/**
 * iOS Viewport & Keyboard Handler
 * Native PWA keyboard handling - NO transforms, flexbox-based layout
 */

export class IOSViewportHandler {
  constructor() {
    this.chatContainer = null;
    this.input = null;
    this.isKeyboardOpen = false;
    this.initialHeight = 0;
  }

  init() {
    this.chatContainer = document.getElementById('chat-container');
    this.input = document.getElementById('message-input');
    this.initialHeight = window.innerHeight;
    
    // Set initial height
    this.updateHeight();
    
    // The key: use visualViewport to update ONLY --app-height
    // Let CSS flexbox handle everything else
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.onViewportResize());
      window.visualViewport.addEventListener('scroll', () => this.onViewportScroll());
    }
    
    // Backup listeners
    window.addEventListener('resize', () => this.updateHeight());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.updateHeight(), 150);
    });
    
    // Focus handling
    if (this.input) {
      this.input.addEventListener('focus', () => this.onInputFocus());
      this.input.addEventListener('blur', () => this.onInputBlur());
    }
  }

  updateHeight() {
    const height = window.visualViewport 
      ? window.visualViewport.height 
      : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${height}px`);
  }

  onViewportResize() {
    const vv = window.visualViewport;
    const height = vv.height;
    
    // Update app height to match visual viewport
    document.documentElement.style.setProperty('--app-height', `${height}px`);
    
    // Detect keyboard
    const keyboardVisible = (this.initialHeight - height) > 150;
    
    if (keyboardVisible && !this.isKeyboardOpen) {
      this.isKeyboardOpen = true;
      document.body.classList.add('keyboard-open');
      this.scrollToBottom();
    } else if (!keyboardVisible && this.isKeyboardOpen) {
      this.isKeyboardOpen = false;
      document.body.classList.remove('keyboard-open');
    }
  }

  onViewportScroll() {
    // On iOS, when keyboard shows, viewport can scroll
    // We need to keep the app height updated
    this.updateHeight();
  }

  onInputFocus() {
    // Small delay to let keyboard animate
    setTimeout(() => {
      this.scrollToBottom();
      this.updateHeight();
    }, 100);
  }

  onInputBlur() {
    // Reset after keyboard dismisses
    setTimeout(() => {
      if (document.activeElement !== this.input) {
        this.isKeyboardOpen = false;
        document.body.classList.remove('keyboard-open');
        this.initialHeight = window.innerHeight;
        this.updateHeight();
      }
    }, 100);
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
