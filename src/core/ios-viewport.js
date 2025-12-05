/**
 * iOS Viewport & Keyboard Handler v3.0
 * Bulletproof PWA keyboard handling for iOS Safari/WebKit
 * 
 * Key techniques from 2024/2025 research:
 * 1. Use visualViewport API exclusively for keyboard detection
 * 2. Use position: fixed + bottom for input bar (most stable)
 * 3. Aggressive touch-action control to prevent dragging
 * 4. Use dvh units where possible, JS fallback elsewhere
 * 5. Account for viewport offset (iOS scrolls viewport on keyboard)
 */

export class IOSViewportHandler {
  constructor() {
    this.chatContainer = null;
    this.inputArea = null;
    this.main = null;
    this.input = null;
    this.contextInput = null;
    this.isKeyboardOpen = false;
    this.baseHeight = 0;
    this.lastKeyboardHeight = 0;
    this.isIOS = false;
    this.isPWA = false;
    this.rafId = null;
    this.inputBarHeight = 0;
  }

  init() {
    // Detect iOS (including iPadOS)
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    this.isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                 window.navigator.standalone === true;
    
    // Get elements
    this.main = document.querySelector('.main');
    this.chatContainer = document.getElementById('chat-container');
    this.inputArea = document.getElementById('input-area');
    this.input = document.getElementById('message-input');
    this.contextInput = document.getElementById('context-input');
    
    // Store base height (full screen without keyboard)
    this.baseHeight = window.visualViewport?.height || window.innerHeight;
    
    // Measure input bar once loaded
    if (this.inputArea) {
      this.inputBarHeight = this.inputArea.offsetHeight;
    }
    
    // Set initial CSS variables
    this.updateCSSVariables();
    
    // Apply iOS-specific classes
    if (this.isIOS) {
      document.body.classList.add('is-ios');
      if (this.isPWA) {
        document.body.classList.add('is-pwa');
      }
    }
    
    // Setup visualViewport listeners (the key to iOS keyboard handling)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.onViewportResize.bind(this));
      window.visualViewport.addEventListener('scroll', this.onViewportScroll.bind(this));
    }
    
