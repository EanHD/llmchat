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
    this.messageForm = $('#message-form');
    this.sendBtn = $('#send-btn');
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
    // Set up event listeners FIRST, before any async operations
    this.setupEventListeners();
    
    // Create scroll to bottom button
    this.createScrollToBottomButton();
    
    // Get API endpoint from settings
    const settings = await storage.getAllSettings();
    const apiEndpoint = settings.apiEndpoint || 'https://bulllike-stephanie-lastingly.ngrok-free.dev';
    this.apiClient = new KaiAPIClient(apiEndpoint);

    // Subscribe to state changes
    state.subscribe('messages', (messages) => this.renderMessages(messages));
    state.subscribe('currentConversationId', (id) => this.handleConversationChange(id));
    state.subscribe('isLoading', (isLoading) => this.updateLoadingState(isLoading));
    state.subscribe('isStreaming', (isStreaming) => this.handleStreamingState(isStreaming));

    // Show empty state initially
    this.showEmptyState();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    console.log('[ChatUI] setupEventListeners called');
    console.log('[ChatUI] messageForm:', this.messageForm);
    console.log('[ChatUI] messageInput:', this.messageInput);
    
    // Form submission / stop streaming
    if (!this.messageForm) {
      console.error('Message form not found - event listeners cannot be attached');
      return;
    }
    
    console.log('[ChatUI] Attaching form submit listener');
    
    this.messageForm.addEventListener('submit', (e) => {
      console.log('[ChatUI] Form submit event fired');
      e.preventDefault();
      console.log('[ChatUI] Default prevented');
      
      // If currently streaming, stop it
      if (state.getState('isStreaming')) {
        console.log('[ChatUI] Currently streaming, stopping');
        this.stopStreaming();
      } else {
        console.log('[ChatUI] Calling handleSendMessage');
        this.handleSendMessage();
      }
    });

    // Auto-resize textarea
    if (this.messageInput) {
      this.messageInput.addEventListener('input', () => {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = `${this.messageInput.scrollHeight}px`;
      });

      // Enter to send (without shift)
      this.messageInput.addEventListener('keydown', async (e) => {
        const settings = await storage.getAllSettings();
        if (e.key === 'Enter' && !e.shiftKey && settings.sendOnEnter !== false) {
          e.preventDefault();
          
          // If streaming, don't send new message
          if (state.getState('isStreaming')) {
            return;
          }
          
          this.handleSendMessage();
        }
      });
    }
    
    // Track user scroll
    this.chatContainer.addEventListener('scroll', () => {
      this.handleScroll();
    });
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
    console.log('[ChatUI] handleSendMessage called');
    const content = this.messageInput.value.trim();
    console.log('[ChatUI] Message content:', content);
    console.log('[ChatUI] isSubmitting:', this.isSubmitting);
    
    if (!content || this.isSubmitting) {
      console.log('[ChatUI] Returning early - no content or already submitting');
      return;
    }

    this.isSubmitting = true;
    this.updateSendButton(true);
    console.log('[ChatUI] Starting message send process');

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
      this.messageInput.style.height = 'auto';

      // Create assistant message (pending)
      const assistantMessage = Message.createAssistantMessage(conversationId);
      
      try {
        await storage.saveMessage(assistantMessage.toJSON());
      } catch (storageError) {
        console.error('Failed to save assistant placeholder:', storageError);
        // Continue anyway - will be saved after response
      }
      
      state.addMessage(assistantMessage.toJSON());

      // Don't scroll here - will scroll after render

      // Get conversation history from STATE (not storage) to avoid race conditions
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

      // Update conversation metadata using current message count from state
      const currentMessages = state.getState('messages');
      const conversation = await storage.getConversation(conversationId);
      if (conversation) {
        conversation.messageCount = currentMessages.length;
        conversation.updatedAt = Date.now();
        
        // Auto-generate title from first user message if still "New Chat"
        if (conversation.title === 'New Chat' && currentMessages.length >= 2) {
          const firstUserMsg = currentMessages.find(m => m.role === MessageRole.USER);
          if (firstUserMsg) {
            conversation.title = generateTitle(firstUserMsg.content, 60);
          }
        }
        
        try {
          await storage.saveConversation(conversation);
          
          // Update conversations list to reflect new title
          const conversations = await storage.getAllConversations();
          state.setConversations(conversations);
        } catch (storageError) {
          console.error('Failed to update conversation metadata:', storageError);
          // Non-critical, continue
        }
      }

      // Scroll to bottom
      this.scrollToBottom();

    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Show user-friendly error message
      const userMessage = error.message || 'An unexpected error occurred';
      state.setError(userMessage);
      
      // Update assistant message to error state
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
    // Ensure model is always set
    const modelToUse = settings.model || 'granite-local';
    
    const response = await this.apiClient.sendMessage(apiMessages, {
      model: modelToUse,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens
    });

    // Update assistant message with response
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
    console.log('[ChatUI] streamResponse called with settings:', settings);
    // Update message status first, BEFORE setting streaming flag
    // This allows the initial render to happen with the assistant placeholder
    assistantMessage.updateStatus(MessageStatus.STREAMING);
    state.updateMessage(assistantMessage.id, assistantMessage.toJSON());
    
    // NOW set streaming to prevent subsequent full re-renders
    state.setStreaming(true);

    let lastSaveTime = Date.now();
    let lastRenderTime = Date.now();
    const SAVE_INTERVAL = 2000; // Save every 2 seconds during streaming
    const RENDER_INTERVAL = 100; // Update UI every 100ms max
    
    // Create AbortController for cancellation
    this.abortController = new AbortController();

    try {
      console.log('[ChatUI] Settings:', settings);
      console.log('[ChatUI] Creating stream with model:', settings.model || 'granite-local');
      
      // Ensure model is always set
      const modelToUse = settings.model || 'granite-local';
      console.log('[ChatUI] Using model:', modelToUse);
      
      const stream = this.apiClient.streamMessage(apiMessages, {
        model: modelToUse,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        signal: this.abortController.signal
      });
      
      console.log('[ChatUI] Stream created, starting iteration');

      for await (const delta of stream) {
        console.log('[ChatUI] Received delta:', delta);
        if (delta.content) {
          console.log('[ChatUI] Delta content:', delta.content);
          assistantMessage.appendContent(delta.content);
          
          const now = Date.now();
          
          // Debounced UI update - only render every 100ms
          if (now - lastRenderTime >= RENDER_INTERVAL) {
            // Update DOM directly without triggering full re-render
            await this.updateMessageContent(assistantMessage.id, assistantMessage.content);
            
            // Auto-scroll during streaming only if user is at bottom
            if (this.isAtBottom()) {
              this.scrollToBottom();
            }
            
            lastRenderTime = now;
          }
          
          // Periodic save to prevent data loss
          if (now - lastSaveTime >= SAVE_INTERVAL) {
            try {
              await storage.saveMessage(assistantMessage.toJSON());
              lastSaveTime = now;
            } catch (saveError) {
              console.error('Failed to save streaming message:', saveError);
              // Continue streaming even if save fails
            }
          }
        }
      }

      // Final update and save
      await this.updateMessageContent(assistantMessage.id, assistantMessage.content);
      assistantMessage.updateStatus(MessageStatus.COMPLETE);
      await storage.saveMessage(assistantMessage.toJSON());
      state.updateMessage(assistantMessage.id, assistantMessage.toJSON());

    } catch (error) {
      console.error('Streaming error:', error);
      
      // Check if it was cancelled by user
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
      
      // Only re-throw if not a user cancellation
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
    // During streaming, don't re-render - updates are handled in streamResponse
    // UNLESS the container is empty (initial render after adding messages)
    if (state.getState('isStreaming')) {
      // Only skip if messages are already rendered
      if (this.messagesContainer.children.length > 0) {
        return;
      }
    }

    clearElement(this.messagesContainer);

    if (messages.length === 0) {
      this.showEmptyState();
      return;
    }

    const settings = await storage.getAllSettings();
    const markdownEnabled = settings.markdown !== false;

    for (const message of messages) {
      const messageBubble = createMessageBubble(message);
      
      // Render markdown if enabled
      if (markdownEnabled && message.role === 'assistant' && message.content) {
        const contentEl = messageBubble.querySelector('.message-content');
        if (contentEl) {
          contentEl.innerHTML = markdownRenderer.render(message.content);
          markdownRenderer.setupCopyButtons(contentEl);
        }
      }
      
      this.messagesContainer.appendChild(messageBubble);
    }

    // Force scroll to bottom after rendering (user just sent a message)
    this.scrollToBottom(true);
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

    if (markdownEnabled) {
      contentEl.innerHTML = markdownRenderer.render(content || '');
      markdownRenderer.setupCopyButtons(contentEl);
    } else {
      contentEl.textContent = content || '';
    }
  }

  /**
   * Handle streaming state changes
   */
  handleStreamingState(isStreaming) {
    const sendIcon = document.getElementById('send-icon');
    const stopIcon = document.getElementById('stop-icon');
    
    if (isStreaming) {
      // Show stop icon, hide send icon
      if (sendIcon) sendIcon.style.display = 'none';
      if (stopIcon) stopIcon.style.display = 'block';
      this.sendBtn.setAttribute('aria-label', 'Stop streaming');
      this.sendBtn.title = 'Stop streaming';
    } else {
      // Show send icon, hide stop icon
      if (sendIcon) sendIcon.style.display = 'block';
      if (stopIcon) stopIcon.style.display = 'none';
      this.sendBtn.setAttribute('aria-label', 'Send message');
      this.sendBtn.title = 'Send message';
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
      this.sendBtn.classList.add('loading');
    } else {
      this.sendBtn.classList.remove('loading');
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
    // Only auto-scroll if user is at bottom or force is true
    if (force || this.isAtBottom()) {
      setTimeout(() => {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        this.userScrolledUp = false;
        if (this.scrollToBottomBtn) {
          this.scrollToBottomBtn.style.display = 'none';
        }
      }, 0);
    }
  }
}
