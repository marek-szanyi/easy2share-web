// Copyright (c) Marek Szanyi. See LICENSE.md.

export function AboutScreen() {
    return (<article className="about-screen" aria-labelledby="about-title">
        <header className="about-intro">
            <p className="section-kicker">ABOUT</p>
            <h2 id="about-title">easy. <br/> direct. secure.<br/> sharing</h2>
            <p>
                With any device capable of running a web browser.
            </p>
            <p className="answer-summary">
                easy2share lets you securely copy your phone clipboard to a desktop browser and send files directly over
                a local encrypted session—without cloud storage, accounts, or a relay service.
            </p>
        </header>

        <section className="about-section" aria-labelledby="tutorial-title">
            <h3 id="tutorial-title">How to use</h3>
            <ol className="tutorial-steps">
                <li>
                    <strong>Open the mobile app.</strong>
                    <span>Note the (IP) address shown by the app.</span>
                </li>
                <li className="tutorial-step-web">
                    <strong>Load the client</strong>
                    <span>Load the web app. client from a trusted source.</span>
                    <span>The official trusted source is <a className="about-link outfit-content-title" href="https://getsharing.link">getsharing.link</a></span>
                </li>
                <li className="tutorial-step-web">
                    <strong>Create a secure session.</strong>
                    <span>Select CONNECT. Each time a new session key is generated and displayed as a QR code.</span>
                </li>
                <li>
                    <strong>Scan the QR code.</strong>
                    <span>Use the mobile app to scan the QR code. Start accepting connections from other devices by selecting START SHARING.</span>
                </li>
                <li className="tutorial-step-web">
                    <strong>Establish Connection</strong>
                    <span>Select CONTINUE and wait for the mobile device to approve the encrypted connection.</span>
                </li>
                <li>
                    <strong>Share clipboard</strong>
                    <span>In the mobile app select "Share Clipboard". It will copy the phone clipboard content to the webapp.</span>
                </li>
                <li className="tutorial-step-web">
                    <strong>End the session.</strong>
                    <span>Select the easy2share title to disconnect, erase the session key, and return to a clean start.</span>
                </li>
            </ol>
        </section>

        <section className="about-section" aria-labelledby="security-title">
            <h3 id="security-title">Is it Safe?</h3>
            <p className="section-summary">
                Absolutely! You can share any sensitive data from your Phone to your other device(s). Here are a few things that together
                ensure the safety of your data.
            </p>
            <div className="security-grid">
                <article>
                    <span aria-hidden="true">01</span>
                    <h4>Trusted Source</h4>
                    <p>The web app. must be loaded from a trusted source such as <a className="about-link outfit-content-title" href="https://getsharing.link">getsharing.link</a> </p>
                </article>
                <article>
                    <span aria-hidden="true">02</span>
                    <h4>Direct Link</h4>
                    <p>The web app. runs in your browser and it directly connects to your mobile phone. There is no other service involved in data transfer. </p>
                </article>
                <article>
                    <span aria-hidden="true">03</span>
                    <h4>Authenticated encryption</h4>
                    <p>All data in transit is encrypted using ChaCha20-Poly1305. Together with controls <span className="article-ref">01</span> and <span className="article-ref">04</span>, this makes the solution resistant to man-in-the-middle attacks.</p>
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
                <h4 id="security-note-title">Warning!</h4>
                <p>
                    Do not share the QR code with anyone and ensure that no one can photograph it while you are scanning it..
                </p>
            </aside>
        </section>

        <section className="about-section faq-section" aria-labelledby="faq-title">
            <h3 id="faq-title">Frequently asked questions</h3>
            <div className="faq-list">
                <article className="faq-item">
                    <h4>What is easy2share?</h4>
                    <p>easy2share is a secure local clipboard and file-sharing tool that connects a phone to a browser
                        on another device without a cloud relay.</p>
                </article>
                <article className="faq-item">
                    <h4>How does easy2share share data securely?</h4>
                    <p>It creates a fresh key for each session, displays it as a QR code, and lets the phone scan it
                        locally. The connection then uses authenticated encryption for clipboard and file transfer
                        payloads.</p>
                </article>
                <article className="faq-item">
                    <h4>Does easy2share store my clipboard or files?</h4>
                    <p>No. The browser keeps the session key in session storage only, and the direct connection stays
                        local between the participating devices. Data is not sent to a central server.</p>
                </article>
                <article className="faq-item">
                    <h4>Can I use easy2share for files as well as text?</h4>
                    <p>Yes. After the encrypted session is live, the mobile app can send clipboard text and files to the
                        browser, where they are reassembled and downloaded as completed transfers.</p>
                </article>
            </div>
        </section>
    </article>)
}