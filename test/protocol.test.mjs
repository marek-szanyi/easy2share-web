// Copyright (c) Marek Szanyi. See LICENSE.md.
// Mock Android server + end-to-end round-trip test for the ws + ChaCha20-Poly1305 contract.
// Run: node --test test/protocol.test.mjs
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {WebSocketServer, WebSocket} from 'ws'
import {chacha20poly1305} from '@noble/ciphers/chacha.js'
import {Encoder} from 'cbor-x'
import {randomBytes} from 'node:crypto'
import {encodeRegisterFrame, decryptFrame, bytesToBase64, createFileTransferCollector, FILE_TRANSFER_TYPES} from '../src/protocol.js'

const cbor = new Encoder({useRecords: false, tagUint8Array: false, mapsAsObjects: true, variableMapSize: true})

// --- Server side of the contract, implemented independently of src/protocol.js ---
function serverDecrypt(key, frame) {
    const envelope = cbor.decode(new Uint8Array(frame))
    const data = new Uint8Array(envelope.data)
    const nonce = data.subarray(data.length - 12) // nonce is the LAST 12 bytes
    const ciphertextWithTag = data.subarray(0, data.length - 12)
    return cbor.decode(chacha20poly1305(key, nonce).decrypt(ciphertextWithTag))
}

function serverEncrypt(key, message) {
    const plaintext = cbor.encode(message)
    const nonce = new Uint8Array(randomBytes(12))
    const ct = chacha20poly1305(key, nonce).encrypt(plaintext)
    const data = new Uint8Array(ct.length + 12)
    data.set(ct, 0)
    data.set(nonce, ct.length)
    return cbor.encode({data})
}

function startMockServer(key) {
    const wss = new WebSocketServer({port: 0, path: '/notify'})
    wss.on('connection', (ws) => {
        ws.on('message', (frame, isBinary) => {
            try {
                assert.ok(isBinary, 'frame must be binary')
                const register = serverDecrypt(key, frame)
                assert.equal(typeof register.clientName, 'string')
                ws.send(serverEncrypt(key, {isOk: true, message: `welcome ${register.clientName}`, code: 201}))
            } catch {
                ws.close(1008, 'bad frame')
            }
        })
    })
    return wss
}

test('CBOR envelope has definite-length string-keyed map and byte string data', () => {
    const key = new Uint8Array(randomBytes(32))
    const frame = encodeRegisterFrame(key, 'easy2share-web')
    const bytes = new Uint8Array(frame)
    assert.equal(bytes[0], 0xa1, 'definite-length map with 1 entry')
    assert.equal(bytes[1], 0x64, 'text string of length 4 ("data")')
    assert.equal(new TextDecoder().decode(bytes.subarray(2, 6)), 'data')
    assert.equal(bytes[6] >> 5, 2, 'value is a CBOR byte string (major type 2)')
})

test('base64 fallback matches Node base64 and uses standard alphabet with padding', () => {
    const bytes = new Uint8Array(randomBytes(32))
    const b64 = bytesToBase64(bytes)
    assert.equal(b64, Buffer.from(bytes).toString('base64'))
    assert.equal(Buffer.from(b64, 'base64').length, 32)
})

