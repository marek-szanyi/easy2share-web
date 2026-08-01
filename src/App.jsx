import {useEffect, useRef, useState} from 'react'
import QRCode from 'qrcode'
import {bytesToBase64, decryptFrame, encodeRegisterFrame, generateKeyBytes} from './protocol.js'
import './App.css'

const SESSION_KEY = 'easy2share.chacha20-poly1305.key.v1'
const CLIENT_NAME = 'easy2share-web'

function getWebSocketUrl(address) {
  const trimmedAddress = address.trim()
  const hasProtocol = /^(?:https?|wss?):\/\//i.test(trimmedAddress)
  const url = new URL(hasProtocol ? trimmedAddress : `ws://${trimmedAddress}`)

  url.protocol = 'ws:'
  url.port = '8080'
  url.pathname = '/notify'
  url.search = ''
  url.hash = ''

  return url.toString()
}


function App() {
  const dialogRef = useRef(null)
  const mobileAddressInputRef = useRef(null)
  const socketRef = useRef(null)
  const keyBytesRef = useRef(null)
  const [mobileAddress, setMobileAddress] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [error, setError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('idle')

  useEffect(() => () => {
    const socket = socketRef.current
    socketRef.current = null
    socket?.close()
  }, [])

  async function handleConnect() {
    if (!mobileAddress.trim()) return

    setError('')
    setIsGenerating(true)

    try {
      const keyBytes = generateKeyBytes()
      const key = bytesToBase64(keyBytes)
      const qrDataUrl = await QRCode.toDataURL(key, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#111111',
          light: '#fffdf5',
        },
      })

      keyBytesRef.current = keyBytes
      sessionStorage.setItem(SESSION_KEY, key)
      setQrCode(qrDataUrl)
      dialogRef.current?.showModal()
    } catch {
      setError('COULD NOT GENERATE A SECURE KEY. TRY AGAIN.')
    } finally {
      setIsGenerating(false)
    }
  }

  function handleContinue() {
    if (connectionStatus === 'connecting') return

    setError('')
    setConnectionStatus('connecting')

    const keyBytes = keyBytesRef.current
    if (!keyBytes) {
      setConnectionStatus('idle')
      setError('ENCRYPTION KEY MISSING. GENERATE A NEW ONE.')
      return
    }

    try {
      const socket = new WebSocket(getWebSocketUrl(mobileAddress))
      socket.binaryType = 'arraybuffer'
      socketRef.current = socket
      let hasConnected = false
      let handshakeFailed = false

      socket.addEventListener('open', () => {
        if (socketRef.current !== socket) return

        socket.send(encodeRegisterFrame(keyBytes, CLIENT_NAME))
      })

      socket.addEventListener('message', (event) => {
        if (socketRef.current !== socket || hasConnected) return

        try {
          const response = decryptFrame(keyBytes, new Uint8Array(event.data))
          if (response?.isOk === true) {
            hasConnected = true
            setConnectionStatus('connected')
            dialogRef.current?.close()
          } else {
            handshakeFailed = true
            setError(`MOBILE DEVICE REJECTED THE CONNECTION${response?.message ? `: ${String(response.message).toUpperCase()}` : '.'}`)
            socket.close()
          }
        } catch {
          handshakeFailed = true
          setError('COULD NOT DECRYPT SERVER RESPONSE. CHECK THE KEY AND TRY AGAIN.')
          socket.close()
        }
      })

      socket.addEventListener('close', () => {
        if (socketRef.current !== socket) return

        socketRef.current = null
        if (hasConnected) {
          setConnectionStatus('idle')
          setError('CONNECTION TO MOBILE DEVICE CLOSED.')
        } else {
          setConnectionStatus('idle')
          if (!handshakeFailed) {
            setError('COULD NOT CONNECT TO MOBILE DEVICE. TRY AGAIN.')
          }
        }
      })

      socket.addEventListener('error', () => {
        if (socketRef.current === socket && !hasConnected) {
          socket.close()
        }
      })
    } catch {
      socketRef.current = null
      setConnectionStatus('idle')
      setError('ENTER A VALID WEBSOCKET ADDRESS.')
    }
  }

  function handleCancel() {
    setError('')
    setConnectionStatus('idle')
    dialogRef.current?.close()
    requestAnimationFrame(() => mobileAddressInputRef.current?.focus())
  }

  return (
    <main className="share-page">
      <section
        className={`share-panel${connectionStatus === 'connected' ? ' share-panel--connected' : ''}`}
        aria-labelledby="page-title"
      >
        <h1 id="page-title">easy2share</h1>

        {connectionStatus === 'connected' ? (
          <div className="sharing-workspace">
            <section className="clipboard-panel" aria-labelledby="clipboard-title">
              <h2 id="clipboard-title">Clipboard</h2>
              <textarea
                aria-label="Shared clipboard"
                placeholder="TYPE OR PASTE TEXT HERE…"
              />
            </section>

            <section className="files-panel" aria-labelledby="shared-files-title">
              <h2 id="shared-files-title">Shared Files</h2>
              <ul className="shared-file-list">
                <li className="empty-file-list">NO FILES SHARED YET</li>
              </ul>
            </section>
          </div>
        ) : (
          <div className="connection-form">
            <label className="visually-hidden" htmlFor="mobile-address">
              Mobile address
            </label>
            <input
              ref={mobileAddressInputRef}
              id="mobile-address"
              name="mobile-address"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="ENTER MOBILE ADDRESS"
              value={mobileAddress}
              onChange={(event) => setMobileAddress(event.target.value)}
              required
            />
            <button
              type="button"
              onClick={handleConnect}
              disabled={isGenerating || !mobileAddress.trim()}
              aria-busy={isGenerating}
            >
              {isGenerating ? 'GENERATING…' : 'CONNECT'}
            </button>
          </div>
        )}

        {error && !qrCode && <p className="error-message" role="alert">{error}</p>}
      </section>

      <dialog
        ref={dialogRef}
        className="key-dialog"
        aria-labelledby="key-dialog-title"
        onCancel={(event) => event.preventDefault()}
        onClose={() => setQrCode('')}
      >
        <h2 id="key-dialog-title">YOUR ENCRYPTION KEY</h2>
        {qrCode && (
          <img
            src={qrCode}
            alt="QR code containing the ChaCha20-Poly1305 encryption key"
            width="320"
            height="320"
          />
        )}
        {error && qrCode && connectionStatus !== 'connected' && (
          <p className="dialog-error" role="alert">{error}</p>
        )}
        <div className="dialog-actions">
          {error && qrCode && connectionStatus === 'idle' && (
            <button
              className="cancel-button"
              type="button"
              onClick={handleCancel}
            >
              CANCEL
            </button>
          )}
          <button
            type="button"
            onClick={handleContinue}
            disabled={connectionStatus === 'connecting'}
            aria-busy={connectionStatus === 'connecting'}
          >
            {connectionStatus === 'connecting' ? 'CONNECTING…' : 'CONTINUE'}
          </button>
        </div>
      </dialog>
    </main>
  )
}

export default App
