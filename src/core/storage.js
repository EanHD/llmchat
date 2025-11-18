/**
 * IndexedDB Storage Wrapper
 * Handles all database operations for conversations, messages, and settings
 */

const DB_NAME = 'llmchat';
const DB_VERSION = 1;

// Store names
const STORES = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  SETTINGS: 'settings'
};

class Storage {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize database with schema
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Conversations store
        if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
          const conversationStore = db.createObjectStore(STORES.CONVERSATIONS, { keyPath: 'id' });
          conversationStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          conversationStore.createIndex('createdAt', 'createdAt', { unique: false });
          conversationStore.createIndex('archived', 'archived', { unique: false });
        }

        // Messages store
        if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
          const messageStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
          messageStore.createIndex('conversationId', 'conversationId', { unique: false });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
          messageStore.createIndex('conversation_timestamp', ['conversationId', 'timestamp'], { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Ensure database is initialized
   */
  _ensureDB() {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
  }

  /**
   * Check storage quota
   */
  async checkQuota() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const usagePercent = (estimate.usage / estimate.quota) * 100;
        return {
          usage: estimate.usage,
          quota: estimate.quota,
          percentUsed: usagePercent,
          available: estimate.quota - estimate.usage
        };
      } catch (error) {
        console.warn('Failed to check storage quota:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Generic get operation
   */
  async get(storeName, key) {
    this._ensureDB();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onerror = () => reject(new Error(`Failed to get ${storeName}/${key}: ${request.error}`));
        request.onsuccess = () => resolve(request.result);
      } catch (error) {
        reject(new Error(`Transaction failed for ${storeName}: ${error.message}`));
      }
    });
  }

  /**
   * Generic put operation (add or update)
   */
  async put(storeName, value) {
    this._ensureDB();
    
    // Check quota before large writes
    const quota = await this.checkQuota();
    if (quota && quota.percentUsed > 90) {
      console.warn(`Storage quota ${quota.percentUsed.toFixed(1)}% full`);
      if (quota.percentUsed > 95) {
        throw new Error('Storage quota exceeded. Please delete old conversations.');
      }
    }
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value);

        request.onerror = () => reject(new Error(`Failed to save to ${storeName}: ${request.error}`));
        request.onsuccess = () => resolve(request.result);
        
        transaction.onerror = () => reject(new Error(`Transaction failed: ${transaction.error}`));
      } catch (error) {
        reject(new Error(`Failed to save to ${storeName}: ${error.message}`));
      }
    });
  }

  /**
   * Generic delete operation
   */
  async delete(storeName, key) {
    this._ensureDB();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onerror = () => reject(new Error(`Failed to delete from ${storeName}: ${request.error}`));
        request.onsuccess = () => resolve(request.result);
      } catch (error) {
        reject(new Error(`Delete failed for ${storeName}: ${error.message}`));
      }
    });
  }

  /**
   * Get all items from store
   */
  async getAll(storeName, indexName = null, query = null) {
    this._ensureDB();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const source = indexName ? store.index(indexName) : store;
        const request = query ? source.getAll(query) : source.getAll();

        request.onerror = () => reject(new Error(`Failed to get all from ${storeName}: ${request.error}`));
        request.onsuccess = () => resolve(request.result || []);
      } catch (error) {
        reject(new Error(`Query failed for ${storeName}: ${error.message}`));
      }
    });
  }

  /**
   * Count items in store
   */
  async count(storeName, indexName = null, query = null) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const source = indexName ? store.index(indexName) : store;
      const request = query ? source.count(query) : source.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Clear all items from store
   */
  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  // Conversation-specific methods

  async getConversation(id) {
    return this.get(STORES.CONVERSATIONS, id);
  }

  async saveConversation(conversation) {
    return this.put(STORES.CONVERSATIONS, conversation);
  }

  async deleteConversation(id) {
    // Delete conversation and all its messages
    const messages = await this.getMessagesByConversation(id);
    const transaction = this.db.transaction([STORES.CONVERSATIONS, STORES.MESSAGES], 'readwrite');
    
    const conversationStore = transaction.objectStore(STORES.CONVERSATIONS);
    const messageStore = transaction.objectStore(STORES.MESSAGES);
    
    conversationStore.delete(id);
    messages.forEach(msg => messageStore.delete(msg.id));

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAllConversations() {
    const conversations = await this.getAll(STORES.CONVERSATIONS);
    // Sort by updatedAt descending
    return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Message-specific methods

  async getMessage(id) {
    return this.get(STORES.MESSAGES, id);
  }

  async saveMessage(message) {
    return this.put(STORES.MESSAGES, message);
  }

  async deleteMessage(id) {
    return this.delete(STORES.MESSAGES, id);
  }

  async getMessagesByConversation(conversationId) {
    const messages = await this.getAll(STORES.MESSAGES, 'conversationId', conversationId);
    // Sort by timestamp ascending
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  async deleteMessagesByConversation(conversationId) {
    const messages = await this.getMessagesByConversation(conversationId);
    const transaction = this.db.transaction(STORES.MESSAGES, 'readwrite');
    const store = transaction.objectStore(STORES.MESSAGES);
    
    messages.forEach(msg => store.delete(msg.id));

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Settings-specific methods

  async getSetting(key) {
    const result = await this.get(STORES.SETTINGS, key);
    return result ? result.value : null;
  }

  async saveSetting(key, value) {
    return this.put(STORES.SETTINGS, { key, value });
  }

  async getAllSettings() {
    const settings = await this.getAll(STORES.SETTINGS);
    // Convert array to object
    return settings.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});
  }
}

// Export singleton instance
export const storage = new Storage();
export { STORES };
