// Copyright (c) Marek Szanyi. See LICENSE.md.
import {useEffect, useRef, useState} from 'react'
import QRCode from 'qrcode'
import {bytesToBase64, decryptFrame, encodeRegisterFrame, generateKeyBytes} from './protocol.js'
import './App.css'
import {AboutScreen} from "./AboutScreen.jsx";
import {PrivacyPolicyScreen} from './PrivacyPolicyScreen.jsx'
import {MarkGithubIcon} from '@primer/octicons-react'

const SESSION_KEY = 'easy2share.chacha20-poly1305.key.v1'
const CLIENT_NAME = 'easy2share-web'
const CURRENT_YEAR = new Date().getFullYear()
const PRIVACY_POLICY_PATH = '/privacy-policy'

function getInitialScreen() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/'
    return path === PRIVACY_POLICY_PATH || path.startsWith(`${PRIVACY_POLICY_PATH}/`) ? 'privacy-policy' : 'app'
}

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
    const keyGenerationRef = useRef(0)
    const [mobileAddress, setMobileAddress] = useState('')
    const [qrCode, setQrCode] = useState('')
    const [error, setError] = useState('')
    const [clipboardContent, setClipboardContent] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [connectionStatus, setConnectionStatus] = useState('idle')
    const [currentScreen, setCurrentScreen] = useState(getInitialScreen)

    useEffect(() => () => {
        const socket = socketRef.current
        socketRef.current = null
        socket?.close()
    }, [])

    async function handleConnect() {
        if (!mobileAddress.trim()) return

        const generation = ++keyGenerationRef.current
        setError('')
        setIsGenerating(true)
        setClipboardContent('')

        try {
            const keyBytes = generateKeyBytes()
            const key = bytesToBase64(keyBytes)
            const qrDataUrl = await QRCode.toDataURL(key, {
                width: 320, margin: 2, errorCorrectionLevel: 'H', color: {
                    dark: '#111111', light: '#fffdf5',
                },
            })

            if (generation !== keyGenerationRef.current) return

            keyBytesRef.current = keyBytes
            sessionStorage.setItem(SESSION_KEY, key)
            setQrCode(qrDataUrl)
            dialogRef.current?.showModal()
        } catch {
            if (generation === keyGenerationRef.current) {
                setError('COULD NOT GENERATE A SECURE KEY. TRY AGAIN.')
            }
        } finally {
            if (generation === keyGenerationRef.current) {
                setIsGenerating(false)
            }
        }
    }

    function handleContinue() {
        if (connectionStatus === 'connecting') return

        setError('')
        setConnectionStatus('connecting')

        let keyBytes = keyBytesRef.current
        if (!keyBytes) {
            const storedKey = sessionStorage.getItem(SESSION_KEY)
            if (storedKey) {
                const bin = atob(storedKey)
                keyBytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
                keyBytesRef.current = keyBytes
            }
        }
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
                if (socketRef.current !== socket) return

                try {
                    const response = decryptFrame(keyBytes, new Uint8Array(event.data))
                    if (!hasConnected) {
                        if (response?.isOk === true) {
                            hasConnected = true
                            setConnectionStatus('connected')
                            dialogRef.current?.close()
                        } else {
                            handshakeFailed = true
                            setError(`MOBILE DEVICE REJECTED THE CONNECTION${response?.message ? `: ${String(response.message).toUpperCase()}` : '.'}`)
                            socket.close()
                            return
                        }
                    }

                    if (response?.clipboard !== undefined) {
                        setClipboardContent(response.clipboard)
                    }

                } catch {
                    if (hasConnected) return

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

    function handleReset() {
        keyGenerationRef.current += 1
        keyBytesRef.current = null
        sessionStorage.removeItem(SESSION_KEY)

        const socket = socketRef.current
        socketRef.current = null
        socket?.close()

        dialogRef.current?.close()
        setMobileAddress('')
        setQrCode('')
        setError('')
        setClipboardContent('')
        setIsGenerating(false)
        setConnectionStatus('idle')
        setCurrentScreen('app')
        requestAnimationFrame(() => mobileAddressInputRef.current?.focus())
    }

    function handleShowAbout() {
        keyGenerationRef.current += 1
        setIsGenerating(false)
        setCurrentScreen('about')
    }

    function handleBackToApp() {
        setCurrentScreen('app')
        if (connectionStatus !== 'connected') {
            requestAnimationFrame(() => mobileAddressInputRef.current?.focus())
        }
    }


    return (<div className="app-shell">
        <main className="share-page">
            <section
                className={`share-panel${connectionStatus === 'connected' ? ' share-panel--connected' : ''}${currentScreen === 'about' ? ' share-panel--about' : ''}${currentScreen === 'privacy-policy' ? ' share-panel--privacy-policy' : ''}`}
                aria-labelledby="page-title"
            >
                <header className="page-header">
                    <h1 id="page-title" className="outfit-title">
                        {currentScreen === 'privacy-policy' ? 'easy2share' : (
                            <button type="button" onClick={handleReset} aria-label="Reset easy2share">
                                easy2share
                            </button>)}
                    </h1>
                    {currentScreen !== 'privacy-policy' && (<div className="screen-nav-actions">
                        <a
                            className="google-play-link"
                            href="https://play.google.com/store/apps/details?id=com.eaxor.easy2share&pcampaignid=web_share"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Get easy2share on Google Play"
                        >
                            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
                                <path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85A1.5 1.5 0 0 1 3 20.5Zm13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27Zm3.35-4.31c.37.28.59.69.59 1.19 0 .5-.22.9-.57 1.18l-2.29 1.32-2.5-2.5 2.5-2.5 2.27 1.31ZM6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49Z"/>
                            </svg>
                            <span>Get the mobile app from Google Play</span>
                        </a>
                        <button
                            className="screen-nav-button"
                            type="button"
                            onClick={currentScreen === 'about' ? handleBackToApp : handleShowAbout}
                        >
                            {currentScreen === 'about' ? 'BACK TO APP' : 'ABOUT'}
                        </button>
                    </div>)}
                </header>

                {currentScreen === 'privacy-policy' ? (<PrivacyPolicyScreen/>) : currentScreen === 'about' ? (<AboutScreen/>) : connectionStatus === 'connected' ? (
                    <div className="sharing-workspace">
                        <section className="clipboard-panel" aria-labelledby="clipboard-title">
                            <h2 id="clipboard-title">Clipboard</h2>
                            <textarea
                                aria-label="Shared clipboard"
                                placeholder="TYPE OR PASTE TEXT HERE…"
                                value={clipboardContent}
                                onChange={(event) => setClipboardContent(event.target.value)}
                            />
                        </section>

                        <section className="files-panel" aria-labelledby="shared-files-title">
                            <h2 id="shared-files-title">Shared Files</h2>
                            <ul className="shared-file-list">
                                <li className="empty-file-list">NO FILES SHARED YET</li>
                            </ul>
                        </section>
                    </div>) : (<div className="connection-form">
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
                        placeholder="ENTER ADDRESS SHOWN IN THE MOBILE APP"
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
                </div>)}

                {currentScreen === 'app' && error && !qrCode && (
                    <p className="error-message" role="alert">{error}</p>)}
            </section>
        </main>

        <footer className="app-footer">
            <div className="footer-content">
                <p className="footer-copyright outfit-content-title">© {CURRENT_YEAR} Marek Szanyi</p>

                <a
                    className="outfit-content-title"
                    href="https://github.com/marek-szanyi/easy2share-web"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View easy2share on GitHub"
                >
                    <MarkGithubIcon size={24} verticalAlign="middle"/>
                </a>

                <nav className="footer-links outfit-content-title" aria-label="Footer links">
                    Contact:<a className="outfit-content-title" href="mailto:marek@memdump.sk">marek@memdump.sk</a>
                </nav>
            </div>
        </footer>

        <dialog
            ref={dialogRef}
            className="key-dialog"
            aria-labelledby="key-dialog-title"
            onCancel={(event) => event.preventDefault()}
            onClose={() => setQrCode('')}
        >
            <h2 id="key-dialog-title">YOUR ENCRYPTION KEY</h2>
            {qrCode && (<img
                src={qrCode}
                alt="QR code containing the ChaCha20-Poly1305 encryption key"
                width="320"
                height="320"
            />)}
            {error && qrCode && connectionStatus !== 'connected' && (
                <p className="dialog-error" role="alert">{error}</p>)}
            <div className="dialog-actions">
                {error && qrCode && connectionStatus === 'idle' && (<button
                    className="cancel-button"
                    type="button"
                    onClick={handleCancel}
                >
                    CANCEL
                </button>)}
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
    </div>)
}

export default App
