/**
 * Application State Manager
 * Pub/Sub pattern for UI updates and global state management
 */

class StateManager {
  constructor() {
    this.state = {
      currentConversationId: null,
      conversations: [],
      messages: [],
      settings: {},
      isLoading: false,
      isStreaming: false,
      isOffline: false,
      error: null
    };
    this.subscribers = new Map();
  }

  /**
   * Subscribe to state changes
   * @param {string} key - State key to watch (or '*' for all changes)
   * @param {Function} callback - Called with (newValue, oldValue, key)
   * @returns {Function} Unsubscribe function
   */
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * Update state and notify subscribers
   */
  setState(updates) {
    const oldState = { ...this.state };

    // Apply updates
    Object.assign(this.state, updates);

    // Notify specific subscribers
    Object.keys(updates).forEach(key => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) {
        callbacks.forEach(callback => {
          callback(this.state[key], oldState[key], key);
        });
      }
    });

    // Notify wildcard subscribers
    const wildcardCallbacks = this.subscribers.get('*');
    if (wildcardCallbacks) {
      wildcardCallbacks.forEach(callback => {
        callback(this.state, oldState, '*');
      });
    }
  }

  /**
   * Get current state
   */
  getState(key = null) {
    return key ? this.state[key] : { ...this.state };
  }

  /**
   * Set current conversation
   */
  setCurrentConversation(conversationId) {
    this.setState({ currentConversationId: conversationId });
  }

  /**
   * Update conversations list
   */
  setConversations(conversations) {
    this.setState({ conversations });
  }

  /**
   * Update messages for current conversation
   */
  setMessages(messages) {
    this.setState({ messages });
  }

  /**
   * Add a message to current conversation
   */
  addMessage(message) {
    const messages = [...this.state.messages, message];
    this.setState({ messages });
  }

  /**
   * Update a specific message
   */
  updateMessage(messageId, updates) {
    const messages = this.state.messages.map(msg =>
      msg.id === messageId ? { ...msg, ...updates } : msg
    );
    this.setState({ messages });
  }

  /**
   * Update settings
   */
  setSettings(settings) {
    this.setState({ settings });
  }

  /**
   * Set loading state
   */
  setLoading(isLoading) {
    this.setState({ isLoading });
  }

  /**
   * Set streaming state
   */
  setStreaming(isStreaming) {
    this.setState({ isStreaming });
  }

  /**
   * Set offline state
   */
  setOffline(isOffline) {
    this.setState({ isOffline });
  }

  /**
   * Set error state
   */
  setError(error) {
    this.setState({ error });
  }

  /**
   * Clear error
   */
  clearError() {
    this.setState({ error: null });
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // Import dynamically to avoid circular dependency
    import('../ui/toast.js').then(module => {
      module.toast[type](message);
    });
  }
}

// Export singleton instance
export const state = new StateManager();
