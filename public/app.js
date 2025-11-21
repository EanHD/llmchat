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
      this.setupPromptChips();
      this.setupUserMenu();

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
      const show = container.scrollTop > 300;
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

    // Event delegation for actions
    messagesEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-icon');
      if (!btn) return;

      const messageEl = btn.closest('.message');
      if (!messageEl) return;

      const content = messageEl.querySelector('.message-content');

      // Copy
      if (btn.classList.contains('btn-copy')) {
        e.stopPropagation();
        try {
          // Get text content without the actions div
          const clone = content.cloneNode(true);
          const actions = clone.querySelector('.assistant-actions');
          if (actions) actions.remove();
          await navigator.clipboard.writeText(clone.innerText.trim());
          toast.success('Copied');
        } catch (err) {
          console.error('Copy failed', err);
          toast.error('Copy failed');
        }
      }

      // Regenerate
      if (btn.classList.contains('btn-regen')) {
        e.stopPropagation();
        const msgId = messageEl.dataset.messageId;
        await this.callRegenerateEndpoint(msgId, false);
      }
    });
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
    // Minimum viable: just log for now
    const map = { '👎': 'too long', '🤓': 'over-explaining', '💀': 'tone wrong' };
    console.log('[Feedback]', { messageId, reaction, meaning: map[reaction] || reaction });
    toast.success('Feedback noted');
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
    const original = send.innerHTML;
    const showDots = () => {
      send.innerHTML = '<span class="sending-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>';
    };
    const restore = () => { send.innerHTML = original; };
    send.addEventListener('click', () => {
      showDots();
      setTimeout(restore, 2000);
    });
    state.subscribe('isStreaming', (val) => {
      if (!val) restore();
    });
  }

  setupPromptChips() {
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('.prompt-chip');
      if (!chip) return;
      const text = chip.getAttribute('data-text') || chip.textContent;
      const input = document.getElementById('message-input');
      const send = document.getElementById('send-btn');
      const mic = document.getElementById('mic-btn');
      if (!input || !send || !mic) return;
      input.value = text;
      // Reveal send button
      send.classList.remove('hidden');
      mic.style.display = 'none';
      input.focus();
    });
  }

  setupUserMenu() {
    const btn = document.getElementById('user-menu-btn');
    const menu = document.getElementById('user-menu');
    if (!btn || !menu) return;
    const hide = (e) => {
      if (!menu.contains(e.target) && e.target !== btn) menu.classList.add('hidden');
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });
    document.addEventListener('click', hide);
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
