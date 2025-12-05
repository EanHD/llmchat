/**
 * iOS Viewport & Keyboard Handler v2.0
 * Bulletproof PWA keyboard handling for iOS Safari/WebKit
 * 
 * Key techniques from 2024/2025 research:
 * 1. Use visualViewport API to track actual visible area
 * 2. Position input using bottom offset, not transform (more stable)
 * 3. Lock body scroll to prevent rubber-banding
 * 4. Disable touch-move on non-scrollable areas
 */

export class IOSViewportHandler {
  constructor() {
    this.chatContainer = null;
    this.inputArea = null;
    this.input = null;
    this.contextInput = null;
    this.isKeyboardOpen = false;
    this.initialHeight = 0;
    this.lastKeyboardHeight = 0;
    this.isIOS = false;
    this.isPWA = false;
  }

  init() {
    // Detect iOS
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    this.isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                 window.navigator.standalone === true;
    
    this.chatContainer = document.getElementById('chat-container');
    this.inputArea = document.getElementById('input-area');
    this.input = document.getElementById('message-input');
    this.contextInput = document.getElementById('context-input');
    this.initialHeight = window.visualViewport?.height || window.innerHeight;
    
    // Set CSS variable for app height
    this.updateAppHeight();
    
    if (window.visualViewport) {
      // The key: listen to visualViewport changes
      window.visualViewport.addEventListener('resize', this.handleViewportChange.bind(this));
      window.visualViewport.addEventListener('scroll', this.handleViewportScroll.bind(this));
    }
    
    // Orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.initialHeight = window.visualViewport?.height || window.innerHeight;
        this.updateAppHeight();
        this.resetInputPosition();
      }, 300);
    });
    
    // Focus/blur on inputs
    this.setupInputListeners();
    
    // Prevent rubber-banding on iOS PWA
    if (this.isIOS) {
      this.preventRubberBanding();
    }
    
    // Also listen for resize as backup
    window.addEventListener('resize', () => {
      if (!this.isKeyboardOpen) {
        this.updateAppHeight();
      }
    });
  }

  setupInputListeners() {
    const inputs = [this.input, this.contextInput].filter(Boolean);
    
    inputs.forEach(input => {
      input.addEventListener('focus', () => this.onInputFocus(), { passive: true });
      input.addEventListener('blur', () => this.onInputBlur(), { passive: true });
      
      // Prevent zoom on iOS (font-size < 16px triggers zoom)
      input.style.fontSize = '16px';
    });
  }

  preventRubberBanding() {
    // Lock body completely
    const lockBody = () => {
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
    };
    
    lockBody();
    
    // Prevent touchmove on body/non-scrollable areas
    document.addEventListener('touchmove', (e) => {
      const target = e.target;
      const scrollableParent = target.closest(
        '#chat-container, .conversation-list, .panel-content, ' +
        '.context-panel-input, #context-input, #message-input, textarea'
      );
      
      if (!scrollableParent) {
        e.preventDefault();
      }
    }, { passive: false });
    
    // Prevent touchstart from causing issues on input area
    if (this.inputArea) {
      this.inputArea.addEventListener('touchstart', (e) => {
        // Don't prevent - allow tapping buttons
      }, { passive: true });
      
      // But prevent the input area itself from being dragged
      this.inputArea.addEventListener('touchmove', (e) => {
        // Allow if scrolling textarea
        if (e.target.closest('textarea, input')) {
          return;
        }
        e.preventDefault();
      }, { passive: false });
    }
  }

  updateAppHeight() {
    const height = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${height}px`);
  }

  handleViewportChange() {
    const vv = window.visualViewport;
    if (!vv) return;
    
    // Calculate how much viewport shrunk (keyboard height)
    const keyboardOffset = this.initialHeight - vv.height;
    
    // Also account for viewport scroll (iOS scrolls viewport when keyboard shows)
    const totalOffset = keyboardOffset + vv.offsetTop;
    
    if (totalOffset > 50) {
      // Keyboard is open
      if (!this.isKeyboardOpen) {
        this.isKeyboardOpen = true;
        document.body.classList.add('keyboard-open');
      }
      
      this.lastKeyboardHeight = totalOffset;
      this.adjustForKeyboard(totalOffset);
      
    } else if (this.isKeyboardOpen && totalOffset < 30) {
      // Keyboard closed
      this.isKeyboardOpen = false;
      document.body.classList.remove('keyboard-open');
      this.resetInputPosition();
    }
  }

  handleViewportScroll() {
    // iOS may scroll the visual viewport - keep input pinned
    if (this.isKeyboardOpen) {
      this.handleViewportChange();
    }
  }

  adjustForKeyboard(keyboardHeight) {
    if (!this.inputArea) return;
    
    // Method: Use bottom positioning via CSS variable
    // This is more stable than transform on iOS
    this.inputArea.style.setProperty('--keyboard-offset', `${keyboardHeight}px`);
    this.inputArea.style.bottom = `${keyboardHeight}px`;
    
    // Adjust chat container so content isn't hidden
    if (this.chatContainer) {
      // Extra padding = input bar height (~80px) + some buffer
      const inputBarHeight = this.inputArea.offsetHeight || 80;
      this.chatContainer.style.paddingBottom = `${keyboardHeight + inputBarHeight + 16}px`;
    }
    
    // Scroll to show latest content
    this.scrollToBottom();
  }

  resetInputPosition() {
    if (this.inputArea) {
      this.inputArea.style.removeProperty('--keyboard-offset');
      this.inputArea.style.bottom = '';
    }
    
    if (this.chatContainer) {
      this.chatContainer.style.paddingBottom = '';
    }
    
    this.lastKeyboardHeight = 0;
    
    // Reset any page scroll that iOS might have done
    if (this.isIOS) {
      window.scrollTo(0, 0);
    }
  }

  onInputFocus() {
    // Wait for keyboard to appear
    const checkKeyboard = () => {
      if (window.visualViewport) {
        this.handleViewportChange();
      }
      this.scrollToBottom();
    };
    
    // Multiple checks as keyboard animates
    setTimeout(checkKeyboard, 100);
    setTimeout(checkKeyboard, 250);
    setTimeout(checkKeyboard, 400);
  }

  onInputBlur() {
    // Delay to see if focus moved to another input
    setTimeout(() => {
      const activeEl = document.activeElement;
      const isStillInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.isContentEditable
      );
      
      if (!isStillInput) {
        this.isKeyboardOpen = false;
        document.body.classList.remove('keyboard-open');
        this.resetInputPosition();
      }
    }, 200);
  }

  scrollToBottom() {
    if (!this.chatContainer) return;
    
    // Use requestAnimationFrame for smooth scroll
    requestAnimationFrame(() => {
      this.chatContainer.scrollTo({
        top: this.chatContainer.scrollHeight,
        behavior: 'smooth'
      });
    });
  }
}

export const iosViewport = new IOSViewportHandler();
