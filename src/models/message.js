/**
 * Message Model
 * Represents a single message in a conversation with validation
 */

export const MessageStatus = {
  PENDING: 'pending',
  STREAMING: 'streaming',
  COMPLETE: 'complete',
  ERROR: 'error'
};

export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
};

export class Message {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.conversationId = data.conversationId;
    this.role = data.role || MessageRole.USER;
    this.content = data.content || '';
    this.timestamp = data.timestamp || Date.now();
    this.status = data.status || MessageStatus.COMPLETE;
    this.tokenCount = data.tokenCount || null;
    this.metadata = data.metadata || {};
    this.attachments = data.attachments || []; // Array of attachment objects
  }

  /**
   * Validate message data
   */
  static validate(data) {
    const errors = [];

    if (!data.id || typeof data.id !== 'string') {
      errors.push('Invalid message ID');
    }

    if (!data.conversationId || typeof data.conversationId !== 'string') {
      errors.push('Invalid conversation ID');
    }

    if (!Object.values(MessageRole).includes(data.role)) {
      errors.push('Invalid message role');
    }

    if (typeof data.content !== 'string') {
      errors.push('Invalid message content');
    }

    if (!Number.isInteger(data.timestamp) || data.timestamp < 0) {
      errors.push('Invalid timestamp');
    }

    if (!Object.values(MessageStatus).includes(data.status)) {
      errors.push('Invalid message status');
    }

    if (data.tokenCount !== null && (!Number.isInteger(data.tokenCount) || data.tokenCount < 0)) {
      errors.push('Invalid token count');
    }

    if (typeof data.metadata !== 'object' || data.metadata === null) {
      errors.push('Invalid metadata');
    }

    if (data.attachments && !Array.isArray(data.attachments)) {
      errors.push('Invalid attachments');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Update message content
   */
  updateContent(content) {
    this.content = content;
  }

  /**
   * Update message status
   */
  updateStatus(status) {
    if (Object.values(MessageStatus).includes(status)) {
      this.status = status;
    }
  }

  /**
   * Append content (for streaming)
   */
  appendContent(chunk) {
    this.content += chunk;
  }

  /**
   * Add attachment to message
   */
  addAttachment(attachment) {
    this.attachments.push(attachment);
  }

  /**
   * Check if message has attachments
   */
  hasAttachments() {
    return this.attachments && this.attachments.length > 0;
  }

  /**
   * Convert to plain object for storage
   */
  toJSON() {
    return {
      id: this.id,
      conversationId: this.conversationId,
      role: this.role,
      content: this.content,
      timestamp: this.timestamp,
      status: this.status,
      tokenCount: this.tokenCount,
      metadata: this.metadata,
      attachments: this.attachments
    };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data) {
    return new Message(data);
  }

  /**
   * Create user message
   */
  static createUserMessage(conversationId, content, attachments = []) {
    return new Message({
      conversationId,
      role: MessageRole.USER,
      content,
      status: MessageStatus.COMPLETE,
      attachments
    });
  }

  /**
   * Create assistant message
   */
  static createAssistantMessage(conversationId, content = '') {
    return new Message({
      conversationId,
      role: MessageRole.ASSISTANT,
      content,
      status: MessageStatus.PENDING
    });
  }
}
