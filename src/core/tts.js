/**
 * Text-to-Speech Module
 * Uses OpenAI TTS API via Kai backend for high-quality voice synthesis
 */

import { storage } from './storage.js';

class TTSController {
  constructor() {
    this.audio = null;
    this.isPlaying = false;
    this.isSpeaking = false; // Prevents overlapping requests
    this.currentMessageId = null;
    this.playerEl = null;
    this.progressInterval = null;
  }

  /**
   * Get TTS audio from backend
   */
  async getAudio(text, voice = 'felicia') {
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
    // Prevent overlapping TTS requests
    if (this.isSpeaking) {
      this.stop();
      // Small delay to ensure cleanup
      await new Promise(r => setTimeout(r, 50));
    }
    
    // Stop any current playback immediately
    this.stopImmediate();
    
    this.isSpeaking = true;
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
        this.isSpeaking = false;
        this.updatePlayButton();
      });
      
      this.audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        this.isSpeaking = false;
        this.hidePlayer();
      });
      
      // Start playback
      await this.audio.play();
      this.isPlaying = true;
      this.updatePlayButton();
      
    } catch (error) {
      console.error('TTS error:', error);
      this.isSpeaking = false;
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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
            <text x="12" y="14.5" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor">15</text>
          </svg>
        </button>
        
        <button class="tts-btn tts-play-btn" aria-label="Play/Pause">
          ${loading ? this.getSpinnerIcon() : this.getPlayIcon()}
        </button>
        
        <button class="tts-btn tts-skip-forward" aria-label="Forward 15 seconds">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
            <text x="12" y="14.5" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor">15</text>
          </svg>
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
   * Stop playback immediately (no animation)
   */
  stopImmediate() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    this.isPlaying = false;
    // Remove player element immediately
    if (this.playerEl) {
      this.playerEl.remove();
      this.playerEl = null;
    }
  }

  /**
   * Stop playback and cleanup (with animation)
   */
  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    this.isPlaying = false;
    this.isSpeaking = false;
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
