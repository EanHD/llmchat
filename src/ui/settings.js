/**
 * Settings UI Component
 * Configuration panel for app preferences
 */

import { state } from '../core/state.js';
import { storage } from '../core/storage.js';
import { DEFAULT_SETTINGS } from '../models/settings.js';
import { $, createElement } from '../utils/dom.js';

export class SettingsUI {
  constructor() {
    this.settingsPanel = $('#settings-panel');
    this.settingsContent = $('.settings-content', this.settingsPanel);
    this.settingsBtn = $('#settings-btn');
    this.closeSettingsBtn = $('#close-settings-btn');

    this.init();
  }

  /**
   * Initialize settings UI
   */
  async init() {
    this.setupEventListeners();
    await this.renderSettings();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Open settings
    this.settingsBtn.addEventListener('click', () => {
      this.openSettings();
    });

    // Close settings
    this.closeSettingsBtn.addEventListener('click', () => {
      this.closeSettings();
    });

    // Close on overlay click
    this.settingsPanel.addEventListener('click', (e) => {
      if (e.target === this.settingsPanel) {
        this.closeSettings();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.settingsPanel.classList.contains('hidden')) {
        this.closeSettings();
      }
    });
  }

  /**
   * Open settings panel
   */
  openSettings() {
    this.settingsPanel.classList.remove('hidden');
  }

  /**
   * Close settings panel
   */
  closeSettings() {
    this.settingsPanel.classList.add('hidden');
  }

  /**
   * Render settings form
   */
  async renderSettings() {
    const settings = await storage.getAllSettings();

    this.settingsContent.innerHTML = '';

    // API Endpoint
    this.settingsContent.appendChild(this.createSettingGroup(
      'API Endpoint',
      'URL of the Kai LLM server (via Cloudflare Tunnel)',
      createElement('input', {
        type: 'text',
        className: 'setting-input',
        value: settings.apiEndpoint || DEFAULT_SETTINGS.apiEndpoint,
        placeholder: 'https://api.eanhd.com',
        onInput: (e) => {
          let value = e.target.value.trim();
          // Auto-add https:// if missing protocol
          if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
            value = 'https://' + value;
          }
          this.saveSetting('apiEndpoint', value);
        }
      })
    ));

    // Custom Headers (JSON)
    const headersInput = createElement('textarea', {
      className: 'setting-input',
      style: 'height: 100px; font-family: monospace;',
      placeholder: '{\n  "CF-Access-Client-Id": "..."\n}',
      onChange: (e) => {
        try {
          const value = e.target.value.trim();
          const headers = value ? JSON.parse(value) : {};
          this.saveSetting('customHeaders', headers);
          e.target.style.borderColor = '';
        } catch (err) {
          e.target.style.borderColor = 'red';
          alert('Invalid JSON for headers');
        }
      }
    });
    
    if (settings.customHeaders && Object.keys(settings.customHeaders).length > 0) {
      headersInput.value = JSON.stringify(settings.customHeaders, null, 2);
    }

    this.settingsContent.appendChild(this.createSettingGroup(
      'Custom Headers (JSON)',
      'Additional HTTP headers (e.g. for Cloudflare Access)',
      headersInput
    ));

    // Model Selection (will be populated from API)
    const modelSelect = createElement('select', {
      className: 'setting-input',
      onChange: (e) => this.saveSetting('model', e.target.value || null)
    });
    
    modelSelect.innerHTML = '<option value="">Auto-select</option>';
    // TODO: Load available models from API
    
    if (settings.model) {
      modelSelect.value = settings.model;
    }

    this.settingsContent.appendChild(this.createSettingGroup(
      'Model',
      'AI model to use for conversations',
      modelSelect
    ));

    // Theme
    const themeSelect = createElement('select', {
      className: 'setting-input',
      value: settings.theme || DEFAULT_SETTINGS.theme,
      onChange: (e) => this.changeTheme(e.target.value)
    });

