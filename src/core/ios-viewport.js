/**
 * iOS Viewport & Keyboard Handler
 * Native PWA keyboard handling using interactive-widget=overlays-content
 * The keyboard overlays content, we move the input bar up using transform
 */

export class IOSViewportHandler {
  constructor() {
    this.chatContainer = null;
    this.inputArea = null;
    this.input = null;
    this.isKeyboardOpen = false;
    this.initialHeight = window.innerHeight;
    this.lastKeyboardHeight = 0;
  }

  init() {
    this.chatContainer = document.getElementById('chat-container');
    this.inputArea = document.getElementById('input-area');
    this.input = document.getElementById('message-input');
    this.initialHeight = window.innerHeight;
    
    // Set initial height
    this.setAppHeight(window.innerHeight);
    
    // iOS Safari with interactive-widget=overlays-content
    // The keyboard overlays, so we must manually move the input bar
    if (window.visualViewport) {
      // Use bound handlers for proper cleanup
      this._onResize = this.onViewportResize.bind(this);
      this._onScroll = this.onViewportScroll.bind(this);
      
      window.visualViewport.addEventListener('resize', this._onResize);
      window.visualViewport.addEventListener('scroll', this._onScroll);
    }
    
    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.initialHeight = window.innerHeight;
        this.setAppHeight(window.innerHeight);
        this.resetInputPosition();
      }, 200);
    });
    
    // Focus/blur handling
    if (this.input) {
      this.input.addEventListener('focus', () => this.onInputFocus());
      this.input.addEventListener('blur', () => this.onInputBlur());
    }
    
    // Prevent body scroll/bounce on iOS
    document.body.addEventListener('touchmove', (e) => {
      // Allow scrolling in chat container
      if (e.target.closest('#chat-container, .conversation-list, .panel-content, .context-panel-input')) {
        return;
      }
      e.preventDefault();
    }, { passive: false });
  }

  setAppHeight(height) {
    document.documentElement.style.setProperty('--app-height', `${height}px`);
  }

  onViewportResize() {
    const vv = window.visualViewport;
    if (!vv) return;
    
    // Calculate keyboard height
    // With overlays-content, innerHeight stays the same, but visualViewport shrinks
    const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
    
    // If keyboard is significantly open (>100px)
    if (keyboardHeight > 100) {
      if (!this.isKeyboardOpen) {
        this.isKeyboardOpen = true;
        document.body.classList.add('keyboard-open');
      }
      this.lastKeyboardHeight = keyboardHeight;
      
      // Move input bar up by keyboard height
      if (this.inputArea) {
        this.inputArea.style.transform = `translateY(-${keyboardHeight}px)`;
      }
      
      // Adjust chat container padding
      if (this.chatContainer) {
        this.chatContainer.style.paddingBottom = `${keyboardHeight + 80}px`;
      }
      
      // Scroll to keep content visible
      this.scrollToBottom();
      
    } else if (keyboardHeight < 50 && this.isKeyboardOpen) {
      // Keyboard closed
      this.isKeyboardOpen = false;
      document.body.classList.remove('keyboard-open');
      this.resetInputPosition();
    }
  }

  onViewportScroll() {
    // When iOS scrolls the visual viewport, update position
    if (this.isKeyboardOpen) {
      this.onViewportResize();
    }
  }

  onInputFocus() {
    // Small delay for keyboard animation
    setTimeout(() => {
      if (window.visualViewport) {
        this.onViewportResize();
      }
      this.scrollToBottom();
    }, 150);
    
    // Second check after keyboard fully shows
    setTimeout(() => {
      if (window.visualViewport) {
        this.onViewportResize();
      }
      this.scrollToBottom();
    }, 350);
  }

  onInputBlur() {
    // Delay to check if we're actually done with input
    setTimeout(() => {
      const activeEl = document.activeElement;
      const isStillInInput = activeEl && (
        activeEl === this.input ||
        activeEl.closest('#input-area, #context-panel')
      );
      
      if (!isStillInInput) {
        this.isKeyboardOpen = false;
        document.body.classList.remove('keyboard-open');
        this.resetInputPosition();
        
        // Force scroll reset on iOS
        window.scrollTo(0, 0);
      }
    }, 150);
  }

  resetInputPosition() {
    if (this.inputArea) {
      this.inputArea.style.transform = '';
    }
    if (this.chatContainer) {
      this.chatContainer.style.paddingBottom = '';
    }
    this.lastKeyboardHeight = 0;
  }

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

export const iosViewport = new IOSViewportHandler();
