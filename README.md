# LLM Chat Interface

A minimal, clean Progressive Web App (PWA) for chatting with AI models via the Kai LLM server.

## Features

- 💬 Real-time chat with AI models
- 📱 Progressive Web App - install to home screen
- 💾 Conversation history persists locally
- 🌓 Dark mode support
- 📡 SSE streaming responses
- 🔒 Privacy-focused - all data stored locally
- ⚡ Zero build step - vanilla JavaScript

## Quick Start

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari)
- Kai LLM server running at `http://eanserver:9000`

### Local Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd llmchat
   ```

2. Install dependencies (for testing only):
   ```bash
   npm install
   ```

3. Start local server:
   ```bash
   npm start
   # OR
   python3 -m http.server 8000 --directory public
   # OR use VS Code Live Server
   ```

4. Open `http://localhost:8000` in your browser

### Testing

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Deployment

Deploys automatically to GitHub Pages via GitHub Actions on push to main branch.

See [quickstart.md](specs/001-llm-chat-interface/quickstart.md) for detailed setup instructions.

## Project Structure

```
llmchat/
├── public/               # Static assets served directly
│   ├── index.html       # Main HTML file
│   ├── manifest.json    # PWA manifest
│   ├── sw.js            # Service Worker
│   ├── assets/          # CSS, images
│   └── icons/           # PWA icons
├── src/                 # JavaScript modules
│   ├── core/            # Core infrastructure (storage, state, API)
│   ├── models/          # Data models (Conversation, Message, Settings)
│   ├── ui/              # UI components
│   └── utils/           # Helper utilities
├── tests/               # Test files
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── e2e/             # End-to-end tests
└── specs/               # Feature specifications
```

## Tech Stack

- **Language**: Vanilla JavaScript ES2020+
- **Storage**: IndexedDB for conversations, LocalStorage for settings
- **Markdown**: marked.js (5KB gzipped)
- **Code Highlighting**: highlight.js (10KB gzipped)
- **Testing**: Jest (unit), Playwright (E2E)
- **Deployment**: GitHub Actions → GitHub Pages

## User Stories

1. **Basic Chat** (P1) - Send messages and receive AI responses
2. **Conversation History** (P2) - View and persist conversation history
3. **Multiple Conversations** (P2) - Create and switch between conversations
4. **Edit/Delete** (P3) - Rename/delete conversations
5. **Regenerate/Edit** (P3) - Regenerate responses, edit messages
6. **Streaming** (P2) - Real-time word-by-word responses

## Configuration

Configure API endpoint and preferences in Settings panel:

- **API Endpoint**: Kai server URL (default: `http://eanserver:9000`)
- **Model**: AI model selection
- **Theme**: Light/Dark/Auto
- **Streaming**: Enable/disable streaming responses
- **Auto-scroll**: Keep newest messages visible

## Privacy

All data is stored locally in your browser:
- Conversations and messages: IndexedDB
- Settings and preferences: LocalStorage
- No data sent to external servers except Kai LLM server

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.
