# Quick Start Guide: LLM Chat Interface

**Version**: 1.0.0  
**Last Updated**: November 17, 2025  
**Target Audience**: Developers setting up the PWA locally and deploying to GitHub Pages

---

## Prerequisites

Before you begin, ensure you have:

- **Modern web browser**: Chrome 90+, Firefox 88+, or Safari 14+
- **Git**: For version control
- **GitHub account**: For deployment to GitHub Pages
- **Kai LLM server running**: At `http://eanserver:9000` on your local network
- **Node.js 18+** (optional): For running tests

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/llmchat.git
cd llmchat
```

### 2. Verify Kai Server Connection

Test that your Kai server is accessible:

```bash
curl http://eanserver:9000/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

If this fails, ensure:
- Kai server is running: `cd ~/projects/kai && python -m src.api.main`
- Network allows connections to port 9000
- Hostname `eanserver` resolves (check `/etc/hosts` or use IP address)

### 3. Serve Locally

**Option A: Using Python (simplest)**

```bash
cd public
python3 -m http.server 8080
```

Open browser to: `http://localhost:8080`

**Option B: Using Node.js**

```bash
npx serve public -p 8080
```

Open browser to: `http://localhost:8080`

**Option C: Using VS Code Live Server**

1. Install "Live Server" extension
2. Right-click `public/index.html`
3. Select "Open with Live Server"

### 4. Configure API Endpoint (if needed)

If your Kai server is at a different address:

1. Open the app in browser
2. Click Settings icon
3. Update "API Endpoint" to your server URL
4. Click Save

---

## Running Tests

### Unit Tests (Jest)

```bash
npm install
npm test
```

This runs tests for:
- API client (`src/core/api.js`)
- Storage module (`src/core/storage.js`)
- Data models (`src/models/*.js`)

### E2E Tests (Playwright)

```bash
npm install
npx playwright install
npm run test:e2e
```

This tests:
- PWA installation
- Chat send/receive flow
- Conversation switching
- Offline mode

### Manual Testing Checklist

- [ ] Send a message and receive response
- [ ] Start a new conversation
- [ ] Switch between conversations
- [ ] Rename a conversation
- [ ] Delete a conversation
- [ ] Test streaming (watch words appear in real-time)
- [ ] Click "Stop" during streaming
- [ ] Test offline mode (disconnect network, reload app)
- [ ] Install PWA (click "Add to Home Screen" in browser)
- [ ] Test dark mode (OS setting or Settings panel)

---

## Deployment to GitHub Pages

### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Source: Select "GitHub Actions"

### 2. Deploy with GitHub Actions

The repository includes `.github/workflows/deploy.yml` which automatically deploys on push to `main`.

**Manual deployment**:

```bash
git add .
git commit -m "Deploy LLM Chat Interface"
git push origin main
```

GitHub Actions will:
1. Build (copy files from `public/` directory)
2. Deploy to `gh-pages` branch
3. Make available at: `https://yourusername.github.io/llmchat/`

**Check deployment status**:
- Go to **Actions** tab in GitHub
- View latest workflow run
- Wait for green checkmark

### 3. Custom Domain (Optional)

To use a custom domain like `chat.yourdomain.com`:

1. Add DNS CNAME record pointing to `yourusername.github.io`
2. In repository Settings → Pages → Custom domain, enter `chat.yourdomain.com`
3. Enable "Enforce HTTPS"

---

## Configuration

### Update API Endpoint for Production

If deploying to GitHub Pages, update the default API endpoint:

**Edit `src/models/settings.js`**:

```javascript
const DEFAULT_SETTINGS = {
  'api-endpoint': 'http://YOUR_SERVER_IP:9000',  // Change this
  'default-model': 'granite-local',
  // ... other settings
};
```

**Note**: If using HTTPS (GitHub Pages), you may need to:
- Use Tailscale or VPN to access Kai server
- Or deploy Kai server with HTTPS certificate
- Or use browser extension to allow mixed content (HTTP API from HTTPS page)

### Environment-Specific Settings

For local vs production:

```javascript
const API_ENDPOINT = window.location.hostname === 'localhost' 
  ? 'http://eanserver:9000'
  : 'http://YOUR_PRODUCTION_IP:9000';
```