    // Orientation change - reset base height
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.baseHeight = window.visualViewport?.height || window.innerHeight;
        this.updateCSSVariables();
        this.closeKeyboard();
      }, 350);
    });
    
    // Regular resize (not keyboard) 
    window.addEventListener('resize', () => {
      if (!this.isKeyboardOpen) {
        this.baseHeight = window.visualViewport?.height || window.innerHeight;
        this.updateCSSVariables();
      }
    });
    
    // Input focus/blur
    this.setupInputListeners();
    
    // Prevent iOS rubber-banding and dragging
    if (this.isIOS) {
      this.setupTouchHandling();
    }
  }

  updateCSSVariables() {
    const vh = this.baseHeight;
    document.documentElement.style.setProperty('--app-height', `${vh}px`);
    document.documentElement.style.setProperty('--keyboard-height', '0px');
  }

  setupInputListeners() {
    const inputs = [this.input, this.contextInput].filter(Boolean);
    
    inputs.forEach(input => {
      // Focus - keyboard opening
      input.addEventListener('focus', () => {
        // Wait for iOS keyboard animation
        this.scheduleKeyboardCheck(100);
        this.scheduleKeyboardCheck(200);
        this.scheduleKeyboardCheck(350);
        this.scheduleKeyboardCheck(500);
      }, { passive: true });
      
      // Blur - keyboard closing
      input.addEventListener('blur', () => {
        // Delay to check if focus moved to another input
        setTimeout(() => {
          const active = document.activeElement;
          const stillFocused = active?.tagName === 'INPUT' || 
                               active?.tagName === 'TEXTAREA' ||
                               active?.isContentEditable;
          if (!stillFocused) {
            this.closeKeyboard();
          }
        }, 150);
      }, { passive: true });
      
      // Ensure 16px font to prevent iOS zoom
      input.style.fontSize = '16px';
    });
  }

  scheduleKeyboardCheck(delay) {
    setTimeout(() => {
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') {
        this.onViewportResize();
      }
    }, delay);
  }

  setupTouchHandling() {
    // Completely lock the body
    document.body.style.cssText += `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
      overscroll-behavior: none !important;
      touch-action: none !important;
    `;
    
    // Whitelist scrollable areas
    const scrollableSelectors = [
      '#chat-container',
      '.conversation-list', 
      '.panel-content',
      '.context-panel-input',
      '#context-input',
      '#message-input',
      'textarea'
    ].join(', ');
    
    // Prevent touchmove on non-scrollable areas
    document.addEventListener('touchmove', (e) => {
      const target = e.target;
      const scrollable = target.closest(scrollableSelectors);
      
      if (!scrollable) {
        e.preventDefault();
        return;
      }
      
      // Check if element can actually scroll
      if (scrollable.scrollHeight <= scrollable.clientHeight) {
        // Not actually scrollable
        if (!scrollable.matches('textarea, input')) {
          e.preventDefault();
        }
      }
    }, { passive: false });
    
    // Lock the input area from being dragged
    if (this.inputArea) {
      // Prevent all touch movement on the input container itself
      this.inputArea.addEventListener('touchmove', (e) => {
        // Only allow if directly touching a textarea/input that needs scrolling
        const target = e.target;
        if (target.tagName === 'TEXTAREA' && target.scrollHeight > target.clientHeight) {
          return; // Allow textarea to scroll
        }
        e.preventDefault();
      }, { passive: false });
      
      // Prevent drag gesture
      this.inputArea.style.cssText += `
        touch-action: manipulation !important;
        -webkit-user-drag: none !important;
        user-drag: none !important;
      `;
    }
    
    // The input wrapper should be manipulation only (allow tap, prevent pan/zoom)
    const inputWrapper = document.querySelector('.input-wrapper');
    if (inputWrapper) {
      inputWrapper.style.touchAction = 'manipulation';
    }
  }

  onViewportResize() {
    const vv = window.visualViewport;
    if (!vv) return;
    
    // Cancel any pending RAF
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    
    this.rafId = requestAnimationFrame(() => {
      // Calculate keyboard height
      // Note: On iOS, when keyboard shows, visualViewport.height shrinks
      // and visualViewport.offsetTop may change (viewport scrolls up)
      const viewportHeight = vv.height;
      const offsetTop = vv.offsetTop;
      
      // Keyboard height = difference from base, accounting for viewport scroll
      const keyboardHeight = Math.max(0, this.baseHeight - viewportHeight - offsetTop);
      
      // Threshold to determine if keyboard is "open"
      const threshold = 100; // Keyboard is usually 200px+ on phones
      
      if (keyboardHeight > threshold) {
        // Keyboard is open
        if (!this.isKeyboardOpen) {
          this.isKeyboardOpen = true;
          document.body.classList.add('keyboard-open');
        }
        this.lastKeyboardHeight = keyboardHeight;
        this.positionInputForKeyboard(keyboardHeight);
      } else if (this.isKeyboardOpen && keyboardHeight < 50) {
        // Keyboard closed
        this.closeKeyboard();
      }
    });
  }

  onViewportScroll() {
    // iOS scrolls the visual viewport when keyboard appears
    // Re-run position calculation
    if (this.isKeyboardOpen) {
      this.onViewportResize();
    }
  }

  positionInputForKeyboard(keyboardHeight) {
    if (!this.inputArea) return;
    
    // Set CSS variable for keyboard height
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    
    // Position input bar above keyboard
    // Use bottom positioning - most reliable on iOS
    this.inputArea.style.position = 'fixed';
    this.inputArea.style.bottom = `${keyboardHeight}px`;
    this.inputArea.style.left = '0';
    this.inputArea.style.right = '0';
    
    // Adjust chat container padding so last message is visible
    if (this.chatContainer) {
      const inputHeight = this.inputArea.offsetHeight || this.inputBarHeight || 80;
      this.chatContainer.style.paddingBottom = `${keyboardHeight + inputHeight + 20}px`;
    }
    
    // Scroll chat to bottom
    this.scrollToBottom();
    
    // Reset any body scroll that iOS might have introduced
    window.scrollTo(0, 0);
  }

  closeKeyboard() {
    this.isKeyboardOpen = false;
    this.lastKeyboardHeight = 0;
    document.body.classList.remove('keyboard-open');
    document.documentElement.style.setProperty('--keyboard-height', '0px');
    
    if (this.inputArea) {
      // Reset to CSS-controlled positioning (flex child)
      this.inputArea.style.position = '';
      this.inputArea.style.bottom = '';
      this.inputArea.style.left = '';
      this.inputArea.style.right = '';
    }
    
    if (this.chatContainer) {
      this.chatContainer.style.paddingBottom = '';
    }
    
    // Reset page scroll
    window.scrollTo(0, 0);
  }

  scrollToBottom() {
    if (!this.chatContainer) return;
    
    requestAnimationFrame(() => {
      this.chatContainer.scrollTo({
        top: this.chatContainer.scrollHeight,
        behavior: 'auto' // Use 'auto' for immediate scroll, 'smooth' can lag on iOS
      });
    });
  }
  
  // Public method to manually trigger scroll (for new messages)
  ensureScrolledToBottom() {
    this.scrollToBottom();
  }
}

export const iosViewport = new IOSViewportHandler();
