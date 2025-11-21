/**
 * LLM Chat - Main Application Entry Point
 */

import { storage } from './src/core/storage.js';
import { state } from './src/core/state.js';
import { ChatUI } from './src/ui/chat.js';
import { SidebarUI } from './src/ui/sidebar.js';
import { SettingsUI } from './src/ui/settings.js';
import { MemoryUI } from './src/ui/memory.js';
import { toast } from './src/ui/toast.js';
import { DEFAULT_SETTINGS } from './src/models/settings.js';

class App {
  constructor() {
    this.chatUI = null;
    this.sidebarUI = null;
    this.settingsUI = null;
    this.memoryUI = null;
    this.offlineBanner = null;
  }

  /**
   * Initialize application
   */
  async init() {
    try {
      // Register Service Worker first
      await this.registerServiceWorker();

      // Initialize IndexedDB
      await storage.init();

      // Initialize default settings if not exists
      await this.initializeSettings();

      // Initialize UI components
      this.chatUI = new ChatUI();
      this.sidebarUI = new SidebarUI();
      this.settingsUI = new SettingsUI();
      this.memoryUI = new MemoryUI();

      // Premium mobile UX enhancements
      await this.setupInputAutofocus();
      this.setupPullToRefreshReload();
      this.setupNewChatFAB();
      this.setupAssistantEnhancements();
      this.setupReactionMenu();
      this.setupMicDrunkMode();
      this.setupSendSpinner();

      // Check for offline mode
      this.setupOfflineDetection();

      // Set up error boundary
      this.setupErrorBoundary();

      // Apply theme
      await this.applyTheme();

      // Show app
      document.getElementById('app').style.display = 'flex';
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showFatalError(error);
    }
  }

  async getApiEndpoint() {
    const settings = await storage.getAllSettings();
    let apiEndpoint = settings.apiEndpoint || 'https://api.eanhd.com';
    if (!apiEndpoint.startsWith('http://') && !apiEndpoint.startsWith('https://')) {
      apiEndpoint = 'https://' + apiEndpoint;
    }
    return apiEndpoint.replace(/\/$/, '');
  }

  async setupInputAutofocus() {
    const input = document.getElementById('message-input');
    if (!input) return;
    // Some mobile browsers ignore HTML autofocus
    setTimeout(() => {
      input.focus();
      try { input.setSelectionRange(input.value.length, input.value.length); } catch {}
    }, 60);
  }

  setupPullToRefreshReload() {
    const container = document.getElementById('chat-container');
    if (!container) return;
    let startY = 0;
    let pulling = false;
    const threshold = 100;

    container.addEventListener('touchstart', (e) => {
      if (container.scrollTop === 0) {
        startY = e.touches[0].pageY;
        pulling = true;
      }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!pulling) return;
      const dy = e.touches[0].pageY - startY;
      if (container.scrollTop === 0 && dy > threshold) {
        pulling = false;
        location.reload();
      }
    }, { passive: true });