---

## Project Structure

```
llmchat/
├── public/                  # Deployed files
│   ├── index.html          # Main entry point
│   ├── manifest.json       # PWA manifest
│   ├── sw.js              # Service Worker
│   ├── icons/             # App icons
│   └── assets/
│       └── styles.css     # Global styles
├── src/                    # Source modules
│   ├── core/              # Core functionality
│   │   ├── api.js         # Kai API client
│   │   ├── storage.js     # IndexedDB wrapper
│   │   └── state.js       # State management
│   ├── models/            # Data models
│   ├── ui/                # UI components
│   └── utils/             # Utilities
├── tests/                 # Test files
├── .github/
│   └── workflows/
│       └── deploy.yml     # CI/CD pipeline
└── specs/                 # Documentation
```

---

## Troubleshooting

### "Failed to fetch" Error

**Symptom**: Messages don't send, error in console

**Solutions**:
1. Check Kai server is running: `curl http://eanserver:9000/health`
2. Check CORS headers (Kai should allow requests from your PWA origin)
3. Check browser console for specific error
4. Verify API endpoint in Settings matches your server

### PWA Not Installing

**Symptom**: No "Add to Home Screen" prompt

**Solutions**:
1. Ensure using HTTPS (GitHub Pages) or localhost
2. Check Service Worker registered: DevTools → Application → Service Workers
3. Validate manifest: DevTools → Application → Manifest
4. Ensure `manifest.json` and `sw.js` are accessible (no 404s)

### Conversations Not Persisting

**Symptom**: Conversations disappear after refresh

**Solutions**:
1. Check browser supports IndexedDB (all modern browsers do)
2. Check browser storage quota: DevTools → Application → Storage
3. Check for errors in console related to IndexedDB
4. Try incognito mode (some extensions block IndexedDB)

### Streaming Not Working

**Symptom**: Full response appears at once instead of word-by-word

**Solutions**:
1. Verify Kai server supports streaming: check `stream: true` in request
2. Check network tab: should show "event-stream" content type
3. Test with curl: `curl -N -X POST http://eanserver:9000/v1/chat/completions ...`
4. Check `api.js` handles ReadableStream correctly

### Dark Mode Not Working

**Symptom**: App always light/dark

**Solutions**:
1. Check OS dark mode setting
2. Check Settings panel theme setting
3. Inspect CSS variables in DevTools
4. Ensure `prefers-color-scheme` media query is not overridden

---

## Performance Optimization

### Enable Service Worker Caching

Service Worker (`sw.js`) caches:
- App shell (HTML, CSS, JS)
- Static assets (icons, fonts)

**Cache strategy**: 
- Network first for API calls
- Cache first for static assets

**Clear cache**:
```javascript
// In browser console
caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
```

### Virtual Scrolling for Long Conversations

For conversations >100 messages, implement virtual scrolling:

```javascript
// In src/ui/chat.js
import VirtualScroll from './virtualScroll.js';

const messageList = new VirtualScroll({
  container: document.getElementById('messages'),
  itemHeight: 80,
  items: messages
});
```

---

## Next Steps

### Add Authentication (Optional)

When Kai server adds API key support:

1. **Add login form** in `public/index.html`
2. **Store token** in LocalStorage
3. **Send token** in API requests:
   ```javascript
   headers: {
     'Authorization': `Bearer ${token}`
   }
   ```

### Add Features

- **Export conversations** to JSON/Markdown
- **Search conversations** by keyword
- **Code copy button** in code blocks
- **Voice input** via Web Speech API
- **LaTeX rendering** for math equations
- **Custom themes** with color picker

### Contribute

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes and test
4. Commit: `git commit -am 'Add my feature'`
5. Push: `git push origin feature/my-feature`
6. Open Pull Request

---

## Support

- **Documentation**: `specs/` directory
- **Issues**: GitHub Issues tab
- **Kai Server Docs**: `~/projects/kai/docs/`

---

## License

MIT License - see LICENSE file

---

**You're ready to go!** 🚀

Open `http://localhost:8080` and start chatting with your AI.
