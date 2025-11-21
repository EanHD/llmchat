/**
 * Chat UI Component
 * Message list, input field, send button, and interaction logic
 */

import { state } from '../core/state.js';
import { storage } from '../core/storage.js';
import { KaiAPIClient } from '../core/api.js';
import { Message, MessageStatus, MessageRole } from '../models/message.js';
import { Conversation } from '../models/conversation.js';
import { createMessageBubble, createEmptyState, createSpinner } from './components.js';
import { markdownRenderer } from './markdown.js';
import { $, clearElement } from '../utils/dom.js';
import { generateTitle } from '../utils/format.js';

export class ChatUI {
  constructor() {
    this.messagesContainer = $('#messages');
    this.chatContainer = $('#chat-container');
    this.messageInput = $('#message-input');
    this.sendBtn = $('#send-btn');
    this.micBtn = $('#mic-btn');
    this.attachBtn = $('#attach-btn');
    this.chatTitle = $('#chat-title');
    
    this.apiClient = null;
    this.isSubmitting = false;
    this.abortController = null; // For canceling streaming requests
    this.scrollToBottomBtn = null; // Scroll to bottom button
    this.userScrolledUp = false; // Track if user has scrolled up
    
    this.init();
  }

  /**
   * Initialize chat UI
   */
  async init() {
    // Set up event listeners FIRST
    this.setupEventListeners();
    
    // Create scroll to bottom button
    this.createScrollToBottomButton();
    
    // Get API endpoint from settings
    const settings = await storage.getAllSettings();
    let apiEndpoint = settings.apiEndpoint || 'https://api.eanhd.com';
    
    // Ensure API endpoint has protocol
    if (!apiEndpoint.startsWith('http://') && !apiEndpoint.startsWith('https://')) {
      apiEndpoint = 'https://' + apiEndpoint;
      await storage.saveSetting('apiEndpoint', apiEndpoint);
    }
    
    const customHeaders = settings.customHeaders || {};
    this.apiClient = new KaiAPIClient(apiEndpoint, customHeaders);

    // Subscribe to state changes
    state.subscribe('messages', (messages) => this.renderMessages(messages));
    state.subscribe('currentConversationId', (id) => this.handleConversationChange(id));
    state.subscribe('isLoading', (isLoading) => this.updateLoadingState(isLoading));
    state.subscribe('isStreaming', (isStreaming) => this.handleStreamingState(isStreaming));

    // Show empty state initially
    this.showEmptyState();
    
    // Initial input state check
    this.toggleInputButtons();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Input handling
    if (this.messageInput) {
      this.messageInput.addEventListener('input', () => {
        this.adjustTextareaHeight();
        this.toggleInputButtons();
      });

      this.messageInput.addEventListener('keydown', async (e) => {
        const settings = await storage.getAllSettings();
        if (e.key === 'Enter' && !e.shiftKey && settings.sendOnEnter !== false) {
          e.preventDefault();
          if (state.getState('isStreaming')) return;
          this.handleSendMessage();
        }
      });
    }

    // Send button
    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.getState('isStreaming')) {
          this.stopStreaming();
        } else {
          this.handleSendMessage();
        }
      });
    }

    // Mic button (Placeholder)
    if (this.micBtn) {
      this.micBtn.addEventListener('click', () => {
        // Future voice mode implementation
        console.log('Voice mode coming soon');
      });
    }

    // Attach button (Placeholder)
    if (this.attachBtn) {
      this.attachBtn.addEventListener('click', () => {
        this.showToast('Attachments coming soon');
      });
    }
    
    // Track user scroll
    this.chatContainer.addEventListener('scroll', () => {
      this.handleScroll();
    });

    // Pull to refresh (New Chat)
    this.setupPullToRefresh();
  }

  adjustTextareaHeight() {
    this.messageInput.style.height = 'auto';
    this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 140) + 'px';
  }

  toggleInputButtons() {
    const hasText = this.messageInput.value.trim().length > 0;
    if (hasText) {
      if (this.micBtn) this.micBtn.style.display = 'none';
      this.sendBtn.classList.remove('hidden');
    } else {
      this.sendBtn.classList.add('hidden');
      if (this.micBtn) this.micBtn.style.display = 'flex';
    }
  }

  setupPullToRefresh() {
    let startY = 0;
    let refreshing = false;
    const threshold = 150; // Pull distance to trigger

    this.chatContainer.addEventListener('touchstart', (e) => {
      if (this.chatContainer.scrollTop === 0) {
        startY = e.touches[0].pageY;
      }
    }, { passive: true });

    this.chatContainer.addEventListener('touchmove', (e) => {
      const y = e.touches[0].pageY;
      const pullDistance = y - startY;

      if (this.chatContainer.scrollTop === 0 && pullDistance > 0 && !refreshing) {
        // Visual feedback could be added here (e.g., pulling down an icon)
      }
    }, { passive: true });

    this.chatContainer.addEventListener('touchend', (e) => {
      const y = e.changedTouches[0].pageY;
      const pullDistance = y - startY;

      if (this.chatContainer.scrollTop === 0 && pullDistance > threshold && !refreshing) {
        refreshing = true;
        this.triggerNewChat();
        setTimeout(() => { refreshing = false; }, 1000);
      }
    });
  }

  async triggerNewChat() {
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(50);
    
    // Reset state
    state.setCurrentConversation(null);
    state.setMessages([]);
    this.showEmptyState();
    this.showToast('New Chat Started');
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      z-index: 1000;
      font-size: 14px;
      backdrop-filter: blur(10px);
      animation: fadeInOut 2s ease forwards;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
    
    // Add keyframes if not exists
    if (!document.getElementById('toast-style')) {
      const style = document.createElement('style');
      style.id = 'toast-style';
      style.textContent = `
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translate(-50%, -20px); }
          10% { opacity: 1; transform: translate(-50%, 0); }
          90% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -20px); }
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  /**
   * Create scroll to bottom button
   */
  createScrollToBottomButton() {
    this.scrollToBottomBtn = document.createElement('button');
    this.scrollToBottomBtn.className = 'scroll-to-bottom-btn';
    this.scrollToBottomBtn.setAttribute('aria-label', 'Scroll to bottom');
    this.scrollToBottomBtn.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M7 13l5 5 5-5M7 6l5 5 5-5"/></svg>';
    this.scrollToBottomBtn.style.display = 'none';
    
    this.scrollToBottomBtn.addEventListener('click', () => {
      this.scrollToBottom(true);
    });
    
    this.chatContainer.appendChild(this.scrollToBottomBtn);
  }
  
  /**
   * Handle scroll event
   */
  handleScroll() {
    const container = this.chatContainer;
    const threshold = 100; // pixels from bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    
    this.userScrolledUp = !isNearBottom;
    
    // Show/hide scroll to bottom button
    if (this.scrollToBottomBtn) {
      this.scrollToBottomBtn.style.display = this.userScrolledUp ? 'flex' : 'none';
    }
  }
  
  /**
   * Check if user is at bottom
   */
  isAtBottom() {
    const container = this.chatContainer;
    const threshold = 50;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }

  /**
   * Handle conversation change
   */
  async handleConversationChange(conversationId) {
    if (!conversationId) {
      this.showEmptyState();
      this.chatTitle.textContent = 'New Chat';
      return;
    }

    // Load conversation
    const conversation = await storage.getConversation(conversationId);
    if (conversation) {
      this.chatTitle.textContent = conversation.title;
    }

    // Load messages
    const messages = await storage.getMessagesByConversation(conversationId);
    state.setMessages(messages);
  }

  /**
   * Handle send message
   */
  async handleSendMessage() {
    const content = this.messageInput.value.trim();
    
    if (!content || this.isSubmitting) {
      return;
    }

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(5);
    }

    this.isSubmitting = true;
    this.updateSendButton(true);

    try {
      // Get or create conversation
      let conversationId = state.getState('currentConversationId');
      
      if (!conversationId) {
        const conversation = new Conversation({
          title: generateTitle(content, 50),
          model: null // Will be set when we get response
        });
        
        try {
          await storage.saveConversation(conversation.toJSON());
        } catch (storageError) {
          throw new Error(`Failed to save conversation: ${storageError.message}`);
        }
        
        conversationId = conversation.id;
        state.setCurrentConversation(conversationId);
        
        // Update conversations list
        const conversations = await storage.getAllConversations();
        state.setConversations(conversations);
      }

      // Create user message
      const userMessage = Message.createUserMessage(conversationId, content);
      
      try {
        await storage.saveMessage(userMessage.toJSON());
      } catch (storageError) {
        throw new Error(`Failed to save message: ${storageError.message}`);
      }
      
      state.addMessage(userMessage.toJSON());

      // Clear input
      this.messageInput.value = '';
      this.adjustTextareaHeight();
      this.toggleInputButtons();

      // Create assistant message (pending)
      const assistantMessage = Message.createAssistantMessage(conversationId);
      
      try {
        await storage.saveMessage(assistantMessage.toJSON());
      } catch (storageError) {
        console.error('Failed to save assistant placeholder:', storageError);
      }
      
      state.addMessage(assistantMessage.toJSON());

      // Get conversation history from STATE
      const stateMessages = state.getState('messages');
      const apiMessages = stateMessages
        .filter(m => m.role !== 'system' && m.status === MessageStatus.COMPLETE)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      // Get settings
      const settings = await storage.getAllSettings();

      // Check if streaming is enabled
      if (settings.streaming) {
        await this.streamResponse(assistantMessage, apiMessages, settings);
      } else {
        await this.fetchResponse(assistantMessage, apiMessages, settings);
      }

      // Update conversation metadata
      const currentMessages = state.getState('messages');
      const conversation = await storage.getConversation(conversationId);
      if (conversation) {
        conversation.messageCount = currentMessages.length;
        conversation.updatedAt = Date.now();
        
        if (conversation.title === 'New Chat' && currentMessages.length >= 2) {
          const firstUserMsg = currentMessages.find(m => m.role === MessageRole.USER);
          if (firstUserMsg) {
            conversation.title = generateTitle(firstUserMsg.content, 60);
          }
        }
        
        try {
          await storage.saveConversation(conversation);
          const conversations = await storage.getAllConversations();
          state.setConversations(conversations);
        } catch (storageError) {
          console.error('Failed to update conversation metadata:', storageError);
        }
      }

      this.scrollToBottom();

    } catch (error) {
      console.error('Failed to send message:', error);
      
      const userMessage = error.message || 'An unexpected error occurred';
      state.setError(userMessage);
      
      const messages = state.getState('messages');
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === MessageRole.ASSISTANT) {
        lastMessage.status = MessageStatus.ERROR;
        lastMessage.content = 'Failed to get response from AI. Please try again.';
        await storage.saveMessage(lastMessage);
        state.updateMessage(lastMessage.id, lastMessage);
      }
    } finally {
      this.isSubmitting = false;
      this.updateSendButton(false);
      state.setStreaming(false);
    }
  }

  /**
   * Fetch response (non-streaming)
   */
  async fetchResponse(assistantMessage, apiMessages, settings) {
    const modelToUse = settings.model || 'granite-local';
    
    const response = await this.apiClient.sendMessage(apiMessages, {
      model: modelToUse,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens
    });

    const responseContent = response.choices[0].message.content;
    assistantMessage.updateContent(responseContent);
    assistantMessage.updateStatus(MessageStatus.COMPLETE);
    
    if (response.usage) {
      assistantMessage.tokenCount = response.usage.total_tokens;
    }

    await storage.saveMessage(assistantMessage.toJSON());
    state.updateMessage(assistantMessage.id, assistantMessage.toJSON());
  }

  /**
   * Stream response (streaming)
   */
  async streamResponse(assistantMessage, apiMessages, settings) {
    assistantMessage.updateStatus(MessageStatus.STREAMING);
    state.updateMessage(assistantMessage.id, assistantMessage.toJSON());
    
    state.setStreaming(true);

    let lastSaveTime = Date.now();
    let lastRenderTime = Date.now();
    const SAVE_INTERVAL = 2000;
    const RENDER_INTERVAL = 100;
    
    this.abortController = new AbortController();

    try {
      const modelToUse = settings.model || 'granite-local';
      
      const stream = this.apiClient.streamMessage(apiMessages, {
        model: modelToUse,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        signal: this.abortController.signal
      });
      
      for await (const delta of stream) {
        if (delta.content) {
          assistantMessage.appendContent(delta.content);
          
          const now = Date.now();
          
          if (now - lastRenderTime >= RENDER_INTERVAL) {
            await this.updateMessageContent(assistantMessage.id, assistantMessage.content);
            
            if (this.isAtBottom()) {
              this.scrollToBottom();
            }
            
            lastRenderTime = now;
          }
          
          if (now - lastSaveTime >= SAVE_INTERVAL) {
            try {
              await storage.saveMessage(assistantMessage.toJSON());
              lastSaveTime = now;
            } catch (saveError) {
              console.error('Failed to save streaming message:', saveError);
            }
          }
        }
      }

      await this.updateMessageContent(assistantMessage.id, assistantMessage.content);
      assistantMessage.updateStatus(MessageStatus.COMPLETE);
      await storage.saveMessage(assistantMessage.toJSON());
      state.updateMessage(assistantMessage.id, assistantMessage.toJSON());

    } catch (error) {
      console.error('Streaming error:', error);
      
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        assistantMessage.updateStatus(MessageStatus.ERROR);
        assistantMessage.content += '\n\n[Streaming stopped by user]';
      } else {
        assistantMessage.updateStatus(MessageStatus.ERROR);
        assistantMessage.content += '\n\n[Streaming interrupted: ' + error.message + ']';
      }
      
      try {
        await storage.saveMessage(assistantMessage.toJSON());
      } catch (saveError) {
        console.error('Failed to save error state:', saveError);
      }
      
      state.updateMessage(assistantMessage.id, assistantMessage.toJSON());
      
      if (error.name !== 'AbortError' && !error.message.includes('aborted')) {
        throw error;
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Stop streaming response
   */
  stopStreaming() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Render messages
   */
  async renderMessages(messages) {
    if (state.getState('isStreaming')) {
      if (this.messagesContainer.children.length > 0) {
        return;
      }
    }

    if (messages.length === 0) {
      this.showEmptyState();
      return;
    }

    const emptyState = this.messagesContainer.querySelector('.empty-state');
    if (emptyState) {
      emptyState.remove();
    }

    const settings = await storage.getAllSettings();
    const markdownEnabled = settings.markdown !== false;

    const existingElements = new Map();
    Array.from(this.messagesContainer.children).forEach(el => {
      if (el.dataset.messageId) {
        existingElements.set(el.dataset.messageId, el);
      }
    });

    const processedIds = new Set();

    for (const message of messages) {
      processedIds.add(message.id);
      let messageBubble = existingElements.get(message.id);
      let isNew = false;

      if (!messageBubble) {
        messageBubble = createMessageBubble(message);
        isNew = true;
        this.messagesContainer.appendChild(messageBubble);
      } else {
        if (message.status && !messageBubble.classList.contains(message.status)) {
          messageBubble.classList.remove(MessageStatus.SENDING, MessageStatus.SENT, MessageStatus.ERROR, MessageStatus.STREAMING);
          if (message.status) messageBubble.classList.add(message.status);
        }
      }

      const contentEl = messageBubble.querySelector('.message-content');
      if (contentEl) {
        if (isNew || !state.getState('isStreaming')) {
          if (markdownEnabled && message.role === 'assistant' && message.content) {
             contentEl.innerHTML = markdownRenderer.render(message.content);
             markdownRenderer.setupCopyButtons(contentEl);
             this.addMessageActions(contentEl);
          } else {
            if (message.status === 'streaming' && !message.content) {
               contentEl.innerHTML = '<div class="thinking-dots"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div></div>';
            } else if (contentEl.textContent !== message.content) {
               contentEl.textContent = message.content;
            }
          }
        }
      }
    }

    existingElements.forEach((el, id) => {
      if (!processedIds.has(id)) {
        el.remove();
      }
    });

    if (!state.getState('isStreaming')) {
       this.scrollToBottom(true);
    }
  }

  /**
   * Update message in place (for streaming)
   */
  async updateMessageContent(messageId, content) {
    const messageEl = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) return;

    const contentEl = messageEl.querySelector('.message-content');
    if (!contentEl) return;

    const settings = await storage.getAllSettings();
    const markdownEnabled = settings.markdown !== false;

    if (!content && state.getState('isStreaming')) {
      contentEl.innerHTML = '<div class="thinking-dots"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div></div>';
      return;
    }

    if (markdownEnabled) {
      contentEl.innerHTML = markdownRenderer.render(content || '');
      markdownRenderer.setupCopyButtons(contentEl);
      this.addMessageActions(contentEl);
    } else {
      contentEl.textContent = content || '';
    }
  }

  addMessageActions(contentEl) {
    const actions = document.createElement('div');
    actions.className = 'assistant-actions';
    actions.innerHTML = `
      <button class="btn-icon btn-copy" title="Copy" aria-label="Copy">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <button class="btn-icon btn-regen" title="Regenerate" aria-label="Regenerate">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M3.51 15a9 9 0 0 0 14.85 3.36L23 14"/><path d="M1 10l4.64-4.36A9 9 0 0 1 20.49 9"/></svg>
      </button>`;
    contentEl.appendChild(actions);
  }

  /**
   * Handle streaming state changes
   */
  handleStreamingState(isStreaming) {
    // Update UI for streaming state if needed
    // Note: Send button is now handled by toggleInputButtons mostly, 
    // but we might want to show a stop button.
    // For now, we'll just let the send button be the stop button if streaming.
    
    if (isStreaming) {
      this.sendBtn.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>';
      this.sendBtn.classList.remove('hidden');
      this.sendBtn.style.display = 'flex';
      this.sendBtn.style.opacity = '1';
      this.micBtn.style.display = 'none';
    } else {
      this.sendBtn.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
      this.toggleInputButtons(); // Reset to correct state
    }
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    clearElement(this.messagesContainer);
    const emptyState = createEmptyState(
      'Start a conversation',
      'Send a message to begin chatting with AI'
    );
    this.messagesContainer.appendChild(emptyState);
  }

  /**
   * Update send button state
   */
  updateSendButton(disabled) {
    this.sendBtn.disabled = disabled;
    if (disabled) {
      this.sendBtn.style.opacity = '0.5';
    } else {
      this.sendBtn.style.opacity = '1';
    }
  }

  /**
   * Update loading state
   */
  updateLoadingState(isLoading) {
    if (isLoading) {
      this.messageInput.disabled = true;
    } else {
      this.messageInput.disabled = false;
    }
  }

  /**
   * Scroll to bottom
   */
  scrollToBottom(force = false) {
    if (force || this.isAtBottom()) {
      const target = this.chatContainer.scrollHeight;
      this.chatContainer.scrollTo({ top: target, behavior: 'smooth' });
      this.userScrolledUp = false;
      if (this.scrollToBottomBtn) {
        this.scrollToBottomBtn.style.display = 'none';
      }
    }
  }
}