    container.addEventListener('touchend', () => { pulling = false; }, { passive: true });
  }

  setupNewChatFAB() {
    const container = document.getElementById('chat-container');
    const fab = document.getElementById('new-chat-fab');
    if (!container || !fab) return;

    const onScroll = () => {
      const show = container.scrollTop > 500;
      fab.classList.toggle('hidden', !show);
    };
    container.addEventListener('scroll', onScroll);
    onScroll();

    fab.addEventListener('click', async () => {
      // Start new chat
      state.setCurrentConversation(null);
      state.setMessages([]);
      toast.success('New chat');
      // Scroll to top
      container.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  setupAssistantEnhancements() {
    const messagesEl = document.getElementById('messages');
    if (!messagesEl) return;

    const enhanceMessage = (el) => {
      if (!el.classList || !el.classList.contains('message') || !el.classList.contains('assistant')) return;
      if (el.dataset.enhanced === '1') return;
      const content = el.querySelector('.message-content');
      if (!content) return;

      // Actions bar (copy + regen)
      const actions = document.createElement('div');
      actions.className = 'assistant-actions';
      actions.innerHTML = `
        <button class="btn-icon btn-copy" title="Copy" aria-label="Copy">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="btn-icon btn-regen" title="Regenerate" aria-label="Regenerate">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M3.51 15a9 9 0 0 0 14.85 3.36L23 14"/><path d="M1 10l4.64-4.36A9 9 0 0 1 20.49 9"/></svg>
        </button>`;
      content.appendChild(actions);

      // Copy handler
      const copyBtn = actions.querySelector('.btn-copy');
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const clone = content.cloneNode(true);
          const tool = clone.querySelector('.assistant-actions');
          if (tool) tool.remove();
          await navigator.clipboard.writeText(clone.innerText.trim());
          toast.success('Copied');
        } catch (err) {
          console.error('Copy failed', err);
          toast.error('Copy failed');
        }
      });

      // Regenerate handler with double-tap support
      let lastTap = 0;
      const regenBtn = actions.querySelector('.btn-regen');
      regenBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const now = Date.now();
        const isDouble = now - lastTap < 300;
        lastTap = now;
        const msgId = el.dataset.messageId;
        await this.callRegenerateEndpoint(msgId, isDouble);
      });

      // On mobile tap, toggle actions bar visibility
      el.addEventListener('touchstart', () => {
        actions.classList.add('show');
        setTimeout(() => actions.classList.remove('show'), 1600);
      }, { passive: true });

      el.dataset.enhanced = '1';
    };

    // Initial pass
    Array.from(messagesEl.children).forEach(enhanceMessage);

    // Observe for new messages
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach(node => enhanceMessage(node));
      }
    });
    observer.observe(messagesEl, { childList: true });
  }

  async callRegenerateEndpoint(messageId, force) {
    if (!messageId) return toast.error('Missing message id');
    try {
      const base = await this.getApiEndpoint();
      const url = `${base}/v1/chat/regenerate${force ? '?force=grok4' : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(force ? 'Regenerating (Grok4 forced)…' : 'Regenerating…');
    } catch (err) {
      console.error('Regenerate failed', err);
      toast.error('Regenerate failed');
    }
  }

  setupReactionMenu() {
    const messagesEl = document.getElementById('messages');
    const menu = document.getElementById('reaction-menu');
    if (!messagesEl || !menu) return;

    let pressTimer = null;
    let targetMessage = null;

    const showMenu = (x, y, msgEl) => {
      targetMessage = msgEl;
      menu.style.left = `${x - menu.offsetWidth / 2}px`;
      menu.style.top = `${y - 48}px`;
      menu.classList.remove('hidden');
    };

    const hideMenu = () => {
      menu.classList.add('hidden');
      targetMessage = null;
    };

    const startPress = (e, fromMouse = false) => {
      const pathEl = e.target.closest('.message.assistant');
      if (!pathEl) return;
      const pointX = fromMouse ? e.clientX : (e.touches && e.touches[0].clientX);
      const pointY = fromMouse ? e.clientY : (e.touches && e.touches[0].clientY);
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => showMenu(pointX, pointY, pathEl), 550);
    };

    const cancelPress = () => clearTimeout(pressTimer);

    messagesEl.addEventListener('touchstart', (e) => startPress(e), { passive: true });
    messagesEl.addEventListener('touchend', cancelPress, { passive: true });
    messagesEl.addEventListener('touchmove', cancelPress, { passive: true });
    messagesEl.addEventListener('mousedown', (e) => startPress(e, true));
    messagesEl.addEventListener('mouseup', cancelPress);
    document.addEventListener('scroll', hideMenu, true);
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) hideMenu(); });

    // Reaction clicks
    menu.querySelectorAll('.reaction-emoji').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!targetMessage) return hideMenu();
        const reaction = btn.dataset.reaction;
        // Floating emoji animation
        const float = document.createElement('div');
        float.className = 'emoji-float';
        float.textContent = reaction;
        targetMessage.appendChild(float);
        setTimeout(() => float.remove(), 900);
        hideMenu();
        await this.sendFeedbackReaction(targetMessage.dataset.messageId, reaction);
      });
    });
  }

  async sendFeedbackReaction(messageId, reaction) {
    try {
      const base = await this.getApiEndpoint();
      const conversationId = state.getState('currentConversationId') || null;
      const res = await fetch(`${base}/v1/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, conversationId, reaction })
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success('Feedback sent');
    } catch (err) {
      console.error('Feedback failed', err);
      toast.error('Feedback failed');
    }
  }

  setupMicDrunkMode() {
    const mic = document.getElementById('mic-btn');
    if (!mic) return;
    let timer = null;
    const activate = () => {
      document.body.classList.toggle('drunk-mode');
      if (document.body.classList.contains('drunk-mode')) {
        toast.info("I'm drunk mode: bigger text, slower vibes");
      } else {
        toast.info('Back to normal');
      }
    };
    const start = () => { timer = setTimeout(activate, 3000); };
    const cancel = () => { clearTimeout(timer); };
    mic.addEventListener('mousedown', start);
    mic.addEventListener('mouseup', cancel);
    mic.addEventListener('mouseleave', cancel);
    mic.addEventListener('touchstart', start, { passive: true });
    mic.addEventListener('touchend', cancel, { passive: true });
  }

  setupSendSpinner() {
    const send = document.getElementById('send-btn');
    if (!send) return;
    send.addEventListener('click', () => {
      send.classList.add('sending');
      // fallback if streaming doesn't start
      setTimeout(() => send.classList.remove('sending'), 1500);
    });
    // Remove spinner on streaming state change
    state.subscribe('isStreaming', () => {
      send.classList.remove('sending');
    });
  }

  /**
   * Register Service Worker
   */
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        console.log('Service Worker registered:', registration.scope);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  /**
   * Initialize default settings
   */
  async initializeSettings() {
    const existingSettings = await storage.getAllSettings();
    
    // Set defaults for any missing settings
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(key in existingSettings)) {
        await storage.saveSetting(key, value);
      }
    }

    // Load settings into state
    const settings = await storage.getAllSettings();
    state.setSettings(settings);
  }

  /**
   * Set up offline detection
   */
  setupOfflineDetection() {
    // Create offline banner
    this.offlineBanner = document.createElement('div');
    this.offlineBanner.className = 'offline-banner';
    this.offlineBanner.textContent = '⚠ You are offline - some features may not work';
    document.body.appendChild(this.offlineBanner);

    const updateOnlineStatus = () => {
      const isOffline = !navigator.onLine;
      state.setOffline(isOffline);
      
      if (isOffline) {
        this.offlineBanner.classList.add('show');
        toast.warning('Connection lost - viewing cached content');
      } else {
        this.offlineBanner.classList.remove('show');
        toast.success('Back online');
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
  }

  /**
   * Set up global error boundary
   */
  setupErrorBoundary() {
    window.addEventListener('error', (event) => {
      console.error('Uncaught error:', event.error);
      toast.error(`Error: ${event.error.message}`);
      state.setError(event.error.message);
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      toast.error(`Error: ${event.reason}`);
      state.setError(String(event.reason));
    });

    // Subscribe to state errors
    state.subscribe('error', (error) => {
      if (error) {
        toast.error(error);
        // Clear error after showing
        setTimeout(() => state.clearError(), 5000);
      }
    });
  }

  /**
   * Apply theme
   */
  async applyTheme() {
    const settings = await storage.getAllSettings();
    const theme = settings.theme || 'auto';

    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  /**
   * Show fatal error
   */
  showFatalError(error) {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 2rem; text-align: center;">
        <h1 style="color: var(--error); margin-bottom: 1rem;">Failed to Initialize App</h1>
        <p style="color: var(--text-secondary); margin-bottom: 2rem;">${error.message}</p>
        <button onclick="location.reload()" style="padding: 0.5rem 1rem; background: var(--accent-primary); color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
          Reload Page
        </button>
      </div>
    `;
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
  });
} else {
  const app = new App();
  app.init();
}
