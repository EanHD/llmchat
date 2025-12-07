/**
 * Voice Mode - Seamless voice conversation loop
 * Perfect for venting and hands-free car conversations
 */

import { storage } from '../core/storage.js';
import { tts } from '../core/tts.js';
import { $ } from '../utils/dom.js';

class VoiceMode {
  constructor() {
    this.isEnabled = false;
    this.autoPlayTTS = false;
    this.autoStartSTT = false;
    this.minimalUI = false;
    this.pendingTTS = null;
  }

  /**
   * Initialize voice mode from settings
   */
  async init() {
    const settings = await storage.getAllSettings();
    this.autoPlayTTS = settings.voiceModeAutoPlay !== false; // Default true
    this.autoStartSTT = settings.voiceModeAutoSTT === true; // Default false (opt-in)
    this.minimalUI = settings.voiceModeMinimalUI === true; // Default false
  }

  /**
   * Save voice mode settings
   */
  async saveSettings() {
    await storage.saveSetting('voiceModeAutoPlay', this.autoPlayTTS);
    await storage.saveSetting('voiceModeAutoSTT', this.autoStartSTT);
    await storage.saveSetting('voiceModeMinimalUI', this.minimalUI);
  }

  /**
   * Toggle auto-play TTS
   */
  async toggleAutoPlay() {
    this.autoPlayTTS = !this.autoPlayTTS;
    await this.saveSettings();
    this.updateUI();
  }

  /**
   * Toggle auto-start STT
   */
  async toggleAutoSTT() {
    this.autoStartSTT = !this.autoStartSTT;
    await this.saveSettings();
    this.updateUI();
  }

  /**
   * Toggle minimal UI mode
   */
  async toggleMinimalUI() {
    this.minimalUI = !this.minimalUI;
    await this.saveSettings();
    this.applyMinimalUI();
    this.updateUI();
  }

  /**
   * Apply minimal UI (hide sidebar, simplify chat)
   */
  applyMinimalUI() {
    const body = document.body;
    const sidebar = $('#sidebar');
    const chatContainer = $('#chat-container');

    if (this.minimalUI) {
      body.classList.add('voice-mode-minimal');
      sidebar?.classList.add('hidden');
      chatContainer?.classList.add('voice-mode-active');
    } else {
      body.classList.remove('voice-mode-minimal');
      sidebar?.classList.remove('hidden');
      chatContainer?.classList.remove('voice-mode-active');
    }
  }

  /**
   * Handle new AI response - auto-play TTS if enabled
   */
  async handleNewResponse(messageId, text, chatUI) {
    if (!this.autoPlayTTS) return;

    // Auto-play TTS for AI responses
    try {
      await tts.speak(text, messageId);

      // If auto-STT is enabled, start listening after TTS finishes
      if (this.autoStartSTT && tts.audio) {
        tts.audio.addEventListener('ended', () => {
          this.startAutoSTT(chatUI);
        }, { once: true });
      }
    } catch (error) {
      console.error('Voice mode TTS error:', error);
    }
  }

  /**
   * Auto-start STT after TTS finishes
   */
  startAutoSTT(chatUI) {
    // Small delay to avoid audio overlap
    setTimeout(() => {
      if (chatUI && typeof chatUI.startListening === 'function') {
        chatUI.startListening();
      }
    }, 500);
  }

  /**
   * Update UI to reflect current settings
   */
  updateUI() {
    // Update toggle buttons in settings if they exist
    const autoPlayToggle = $('#voice-mode-auto-play');
    const autoSTTToggle = $('#voice-mode-auto-stt');
    const minimalUIToggle = $('#voice-mode-minimal-ui');

    if (autoPlayToggle) {
      autoPlayToggle.classList.toggle('active', this.autoPlayTTS);
      autoPlayToggle.setAttribute('aria-checked', this.autoPlayTTS);
    }

    if (autoSTTToggle) {
      autoSTTToggle.classList.toggle('active', this.autoStartSTT);
      autoSTTToggle.setAttribute('aria-checked', this.autoStartSTT);
    }

    if (minimalUIToggle) {
      minimalUIToggle.classList.toggle('active', this.minimalUI);
      minimalUIToggle.setAttribute('aria-checked', this.minimalUI);
    }
  }

  /**
   * Create settings UI for voice mode
   */
  createSettingsUI() {
    const html = `
      <div class="settings-section">
        <div class="settings-section-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          </svg>
          <h3>Voice Mode</h3>
        </div>
        <p class="settings-description">Seamless voice conversations for venting and hands-free use</p>
        
        <div class="settings-item">
          <div class="settings-item-info">
            <div class="settings-item-label">Auto-play responses</div>
            <div class="settings-item-description">Automatically play TTS for AI responses</div>
          </div>
          <button 
            id="voice-mode-auto-play" 
            class="toggle-btn ${this.autoPlayTTS ? 'active' : ''}"
            role="switch"
            aria-checked="${this.autoPlayTTS}"
            aria-label="Toggle auto-play TTS">
            <span class="toggle-slider"></span>
          </button>
        </div>

        <div class="settings-item">
          <div class="settings-item-info">
            <div class="settings-item-label">Auto-listen after response</div>
            <div class="settings-item-description">Start listening automatically after AI finishes speaking</div>
          </div>
          <button 
            id="voice-mode-auto-stt" 
            class="toggle-btn ${this.autoStartSTT ? 'active' : ''}"
            role="switch"
            aria-checked="${this.autoStartSTT}"
            aria-label="Toggle auto-start STT">
            <span class="toggle-slider"></span>
          </button>
        </div>

        <div class="settings-item">
          <div class="settings-item-info">
            <div class="settings-item-label">Minimal UI</div>
            <div class="settings-item-description">Hide sidebar and simplify interface for focused conversation</div>
          </div>
          <button 
            id="voice-mode-minimal-ui" 
            class="toggle-btn ${this.minimalUI ? 'active' : ''}"
            role="switch"
            aria-checked="${this.minimalUI}"
            aria-label="Toggle minimal UI">
            <span class="toggle-slider"></span>
          </button>
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Setup event listeners for settings UI
   */
  setupSettingsListeners() {
    const autoPlayToggle = $('#voice-mode-auto-play');
    const autoSTTToggle = $('#voice-mode-auto-stt');
    const minimalUIToggle = $('#voice-mode-minimal-ui');

    autoPlayToggle?.addEventListener('click', () => this.toggleAutoPlay());
    autoSTTToggle?.addEventListener('click', () => this.toggleAutoSTT());
    minimalUIToggle?.addEventListener('click', () => this.toggleMinimalUI());
  }
}

// Singleton instance
export const voiceMode = new VoiceMode();
