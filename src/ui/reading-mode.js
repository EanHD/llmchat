/**
 * Reading Mode - Display text in large, readable format during TTS playback
 * Perfect for car rides: read while listening
 */

import { markdownRenderer } from './markdown.js';
import { $ } from '../utils/dom.js';

class ReadingMode {
  constructor() {
    this.isActive = false;
    this.currentText = '';
    this.currentMessageId = null;
    this.overlayEl = null;
    this.autoScroll = true;
    this.scrollInterval = null;
    this.audioDuration = 0;
  }

  /**
   * Show reading mode with text
   */
  show(text, messageId, audioDuration = 0) {
    this.currentText = text;
    this.currentMessageId = messageId;
    this.audioDuration = audioDuration;
    this.isActive = true;
    
    // Create overlay if doesn't exist
    if (!this.overlayEl) {
      this.createOverlay();
    }

    // Render content
    this.renderContent();
    
    // Show overlay
    this.overlayEl.classList.add('active');
    
    // Start auto-scroll if enabled and we have duration
    if (this.autoScroll && audioDuration > 0) {
      this.startAutoScroll();
    }
  }

  /**
   * Hide reading mode
   */
  hide() {
    if (!this.overlayEl) return;
    
    this.isActive = false;
    this.overlayEl.classList.remove('active');
    this.stopAutoScroll();
    
    // Clear content after animation
    setTimeout(() => {
      if (!this.isActive && this.overlayEl) {
        this.overlayEl.querySelector('.reading-mode-content').innerHTML = '';
      }
    }, 300);
  }

  /**
   * Create overlay element
   */
  createOverlay() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'reading-mode-overlay';
    this.overlayEl.innerHTML = `
      <div class="reading-mode-header">
        <div class="reading-mode-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          Reading Mode
        </div>
        <div class="reading-mode-controls">
          <button class="reading-mode-btn reading-mode-fullscreen" aria-label="Fullscreen" title="Fullscreen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
          <button class="reading-mode-btn reading-mode-scroll-toggle active" aria-label="Auto-scroll" title="Auto-scroll">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15"/>
            </svg>
          </button>
          <button class="reading-mode-btn reading-mode-close" aria-label="Close" title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="reading-mode-body">
        <div class="reading-mode-content"></div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);

    // Setup event listeners
    this.overlayEl.querySelector('.reading-mode-close').addEventListener('click', () => {
      this.hide();
    });

    this.overlayEl.querySelector('.reading-mode-fullscreen').addEventListener('click', () => {
      this.toggleFullscreen();
    });

    this.overlayEl.querySelector('.reading-mode-scroll-toggle').addEventListener('click', (e) => {
      this.toggleAutoScroll(e.currentTarget);
    });

    // Click outside to close
    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) {
        this.hide();
      }
    });

    // ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isActive) {
        this.hide();
      }
    });
  }

  /**
   * Render markdown content
   */
  renderContent() {
    const contentEl = this.overlayEl.querySelector('.reading-mode-content');
    
    // Render markdown
    const htmlContent = markdownRenderer.render(this.currentText);
    contentEl.innerHTML = htmlContent;
    
    // Scroll to top
    contentEl.scrollTop = 0;
  }

  /**
   * Start auto-scroll based on audio duration
   */
  startAutoScroll() {
    this.stopAutoScroll();
    
    const contentEl = this.overlayEl.querySelector('.reading-mode-content');
    const maxScroll = contentEl.scrollHeight - contentEl.clientHeight;
    
    if (maxScroll <= 0 || this.audioDuration <= 0) return;
    
    // Calculate scroll speed (pixels per second)
    const scrollSpeed = maxScroll / this.audioDuration;
    
    // Smooth scroll animation
    let startTime = null;
    const animate = (currentTime) => {
      if (!this.autoScroll || !this.isActive) return;
      
      if (!startTime) startTime = currentTime;
      const elapsed = (currentTime - startTime) / 1000; // seconds
      
      const scrollPosition = Math.min(elapsed * scrollSpeed, maxScroll);
      contentEl.scrollTop = scrollPosition;
      
      if (scrollPosition < maxScroll) {
        this.scrollInterval = requestAnimationFrame(animate);
      }
    };
    
    this.scrollInterval = requestAnimationFrame(animate);
  }

  /**
   * Stop auto-scroll
   */
  stopAutoScroll() {
    if (this.scrollInterval) {
      cancelAnimationFrame(this.scrollInterval);
      this.scrollInterval = null;
    }
  }

  /**
   * Toggle auto-scroll
   */
  toggleAutoScroll(button) {
    this.autoScroll = !this.autoScroll;
    button.classList.toggle('active', this.autoScroll);
    
    if (this.autoScroll && this.audioDuration > 0) {
      this.startAutoScroll();
    } else {
      this.stopAutoScroll();
    }
  }

  /**
   * Toggle fullscreen
   */
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.overlayEl.requestFullscreen?.() || 
      this.overlayEl.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() || 
      document.webkitExitFullscreen?.();
    }
  }

  /**
   * Update scroll position based on audio progress
   */
  updateProgress(currentTime, duration) {
    if (!this.autoScroll || !this.isActive) return;
    
    const contentEl = this.overlayEl?.querySelector('.reading-mode-content');
    if (!contentEl) return;
    
    const maxScroll = contentEl.scrollHeight - contentEl.clientHeight;
    const progress = currentTime / duration;
    
    contentEl.scrollTop = maxScroll * progress;
  }
}

// Singleton instance
export const readingMode = new ReadingMode();
