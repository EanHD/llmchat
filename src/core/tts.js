/**
 * Text-to-Speech Module
 * Uses OpenAI TTS API via Kai backend for high-quality voice synthesis
 */

import { storage } from './storage.js';

class TTSController {
  constructor() {
    this.audio = null;
    this.isPlaying = false;
    this.currentMessageId = null;
    this.playerEl = null;
    this.progressInterval = null;
  }

  /**
   * Get TTS audio from backend
   */
  async getAudio(text, voice = 'nova') {
    const settings = await storage.getAllSettings();
    const apiUrl = settings.apiUrl || 'https://api.eanhd.com';
    const customHeaders = settings.customHeaders || {};
    
    const response = await fetch(`${apiUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...customHeaders
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`TTS failed: ${errorText}`);
    }

    return await response.blob();
  }

  /**
   * Speak text with audio player UI
   */
  async speak(text, messageId) {
    // Stop any current playback
    this.stop();
    
    this.currentMessageId = messageId;
    
    try {
      // Show loading state
      this.showPlayer(messageId, true);
      
      // Get audio from backend
      const audioBlob = await this.getAudio(text);
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create audio element
      this.audio = new Audio(audioUrl);
      this.audio.preload = 'auto';
      
      // Update player when ready
      this.audio.addEventListener('loadedmetadata', () => {
        this.updatePlayerUI();
      });
      
      this.audio.addEventListener('timeupdate', () => {
        this.updateProgress();
      });
      
      this.audio.addEventListener('ended', () => {
        this.isPlaying = false;
        this.updatePlayButton();
      });
      
      this.audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        this.hidePlayer();
      });
      
      // Start playback
      await this.audio.play();
      this.isPlaying = true;
      this.updatePlayButton();
      
    } catch (error) {
      console.error('TTS error:', error);
      this.hidePlayer();
      throw error;
    }
  }

  /**
   * Show audio player UI - clean, minimal design
   */
  showPlayer(messageId, loading = false) {
    // Remove existing player
    this.hidePlayer();
    
    this.playerEl = document.createElement('div');
    this.playerEl.className = 'tts-player';
    this.playerEl.innerHTML = `
      <div class="tts-player-inner">
        <button class="tts-btn tts-skip-back" aria-label="Back 15 seconds">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 4v6h6"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
          <span class="tts-skip-label">15</span>
        </button>
        
        <button class="tts-btn tts-play-btn" aria-label="Play/Pause">
          ${loading ? this.getSpinnerIcon() : this.getPlayIcon()}
        </button>
        
        <button class="tts-btn tts-skip-forward" aria-label="Forward 15 seconds">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"/>
            <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/>
          </svg>
          <span class="tts-skip-label">15</span>
        </button>
        
        <div class="tts-time-display">
          <span class="tts-current">0:00</span>
          <span class="tts-separator">/</span>
          <span class="tts-duration">--:--</span>
        </div>
        
        <button class="tts-btn tts-close" aria-label="Stop">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <div class="tts-progress-container">
        <div class="tts-progress-bar">
          <div class="tts-progress-fill"></div>
          <div class="tts-progress-handle"></div>
        </div>
      </div>
    `;
    
    // Add event listeners
    const playBtn = this.playerEl.querySelector('.tts-play-btn');
    const skipBackBtn = this.playerEl.querySelector('.tts-skip-back');
    const skipForwardBtn = this.playerEl.querySelector('.tts-skip-forward');
    const closeBtn = this.playerEl.querySelector('.tts-close');
    const progressContainer = this.playerEl.querySelector('.tts-progress-container');
    
    playBtn.addEventListener('click', () => this.togglePlay());
    skipBackBtn.addEventListener('click', () => this.skip(-15));
    skipForwardBtn.addEventListener('click', () => this.skip(15));
    closeBtn.addEventListener('click', () => this.stop());
    
    // Progress bar seeking
    progressContainer.addEventListener('click', (e) => {
      if (!this.audio || !this.audio.duration) return;
      const rect = progressContainer.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.audio.currentTime = percent * this.audio.duration;
    });
    
    // Touch/drag support for progress bar
    let isDragging = false;
    progressContainer.addEventListener('touchstart', (e) => {
      isDragging = true;
      this.handleProgressSeek(e.touches[0], progressContainer);
    }, { passive: true });
    
    progressContainer.addEventListener('touchmove', (e) => {
      if (isDragging) {
        this.handleProgressSeek(e.touches[0], progressContainer);
      }
    }, { passive: true });
    
    progressContainer.addEventListener('touchend', () => {
      isDragging = false;
    });
    
    // Insert into DOM - inside input-container for proper positioning
    const inputContainer = document.querySelector('.input-container');
    if (inputContainer) {
      inputContainer.insertBefore(this.playerEl, inputContainer.firstChild);
    }
  }

  /**
   * Handle progress bar seeking
   */
  handleProgressSeek(touch, container) {
    if (!this.audio || !this.audio.duration) return;
    const rect = container.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    this.audio.currentTime = percent * this.audio.duration;
  }

  /**
   * Hide audio player
   */
  hidePlayer() {
    if (this.playerEl) {
      this.playerEl.classList.add('tts-player-hiding');
      setTimeout(() => {
        if (this.playerEl) {
          this.playerEl.remove();
          this.playerEl = null;
        }
      }, 200);
    }
  }

  /**
   * Toggle play/pause
   */
  togglePlay() {
    if (!this.audio) return;
    
    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    } else {
      this.audio.play();
      this.isPlaying = true;
    }
    this.updatePlayButton();
  }

  /**
   * Skip forward/back
   */
  skip(seconds) {
    if (!this.audio) return;
    this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || 0, this.audio.currentTime + seconds));
  }

  /**
   * Stop playback and cleanup
   */
  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    this.isPlaying = false;
    this.currentMessageId = null;
    this.hidePlayer();
  }

  /**
   * Update play button icon
   */
  updatePlayButton() {
    if (!this.playerEl) return;
    const btn = this.playerEl.querySelector('.tts-play-btn');
    if (btn) {
      btn.innerHTML = this.isPlaying ? this.getPauseIcon() : this.getPlayIcon();
    }
  }

  /**
   * Update progress bar and time
   */
  updateProgress() {
    if (!this.playerEl || !this.audio) return;
    
    const current = this.audio.currentTime;
    const duration = this.audio.duration || 0;
    const percent = duration > 0 ? (current / duration) * 100 : 0;
    
    const fill = this.playerEl.querySelector('.tts-progress-fill');
    const handle = this.playerEl.querySelector('.tts-progress-handle');
    const currentEl = this.playerEl.querySelector('.tts-current');
    
    if (fill) fill.style.width = `${percent}%`;
    if (handle) handle.style.left = `${percent}%`;
    if (currentEl) currentEl.textContent = this.formatTime(current);
  }

  /**
   * Update player UI when audio loads
   */
  updatePlayerUI() {
    if (!this.playerEl || !this.audio) return;
    
    const durationEl = this.playerEl.querySelector('.tts-duration');
    if (durationEl) {
      durationEl.textContent = this.formatTime(this.audio.duration);
    }
    
    // Replace spinner with play/pause button
    const btn = this.playerEl.querySelector('.tts-play-btn');
    if (btn) {
      btn.innerHTML = this.isPlaying ? this.getPauseIcon() : this.getPlayIcon();
    }
  }

  /**
   * Format time as M:SS
   */
  formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Icon helpers - clean, consistent stroke icons
  getPlayIcon() {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v14l11-7-11-7z"/>
    </svg>`;
  }

  getPauseIcon() {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1"/>
      <rect x="14" y="4" width="4" height="16" rx="1"/>
    </svg>`;
  }

  getSpinnerIcon() {
    return `<div class="tts-spinner"></div>`;
  }
}

export const tts = new TTSController();
