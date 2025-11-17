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
import { $, clearElement } from '../utils/dom.js';
import { generateTitle } from '../utils/format.js';

export class ChatUI {
  constructor() {
    this.messagesContainer = $('#messages');
    this.messageInput = $('#message-input');
    this.messageForm = $('#message-form');
    this.sendBtn = $('#send-btn');
    this.chatTitle = $('#chat-title');
    
    this.apiClient = null;
    this.isSubmitting = false;

    this.init();
  }

  /**
   * Initialize chat UI
   */
  async init() {
    // Get API endpoint from settings
    const settings = await storage.getAllSettings();
    const apiEndpoint = settings.apiEndpoint || 'http://eanserver:9000';
    this.apiClient = new KaiAPIClient(apiEndpoint);

    // Set up event listeners
    this.setupEventListeners();

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
    // Form submission
    this.messageForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSendMessage();
    });

    // Auto-resize textarea
    this.messageInput.addEventListener('input', () => {
      this.messageInput.style.height = 'auto';
      this.messageInput.style.height = `${this.messageInput.scrollHeight}px`;
    });

    // Enter to send (without shift)
    this.messageInput.addEventListener('keydown', async (e) => {
      const settings = await storage.getAllSettings();
      if (e.key === 'Enter' && !e.shiftKey && settings.sendOnEnter !== false) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });
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
        await storage.saveConversation(conversation.toJSON());
        conversationId = conversation.id;
        state.setCurrentConversation(conversationId);
        
        // Update conversations list
        const conversations = await storage.getAllConversations();
        state.setConversations(conversations);
      }

      // Create user message
      const userMessage = Message.createUserMessage(conversationId, content);
      await storage.saveMessage(userMessage.toJSON());
      state.addMessage(userMessage.toJSON());

      // Clear input
      this.messageInput.value = '';
      this.messageInput.style.height = 'auto';

      // Create assistant message (pending)
      const assistantMessage = Message.createAssistantMessage(conversationId);
      await storage.saveMessage(assistantMessage.toJSON());
      state.addMessage(assistantMessage.toJSON());

      // Scroll to bottom
      this.scrollToBottom();

      // Get conversation history
      const messages = await storage.getMessagesByConversation(conversationId);
      const apiMessages = messages
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

      // Update conversation
      const conversation = await storage.getConversation(conversationId);
      conversation.messageCount = messages.length + 2;
      conversation.updatedAt = Date.now();
      await storage.saveConversation(conversation);

      // Scroll to bottom
      this.scrollToBottom();

    } catch (error) {
      console.error('Failed to send message:', error);
      state.setError(error.message);
      
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
    const response = await this.apiClient.sendMessage(apiMessages, {
      model: settings.model,
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
    state.setStreaming(true);
    assistantMessage.updateStatus(MessageStatus.STREAMING);
    state.updateMessage(assistantMessage.id, assistantMessage.toJSON());

    try {
      const stream = this.apiClient.streamMessage(apiMessages, {
        model: settings.model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens
      });

      for await (const delta of stream) {
        if (delta.content) {
          assistantMessage.appendContent(delta.content);
          state.updateMessage(assistantMessage.id, assistantMessage.toJSON());
          
          // Auto-scroll during streaming
          if (settings.autoScroll !== false) {
            this.scrollToBottom();
          }
        }
      }

      // Mark as complete
      assistantMessage.updateStatus(MessageStatus.COMPLETE);
      await storage.saveMessage(assistantMessage.toJSON());
      state.updateMessage(assistantMessage.id, assistantMessage.toJSON());

    } catch (error) {
      console.error('Streaming error:', error);
      assistantMessage.updateStatus(MessageStatus.ERROR);
      assistantMessage.content += '\n\n[Streaming interrupted]';
      await storage.saveMessage(assistantMessage.toJSON());
      state.updateMessage(assistantMessage.id, assistantMessage.toJSON());
      throw error;
    }
  }

  /**
   * Render messages
   */
  renderMessages(messages) {
    // During streaming, update message content in place instead of full re-render
    if (state.getState('isStreaming')) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        this.updateMessageContent(lastMessage.id, lastMessage.content);
        return;
      }
    }

    clearElement(this.messagesContainer);

    if (messages.length === 0) {
      this.showEmptyState();
      return;
    }

    messages.forEach(message => {
      const messageBubble = createMessageBubble(message);
      this.messagesContainer.appendChild(messageBubble);
    });

    this.scrollToBottom();
  }

  /**
   * Update message in place (for streaming)
   */
  updateMessageContent(messageId, content) {
    const messageEl = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
      const contentEl = messageEl.querySelector('.message-content');
      if (contentEl) {
        contentEl.textContent = content || '';
      }
    }
  }

  /**
   * Handle streaming state changes
   */
  handleStreamingState(isStreaming) {
    // Could add UI indicators here (e.g., stop button)
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
  scrollToBottom() {
    const container = this.messagesContainer.parentElement;
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 0);
  }
}
