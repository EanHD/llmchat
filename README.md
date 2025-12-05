# Kai Chat

A native-feeling PWA chat interface for the Kai AI backend.

## Features

- 💬 Real-time streaming chat with AI
- 🎤 Voice input (speech-to-text) with smart cleanup
- 🔊 Text-to-speech playback with audio controls
- 📎 File attachments + text context
- 🔐 Password-protected access
- 📱 iOS PWA with proper keyboard/safe-area handling
- 💾 Offline-capable with local conversation storage
- 🌙 Dark mode

## Quick Start

```bash
# Serve locally
python3 -m http.server 8000 --directory public

# Open http://localhost:8000
# Default password: ubuntu
```

## Deployment

Auto-deploys to GitHub Pages via GitHub Actions on push.

**Production URL**: `https://chat.eanhd.com` (via Cloudflare Tunnel)

## Configuration

Open Settings (gear icon) to configure:

| Setting | Description |
|---------|-------------|
| API Endpoint | Kai server URL (default: `https://api.eanhd.com`) |
| Custom Headers | For Cloudflare Access auth |
| Theme | Light / Dark / Auto |
| Streaming | Enable/disable streaming responses |

## Password Protection

Edit `public/src/core/auth.js` to change password:

```bash
# Generate new hash
echo -n 'newpassword' | sha256sum

# Update PASSWORD_HASH in auth.js
```

## Project Structure

```
public/
├── index.html          # Main app
├── app.js              # Entry point
├── sw.js               # Service worker
├── assets/styles.css   # All styles
└── src/
    ├── core/           # Storage, state, auth, API
    ├── ui/             # Chat, sidebar, settings
    └── agent/          # Agent mode (experimental)
```

## Tech Stack

- Vanilla JS (ES2020+)
- IndexedDB (conversations)
- LocalStorage (settings)
- Web Speech API (STT/TTS)
- marked.js + highlight.js

## License

MIT
