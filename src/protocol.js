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
