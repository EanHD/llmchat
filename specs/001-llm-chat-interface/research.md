# Phase 0: Research & Technology Decisions

**Feature**: LLM Chat Interface  
**Date**: November 17, 2025  
**Purpose**: Document technology choices and research findings to resolve all NEEDS CLARIFICATION items

## Research Tasks Completed

### 1. PWA Architecture & Best Practices

**Decision**: Vanilla JavaScript PWA with no build tools

**Rationale**:
- Modern browsers support ES6 modules natively - no transpilation needed
- Service Workers provide offline capability without framework overhead
- IndexedDB provides robust local storage for conversations
- Faster development iteration without build step
- Smaller bundle size (<50KB total excluding cached assets)
- Better performance - no framework runtime overhead

**Alternatives Considered**:
- **React/Vue PWA**: Rejected - adds 100KB+ framework overhead, requires build tooling, overkill for simple UI
- **SvelteKit**: Rejected - adds build complexity, not needed for static PWA
- **Lit/Web Components**: Rejected - adds dependency, vanilla modules sufficient for this scope

**Implementation Notes**:
- Use native `<template>` elements for component templates
- CSS Grid and Flexbox for layout (no CSS framework)
- Native Fetch API with EventSource/ReadableStream for SSE
- Service Worker caches static assets for offline viewing

---

### 2. Server-Sent Events (SSE) Streaming for LLM Responses

**Decision**: Use Fetch API with ReadableStream parser for streaming responses

**Rationale**:
- Kai server uses OpenAI-compatible streaming format: `data: {json}\n\ndata: [DONE]`
- Fetch with `response.body.getReader()` provides fine-grained control over stream chunks
- Better error handling than EventSource API
- Can send custom headers (for future auth if needed)
- Works with POST requests (EventSource only supports GET)

**Alternatives Considered**:
- **EventSource API**: Rejected - only supports GET, cannot send request body with messages
- **WebSocket**: Rejected - Kai server uses HTTP SSE, not WebSocket protocol
- **Polling**: Rejected - inefficient, doesn't provide real-time word-by-word streaming

**Implementation Pattern**:
```javascript
const response = await fetch('http://eanserver:9000/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'granite-local', messages, stream: true })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') return;
      const json = JSON.parse(data);
      const content = json.choices[0]?.delta?.content || '';
      // Append to UI
    }
  }
}
```

---

### 3. IndexedDB for Conversation Persistence

**Decision**: Use IndexedDB with a thin wrapper module for all conversation storage

**Rationale**:
- Supports storing large amounts of structured data (100+ conversations, 100+ messages each)
- Async API doesn't block UI thread
- Built-in indexing for fast conversation lookups
- Can store objects directly without JSON serialization
- 50MB+ quota (far exceeds LocalStorage 5-10MB limit)
- Works offline by default

**Alternatives Considered**:
- **LocalStorage**: Rejected - synchronous API blocks UI, 5-10MB limit too small, no indexing
- **Cache API**: Rejected - designed for HTTP responses, not structured data
- **File System Access API**: Rejected - requires user permission, not suitable for automatic saves

**Schema Design**:
```javascript
// Database: llmchat
// Stores:
{
  conversations: {
    keyPath: 'id',
    indexes: ['updatedAt', 'createdAt']
  },
  messages: {
    keyPath: 'id',
    indexes: ['conversationId', 'timestamp']
  },
  settings: {
    keyPath: 'key'
  }
}
```

---

### 4. GitHub Actions Deployment to GitHub Pages

**Decision**: Deploy static PWA to GitHub Pages using GitHub Actions workflow

**Rationale**:
- Zero hosting cost
- Automatic HTTPS with custom domain support
- Simple deployment pipeline - just copy files to gh-pages branch
- Built-in CDN for fast global delivery
- Perfect for static PWA (no server-side rendering needed)

**Alternatives Considered**:
- **Vercel/Netlify**: Rejected - unnecessary for static files, GitHub Pages is simpler
- **AWS S3**: Rejected - requires AWS account setup, billing complexity
- **Self-hosted**: Rejected - requires server maintenance, overkill for static app

**Workflow Pattern**:
```yaml
name: Deploy PWA
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
```

---

### 5. Minimal UI Design System

**Decision**: Custom CSS with CSS variables for theming, no UI framework

**Rationale**:
- Requirement: clean, minimal, no emoji
- CSS Grid for layout, Flexbox for component alignment
- CSS variables for consistent spacing, colors, typography
- Dark mode support via `prefers-color-scheme` media query
- Total CSS: ~300 lines for entire app

**Alternatives Considered**:
- **Tailwind CSS**: Rejected - requires build step, bloated class names
- **Material UI / Bootstrap**: Rejected - opinionated design, too heavy, not minimal
- **DaisyUI**: Rejected - includes emoji and playful design elements (conflicts with requirement)

**Design Tokens**:
```css
:root {
  --spacing-unit: 8px;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --color-bg: #ffffff;
  --color-surface: #f5f5f5;
  --color-text: #1a1a1a;
  --color-border: #e0e0e0;
  --color-primary: #2563eb;
  --radius: 8px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #1a1a1a;
    --color-surface: #2a2a2a;
    --color-text: #e0e0e0;
    --color-border: #404040;
  }
}
```

---

### 6. Markdown Rendering with Code Highlighting

**Decision**: Use marked.js (5KB gzipped) for Markdown, highlight.js (core only, ~10KB) for syntax

