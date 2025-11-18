/**
 * Conversation Model
 * Represents a chat conversation with validation rules
 */

export class Conversation {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.title = data.title || 'New Chat';
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
    this.messageCount = data.messageCount || 0;
    this.model = data.model || null;
    this.archived = data.archived || false;
    this.starred = data.starred || false;
  }

  /**
   * Validate conversation data
   */
  static validate(data) {
    const errors = [];

    if (!data.id || typeof data.id !== 'string') {
      errors.push('Invalid conversation ID');
    }

    if (!data.title || typeof data.title !== 'string') {
      errors.push('Invalid conversation title');
    }

    if (data.title.length > 200) {
      errors.push('Title must be 200 characters or less');
    }

    if (!Number.isInteger(data.createdAt) || data.createdAt < 0) {
      errors.push('Invalid createdAt timestamp');
    }

    if (!Number.isInteger(data.updatedAt) || data.updatedAt < 0) {
      errors.push('Invalid updatedAt timestamp');
    }

    if (!Number.isInteger(data.messageCount) || data.messageCount < 0) {
      errors.push('Invalid message count');
    }

    if (typeof data.archived !== 'boolean') {
      errors.push('Invalid archived flag');
    }

    if (typeof data.starred !== 'boolean') {
      errors.push('Invalid starred flag');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Update conversation metadata
   */
  update(updates) {
    if (updates.title !== undefined) {
      this.title = updates.title;
    }
    if (updates.model !== undefined) {
      this.model = updates.model;
    }
    if (updates.messageCount !== undefined) {
      this.messageCount = updates.messageCount;
    }
    if (updates.archived !== undefined) {
      this.archived = updates.archived;
    }
    if (updates.starred !== undefined) {
      this.starred = updates.starred;
    }
    this.updatedAt = Date.now();
  }

  /**
   * Convert to plain object for storage
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      messageCount: this.messageCount,
      model: this.model,
      archived: this.archived,
      starred: this.starred
    };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data) {
    return new Conversation(data);
  }
}
