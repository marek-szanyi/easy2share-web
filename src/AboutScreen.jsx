// Copyright (c) Marek Szanyi. See LICENSE.md.

export function AboutScreen() {
    return (<article className="about-screen" aria-labelledby="about-title">
        <header className="about-intro">
            <p className="section-kicker">ABOUT</p>
            <h2 id="about-title">Share directly. Keep control.</h2>
            <p>
                easy2share connects this browser directly to your mobile device and
                protects protocol messages with a key created for your session.
            </p>
        </header>

        <section className="about-section" aria-labelledby="tutorial-title">
            <h3 id="tutorial-title">Tutorial</h3>
            <ol className="tutorial-steps">
                <li>
                    <strong>Open the mobile app.</strong>
                    <span>Keep both devices on the same trusted network and note the address shown by the app.</span>
                </li>
                <li>
                    <strong>Enter the address.</strong>
                    <span>Type the mobile app&apos;s address into the field on the easy2share home screen.</span>
                </li>
                <li>
                    <strong>Create a secure session.</strong>
                    <span>Select CONNECT. This browser creates a fresh encryption key and displays it as a QR code.</span>
                </li>
                <li>
                    <strong>Scan the QR code.</strong>
                    <span>Use the mobile app to scan it. Keep the code private because it contains the session key.</span>
                </li>
                <li>
                    <strong>Finish connecting.</strong>
                    <span>Select CONTINUE and wait for the mobile device to approve the encrypted connection.</span>
                </li>
                <li>
                    <strong>Use the shared workspace.</strong>
                    <span>Clipboard text received from your mobile device appears in the Clipboard panel.</span>
                </li>
                <li>
                    <strong>End the session.</strong>
                    <span>Select the easy2share title to disconnect, erase the session key, and return to a clean start.</span>
                </li>
            </ol>
        </section>

        <section className="about-section" aria-labelledby="security-title">
            <h3 id="security-title">Why is easy2share more secure?</h3>
            <p className="section-summary">
                Unlike sharing tools that depend on a reusable password or upload content to a cloud relay,
                easy2share is designed to reduce how far your data and credentials travel.
            </p>
            <div className="security-grid">
                <article>
                    <span aria-hidden="true">01</span>
                    <h4>Direct connection</h4>
                    <p>The web app connects to the address shown by your phone instead of an easy2share cloud
                        account.</p>
                </article>
                <article>
                    <span aria-hidden="true">02</span>
                    <h4>Fresh 256-bit key</h4>
                    <p>A cryptographically random key is generated in your browser for the session—there is no
                        password to reuse.</p>
                </article>
                <article>
                    <span aria-hidden="true">03</span>
                    <h4>Authenticated encryption</h4>
                    <p>ChaCha20-Poly1305 encrypts messages and detects modification before the app accepts them.</p>
                </article>
                <article>
                    <span aria-hidden="true">04</span>
                    <h4>Local QR handoff</h4>
                    <p>The browser turns the key into a QR code locally so you can transfer it directly to the
                        mobile device.</p>
                </article>
                <article>
                    <span aria-hidden="true">05</span>
                    <h4>Session-scoped storage</h4>
                    <p>The key uses browser session storage, and selecting the title explicitly removes it and
                        closes the connection.</p>
                </article>
            </div>
            <aside className="security-note" aria-labelledby="security-note-title">
                <h4 id="security-note-title">Use it safely</h4>
                <p>
                    Message encryption does not replace network security. Use a trusted network, verify the mobile
                    address,
                    do not share the QR code, and reset the app when you finish.
                </p>
            </aside>
        </section>
    </article>)
}