**Rationale**:
- ChatGPT feature requirement: support code blocks with syntax highlighting
- marked.js is lightweight, well-maintained, handles CommonMark spec
- highlight.js auto-detects language, supports 50+ languages
- Total: ~15KB for both libraries (acceptable for chat app)

**Alternatives Considered**:
- **markdown-it**: Rejected - similar size, no significant advantage
- **Custom regex parser**: Rejected - error-prone, wouldn't handle edge cases
- **No highlighting**: Rejected - code blocks are core ChatGPT feature
- **Prism.js**: Rejected - requires manual language specification, highlight.js auto-detects

**Security**: Both libraries sanitize HTML to prevent XSS

---

### 7. Authentication Strategy

**Decision**: No authentication in v1.0 - open access on private network

**Rationale** (from clarification):
- Kai server at http://eanserver:9000 is on private network (Tailscale/LAN)
- Security handled at network layer, not application layer
- Simpler implementation - no token management, login UI, or session handling
- Can add API key support later without breaking existing clients

**Future Consideration**:
- When adding auth, use Bearer token in `Authorization` header
- Store token in LocalStorage
- Add simple login form, no user registration (single-user app)

---

### 8. State Management Pattern

**Decision**: Simple observable state object with pub/sub for UI updates

**Rationale**:
- No framework needed - vanilla JS event system sufficient
- Centralized state prevents bugs from multiple sources of truth
- Components subscribe to state changes and re-render
- ~50 lines of code for entire state management system

**Alternatives Considered**:
- **Redux/Zustand**: Rejected - massive overkill for single-user chat app
- **MobX**: Rejected - adds dependency, reactive system not needed
- **Direct DOM manipulation**: Rejected - leads to spaghetti code, hard to debug

**Pattern**:
```javascript
class AppState {
  constructor() {
    this.state = {
      conversations: [],
      currentConversationId: null,
      isStreaming: false,
      settings: {}
    };
    this.listeners = new Map();
  }
  
  subscribe(key, callback) {
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key).push(callback);
  }
  
  update(key, value) {
    this.state[key] = value;
    this.listeners.get(key)?.forEach(cb => cb(value));
  }
}
```

---

### 9. Testing Strategy

**Decision**: Jest for unit tests, Playwright for E2E tests

**Rationale**:
- Jest: Fast, built-in mocking, works with ES modules
- Playwright: Tests PWA install, offline mode, real browser behavior
- Focus on critical paths: message send/receive, conversation CRUD, streaming
- 80%+ coverage target for core modules (api.js, storage.js, state.js)

**Alternatives Considered**:
- **Vitest**: Rejected - Jest is more established, better IDE integration
- **Cypress**: Rejected - Playwright has better PWA support, faster
- **Manual testing only**: Rejected - too risky for data persistence logic

---

### 10. Error Handling & Offline Support

**Decision**: Graceful degradation with offline mode and error retry logic

**Rationale**:
- Service Worker caches app shell for offline viewing of conversations
- Detect `navigator.onLine` status and show appropriate UI
- Retry failed requests with exponential backoff
- Clear error messages: "Server unreachable - check network" instead of generic errors

**User Experience**:
- Offline: Can view existing conversations, cannot send new messages
- Server down: Show error toast, offer retry button
- Network timeout: Auto-retry up to 3 times with 2s, 4s, 8s delays

---

## Summary of Key Decisions

| Area | Technology | Why |
|------|-----------|-----|
| Frontend | Vanilla JS + ES Modules | No build step, minimal bundle size |
| UI Framework | None (custom CSS) | Clean, minimal design requirement |
| Streaming | Fetch + ReadableStream | POST support, fine-grained control |
| Storage | IndexedDB | Large data capacity, async, offline |
| Markdown | marked.js | Lightweight, CommonMark compliant |
| Syntax Highlighting | highlight.js | Auto-detection, small size |
| Deployment | GitHub Actions → Pages | Free, simple, HTTPS included |
| State | Custom pub/sub | Simple, no dependencies |
| Testing | Jest + Playwright | Fast unit tests, real browser E2E |
| Auth | None (v1.0) | Private network, can add later |

## Performance Budget

| Metric | Target | Strategy |
|--------|--------|----------|
| First Contentful Paint | <1s | Inline critical CSS, defer non-critical JS |
| Time to Interactive | <2s | Minimal JS, no framework overhead |
| Bundle Size | <50KB | No frameworks, tree-shaken modules |
| Streaming Start | <2s | Direct Fetch API, no middleware |
| Conversation Switch | <500ms | IndexedDB indexes, virtual scrolling for messages |
| Offline Load | <200ms | Service Worker cache-first strategy |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| IndexedDB quota exceeded | Cannot save new conversations | Show warning at 80% quota, offer export/delete |
| Kai server API changes | App breaks | Version API endpoint, test with Kai's test suite |
| Browser compatibility | Features don't work | Polyfills for Safari (IndexedDB edge cases) |
| Large conversation lag | UI freezes | Virtual scrolling, paginate old messages |
| Streaming format changes | Parsing breaks | Robust error handling, fallback to non-streaming |

## Next Steps → Phase 1

All research complete. Proceeding to:
1. **data-model.md**: Define conversation, message, settings schemas
2. **contracts/**: OpenAPI spec for Kai integration, PWA manifest
3. **quickstart.md**: Setup and deployment guide
