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
    this.audioContext = null;
    this.analyser = null;
    this.animationFrame = null;
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
      
      // Set up audio context for visualization
      this.setupAudioContext();
      
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
        this.stopVisualization();
      });
      
      this.audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        this.hidePlayer();
      });
      
      // Start playback
      await this.audio.play();
      this.isPlaying = true;
      this.updatePlayButton();
      this.startVisualization();
      
    } catch (error) {
      console.error('TTS error:', error);
      this.hidePlayer();
      throw error;
    }
  }

  /**
   * Setup Web Audio API for visualization
   */
  setupAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const source = this.audioContext.createMediaElementSource(this.audio);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 64;
    
    source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  /**
   * Show audio player UI
   */
  showPlayer(messageId, loading = false) {
    // Remove existing player
    this.hidePlayer();
    
    this.playerEl = document.createElement('div');
    this.playerEl.className = 'tts-player';
    this.playerEl.innerHTML = `
      <div class="tts-player-inner">
        <button class="tts-btn tts-play-btn" aria-label="Play/Pause">
          ${loading ? this.getSpinnerIcon() : this.getPlayIcon()}
        </button>
        <button class="tts-btn tts-skip-back" aria-label="Back 15s">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            <text x="12" y="15" font-size="8" fill="currentColor" text-anchor="middle">15</text>
          </svg>
        </button>
        <div class="tts-waveform">
          <canvas class="tts-canvas" width="120" height="32"></canvas>
        </div>
        <button class="tts-btn tts-skip-forward" aria-label="Forward 15s">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/>
            <text x="12" y="15" font-size="8" fill="currentColor" text-anchor="middle">15</text>
          </svg>
        </button>
        <div class="tts-time">
          <span class="tts-current">0:00</span>
          <span class="tts-separator">/</span>
          <span class="tts-duration">0:00</span>
        </div>
        <button class="tts-btn tts-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="tts-progress-bar">
        <div class="tts-progress-fill"></div>
      </div>
    `;
    
    // Add event listeners
    const playBtn = this.playerEl.querySelector('.tts-play-btn');
    const skipBackBtn = this.playerEl.querySelector('.tts-skip-back');
    const skipForwardBtn = this.playerEl.querySelector('.tts-skip-forward');
    const closeBtn = this.playerEl.querySelector('.tts-close');
    const progressBar = this.playerEl.querySelector('.tts-progress-bar');
    
    playBtn.addEventListener('click', () => this.togglePlay());
    skipBackBtn.addEventListener('click', () => this.skip(-15));
    skipForwardBtn.addEventListener('click', () => this.skip(15));
    closeBtn.addEventListener('click', () => this.stop());
    
    progressBar.addEventListener('click', (e) => {
      if (!this.audio) return;
      const rect = progressBar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      this.audio.currentTime = percent * this.audio.duration;
    });
    
    // Insert into DOM - inside input-container for proper positioning
    const inputContainer = document.querySelector('.input-container');
    if (inputContainer) {
      inputContainer.insertBefore(this.playerEl, inputContainer.firstChild);
    }
  }

  /**
   * Hide audio player
   */
  hidePlayer() {
    if (this.playerEl) {
      this.playerEl.remove();
      this.playerEl = null;
    }
    this.stopVisualization();
  }

  /**
   * Toggle play/pause
   */
  togglePlay() {
    if (!this.audio) return;
    
    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
      this.stopVisualization();
    } else {
      this.audio.play();
      this.isPlaying = true;
      this.startVisualization();
    }
    this.updatePlayButton();
  }

  /**
   * Skip forward/back
   */
  skip(seconds) {
    if (!this.audio) return;
    this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, this.audio.currentTime + seconds));
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
    this.stopVisualization();
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
    const currentEl = this.playerEl.querySelector('.tts-current');
    const durationEl = this.playerEl.querySelector('.tts-duration');
    
    if (fill) fill.style.width = `${percent}%`;
    if (currentEl) currentEl.textContent = this.formatTime(current);
    if (durationEl) durationEl.textContent = this.formatTime(duration);
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
    
    // Replace spinner with play button
    const btn = this.playerEl.querySelector('.tts-play-btn');
    if (btn) {
      btn.innerHTML = this.isPlaying ? this.getPauseIcon() : this.getPlayIcon();
    }
  }

  /**
   * Start waveform visualization
   */
  startVisualization() {
    if (!this.analyser || !this.playerEl) return;
    
    const canvas = this.playerEl.querySelector('.tts-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      if (!this.isPlaying) return;
      
      this.animationFrame = requestAnimationFrame(draw);
      this.analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        // Gradient from accent to secondary color
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, 'rgba(45, 90, 140, 0.6)');
        gradient.addColorStop(1, 'rgba(45, 90, 140, 1)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };
    
    draw();
  }

  /**
   * Stop visualization
   */
  stopVisualization() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
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

  // Icon helpers
  getPlayIcon() {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  }

  getPauseIcon() {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
  }

  getSpinnerIcon() {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="tts-spinner"><circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/></svg>`;
  }
}

export const tts = new TTSController();
