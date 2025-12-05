/**
 * Kai - Private AI Chat PWA
 * Version 1.3.0
 */

import { storage } from './src/core/storage.js';
import { state } from './src/core/state.js';
import { ChatUI } from './src/ui/chat.js';
import { SidebarUI } from './src/ui/sidebar.js';
import { SettingsUI } from './src/ui/settings.js';
import { MemoryUI } from './src/ui/memory.js';
import { toast } from './src/ui/toast.js';
import { DEFAULT_SETTINGS } from './src/models/settings.js';
import { shortcuts } from './src/core/shortcuts.js';
import { openCodeUI } from './src/opencode/ui.js';

class App {
  constructor() {
    this.chatUI = null;
    this.sidebarUI = null;
    this.settingsUI = null;
    this.memoryUI = null;
    this.openCodeUI = null;
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

      // Initialize personal shortcuts
      await shortcuts.init();

      // Handle URL routing (for /new, /?drunk, etc.)
      this.handleURLRouting();

      // Initialize UI components
      this.chatUI = new ChatUI();
      this.sidebarUI = new SidebarUI();
      this.settingsUI = new SettingsUI();
      this.memoryUI = new MemoryUI();

      // Initialize OpenCode IDE
      await openCodeUI.init();
      this.setupOpenCodeToggle();

      // Personal PWA features
      this.setupKeyboardShortcuts();
      this.setupDebugPanel();

      // Premium mobile UX enhancements
      await this.setupInputAutofocus();
      this.setupKeyboardDetection();
      this.setupPullToRefreshReload();
      this.setupNewChatFAB();
      this.setupAssistantEnhancements();
      this.setupReactionMenu();
      this.setupSendSpinner();
      this.setupPromptChips();
      this.setupUserMenu();
      this.setupHapticFeedback();
      this.setupNativeScrolling();

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

  /**
   * Handle URL routing for quick actions
   */
  handleURLRouting() {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.slice(1);

    // Handle query params (?new, ?drunk, ?voice, etc.)
    if (params.has('new') || params.has('action') && params.get('action') === 'new') {
      setTimeout(() => {
        state.setCurrentConversation(null);
        state.setMessages([]);
        toast.success('New chat started');
      }, 500);
    }

    if (params.has('drunk')) {
      setTimeout(() => {
        document.body.classList.add('drunk-mode');
        toast.info('Drunk mode activated');
      }, 500);
    }

    if (params.has('settings') || params.has('action') && params.get('action') === 'settings') {
      setTimeout(() => {
        document.getElementById('settings-panel')?.classList.remove('hidden');
      }, 600);
    }

    if (params.has('memory')) {
      setTimeout(() => {
        document.getElementById('memory-panel')?.classList.remove('hidden');
      }, 600);
    }

    // Handle hash routes (#new, #drunk, etc.)
    if (hash === 'new') {
      setTimeout(() => {
        state.setCurrentConversation(null);
        state.setMessages([]);
        toast.success('New chat started');
      }, 500);
    }

    // Clear URL params after processing
    if (params.toString()) {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }

  /**
   * Setup OpenCode toggle button
   */
  setupOpenCodeToggle() {
    const toggleBtn = document.getElementById('opencode-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        openCodeUI.toggle();
      });
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

  setupKeyboardDetection() {
    const input = document.getElementById('message-input');
    const chatContainer = document.getElementById('chat-container');
    if (!input) return;

    // Use visualViewport API for reliable iOS keyboard detection
    if (window.visualViewport) {
      let lastHeight = window.visualViewport.height;
      
      window.visualViewport.addEventListener('resize', () => {
        const currentHeight = window.visualViewport.height;
        const heightDiff = lastHeight - currentHeight;
        
        // Keyboard opened (viewport shrunk significantly)
        if (heightDiff > 100) {
          document.body.classList.add('keyboard-open');
          // Scroll to keep input visible
          setTimeout(() => {
            if (chatContainer) {
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          }, 100);
        } 
        // Keyboard closed
        else if (heightDiff < -100) {
          document.body.classList.remove('keyboard-open');
        }
        
        lastHeight = currentHeight;
      });
    }

    // Fallback for older browsers
    const onFocus = () => {
      document.body.classList.add('keyboard-open');
      setTimeout(() => {
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 300);
    };

    const onBlur = () => {
      // Small delay to prevent flicker during keyboard switch
      setTimeout(() => {
        if (document.activeElement !== input) {
          document.body.classList.remove('keyboard-open');
        }
      }, 100);
    };

    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
  }

  /**
   * Setup haptic feedback for native feel
   */
  setupHapticFeedback() {
    // Trigger haptic on button clicks
    const triggerHaptic = (style = 'light') => {
      if ('vibrate' in navigator) {
        const patterns = {
          light: [10],
          medium: [20],
          heavy: [30],
          success: [10, 50, 10],
          error: [50, 30, 50]
        };
        navigator.vibrate(patterns[style] || patterns.light);
      }
    };

    // Add haptic to all buttons
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn) {
        triggerHaptic('light');
      }
    }, { passive: true });

    // Expose for other uses
    window.haptic = triggerHaptic;
  }

  /**
   * Setup native-like scrolling behavior
   */
  setupNativeScrolling() {
    const chatContainer = document.getElementById('chat-container');
    if (!chatContainer) return;

    // Auto-scroll to bottom when new messages arrive
    const messagesEl = document.getElementById('messages');
    if (messagesEl) {
      const observer = new MutationObserver((mutations) => {
        // Check if we're near the bottom (within 150px)
        const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 150;
        
        if (isNearBottom) {
          // Smooth scroll to bottom for new messages
          requestAnimationFrame(() => {
            chatContainer.scrollTo({
              top: chatContainer.scrollHeight,
              behavior: 'smooth'
            });
          });
        }
      });

      observer.observe(messagesEl, { childList: true, subtree: true });
    }
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
   * Setup global keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger if typing in input
      const input = document.getElementById('message-input');
      const isTyping = document.activeElement === input;

      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + K: New chat
      if (isMod && e.key === 'k') {
        e.preventDefault();
        state.setCurrentConversation(null);
        state.setMessages([]);
        toast.success('New chat');
        if (input) input.focus();
      }

      // Cmd/Ctrl + R: Regenerate last response
      if (isMod && e.key === 'r' && !isTyping) {
        e.preventDefault();
        const messages = state.getState('messages');
        const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
        if (lastAssistant) {
          this.callRegenerateEndpoint(lastAssistant.id, false);
        }
      }

      // Cmd/Ctrl + /: Toggle settings
      if (isMod && e.key === '/') {
        e.preventDefault();
        const panel = document.getElementById('settings-panel');
        if (panel) panel.classList.toggle('hidden');
      }

      // Cmd/Ctrl + M: Toggle memory
      if (isMod && e.key === 'm' && !isTyping) {
        e.preventDefault();
        const panel = document.getElementById('memory-panel');
        if (panel) panel.classList.toggle('hidden');
      }

      // Cmd/Ctrl + D: Toggle drunk mode
      if (isMod && e.key === 'd' && !isTyping) {
        e.preventDefault();
        document.body.classList.toggle('drunk-mode');
        const isActive = document.body.classList.contains('drunk-mode');
        toast.info(isActive ? 'Drunk mode ON' : 'Drunk mode OFF');
      }

      // Escape: Close any open panel
      if (e.key === 'Escape') {
        document.getElementById('settings-panel')?.classList.add('hidden');
        document.getElementById('memory-panel')?.classList.add('hidden');
        document.getElementById('reaction-menu')?.classList.add('hidden');
      }
    });
  }

  /**
   * Setup debug panel (triple-tap header)
   */
  setupDebugPanel() {
    const header = document.getElementById('chat-header');
    if (!header) return;

    let tapCount = 0;
    let tapTimer = null;

    header.addEventListener('click', (e) => {
      // Only if clicking header itself, not buttons
      if (e.target.closest('button')) return;

      tapCount++;
      clearTimeout(tapTimer);

      if (tapCount === 3) {
        tapCount = 0;
        this.showDebugPanel();
      } else {
        tapTimer = setTimeout(() => { tapCount = 0; }, 500);
      }
    });
  }

  /**
   * Show debug panel overlay
   */
  async showDebugPanel() {
    const conversations = await storage.getAllConversations();
    const messages = state.getState('messages');
    const settings = await storage.getAllSettings();
    const quota = await storage.checkQuota();

    const debugInfo = {
      'App Version': '1.0.0',
      'Conversations': conversations.length,
      'Messages in Current': messages.length,
      'IndexedDB Quota': `${quota.used.toFixed(2)}MB / ${quota.total.toFixed(2)}MB (${quota.percentUsed.toFixed(1)}%)`,
      'Service Worker': navigator.serviceWorker.controller ? 'Active' : 'Not registered',
      'Online': navigator.onLine,
      'API Endpoint': settings.apiEndpoint || 'https://api.eanhd.com',
      'Shortcuts Loaded': Object.keys(shortcuts.getAll()).length,
      'Current Model': settings.model || 'granite-local',
      'Streaming': settings.streaming ? 'Enabled' : 'Disabled'
    };

    const overlay = document.createElement('div');
    overlay.className = 'debug-overlay';
    overlay.innerHTML = `
      <div class="debug-panel">
        <div class="debug-header">
          <h3>🛠️ Debug Panel</h3>
          <button class="close-debug" aria-label="Close">✕</button>
        </div>
        <div class="debug-content">
          ${Object.entries(debugInfo).map(([key, value]) => `
            <div class="debug-row">
              <span class="debug-key">${key}:</span>
              <span class="debug-value">${value}</span>
            </div>
          `).join('')}
        </div>
        <div class="debug-actions">
          <button class="debug-btn" id="export-state">Export State</button>
          <button class="debug-btn" id="clear-cache">Clear Cache</button>
          <button class="debug-btn" id="reload-app">Reload App</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Add styles if not exists
    if (!document.getElementById('debug-styles')) {
      const style = document.createElement('style');
      style.id = 'debug-styles';
      style.textContent = `
        .debug-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8); backdrop-filter: blur(10px);
          z-index: 10000; display: flex; align-items: center; justify-content: center;
          animation: fadeIn 0.2s;
        }
        .debug-panel {
          background: #1a1a1a; border-radius: 12px; padding: 20px;
          max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        }
        .debug-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #333;
        }
        .debug-header h3 { margin: 0; color: #fff; font-size: 18px; }
        .close-debug {
          background: transparent; border: none; color: #888;
          font-size: 24px; cursor: pointer; padding: 0; width: 30px; height: 30px;
        }
        .close-debug:hover { color: #fff; }
        .debug-content { margin-bottom: 20px; }
        .debug-row {
          display: flex; justify-content: space-between; padding: 8px 0;
          border-bottom: 1px solid #222;
        }
        .debug-key { color: #888; font-size: 13px; }
        .debug-value { color: #fff; font-size: 13px; font-weight: 500; }
        .debug-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .debug-btn {
          flex: 1; padding: 10px; background: #007bff; color: #fff;
          border: none; border-radius: 6px; cursor: pointer; font-size: 13px;
        }
        .debug-btn:hover { background: #0069d9; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `;
      document.head.appendChild(style);
    }

    // Event handlers
    overlay.querySelector('.close-debug').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('#export-state').addEventListener('click', async () => {
      const stateExport = {
        conversations: await storage.getAllConversations(),
        settings,
        timestamp: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(stateExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kai-export-${Date.now()}.json`;
      a.click();
      toast.success('State exported');
    });

    overlay.querySelector('#clear-cache').addEventListener('click', async () => {
      if (confirm('Clear service worker cache?')) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        toast.success('Cache cleared');
      }
    });

    overlay.querySelector('#reload-app').addEventListener('click', () => {
      location.reload();
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
