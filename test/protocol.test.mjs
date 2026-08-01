// Mock Android server + end-to-end round-trip test for the ws + ChaCha20-Poly1305 contract.
// Run: node --test test/protocol.test.mjs
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {WebSocketServer, WebSocket} from 'ws'
import {chacha20poly1305} from '@noble/ciphers/chacha.js'
import {Encoder} from 'cbor-x'
import {randomBytes} from 'node:crypto'
import {encodeRegisterFrame, decryptFrame, bytesToBase64} from '../src/protocol.js'

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
