/**
 * Sidebar UI Component
 * Conversation list and new chat functionality
 */

import { state } from '../core/state.js';
import { storage } from '../core/storage.js';
import { Conversation } from '../models/conversation.js';
import { createConversationItem } from './components.js';
import { $, clearElement } from '../utils/dom.js';

export class SidebarUI {
  constructor() {
    this.conversationList = $('#conversation-list');
    this.newChatBtn = $('#new-chat-btn');
    this.sidebar = $('#sidebar');
    this.sidebarToggle = $('#sidebar-toggle');
    this.closeSidebarBtn = $('#close-sidebar-btn');

    this.init();
  }

  /**
   * Initialize sidebar
   */
  async init() {
    // Set up event listeners
    this.setupEventListeners();

    // Subscribe to state changes
    state.subscribe('conversations', (conversations) => this.renderConversations(conversations));
    state.subscribe('currentConversationId', (id) => this.updateActiveConversation(id));

    // Load conversations
    await this.loadConversations();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // New chat button
    this.newChatBtn.addEventListener('click', () => this.createNewChat());

    // Conversation list (event delegation)
    this.conversationList.addEventListener('click', (e) => {
      const item = e.target.closest('.conversation-item');
      if (item) {
        const conversationId = item.dataset.conversationId;
        this.switchConversation(conversationId);
      }
    });

    // Sidebar toggle (mobile)
    if (this.sidebarToggle) {
      this.sidebarToggle.addEventListener('click', () => {
        this.sidebar.classList.toggle('open');
      });
    }
    
    // Close sidebar button (mobile)
    if (this.closeSidebarBtn) {
      this.closeSidebarBtn.addEventListener('click', () => {
        this.sidebar.classList.remove('open');
      });
    }
  }

  /**
   * Load conversations from storage
   */
  async loadConversations() {
    const conversations = await storage.getAllConversations();
    state.setConversations(conversations);
  }

  /**
   * Create new chat
   */
  async createNewChat() {
    // Check conversation limit (max 100)
    const conversations = await storage.getAllConversations();
    if (conversations.length >= 100) {
      // Delete oldest conversation
      const oldest = conversations[conversations.length - 1];
      await storage.deleteConversation(oldest.id);
    }

    const conversation = new Conversation({
      title: 'New Chat'
    });

    await storage.saveConversation(conversation.toJSON());
    
    // Update state
    state.setCurrentConversation(conversation.id);
    state.setMessages([]);
    
    // Reload conversations
    await this.loadConversations();

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      this.sidebar.classList.remove('open');
    }
  }

  /**
   * Switch to a conversation
   */
  async switchConversation(conversationId) {
    state.setCurrentConversation(conversationId);

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      this.sidebar.classList.remove('open');
    }
  }

  /**
   * Render conversations
   */
  renderConversations(conversations) {
    clearElement(this.conversationList);

    if (conversations.length === 0) {
      const emptyText = document.createElement('div');
      emptyText.className = 'empty-text';
      emptyText.style.cssText = 'padding: var(--space-md); text-align: center; color: var(--text-tertiary); font-size: var(--text-sm);';
      emptyText.textContent = 'No conversations yet';
      this.conversationList.appendChild(emptyText);
      return;
    }

    const currentId = state.getState('currentConversationId');
    
    // Sort: starred first, then by updatedAt
    const sorted = [...conversations].sort((a, b) => {
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;
      return b.updatedAt - a.updatedAt;
    });

    sorted.forEach(conversation => {
      const isActive = conversation.id === currentId;
      const item = createConversationItem(conversation, isActive, {
        onRename: (id, currentTitle) => this.handleRename(id, currentTitle),
        onDelete: (id) => this.handleDelete(id),
        onToggleStar: (id) => this.handleToggleStar(id)
      });
      this.conversationList.appendChild(item);
    });
  }
  
  /**
   * Handle rename conversation
   */
  async handleRename(conversationId, currentTitle) {
    const newTitle = prompt('Rename conversation:', currentTitle);
    if (newTitle && newTitle.trim() && newTitle !== currentTitle) {
      const conversation = await storage.getConversation(conversationId);
      if (conversation) {
        conversation.title = newTitle.trim();
        conversation.updatedAt = Date.now();
        await storage.saveConversation(conversation);
        await this.loadConversations();
      }
    }
  }
  
  /**
   * Handle delete conversation
   */
  async handleDelete(conversationId) {
    if (confirm('Delete this conversation? This cannot be undone.')) {
      await storage.deleteConversation(conversationId);
      
      // If deleting current conversation, switch to another or create new
      const currentId = state.getState('currentConversationId');
      if (currentId === conversationId) {
        const conversations = await storage.getAllConversations();
        if (conversations.length > 0) {
          state.setCurrentConversation(conversations[0].id);
        } else {
          await this.createNewChat();
        }
      }
      
      await this.loadConversations();
    }
  }
  
  /**
   * Handle toggle star
   */
  async handleToggleStar(conversationId) {
    const conversation = await storage.getConversation(conversationId);
    if (conversation) {
      conversation.starred = !conversation.starred;
      conversation.updatedAt = Date.now();
      await storage.saveConversation(conversation);
      await this.loadConversations();
    }
  }

  /**
   * Update active conversation highlighting
   */
  updateActiveConversation(conversationId) {
    const items = this.conversationList.querySelectorAll('.conversation-item');
    items.forEach(item => {
      if (item.dataset.conversationId === conversationId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
}
