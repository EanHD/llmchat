/**
 * Echo Lyric Mode
 * Apple Music lyrics-style chat transcript with TTS word highlighting
 * 
 * Features:
 * - Verse cards for user/AI messages
 * - Word-level highlighting synced to TTS
 * - Full-screen karaoke mode
 * - Gesture controls (swipe up for fullscreen, double-tap to edit)
 */

import { state } from '../core/state.js';
import { storage } from '../core/storage.js';
import { markdownRenderer } from './markdown.js';
import { agentMode } from '../agent/agent-mode.js';

class LyricModeController {
  constructor() {
    this.enabled = false;
    this.fullscreen = false;
    this.lyricCanvas = null;
    this.messagesContainer = null;
    this.chatHeader = null;
    this.inputContainer = null;
    this.toggleBtn = null;
    
    // TTS word highlighting
    this.currentUtterance = null;
    this.currentVerseEl = null;
    this.wordSpans = [];
    this.currentWordIndex = 0;
    
    // Gesture tracking
    this.touchStartY = 0;
    this.touchStartTime = 0;
    this.lastTapTime = 0;
    
    // Don't auto-init - wait for app to call init after DB is ready
  }

  async init() {
    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      await this.setup();
    }
  }

  async setup() {
    // Get elements
    this.messagesContainer = document.getElementById('messages');
    this.chatHeader = document.getElementById('chat-header');
    this.inputContainer = document.getElementById('input-area');
    this.toggleBtn = document.getElementById('lyric-mode-toggle');
    
    // Create lyric canvas
    this.createLyricCanvas();
    
    // Load saved state - storage should be initialized by now
    try {
      const settings = await storage.getAllSettings();
      this.enabled = settings.lyricMode === true;
    } catch (err) {
      console.warn('Lyric mode: could not load settings, defaulting to off');
      this.enabled = false;
    }
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Apply initial state
    this.applyMode();
    
    // Subscribe to state changes
    state.subscribe('messages', (messages) => {
      if (this.enabled) {
        this.renderVerses(messages);
      }
    });
  }

  createLyricCanvas() {
    // Check if already exists
    if (document.getElementById('lyric-canvas')) {
      this.lyricCanvas = document.getElementById('lyric-canvas');
      return;
    }

    this.lyricCanvas = document.createElement('div');
    this.lyricCanvas.id = 'lyric-canvas';
    this.lyricCanvas.className = 'lyric-canvas hidden';
    this.lyricCanvas.innerHTML = `
      <div class="lyric-verses"></div>
      <div class="lyric-empty-state">
        <div class="lyric-logo">✨</div>
        <p class="lyric-tagline">Echo Lyric Mode</p>
        <p class="lyric-hint">Your words, beautifully spoken</p>
      </div>
    `;
    
    // Insert after messages container
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
      chatContainer.appendChild(this.lyricCanvas);
    }
  }

  setupEventListeners() {
    // Toggle button
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggle());
    }

    // Gesture handling for lyric canvas
    if (this.lyricCanvas) {
      // Swipe up for fullscreen
      this.lyricCanvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
      this.lyricCanvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
      
      // Double-tap to edit
      this.lyricCanvas.addEventListener('click', (e) => this.handleTap(e));
    }

    // Keyboard shortcut (Cmd/Ctrl + Shift + L)
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        this.toggle();
      }
    });

    // iOS keyboard handling - prevent layout shift
    this.setupIOSKeyboardHandling();
  }

  /**
   * iOS-specific keyboard handling to prevent jank
   */
  setupIOSKeyboardHandling() {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (!isIOS) return;

    // Track keyboard state
    let keyboardOpen = false;

    // Use visualViewport API for reliable keyboard detection
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        if (!this.enabled) return;
        
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        
        // Keyboard is open if viewport is significantly smaller
        const newKeyboardOpen = viewportHeight < windowHeight * 0.75;
        
        if (newKeyboardOpen !== keyboardOpen) {
          keyboardOpen = newKeyboardOpen;
          document.body.classList.toggle('keyboard-open', keyboardOpen);
          
          // Scroll to bottom when keyboard opens
          if (keyboardOpen) {
            this.scrollToBottom();
          }
        }
      });
    }

    // Auto-focus input after send
    messageInput.addEventListener('blur', () => {
      if (!this.enabled) return;
      
      // Re-focus after a short delay (allows button clicks to register)
      setTimeout(() => {
        if (this.enabled && !this.fullscreen && document.activeElement !== messageInput) {
          // Don't refocus if user tapped something else intentionally
        }
      }, 100);
    });
  }

  handleTouchStart(e) {
    this.touchStartY = e.touches[0].clientY;
    this.touchStartX = e.touches[0].clientX;
    this.touchStartTime = Date.now();
    this.touchTarget = e.target.closest('.lyric-verse');
  }

  handleTouchEnd(e) {
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaY = this.touchStartY - touchEndY;
    const deltaX = this.touchStartX - touchEndX;
    const deltaTime = Date.now() - this.touchStartTime;
    
    // Swipe up detection (quick swipe, >100px vertical, minimal horizontal)
    if (deltaY > 100 && Math.abs(deltaX) < 50 && deltaTime < 300) {
      this.toggleFullscreen(true);
    }
    // Swipe down to exit fullscreen
    else if (deltaY < -100 && Math.abs(deltaX) < 50 && deltaTime < 300 && this.fullscreen) {
      this.toggleFullscreen(false);
    }
    // Swipe left on verse to archive
    else if (deltaX > 80 && Math.abs(deltaY) < 50 && deltaTime < 300 && this.touchTarget) {
      this.archiveVerse(this.touchTarget);
    }
  }

  handleTap(e) {
    const now = Date.now();
    const timeSinceLastTap = now - this.lastTapTime;
    
    if (timeSinceLastTap < 300) {
      // Double tap - find verse and enable edit
      const verseEl = e.target.closest('.lyric-verse');
      if (verseEl) {
        this.editVerse(verseEl);
      }
    }
    
    this.lastTapTime = now;
  }

  async toggle() {
    this.enabled = !this.enabled;
    await storage.saveSetting('lyricMode', this.enabled);
    this.applyMode();
    
    // Re-render if enabling
    if (this.enabled) {
      const messages = state.getState('messages') || [];
      this.renderVerses(messages);
    }
  }

  applyMode() {
    // Don't apply lyric mode when agent mode is active
    const agentActive = agentMode.isActive;
    
    if (this.enabled && !agentActive) {
      document.body.classList.add('lyric-mode-active');
      this.messagesContainer?.classList.add('hidden');
      this.lyricCanvas?.classList.remove('hidden');
      this.toggleBtn?.classList.add('active');
      this.toggleBtn?.setAttribute('aria-pressed', 'true');
    } else {
      document.body.classList.remove('lyric-mode-active');
      document.body.classList.remove('lyric-fullscreen');
      this.fullscreen = false;
      this.messagesContainer?.classList.remove('hidden');
      this.lyricCanvas?.classList.add('hidden');
      this.toggleBtn?.classList.remove('active');
      this.toggleBtn?.setAttribute('aria-pressed', 'false');
    }
  }

  toggleFullscreen(enable) {
    this.fullscreen = enable;
    
    if (enable) {
      document.body.classList.add('lyric-fullscreen');
      this.chatHeader?.classList.add('hidden');
      this.inputContainer?.classList.add('hidden');
    } else {
      document.body.classList.remove('lyric-fullscreen');
      this.chatHeader?.classList.remove('hidden');
      this.inputContainer?.classList.remove('hidden');
    }
  }

  /**
   * Render all messages as verses
   */
  async renderVerses(messages) {
    if (!this.lyricCanvas) return;
    
    const versesContainer = this.lyricCanvas.querySelector('.lyric-verses');
    const emptyState = this.lyricCanvas.querySelector('.lyric-empty-state');
    
    if (!messages || messages.length === 0) {
      versesContainer.innerHTML = '';
      emptyState?.classList.remove('hidden');
      return;
    }
    
    emptyState?.classList.add('hidden');
    
    // Build verses HTML
    const settings = await storage.getAllSettings();
    const markdownEnabled = settings.markdown !== false;
    
    let html = '';
    for (const message of messages) {
      html += this.createVerseHTML(message, markdownEnabled);
    }
    
    versesContainer.innerHTML = html;
    
    // Setup action handlers
    this.setupVerseActions(versesContainer);
    
    // Scroll to bottom
    this.scrollToBottom();
  }

  /**
   * Create HTML for a single verse
   */
  createVerseHTML(message, markdownEnabled = true) {
    const { id, role, content, attachments, status } = message;
    const isUser = role === 'user';
    const isStreaming = status === 'streaming' || status === 'pending';
    
    // Process content into word spans for TTS highlighting
    let processedContent = '';
    
    if (isStreaming && !content) {
      processedContent = '<span class="lyric-thinking">✨ Composing...</span>';
    } else if (content) {
      if (markdownEnabled && !isUser) {
        // Render markdown but wrap words in spans
        const rendered = markdownRenderer.render(content);
        processedContent = this.wrapWordsInSpans(rendered);
      } else {
        // Plain text - wrap each word
        processedContent = this.wrapWordsInSpans(this.escapeHtml(content));
      }
    }
    
    // Attachment previews
    let attachmentHTML = '';
    if (attachments && attachments.length > 0) {
      attachmentHTML = '<div class="lyric-attachments">';
      for (const att of attachments) {
        if (att.category === 'image' && att.preview) {
          attachmentHTML += `<img src="${att.preview}" alt="${att.name}" class="lyric-attachment-img">`;
        } else {
          const icon = att.category === 'code' ? '📄' : att.category === 'document' ? '📑' : '📝';
          attachmentHTML += `<div class="lyric-attachment-file">${icon} ${att.name}</div>`;
        }
      }
      attachmentHTML += '</div>';
    }
    
    return `
      <div class="lyric-verse ${isUser ? 'user' : 'assistant'} ${isStreaming ? 'streaming' : ''}" 
           data-message-id="${id}">
        <div class="lyric-verse-content">
          ${attachmentHTML}
          <div class="lyric-text">${processedContent}</div>
        </div>
        <div class="lyric-verse-actions">
          <button class="lyric-action-btn lyric-speak-btn" title="Listen" aria-label="Listen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </button>
          <button class="lyric-action-btn lyric-copy-btn" title="Copy" aria-label="Copy">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Wrap words in spans for TTS highlighting
   * Preserves HTML structure while wrapping text nodes
   */
  wrapWordsInSpans(html) {
    // Create temporary container
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Walk text nodes and wrap words
    const walker = document.createTreeWalker(temp, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }
    
    for (const textNode of textNodes) {
      const text = textNode.textContent;
      if (!text.trim()) continue;
      
      // Don't wrap inside code blocks
      if (textNode.parentElement?.closest('pre, code')) {
        continue;
      }
      
      const words = text.split(/(\s+)/);
      const fragment = document.createDocumentFragment();
      
      for (const word of words) {
        if (/^\s+$/.test(word)) {
          fragment.appendChild(document.createTextNode(word));
        } else if (word) {
          const span = document.createElement('span');
          span.className = 'lyric-word';
          span.textContent = word;
          fragment.appendChild(span);
        }
      }
      
      textNode.parentNode.replaceChild(fragment, textNode);
    }
    
    return temp.innerHTML;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Setup action button handlers for verses
   */
  setupVerseActions(container) {
    // Speak buttons
    container.querySelectorAll('.lyric-speak-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const verse = btn.closest('.lyric-verse');
        if (verse) {
          this.speakVerse(verse);
        }
      });
    });
    
    // Copy buttons
    container.querySelectorAll('.lyric-copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const verse = btn.closest('.lyric-verse');
        if (verse) {
          this.copyVerse(verse);
        }
      });
    });
    
    // Setup copy buttons for code blocks
    container.querySelectorAll('pre code').forEach(block => {
      markdownRenderer.setupCopyButtons(block.closest('.lyric-text'));
    });
  }

  /**
   * Speak a verse with word-level highlighting
   */
  async speakVerse(verseEl) {
    // Stop any current speech
    if (this.currentUtterance) {
      speechSynthesis.cancel();
    }
    
    // Get plain text
    const textEl = verseEl.querySelector('.lyric-text');
    if (!textEl) return;
    
    // Clone and strip HTML
    const clone = textEl.cloneNode(true);
    clone.querySelectorAll('.lyric-action-btn, .copy-btn').forEach(el => el.remove());
    const text = clone.textContent || clone.innerText;
    
    if (!text.trim()) return;
    
    // Mark verse as speaking
    verseEl.classList.add('speaking');
    this.currentVerseEl = verseEl;
    
    // Get word spans
    this.wordSpans = Array.from(textEl.querySelectorAll('.lyric-word'));
    this.currentWordIndex = 0;
    
    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Try to get a good voice
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.name.includes('Samantha') || 
      v.name.includes('Karen') || 
      v.name.includes('Google') ||
      v.lang.startsWith('en')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    // Word boundary event for highlighting
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        this.highlightWord(event.charIndex, text);
      }
    };
    
    utterance.onend = () => {
      this.clearHighlights();
      verseEl.classList.remove('speaking');
      this.currentUtterance = null;
      this.currentVerseEl = null;
    };
    
    utterance.onerror = () => {
      this.clearHighlights();
      verseEl.classList.remove('speaking');
      this.currentUtterance = null;
      this.currentVerseEl = null;
    };
    
    this.currentUtterance = utterance;
    speechSynthesis.speak(utterance);
    
    // Scroll verse into view
    verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Highlight current word based on character index
   */
  highlightWord(charIndex, fullText) {
    // Clear previous highlights
    this.wordSpans.forEach(span => span.classList.remove('lyric-word-active'));
    
    // Find which word we're at based on character position
    let currentPos = 0;
    let wordIndex = 0;
    
    const words = fullText.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const wordStart = fullText.indexOf(words[i], currentPos);
      const wordEnd = wordStart + words[i].length;
      
      if (charIndex >= wordStart && charIndex < wordEnd) {
        wordIndex = i;
        break;
      }
      currentPos = wordEnd;
    }
    
    // Highlight the word span
    if (this.wordSpans[wordIndex]) {
      this.wordSpans[wordIndex].classList.add('lyric-word-active');
      
      // Scroll word into view if needed
      this.wordSpans[wordIndex].scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'center'
      });
    }
  }

  /**
   * Clear all word highlights
   */
  clearHighlights() {
    this.wordSpans.forEach(span => span.classList.remove('lyric-word-active'));
    this.wordSpans = [];
    this.currentWordIndex = 0;
  }

  /**
   * Copy verse text to clipboard
   */
  async copyVerse(verseEl) {
    const textEl = verseEl.querySelector('.lyric-text');
    if (!textEl) return;
    
    const clone = textEl.cloneNode(true);
    clone.querySelectorAll('.lyric-action-btn, .copy-btn').forEach(el => el.remove());
    const text = clone.textContent || clone.innerText;
    
    try {
      await navigator.clipboard.writeText(text);
      
      // Visual feedback
      verseEl.classList.add('copied');
      setTimeout(() => verseEl.classList.remove('copied'), 1000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  /**
   * Edit a verse (for user messages)
   */
  editVerse(verseEl) {
    const messageId = verseEl.dataset.messageId;
    const isUser = verseEl.classList.contains('user');
    
    if (!isUser || !messageId) return;
    
    // Get original text
    const textEl = verseEl.querySelector('.lyric-text');
    if (!textEl) return;
    
    const clone = textEl.cloneNode(true);
    clone.querySelectorAll('.lyric-action-btn').forEach(el => el.remove());
    const originalText = clone.textContent || clone.innerText;
    
    // Populate input and focus
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
      messageInput.value = originalText;
      messageInput.focus();
      
      // Exit fullscreen if active
      if (this.fullscreen) {
        this.toggleFullscreen(false);
      }
    }
  }

  /**
   * Archive a verse (swipe left gesture)
   * Removes from view with animation, stores in archive
   */
  async archiveVerse(verseEl) {
    if (!verseEl) return;
    
    const messageId = verseEl.dataset.messageId;
    if (!messageId) return;

    // Animate out
    verseEl.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    verseEl.style.transform = 'translateX(-100%)';
    verseEl.style.opacity = '0';

    // Remove after animation
    setTimeout(() => {
      verseEl.remove();
      
      // Store archive action (lightweight - just mark as archived)
      this.markAsArchived(messageId);
    }, 300);
  }

  /**
   * Mark message as archived in storage
   */
  async markAsArchived(messageId) {
    try {
      // Get archived list from storage
      const archived = JSON.parse(localStorage.getItem('lyric_archived') || '[]');
      if (!archived.includes(messageId)) {
        archived.push(messageId);
        // Keep only last 100 archived IDs to save space
        if (archived.length > 100) {
          archived.shift();
        }
        localStorage.setItem('lyric_archived', JSON.stringify(archived));
      }
    } catch (err) {
      console.error('Failed to archive:', err);
    }
  }

  /**
   * Update a single verse during streaming
   */
  updateVerse(messageId, content) {
    if (!this.enabled || !this.lyricCanvas) return;
    
    const verseEl = this.lyricCanvas.querySelector(`[data-message-id="${messageId}"]`);
    if (!verseEl) return;
    
    const textEl = verseEl.querySelector('.lyric-text');
    if (!textEl) return;
    
    // Update content with word spans
    textEl.innerHTML = this.wrapWordsInSpans(markdownRenderer.render(content));
    
    // Setup code copy buttons
    markdownRenderer.setupCopyButtons(textEl);
    
    // Remove streaming class if complete
    if (!content.endsWith('...')) {
      verseEl.classList.remove('streaming');
    }
    
    this.scrollToBottom();
  }

  /**
   * Add a new verse for streaming
   */
  addStreamingVerse(message) {
    if (!this.enabled || !this.lyricCanvas) return;
    
    const versesContainer = this.lyricCanvas.querySelector('.lyric-verses');
    const emptyState = this.lyricCanvas.querySelector('.lyric-empty-state');
    
    emptyState?.classList.add('hidden');
    
    const html = this.createVerseHTML(message, true);
    versesContainer.insertAdjacentHTML('beforeend', html);
    
    // Setup actions for new verse
    const newVerse = versesContainer.lastElementChild;
    if (newVerse) {
      this.setupVerseActions(newVerse);
    }
    
    this.scrollToBottom();
  }

  scrollToBottom() {
    if (!this.lyricCanvas) return;
    
    const versesContainer = this.lyricCanvas.querySelector('.lyric-verses');
    if (versesContainer) {
      // Use requestAnimationFrame for smooth scrolling
      requestAnimationFrame(() => {
        versesContainer.scrollTo({
          top: versesContainer.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  }

  /**
   * Focus the message input (call after send)
   */
  focusInput() {
    if (!this.enabled) return;
    
    const messageInput = document.getElementById('message-input');
    if (messageInput && !this.fullscreen) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        messageInput.focus();
      }, 50);
    }
  }

  /**
   * Check if lyric mode is enabled
   */
  isEnabled() {
    return this.enabled;
  }
}

// Export singleton - doesn't auto-init, must call lyricMode.init() after storage is ready
export const lyricMode = new LyricModeController();