test('register -> welcome round trip against mock server', async () => {
    const key = new Uint8Array(randomBytes(32))
    const wss = startMockServer(key)
    const port = wss.address().port

    const response = await new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/notify`)
        ws.binaryType = 'arraybuffer'
        ws.on('open', () => ws.send(encodeRegisterFrame(key, 'easy2share-web')))
        ws.on('message', (data) => {
            try {
                resolve(decryptFrame(key, new Uint8Array(data)))
            } catch (err) {
                reject(err)
            } finally {
                ws.close()
            }
        })
        ws.on('error', reject)
        ws.on('close', (code, reason) => reject(new Error(`closed early: ${code} ${reason}`)))
    })

    assert.equal(response.isOk, true)
    assert.equal(response.code, 201)
    assert.match(response.message, /welcome easy2share-web/)
    wss.close()
})

test('wrong key fails to decrypt (no fake success)', async () => {
    const serverKey = new Uint8Array(randomBytes(32))
    const wrongKey = new Uint8Array(randomBytes(32))
    const frame = encodeRegisterFrame(serverKey, 'easy2share-web')
    const welcome = serverEncrypt(serverKey, {isOk: true, message: 'welcome', code: 201})
    assert.throws(() => decryptFrame(wrongKey, new Uint8Array(welcome)))
    assert.throws(() => serverDecrypt(wrongKey, frame))
})

// --- File transfer: the phone pushes start / chunk* / end, each in its own encrypted frame ---
const CHUNK_SIZE = 128 * 1024

function serverFileFrames(key, {fileId, fileName, mimeType, content, isComplete = true, error = null}) {
    const chunkCount = Math.ceil(content.length / CHUNK_SIZE)
    const frames = [serverEncrypt(key, {
        fileId,
        fileName,
        mimeType,
        fileSize: content.length,
        chunkCount,
        type: FILE_TRANSFER_TYPES.START,
    })]

    for (let index = 0; index < chunkCount; index++) {
        frames.push(serverEncrypt(key, {
            fileId,
            chunkIndex: index,
            data: content.subarray(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
            type: FILE_TRANSFER_TYPES.CHUNK,
        }))
    }

    frames.push(serverEncrypt(key, {fileId, isComplete, error, type: FILE_TRANSFER_TYPES.END}))
    return frames
}

test('chunked file transfer is decrypted and reassembled byte for byte', async () => {
    const key = new Uint8Array(randomBytes(32))
    const content = new Uint8Array(randomBytes(CHUNK_SIZE * 2 + 517))
    const collector = createFileTransferCollector()

    const events = serverFileFrames(key, {
        fileId: 'file-1',
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
        content,
    }).map((frame) => collector.handle(decryptFrame(key, new Uint8Array(frame))))

    assert.equal(events[0].status, 'started')
    assert.equal(events[0].fileName, 'report.pdf')
    assert.equal(events[0].fileSize, content.length)
    assert.equal(events[1].status, 'progress')
    assert.equal(events[1].receivedBytes, CHUNK_SIZE)

    const completed = events.at(-1)
    assert.equal(completed.status, 'completed')
    assert.equal(completed.mimeType, 'application/pdf')
    assert.equal(completed.size, content.length)
    assert.deepEqual(new Uint8Array(await completed.blob.arrayBuffer()), content)
})

test('interleaved transfers are kept apart and clipboard frames are untouched', () => {
    const key = new Uint8Array(randomBytes(32))
    const first = new Uint8Array(randomBytes(64))
    const second = new Uint8Array(randomBytes(32))
    const collector = createFileTransferCollector()

    const [startA, chunkA, endA] = serverFileFrames(key, {
        fileId: 'a', fileName: 'a.bin', mimeType: 'application/octet-stream', content: first,
    })
    const [startB, chunkB, endB] = serverFileFrames(key, {
        fileId: 'b', fileName: 'b.bin', mimeType: 'application/octet-stream', content: second,
    })
    const clipboard = serverEncrypt(key, {clipboard: 'hello'})

    const decrypt = (frame) => decryptFrame(key, new Uint8Array(frame))
    collector.handle(decrypt(startA))
    collector.handle(decrypt(startB))
    collector.handle(decrypt(chunkA))
    collector.handle(decrypt(chunkB))

    // Clipboard and handshake frames must not be claimed by the collector.
    assert.equal(collector.handle(decrypt(clipboard)), null)
    assert.equal(collector.handle({isOk: true, message: 'welcome', code: 201}), null)

    const completedA = collector.handle(decrypt(endA))
    const completedB = collector.handle(decrypt(endB))
    assert.equal(completedA.size, first.length)
    assert.equal(completedB.size, second.length)
    assert.equal(completedA.fileName, 'a.bin')
    assert.equal(completedB.fileName, 'b.bin')
})

test('an aborted transfer is reported as failed', () => {
    const key = new Uint8Array(randomBytes(32))
    const collector = createFileTransferCollector()
    const frames = serverFileFrames(key, {
        fileId: 'broken',
        fileName: 'huge.iso',
        mimeType: 'application/octet-stream',
        content: new Uint8Array(randomBytes(16)),
        isComplete: false,
        error: 'Could not read the file',
    })

    const events = frames.map((frame) => collector.handle(decryptFrame(key, new Uint8Array(frame))))
    const failure = events.at(-1)
    assert.equal(failure.status, 'failed')
    assert.equal(failure.fileName, 'huge.iso')
    assert.equal(failure.error, 'Could not read the file')

    // A chunk arriving after the transfer ended is ignored instead of leaking.
    assert.equal(collector.handle({type: FILE_TRANSFER_TYPES.CHUNK, fileId: 'broken', data: new Uint8Array(4)}), null)
})
