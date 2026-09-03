// Copyright (c) Marek Szanyi. See LICENSE.md.
import {chacha20poly1305} from '@noble/ciphers/chacha.js'
import {Encoder} from 'cbor-x'

const NONCE_LENGTH = 12
const TAG_LENGTH = 16

// Definite-length, string-keyed maps and raw byte strings (major type 2) to
// match kotlinx.serialization CBOR on the Android server.
const cbor = new Encoder({useRecords: false, tagUint8Array: false, mapsAsObjects: true, variableMapSize: true})

export function generateKeyBytes() {
    return crypto.getRandomValues(new Uint8Array(32))
}

// Standard base64 WITH padding (the phone decodes it with Kotlin Base64.decode).
export function bytesToBase64(bytes) {
    if (typeof bytes.toBase64 === 'function') {
        return bytes.toBase64()
    }
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
}

function randomNonce() {
    return crypto.getRandomValues(new Uint8Array(NONCE_LENGTH))
}

// plaintext -> CBOR EncryptedMessage frame { data: ciphertext||tag||nonce }
export function encryptFrame(keyBytes, innerMessage) {
    const plaintext = cbor.encode(innerMessage)
    const nonce = randomNonce()
    const ciphertextWithTag = chacha20poly1305(keyBytes, nonce).encrypt(plaintext)
    const data = new Uint8Array(ciphertextWithTag.length + NONCE_LENGTH)
    data.set(ciphertextWithTag, 0)
    data.set(nonce, ciphertextWithTag.length)
    return cbor.encode({data})
}

// CBOR EncryptedMessage frame -> decoded inner message
export function decryptFrame(keyBytes, frameBytes) {
    const envelope = cbor.decode(frameBytes instanceof Uint8Array ? frameBytes : new Uint8Array(frameBytes))
    const data = envelope?.data
    if (!(data instanceof Uint8Array) || data.length < NONCE_LENGTH + TAG_LENGTH) {
        throw new Error('Malformed encrypted envelope')
    }
    const nonce = data.subarray(data.length - NONCE_LENGTH)
    const ciphertextWithTag = data.subarray(0, data.length - NONCE_LENGTH)
    const plaintext = chacha20poly1305(keyBytes, nonce).decrypt(ciphertextWithTag)
    return cbor.decode(plaintext)
}

export function encodeRegisterFrame(keyBytes, clientName) {
    return encryptFrame(keyBytes, {clientName})
}

// Discriminators of the push-based file transfer messages. Clipboard and
// handshake frames are still recognised by their shape (`clipboard` / `isOk`).
export const FILE_TRANSFER_TYPES = {
    START: 'fileTransferStart',
    CHUNK: 'fileChunk',
    END: 'fileTransferEnd',
}

function toBytes(value) {
    if (value instanceof Uint8Array) return value
    if (value instanceof ArrayBuffer) return new Uint8Array(value)
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    return null
}

/**
 * Reassembles the chunked file transfers pushed by the phone.
 *
 * Feed every decrypted inner message to `handle`; it returns `null` for
 * messages that are not part of a transfer, and a progress/result object
 * otherwise. Chunks are buffered per file id so several transfers may
 * interleave on the same socket.
 */
export function createFileTransferCollector() {
    const transfers = new Map()

    function handleStart(message) {
        const transfer = {
            fileId: message.fileId,
            fileName: message.fileName || 'shared-file',
            mimeType: message.mimeType || 'application/octet-stream',
            fileSize: Number(message.fileSize ?? -1),
            chunkCount: Number(message.chunkCount ?? -1),
            chunks: [],
            receivedBytes: 0,
        }
        transfers.set(transfer.fileId, transfer)
        return {
            status: 'started',
            fileId: transfer.fileId,
            fileName: transfer.fileName,
            mimeType: transfer.mimeType,
            fileSize: transfer.fileSize,
            receivedBytes: 0,
        }
    }

    function handleChunk(message) {
        const transfer = transfers.get(message.fileId)
        const chunk = toBytes(message.data)
        if (!transfer || !chunk) return null

        transfer.chunks.push(chunk)
        transfer.receivedBytes += chunk.length
        return {
            status: 'progress',
            fileId: transfer.fileId,
            fileName: transfer.fileName,
            fileSize: transfer.fileSize,
            receivedBytes: transfer.receivedBytes,
        }
    }

    function handleEnd(message) {
        const transfer = transfers.get(message.fileId)
        if (!transfer) return null
        transfers.delete(transfer.fileId)

        if (message.isComplete === false) {
            return {
                status: 'failed',
                fileId: transfer.fileId,
                fileName: transfer.fileName,
                error: message.error || 'Transfer interrupted',
            }
        }

        return {
            status: 'completed',
            fileId: transfer.fileId,
            fileName: transfer.fileName,
            mimeType: transfer.mimeType,
            size: transfer.receivedBytes,
            blob: new Blob(transfer.chunks, {type: transfer.mimeType}),
        }
    }

    return {
        handle(message) {
            if (!message || typeof message.type !== 'string' || typeof message.fileId !== 'string') return null

            switch (message.type) {
                case FILE_TRANSFER_TYPES.START:
                    return handleStart(message)
                case FILE_TRANSFER_TYPES.CHUNK:
                    return handleChunk(message)
                case FILE_TRANSFER_TYPES.END:
                    return handleEnd(message)
                default:
                    return null
            }
        },
        // Drops everything buffered so a dead connection cannot leak memory.
        reset() {
            transfers.clear()
        },
    }
}
