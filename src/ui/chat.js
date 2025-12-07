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
import { shortcuts } from '../core/shortcuts.js';
import { agentMode } from '../agent/agent-mode.js';
import { attachments, FileCategories } from '../core/attachments.js';
import { tts } from '../core/tts.js';
import { stt } from '../core/stt.js';
import { voiceMode } from '../core/voice-mode.js';
import { ventDetector } from '../core/vent-detector.js';

export class ChatUI {
  constructor() {
    this.messagesContainer = $('#messages');
    this.chatContainer = $('#chat-container');
    this.messageInput = $('#message-input');
    this.sendBtn = $('#send-btn');
    this.micBtn = $('#mic-btn');
    this.attachBtn = $('#attach-btn');
    this.chatTitle = $('#chat-title');
    this.fileInput = $('#file-input');
    this.attachmentPreviews = $('#attachment-previews');
    this.contextMenu = $('#context-menu');
    this.contextPanel = $('#context-panel');
    this.contextInput = $('#context-input');
    this.closeContextPanel = $('#close-context-panel');
    this.contextAddText = $('#context-add-text');
    this.contextAddFile = $('#context-add-file');
    
    this.apiClient = null;
    this.isSubmitting = false;
    this.abortController = null; // For canceling streaming requests
    this.scrollToBottomBtn = null; // Scroll to bottom button
    this.userScrolledUp = false; // Track if user has scrolled up
    
    this.recognition = null;
    this.isListening = false;
    this.isManualStop = false;
    this.lastInterimResult = '';
    
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

    // Mic button
    if (this.micBtn) {
      this.micBtn.addEventListener('click', () => {
        this.toggleVoiceInput();
      });
    }

    // Attach button - toggles context menu
    if (this.attachBtn) {
      this.attachBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleContextMenu();
      });
    }
    
    // Context menu items
    if (this.contextAddText) {
      this.contextAddText.addEventListener('click', () => {
        this.hideContextMenu();
        this.showContextPanel();
      });
    }
    
    if (this.contextAddFile) {
      this.contextAddFile.addEventListener('click', () => {
        this.hideContextMenu();
        if (this.fileInput) this.fileInput.click();
      });
    }
    
    // File input change handler
    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        this.handleFileSelect(e.target.files);
        this.fileInput.value = '';
        // Show panel if files were added
        if (attachments.hasAttachments()) {
          this.showContextPanel();
        }
      });
    }
    
    // Close context panel
    if (this.closeContextPanel) {
      this.closeContextPanel.addEventListener('click', () => {
        this.hideContextPanel();
      });
    }
    
    // Context input change handler
    if (this.contextInput) {
      this.contextInput.addEventListener('input', () => {
        this.updateAttachButton();
        this.toggleInputButtons();
      });
    }
    
    // Click outside to close menu
    document.addEventListener('click', (e) => {
      if (this.contextMenu && !this.contextMenu.classList.contains('hidden')) {
        if (!e.target.closest('#context-menu') && !e.target.closest('#attach-btn')) {
          this.hideContextMenu();
        }
      }
    });
    
    // Drag and drop support
    this.setupDragAndDrop();
    
    // Track user scroll
    this.chatContainer.addEventListener('scroll', () => {
      this.handleScroll();
    });

    // Pull to refresh (New Chat)
    this.setupPullToRefresh();
  }

  /**
   * Toggle context menu visibility
   */
  toggleContextMenu() {
    if (!this.contextMenu) return;
    
    const isHidden = this.contextMenu.classList.contains('hidden');
    if (isHidden) {
      // Hide panel if showing menu
      this.hideContextPanel();
      this.contextMenu.classList.remove('hidden');
    } else {
      this.contextMenu.classList.add('hidden');
    }
  }

  /**
   * Hide context menu
   */
  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.classList.add('hidden');
    }
  }

  /**
   * Show context panel
   */
  showContextPanel() {
    if (this.contextPanel) {
      this.contextPanel.classList.remove('hidden');
      if (this.contextInput) {
        this.contextInput.focus();
      }
    }
  }

  /**
   * Hide context panel
   */
  hideContextPanel() {
    if (this.contextPanel) {
      this.contextPanel.classList.add('hidden');
    }
  }

  /**
   * Check if context area has content
   */
  hasContext() {
    const contextText = this.contextInput?.value?.trim() || '';
    return contextText.length > 0 || attachments.hasAttachments();
  }

  /**
   * Get context text
   */
  getContextText() {
    return this.contextInput?.value?.trim() || '';
  }

  /**
   * Clear context
   */
  clearContext() {
    if (this.contextInput) {
      this.contextInput.value = '';
    }
    attachments.clearAttachments();
    this.renderAttachmentPreviews();
    this.updateAttachButton();
    this.hideContextPanel();
    this.hideContextMenu();
  }

  /**
   * Setup drag and drop for file uploads
   */
  setupDragAndDrop() {
    const dropZone = this.chatContainer;
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.handleFileSelect(files);
      }
    });
  }

  /**
   * Handle file selection
   */
  async handleFileSelect(files) {
    if (!files || files.length === 0) return;

    for (const file of files) {
      try {
        const attachment = await attachments.addFile(file);
        this.renderAttachmentPreviews();
        this.updateAttachButton();
        this.toggleInputButtons(); // Show send button if attachments added
      } catch (error) {
        this.showToast(error.message);
      }
    }
  }

  /**
   * Render attachment previews
   */
  renderAttachmentPreviews() {
    if (!this.attachmentPreviews) return;

    const allAttachments = attachments.getAttachments();
    
    if (allAttachments.length === 0) {
      this.attachmentPreviews.classList.add('hidden');
      this.attachmentPreviews.innerHTML = '';
      return;
    }

    this.attachmentPreviews.classList.remove('hidden');
    this.attachmentPreviews.innerHTML = allAttachments.map(att => {
      if (att.category === FileCategories.IMAGE) {
        return `
          <div class="attachment-preview" data-id="${att.id}">
            <img src="${att.preview}" alt="${att.name}">
            <button class="attachment-remove" aria-label="Remove">&times;</button>
            <span class="attachment-name">${this.truncateFilename(att.name)}</span>
          </div>
        `;
      } else {
        const icon = att.category === FileCategories.CODE ? '📄' : 
                     att.category === FileCategories.DOCUMENT ? '📑' : '📝';
        return `
          <div class="attachment-preview attachment-file" data-id="${att.id}">
            <span class="attachment-icon">${icon}</span>
            <button class="attachment-remove" aria-label="Remove">&times;</button>
            <span class="attachment-name">${this.truncateFilename(att.name)}</span>
          </div>
        `;
      }
    }).join('');

    // Add remove handlers
    this.attachmentPreviews.querySelectorAll('.attachment-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preview = e.target.closest('.attachment-preview');
        const id = preview?.dataset.id;
        if (id) {
          attachments.removeAttachment(id);
          this.renderAttachmentPreviews();
          this.updateAttachButton();
          this.toggleInputButtons();
        }
      });
    });
  }

  /**
   * Update attach button state
   */
  updateAttachButton() {
    if (!this.attachBtn) return;
    
    const count = attachments.getAttachments().length;
    if (count > 0) {
      this.attachBtn.classList.add('has-attachments');
      this.attachBtn.setAttribute('data-count', count);
    } else {
      this.attachBtn.classList.remove('has-attachments');
      this.attachBtn.removeAttribute('data-count');
    }
    
    // Also highlight if there's context text
    const hasContextText = this.getContextText().length > 0;
    if (hasContextText || count > 0) {
      this.attachBtn.classList.add('has-context');
    } else {
      this.attachBtn.classList.remove('has-context');
    }
  }

  /**
   * Truncate filename for display
   */
  truncateFilename(name, maxLen = 15) {
    if (name.length <= maxLen) return name;
    const ext = name.split('.').pop();
    const base = name.slice(0, -(ext.length + 1));
    const truncated = base.slice(0, maxLen - ext.length - 4) + '...';
    return `${truncated}.${ext}`;
  }

  /**
   * Format message with attachments for API (OpenAI vision format)
   */
  formatMessageWithAttachments(textContent, messageAttachments) {
    if (!messageAttachments || messageAttachments.length === 0) {
      return textContent;
    }

    // Get full attachment data from the attachments module
    const fullAttachments = attachments.getAttachments();
    
    // Build content array for vision API
    const content = [];
    
    // Add text content first
    if (textContent) {
      content.push({
        type: 'text',
        text: textContent
      });
    }

    // Add attachments
    for (const att of messageAttachments) {
      const fullAtt = fullAttachments.find(a => a.id === att.id);
      
      if (att.category === FileCategories.IMAGE && fullAtt) {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${att.mimeType};base64,${fullAtt.data}`,
            detail: 'auto'
          }
        });
      } else if ((att.category === FileCategories.TEXT || att.category === FileCategories.CODE) && fullAtt) {
        // For text/code files, append as code block
        content.push({
          type: 'text',
          text: `\n\n--- File: ${att.name} ---\n\`\`\`\n${fullAtt.data}\n\`\`\``
        });
      } else if (att.category === FileCategories.DOCUMENT) {
        // For PDFs, note that they're attached
        content.push({
          type: 'text',
          text: `\n\n[Attached document: ${att.name}]`
        });
      }
    }

    // If only text (no vision), return as string
    if (content.length === 1 && content[0].type === 'text') {
      return content[0].text;
    }

    return content;
  }

  adjustTextareaHeight() {
    this.messageInput.style.height = 'auto';
    this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 140) + 'px';
  }

  toggleInputButtons() {
    const hasText = this.messageInput.value.trim().length > 0;
    const hasAttachments = attachments.hasAttachments();
    const hasContextText = this.getContextText().length > 0;
    
    // If listening, always show mic (as stop button) and hide send
    if (this.isListening) {
      if (this.micBtn) this.micBtn.style.display = 'flex';
      this.sendBtn.classList.add('hidden');
      return;
    }

    // Show send button if there's text, attachments, OR context
    if (hasText || hasAttachments || hasContextText) {
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
    let content = this.messageInput.value.trim();
    const hasAttachments = attachments.hasAttachments();
    const contextText = this.getContextText();
    
    // Allow sending with just attachments or context (no main text required)
    if (!content && !hasAttachments && !contextText) {
      return;
    }
    
    if (this.isSubmitting) {
      return;
    }

    // Expand personal shortcuts
    content = shortcuts.expand(content);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(5);
    }

    this.isSubmitting = true;
    this.updateSendButton(true);

    // Get current attachments before clearing
    const currentAttachments = attachments.getAttachments().map(a => ({
      id: a.id,
      name: a.name,
      size: a.size,
      mimeType: a.mimeType,
      category: a.category,
      preview: a.category === FileCategories.IMAGE ? a.preview : null
    }));

    // Build the full message content with context
    let fullContent = content;
    if (contextText) {
      // Prepend context as a clearly marked section
      fullContent = contextText + (content ? '\n\n---\n\n' + content : '');
    }

    try {
      // Get or create conversation
      let conversationId = state.getState('currentConversationId');
      
      if (!conversationId) {
        const conversation = new Conversation({
          title: generateTitle(content || contextText || 'Image', 30),
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

      // Create user message with attachments (store fullContent which includes context)
      const userMessage = Message.createUserMessage(conversationId, fullContent, currentAttachments);
      
      try {
        await storage.saveMessage(userMessage.toJSON());
      } catch (storageError) {
        throw new Error(`Failed to save message: ${storageError.message}`);
      }
      
      state.addMessage(userMessage.toJSON());

      // Clear input, context, and attachments
      this.messageInput.value = '';
      this.adjustTextareaHeight();
      this.clearContext();
      this.toggleInputButtons();
      
      // Analyze message for venting (before creating assistant message)
      const ventAnalysis = ventDetector.analyze(content);
      console.log('Vent detection:', ventAnalysis);
      
      // Show subtle visual feedback if venting detected
      if (ventAnalysis.isVenting) {
        this.showVentFeedback(ventAnalysis);
      }

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
      
      // Format API messages, handling attachments for vision
      const apiMessages = stateMessages
        .filter(m => m.role !== 'system' && m.status === MessageStatus.COMPLETE)
        .map(m => {
          // If message has image attachments, use vision format
          if (m.attachments && m.attachments.length > 0) {
            const hasImages = m.attachments.some(a => a.category === FileCategories.IMAGE);
            if (hasImages) {
              // Build content array for vision API
              const contentParts = [];
              if (m.content) {
                contentParts.push({ type: 'text', text: m.content });
              }
              // Note: For stored messages, we'd need to re-fetch image data
              // For the current message, attachments module has the data
              return {
                role: m.role,
                content: contentParts.length === 1 ? m.content : contentParts
              };
            }
          }
          return {
            role: m.role,
            content: m.content
          };
        });

      // Format the current message with attachments for API
      if (hasAttachments) {
        const lastMsgIndex = apiMessages.length - 1;
        if (lastMsgIndex >= 0) {
          // Get the formatted content with attachments from the attachments module
          // Note: This uses the original attachments data before we cleared them
          const formattedContent = this.formatMessageWithAttachments(content, currentAttachments);
          apiMessages[lastMsgIndex].content = formattedContent;
        }
      }

      // Get settings
      const settings = await storage.getAllSettings();

      // Prepare vent context for API
      const ventContext = ventAnalysis.isVenting ? {
        is_venting: true,
        confidence: ventAnalysis.confidence,
        intensity: ventAnalysis.intensity,
        emotions: ventAnalysis.emotions,
        needs_empathy: ventAnalysis.needsEmpathy,
        needs_motivation: ventAnalysis.needsMotivation,
        needs_validation: ventAnalysis.needsValidation,
        system_prompt_addition: ventAnalysis.systemPromptAddition
      } : null;

      // Check if agent mode is active
      if (agentMode.active) {
        await this.agentResponse(assistantMessage, content, conversationId, settings, ventContext);
      } else if (settings.streaming) {
        await this.streamResponse(assistantMessage, apiMessages, settings, ventContext);
      } else {
        await this.fetchResponse(assistantMessage, apiMessages, settings, ventContext);
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
            conversation.title = generateTitle(firstUserMsg.content, 30);
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
      
      // Show user-friendly toast
      let friendlyMessage = 'Something went wrong. Please try again.';
      if (error.message.includes('Network error') || error.message.includes('fetch')) {
        friendlyMessage = 'Unable to connect. Check your internet connection.';
      } else if (error.message.includes('timed out')) {
        friendlyMessage = 'Request timed out. The server may be busy.';
      } else if (error.message.includes('API')) {
        friendlyMessage = 'AI service unavailable. Try again shortly.';
      }
      
      this.showToast(friendlyMessage);
      
      const messages = state.getState('messages');
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === MessageRole.ASSISTANT) {
        lastMessage.status = MessageStatus.ERROR;
        lastMessage.content = friendlyMessage;
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
  async fetchResponse(assistantMessage, apiMessages, settings, ventContext = null) {
    const modelToUse = settings.model || 'granite-local';
    
    const response = await this.apiClient.sendMessage(apiMessages, {
      model: modelToUse,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      ventContext
    });

    const responseContent = response.choices[0].message.content;
    assistantMessage.updateContent(responseContent);
    assistantMessage.updateStatus(MessageStatus.COMPLETE);
    
    if (response.usage) {
      assistantMessage.tokenCount = response.usage.total_tokens;
    }

    await storage.saveMessage(assistantMessage.toJSON());
    state.updateMessage(assistantMessage.id, assistantMessage.toJSON());
    
    // Voice mode: auto-play TTS if enabled
    await voiceMode.handleNewResponse(assistantMessage.id, responseContent, this);
  }

  /**
   * Stream response (streaming)
   * Note: Streaming continues in background even if user switches conversations.
   * The stream saves progress to storage periodically and on completion.
   */
  async streamResponse(assistantMessage, apiMessages, settings, ventContext = null) {
    assistantMessage.updateStatus(MessageStatus.STREAMING);
    state.updateMessage(assistantMessage.id, assistantMessage.toJSON());
    
    state.setStreaming(true);

    // Save more frequently to ensure progress isn't lost
    let lastSaveTime = Date.now();
    let lastRenderTime = Date.now();
    const SAVE_INTERVAL = 1000; // Save every 1 second
    const RENDER_INTERVAL = 100;
    
    // Track the conversation ID so we can detect if user switched away
    const originalConversationId = state.getState('currentConversationId');
    
    // Create AbortController but don't abort on conversation switch
    this.abortController = new AbortController();

    try {
      const modelToUse = settings.model || 'granite-local';
      
      const stream = this.apiClient.streamMessage(apiMessages, {
        model: modelToUse,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        ventContext
      });
        maxTokens: settings.maxTokens,
        signal: this.abortController.signal
      });
      
      for await (const delta of stream) {
        if (delta.content) {
          assistantMessage.appendContent(delta.content);
          
          const now = Date.now();
          const currentConversationId = state.getState('currentConversationId');
          const isStillActive = currentConversationId === originalConversationId;
          
          // Only update UI if still viewing this conversation
          if (isStillActive && now - lastRenderTime >= RENDER_INTERVAL) {
            await this.updateMessageContent(assistantMessage.id, assistantMessage.content);
            
            if (this.isAtBottom()) {
              this.scrollToBottom();
            }
            
            lastRenderTime = now;
          }
          
          // Always save to storage, regardless of which conversation is active
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

      // Stream completed successfully
      const currentConversationId = state.getState('currentConversationId');
      const isStillActive = currentConversationId === originalConversationId;
      
      if (isStillActive) {
        await this.updateMessageContent(assistantMessage.id, assistantMessage.content);
      }
      
      assistantMessage.updateStatus(MessageStatus.COMPLETE);
      await storage.saveMessage(assistantMessage.toJSON());
      
      if (isStillActive) {
        state.updateMessage(assistantMessage.id, assistantMessage.toJSON());
      }

    } catch (error) {
      console.error('Streaming error:', error);
      
      // Don't mark as error if user just switched conversations
      const currentConversationId = state.getState('currentConversationId');
      const userSwitchedAway = currentConversationId !== originalConversationId;
      
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        // Only append error message if user explicitly stopped
        if (!userSwitchedAway) {
          assistantMessage.updateStatus(MessageStatus.ERROR);
          assistantMessage.content += '\n\n[Streaming stopped by user]';
        } else {
          // User switched away - mark as complete with current content
          assistantMessage.updateStatus(MessageStatus.COMPLETE);
        }
      } else {
        assistantMessage.updateStatus(MessageStatus.ERROR);
        assistantMessage.content += '\n\n[Streaming interrupted: ' + error.message + ']';
      }
      
      // Always save final state
      try {
        await storage.saveMessage(assistantMessage.toJSON());
      } catch (saveError) {
        console.error('Failed to save error state:', saveError);
      }
      
      // Only update state if still on this conversation
      if (!userSwitchedAway) {
        state.updateMessage(assistantMessage.id, assistantMessage.toJSON());
      }
      
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
    // Also stop agent mode if active
    agentMode.stop();
  }

  /**
   * Agent mode response - CLI-style sequential updates
   */
  async agentResponse(assistantMessage, userContent, conversationId, settings, ventContext = null) {
    assistantMessage.updateStatus(MessageStatus.STREAMING);
    state.updateMessage(assistantMessage.id, assistantMessage.toJSON());
    state.setStreaming(true);

    let agentContent = '';
    let lastSaveTime = Date.now();
    const SAVE_INTERVAL = 1000; // Save every second
    const originalConversationId = state.getState('currentConversationId');
    
    try {
      // Pass vent context to agent mode if available
      const agentOptions = ventContext ? { ventContext } : {};
      
      // Process agent messages as they stream in
      for await (const agentMsg of agentMode.processMessage(userContent, conversationId, agentOptions)) {
        // Format the agent message and append to content
        const formatted = agentMode.formatMessage(agentMsg);
        agentContent += formatted;
        
        // Update the message content
        assistantMessage.content = agentContent;
        
        const currentConversationId = state.getState('currentConversationId');
        const isStillActive = currentConversationId === originalConversationId;
        
        // Only update UI if still viewing this conversation
        if (isStillActive) {
          await this.updateAgentMessageContent(assistantMessage.id, agentContent);
          
          // Auto-scroll if near bottom
          if (this.isAtBottom()) {
            this.scrollToBottom();
          }
        }
        
        // Always save periodically
        const now = Date.now();
        if (now - lastSaveTime >= SAVE_INTERVAL) {
          try {
            await storage.saveMessage(assistantMessage.toJSON());
            lastSaveTime = now;
          } catch (saveError) {
            console.error('Failed to save agent message:', saveError);
          }
        }
      }

      // Mark as complete
      assistantMessage.updateStatus(MessageStatus.COMPLETE);
      await storage.saveMessage(assistantMessage.toJSON());
      
      const currentConversationId = state.getState('currentConversationId');
      if (currentConversationId === originalConversationId) {
        state.updateMessage(assistantMessage.id, assistantMessage.toJSON());
      }
      
      // Voice mode: auto-play TTS if enabled
      if (currentConversationId === originalConversationId) {
        await voiceMode.handleNewResponse(assistantMessage.id, assistantMessage.content, this);
      }

    } catch (error) {
      console.error('Agent error:', error);
      
      const currentConversationId = state.getState('currentConversationId');
      const userSwitchedAway = currentConversationId !== originalConversationId;
      
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        if (!userSwitchedAway) {
          assistantMessage.content += agentMode.formatMessage({
            type: 'cancelled',
            content: '⏹ Stopped by user'
          });
          assistantMessage.updateStatus(MessageStatus.ERROR);
        } else {
          assistantMessage.updateStatus(MessageStatus.COMPLETE);
        }
      } else {
        assistantMessage.content += agentMode.formatMessage({
          type: 'error',
          content: `❌ Error: ${error.message}`
        });
        assistantMessage.updateStatus(MessageStatus.ERROR);
      }
      
      await storage.saveMessage(assistantMessage.toJSON());
      
      if (!userSwitchedAway) {
        state.updateMessage(assistantMessage.id, assistantMessage.toJSON());
      }
      
      if (error.name !== 'AbortError' && !error.message.includes('aborted')) {
        throw error;
      }
    }
  }

  /**
   * Update agent message content (renders with markdown for content sections)
   */
  async updateAgentMessageContent(messageId, htmlContent) {
    const messageEl = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) return;

    const contentEl = messageEl.querySelector('.message-content');
    if (!contentEl) return;

    // Parse and render - agent steps are HTML, content text needs markdown
    // Process the content - extract agent-content-text spans and render markdown
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // Find all agent-content-text spans and render markdown
    const contentSpans = tempDiv.querySelectorAll('.agent-content-text');
    for (const span of contentSpans) {
      const rawText = span.textContent;
      try {
        const rendered = await markdownRenderer.render(rawText);
        span.innerHTML = rendered;
      } catch (e) {
        // Keep original if markdown fails
      }
    }
    
    contentEl.innerHTML = tempDiv.innerHTML;
    
    // Add agent response class
    messageEl.classList.add('agent-response');
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
            if ((message.status === 'streaming' || message.status === 'pending') && !message.content) {
               contentEl.innerHTML = '<div class="thinking-indicator"><span class="thinking-text">Kai is thinking</span><span class="thinking-dots-inline"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span></div>';
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

    // Show thinking indicator when streaming but no content yet
    if (!content && state.getState('isStreaming')) {
      contentEl.innerHTML = '<div class="thinking-indicator"><span class="thinking-text">Kai is thinking</span><span class="thinking-dots-inline"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span></div>';
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
      <button class="btn-icon btn-speak" title="Listen" aria-label="Listen to response">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
      </button>
      <button class="btn-icon btn-regen" title="Regenerate" aria-label="Regenerate">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M3.51 15a9 9 0 0 0 14.85 3.36L23 14"/><path d="M1 10l4.64-4.36A9 9 0 0 1 20.49 9"/></svg>
      </button>`;
    
    // Add speak handler
    const speakBtn = actions.querySelector('.btn-speak');
    speakBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const messageEl = contentEl.closest('.message');
      const messageId = messageEl?.dataset?.messageId;
      
      // Get plain text from content (strip HTML)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = contentEl.innerHTML;
      // Remove action buttons from text
      const actionsEl = tempDiv.querySelector('.assistant-actions');
      if (actionsEl) actionsEl.remove();
      const text = tempDiv.textContent || tempDiv.innerText;
      
      if (text.trim()) {
        try {
          await tts.speak(text.trim(), messageId);
        } catch (error) {
          console.error('TTS error:', error);
          this.showToast(`Failed to play audio: ${error.message}`);
        }
      }
    });
    
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

  toggleVoiceInput() {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  async startListening() {
    try {
      // Setup STT callbacks
      stt.onResult = (text) => {
        this.messageInput.value = text;
        this.adjustTextareaHeight();
        this.toggleInputButtons();
      };

      stt.onError = (error) => {
        console.error('STT error:', error);
        this.showToast('Voice input failed');
        this.stopListening();
      };

      // Start recording
      await stt.startRecording();
      
      this.isListening = true;
      this.micBtn.classList.add('listening');
      this.micBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>';
      this.toggleInputButtons();

    } catch (error) {
      console.error('Failed to start listening:', error);
      this.showToast('Microphone access denied');
    }
  }

  stopListening() {
    if (stt.isActive()) {
      stt.stopRecording();
    }
    
    this.isListening = false;
    this.micBtn.classList.remove('listening');
    this.micBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
    this.toggleInputButtons();
  }

  /**
   * Show subtle visual feedback when venting is detected
   */
  showVentFeedback(analysis) {
    const emotionIcons = {
      frustration: '😤',
      sadness: '😔',
      stress: '😰',
      selfDoubt: '🤔',
      motivation: '💪'
    };
    
    const intensityColors = {
      high: '#ff4444',
      medium: '#ffaa44',
      low: '#44aaff'
    };
    
    // Get primary emotion
    const primaryEmotion = analysis.emotions[0] || 'frustration';
    const icon = emotionIcons[primaryEmotion] || '💭';
    const color = intensityColors[analysis.intensity];
    
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'vent-toast';
    toast.style.cssText = `
      position: fixed;
      top: calc(var(--safe-top) + 80px);
      right: 20px;
      background: ${color};
      color: white;
      padding: 12px 20px;
      border-radius: var(--radius-pill);
      font-size: 14px;
      font-weight: 500;
      box-shadow: var(--shadow-md);
      z-index: 9999;
      animation: slideIn 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    const messages = {
      high: 'I hear you, let me respond thoughtfully',
      medium: 'Got it, processing with care',
      low: 'Understood, responding...'
    };
    
    toast.innerHTML = `
      <span style="font-size: 18px;">${icon}</span>
      <span>${messages[analysis.intensity]}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 2.5 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

}
