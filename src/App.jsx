import { useRef, useState } from 'react'
import QRCode from 'qrcode'
import './App.css'

const SESSION_KEY = 'easy2share.chacha20-poly1305.key.v1'

function generateKey() {
  const encoder = new TextEncoder();
  const keyBytes  = encoder.encode("fuck you") // = crypto.getRandomValues(new Uint8Array(32))
  return keyBytes.toBase64()
  // return btoa(String.fromCharCode(...keyBytes))
  //   .replaceAll('+', '-')
  //   .replaceAll('/', '_')
  //   .replace(/=+$/, '')
}

function App() {
  const dialogRef = useRef(null)
  const [mobileAddress, setMobileAddress] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [error, setError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  async function handleConnect() {
    if (!mobileAddress.trim()) return

    setError('')
    setIsGenerating(true)

    try {
      const key = generateKey()
      const qrDataUrl = await QRCode.toDataURL(key, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#111111',
          light: '#fffdf5',
        },
      })

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
    dialogRef.current?.close()
  }

  return (
    <main className="share-page">
      <section className="share-panel" aria-labelledby="page-title">
        <h1 id="page-title">easy2share</h1>

        <div className="connection-form">
          <label className="visually-hidden" htmlFor="mobile-address">
            Mobile address
          </label>
          <input
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

        {error && <p className="error-message" role="alert">{error}</p>}
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
        <button type="button" onClick={handleContinue}>CONTINUE</button>
      </dialog>
    </main>
  )
}

export default App