    themeSelect.innerHTML = `
      <option value="auto">Auto (System)</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    `;
    themeSelect.value = settings.theme || 'auto';

    this.settingsContent.appendChild(this.createSettingGroup(
      'Theme',
      'Color scheme preference',
      themeSelect
    ));

    // Streaming
    this.settingsContent.appendChild(this.createSettingGroup(
      'Streaming Responses',
      'Show AI responses word-by-word in real-time',
      this.createToggle('streaming', settings.streaming !== false)
    ));

    // Markdown
    this.settingsContent.appendChild(this.createSettingGroup(
      'Markdown Rendering',
      'Format messages with markdown (bold, code, lists, etc.)',
      this.createToggle('markdown', settings.markdown !== false)
    ));

    // Auto-scroll
    this.settingsContent.appendChild(this.createSettingGroup(
      'Auto-scroll',
      'Automatically scroll to newest messages',
      this.createToggle('autoScroll', settings.autoScroll !== false)
    ));

    // Send on Enter
    this.settingsContent.appendChild(this.createSettingGroup(
      'Send on Enter',
      'Press Enter to send (Shift+Enter for new line)',
      this.createToggle('sendOnEnter', settings.sendOnEnter !== false)
    ));

    // Temperature
    this.settingsContent.appendChild(this.createSettingGroup(
      'Temperature',
      'Creativity level (0 = focused, 1 = balanced, 2 = creative)',
      createElement('input', {
        type: 'range',
        className: 'setting-input',
        min: '0',
        max: '2',
        step: '0.1',
        value: settings.temperature || DEFAULT_SETTINGS.temperature,
        onInput: (e) => {
          this.saveSetting('temperature', parseFloat(e.target.value));
          e.target.nextElementSibling.textContent = e.target.value;
        }
      }),
      createElement('span', {
        className: 'setting-value'
      }, String(settings.temperature || DEFAULT_SETTINGS.temperature))
    ));

    // Reset button
    const resetBtn = createElement('button', {
      className: 'primary',
      style: 'width: 100%; margin-top: var(--space-lg);',
      onClick: () => this.resetSettings()
    }, 'Reset to Defaults');

    this.settingsContent.appendChild(resetBtn);
  }

  /**
   * Create setting group
   */
  createSettingGroup(label, description, ...inputs) {
    const labelEl = createElement('label', {
      className: 'setting-label'
    }, label);

    const descEl = createElement('div', {
      className: 'setting-description'
    }, description);

    const group = createElement('div', {
      className: 'setting-group'
    }, labelEl, descEl, ...inputs);

    return group;
  }

  /**
   * Create toggle switch
   */
  createToggle(key, checked) {
    const toggle = createElement('label', {
      className: 'toggle-switch'
    });

    const checkbox = createElement('input', {
      type: 'checkbox',
      checked,
      onChange: (e) => this.saveSetting(key, e.target.checked)
    });

    const slider = createElement('span', {
      className: 'toggle-slider'
    });

    toggle.appendChild(checkbox);
    toggle.appendChild(slider);

    return toggle;
  }

  /**
   * Save setting
   */
  async saveSetting(key, value) {
    await storage.saveSetting(key, value);
    
    // Update state
    const settings = await storage.getAllSettings();
    state.setSettings(settings);
  }

  /**
   * Change theme
   */
  async changeTheme(theme) {
    await this.saveSetting('theme', theme);

    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  /**
   * Reset all settings
   */
  async resetSettings() {
    if (!confirm('Reset all settings to defaults?')) {
      return;
    }

    // Clear all settings
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await storage.saveSetting(key, value);
    }

    // Update state
    const settings = await storage.getAllSettings();
    state.setSettings(settings);

    // Apply theme
    if (DEFAULT_SETTINGS.theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', DEFAULT_SETTINGS.theme);
    }

    // Re-render settings
    await this.renderSettings();

    alert('Settings reset to defaults');
  }
}
