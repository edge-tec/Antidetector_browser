# ProfileVault

Professional macOS Browser Profile & Privacy Management Application.

## Features

- **Isolated Browser Profiles** — Each profile runs in its own Chromium instance with separate cookies, storage, cache, and history
- **Privacy Configuration** — Configure user-agent, timezone, language, screen resolution, WebRTC, and more per profile
- **Proxy Management** — HTTP, HTTPS, and SOCKS5 proxy support with connection testing
- **Profile Organization** — Groups, tags, notes, and color-coding for easy management
- **Automation API** — REST API for programmatic profile control (localhost only, token-authenticated)
- **Dark & Light Themes** — Professional macOS-native interface
- **Secure Storage** — Encrypted credentials via macOS Keychain (Electron safeStorage)
- **Process Isolation** — Each browser runs as a separate process with its own data directory

## Tech Stack

- **Electron 33+** — Native macOS integration
- **React 19 + TypeScript** — Modern UI framework
- **Puppeteer Core** — Chromium browser automation
- **SQLite (better-sqlite3)** — Local database with migrations
- **Express.js** — Localhost automation API
- **electron-vite** — Fast build tooling with HMR

## Requirements

- macOS 13+
- Node.js 18+
- Google Chrome or Chromium installed

## Development

```bash
# Install dependencies
npm install

# Start development server (with HMR)
npm run dev

# Build for production
npm run build

# Package macOS DMG
npm run package:mac
```

## Project Structure

```
src/
├── main/              # Electron Main Process
│   ├── database/      # SQLite connection, migrations, repositories
│   ├── browser/       # Chromium launcher, profile manager, process tracker
│   ├── network/       # Proxy management and testing
│   ├── security/      # Encryption, validators, API auth
│   ├── automation/    # Express REST API
│   ├── logging/       # File + database logger
│   └── ipc/           # IPC handlers
├── preload/           # contextBridge API
└── renderer/          # React UI
    ├── styles/        # CSS design system
    ├── types/         # TypeScript interfaces
    └── App.tsx        # Main application
```

## Security

- All credentials encrypted via macOS Keychain
- No plaintext password storage
- API requires Bearer token authentication
- Bound to localhost only
- Input validation prevents path traversal and injection
- Context isolation enabled

## License

MIT
