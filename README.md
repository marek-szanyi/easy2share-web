# easy2share web client

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE.md)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev/)


Web client for **easy2share**: Seamlessly share clipboard content and files from your mobile device. Everything stays local—no cloud relay, no account, and no reused passwords—while remaining secure enough to safely share sensitive information, including passwords

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [Usage](#usage)
- [Protocol](#protocol)
- [Security model](#security-model)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Code of conduct](#code-of-conduct)
- [Security reporting](#security-reporting)
- [License](#license)

## Why this exists

easy2share-web exists because I wanted to share stuff between my phone and workstation(s). I wanted something that would
work out of the box, without cloud, account registration, or client installation. All existing solutions I have found 
either allowed only file sharing or required an account for their cloud service, or security wasn't good enough.

Easy2Share requires no account and no cloud relay. Works on local network, and it allows you to share your phone 
clipboard and files with any device that can run a web browser.... it's also free & open source.

## Features

- Direct mobile-to-device connection
- Authenticated encryption for all data in transit
- QR-based key handoff for fast pairing
- Compact binary protocol frames using **CBOR**
- Clipboard sharing
- File sharing — files arrive in chunks and become downloadable as they complete


## Usage

1. Open the mobile easy2share app and note the address it shows.
2. Enter that address in easy2share-web and press **CONNECT**.
3. Scan the generated QR code with the mobile app; it contains the session key.
4. Press **CONTINUE** to finish the encrypted handshake.
5. Exchange clipboard content in the shared workspace, and download files pushed from the phone in **Shared Files**.
6. Reset by clicking the `easy2share` title to close the connection and clear the session key.


## Protocol

Every WebSocket frame is a CBOR `EncryptedMessage` whose payload is `ciphertext || tag || nonce`,
encrypted with ChaCha20-Poly1305 under the session key. Decrypting a frame yields another CBOR
message, routed by its shape:

| Message | Distinguished by | Purpose |
|---|---|---|
| Handshake response | `isOk` | Result of client registration |
| Clipboard push | `clipboard` | Text copied on the phone |
| `fileTransferStart` | `type` | Announces `fileName`, `mimeType`, `fileSize`, `chunkCount` |
| `fileChunk` | `type` | One 128 KB slice, carrying `chunkIndex` |
| `fileTransferEnd` | `type` | Marks the transfer complete or failed |

Each chunk is a frame of its own, encrypted with a fresh nonce. `createFileTransferCollector()`
in `protocol.js` reassembles the chunks into a `Blob` and reports `started` / `progress` /
`completed` / `failed` events. Because every file transfer message carries a `fileId`, several
files may be in flight over one connection.

## Security model

easy2share-web is designed to reduce credential reuse and unnecessary data transit:

- **Encryption key per session:** a new 256-bit key is generated for each connection.
- **Authenticated encryption:** protocol frames are encrypted and integrity-protected.
- **Different channel for key delivery:** the key is delivered from the browser to the phone via QR code.


> The web client shall always be loaded from a trusted source (HTTPS) and the QR code shall be scanned in person. The session key is never transmitted over the network.

> The official trusted source for the webapp is https://getshared.link 


## Getting started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
npm install
```

### Run in development

```bash
npm run dev
```

Then open the local URL printed by Vite.

### Production build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build production assets |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `node --test test/protocol.test.mjs` | Run protocol contract tests |

## Project structure

```text
src/
  App.jsx            # Main UI and connection flow
  App.css            # App-specific styling
  AboutScreen.jsx    # Tutorial + security guidance screen
  index.css          # Global styles and font setup
  main.jsx           # React entry point
  protocol.js        # Key generation, frame encrypt/decrypt, register frame, file chunk reassembly
test/
  protocol.test.mjs  # End-to-end protocol contract tests
public/
  favicon.svg
LICENSE.md
README.md
```

## Testing

The repository includes protocol coverage that validates the CBOR envelope format, base64 encoding, a mock WebSocket round trip, and file transfer reassembly (including interleaved and aborted transfers).

Run the tests with:

```bash
node --test test/protocol.test.mjs
```

For broader verification, run:

```bash
npm run lint
npm run build
```

## Roadmap

- [ ] Add stronger protocol/session observability in the interface
- [ ] Add a CI workflow for lint + tests
- [x] Add the shared file transfer flow to the web UI


## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make changes with clear commit messages.
4. Run lint and tests locally.
5. Open a pull request with context and rationale.

If you add new behavior, include tests where practical and keep the protocol contract consistent.

## Code of conduct

Please keep discussions respectful, constructive, and inclusive. Harassment and abusive behavior are not acceptable.

## Security reporting

If you discover a security issue, please report it privately:

- Email: [marek@memdump.sk](mailto:marek@memdump.sk)

Please avoid opening public issues for vulnerabilities until a fix is available.

## License

Distributed under the MIT License. See [LICENSE.md](./LICENSE.md).
