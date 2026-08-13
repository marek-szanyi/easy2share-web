// Copyright (c) Marek Szanyi. See LICENSE.md.

export function PrivacyPolicyScreen() {
    return (<article className="privacy-policy-screen" aria-labelledby="privacy-policy-title">
        <p className="section-kicker">LEGAL</p>
        <h2 id="privacy-policy-title">Privacy Policy</h2>
        <div className="privacy-policy-content">
            <p>
                The mobile application or its web client, available from <a href="https://www.getsharing.link">getsharing.link</a>, does not collect or
                store personal data.
            </p>
            <p>
                If you installed the mobile application from Google Play, then Google Play does collect some
                personal data. Please see the privacy policy for Google Play Services here:{' '}
                <a href="https://policies.google.com/privacy">https://policies.google.com/privacy</a>
            </p>
        </div>
    </article>)
}

