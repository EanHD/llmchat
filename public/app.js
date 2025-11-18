/**
 * LLM Chat - Main Application Entry Point
 */

import { storage } from './src/core/storage.js';
import { state } from './src/core/state.js';
import { ChatUI } from './src/ui/chat.js';
import { SidebarUI } from './src/ui/sidebar.js';
import { SettingsUI } from './src/ui/settings.js';
import { toast } from './src/ui/toast.js';
import { DEFAULT_SETTINGS } from './src/models/settings.js';

class App {
  constructor() {
    this.chatUI = null;
    this.sidebarUI = null;
    this.settingsUI = null;
    this.offlineBanner = null;
  }

  /**
   * Initialize application
   */
  async init() {
    try {
      // Initialize IndexedDB
      await storage.init();
      console.log('Storage initialized');

      // Initialize default settings if not exists
      await this.initializeSettings();

      // Initialize UI components
      this.chatUI = new ChatUI();
      this.sidebarUI = new SidebarUI();
      this.settingsUI = new SettingsUI();

      // Check for offline mode
      this.setupOfflineDetection();

      // Set up error boundary
      this.setupErrorBoundary();

      // Apply theme
      await this.applyTheme();

      console.log('App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showFatalError(error);
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
