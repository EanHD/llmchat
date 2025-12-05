/**
 * iOS Viewport & Keyboard Handler
 * Handles iOS Safari quirks with keyboard and safe viewport height
 */

export class IOSViewportHandler {
  constructor() {
    this.inputBar = null;
    this.chatContainer = null;
    this.input = null;
    this.lastViewportHeight = 0;
  }

  /**
   * Initialize viewport handling
   */
  init() {
    this.inputBar = document.getElementById('input-area');
    this.chatContainer = document.getElementById('chat-container');
    this.input = document.getElementById('message-input');
    
    // Set initial app height
    this.setAppHeight();
    
    // Update on resize/orientation change
    window.addEventListener('resize', () => this.setAppHeight());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.setAppHeight(), 100);
    });
    
    // Setup keyboard handling
    this.setupKeyboardHandling();
  }

  /**
   * Set --app-height CSS variable to actual visible height
   */
  setAppHeight() {
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${vh}px`);
  }

  /**
   * Setup keyboard detection and input bar positioning
   */
  setupKeyboardHandling() {
    if (!this.inputBar) return;

    // Use visualViewport API for iOS keyboard detection
    if (window.visualViewport) {
      this.lastViewportHeight = window.visualViewport.height;
      
      const onViewportChange = () => {
        const vv = window.visualViewport;
        
        // Calculate keyboard offset
        // This is how much the visual viewport has shrunk from the layout viewport
        const keyboardOffset = window.innerHeight - vv.height - vv.offsetTop;
        
        // Update CSS variable for transform
        document.documentElement.style.setProperty('--keyboard-offset', `${Math.max(0, keyboardOffset)}px`);
        
        // Detect keyboard open/close
        const heightDiff = this.lastViewportHeight - vv.height;
        
        if (heightDiff > 100) {
          // Keyboard opened
          document.body.classList.add('keyboard-open');
          // Scroll chat to bottom
          this.scrollToBottom();
        } else if (heightDiff < -100) {
          // Keyboard closed
          document.body.classList.remove('keyboard-open');
          // Reset offset
          document.documentElement.style.setProperty('--keyboard-offset', '0px');
        }
        
        this.lastViewportHeight = vv.height;
      };

      window.visualViewport.addEventListener('resize', onViewportChange);
      window.visualViewport.addEventListener('scroll', onViewportChange);
      
    } else {
      // Fallback for browsers without visualViewport
      this.setupFallbackKeyboardHandling();
    }

    // Always scroll to bottom on input focus
    if (this.input) {
      this.input.addEventListener('focus', () => {
        setTimeout(() => this.scrollToBottom(), 150);
      });
    }
  }

  /**
   * Fallback keyboard handling for older browsers
   */
  setupFallbackKeyboardHandling() {
    if (!this.input) return;

    this.input.addEventListener('focus', () => {
      document.body.classList.add('keyboard-open');
      setTimeout(() => this.scrollToBottom(), 300);
    });

    this.input.addEventListener('blur', () => {
      setTimeout(() => {
        if (document.activeElement !== this.input) {
          document.body.classList.remove('keyboard-open');
          document.documentElement.style.setProperty('--keyboard-offset', '0px');
        }
      }, 100);
    });
  }

  /**
   * Scroll chat container to bottom smoothly
   */
  scrollToBottom() {
    if (!this.chatContainer) return;
    
    requestAnimationFrame(() => {
      this.chatContainer.scrollTo({
        top: this.chatContainer.scrollHeight,
        behavior: 'smooth'
      });
    });
  }
}

// Singleton instance
export const iosViewport = new IOSViewportHandler();
