/**
 * Attachments Handler
 * Handles file uploads, image processing, and attachment management
 * Supports: Images (with vision), PDFs, text files, code files
 */

// Supported file types and their categories
export const FileCategories = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  CODE: 'code',
  TEXT: 'text'
};

export const SupportedTypes = {
  // Images (for vision models)
  'image/jpeg': { category: FileCategories.IMAGE, ext: 'jpg', maxSize: 20 * 1024 * 1024 },
  'image/png': { category: FileCategories.IMAGE, ext: 'png', maxSize: 20 * 1024 * 1024 },
  'image/gif': { category: FileCategories.IMAGE, ext: 'gif', maxSize: 20 * 1024 * 1024 },
  'image/webp': { category: FileCategories.IMAGE, ext: 'webp', maxSize: 20 * 1024 * 1024 },
  
  // Documents
  'application/pdf': { category: FileCategories.DOCUMENT, ext: 'pdf', maxSize: 10 * 1024 * 1024 },
  
  // Text & Code
  'text/plain': { category: FileCategories.TEXT, ext: 'txt', maxSize: 1 * 1024 * 1024 },
  'text/markdown': { category: FileCategories.TEXT, ext: 'md', maxSize: 1 * 1024 * 1024 },
  'text/csv': { category: FileCategories.TEXT, ext: 'csv', maxSize: 5 * 1024 * 1024 },
  'application/json': { category: FileCategories.CODE, ext: 'json', maxSize: 1 * 1024 * 1024 },
  'text/javascript': { category: FileCategories.CODE, ext: 'js', maxSize: 1 * 1024 * 1024 },
  'text/typescript': { category: FileCategories.CODE, ext: 'ts', maxSize: 1 * 1024 * 1024 },
  'text/html': { category: FileCategories.CODE, ext: 'html', maxSize: 1 * 1024 * 1024 },
  'text/css': { category: FileCategories.CODE, ext: 'css', maxSize: 1 * 1024 * 1024 },
  'text/x-python': { category: FileCategories.CODE, ext: 'py', maxSize: 1 * 1024 * 1024 },
  'application/x-python': { category: FileCategories.CODE, ext: 'py', maxSize: 1 * 1024 * 1024 },
};

// Extension to MIME type mapping for files without proper MIME
const ExtensionMap = {
  'js': 'text/javascript',
  'ts': 'text/typescript',
  'jsx': 'text/javascript',
  'tsx': 'text/typescript',
  'py': 'text/x-python',
  'md': 'text/markdown',
  'json': 'application/json',
  'html': 'text/html',
  'css': 'text/css',
  'txt': 'text/plain',
  'csv': 'text/csv',
  'pdf': 'application/pdf',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
};

class AttachmentsHandler {
  constructor() {
    this.pendingAttachments = [];
    this.maxAttachments = 5;
  }

  /**
   * Get MIME type from file, with extension fallback
   */
  getMimeType(file) {
    if (file.type && SupportedTypes[file.type]) {
      return file.type;
    }
    
    // Fallback to extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext && ExtensionMap[ext]) {
      return ExtensionMap[ext];
    }
    
    return file.type || 'application/octet-stream';
  }

  /**
   * Validate a file for upload
   */
  validateFile(file) {
    const mimeType = this.getMimeType(file);
    const typeInfo = SupportedTypes[mimeType];
    
    if (!typeInfo) {
      return { valid: false, error: `Unsupported file type: ${file.type || 'unknown'}` };
    }
    
    if (file.size > typeInfo.maxSize) {
      const maxMB = (typeInfo.maxSize / (1024 * 1024)).toFixed(0);
      return { valid: false, error: `File too large. Max ${maxMB}MB for this type.` };
    }
    
    if (this.pendingAttachments.length >= this.maxAttachments) {
      return { valid: false, error: `Maximum ${this.maxAttachments} attachments allowed` };
    }
    
    return { valid: true, mimeType, category: typeInfo.category };
  }

  /**
   * Process and add a file attachment
   */
  async addFile(file) {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const attachment = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      mimeType: validation.mimeType,
      category: validation.category,
      data: null,
      preview: null
    };

    // Process based on category
    if (validation.category === FileCategories.IMAGE) {
      attachment.data = await this.fileToBase64(file);
      attachment.preview = await this.createImagePreview(file);
    } else if (validation.category === FileCategories.TEXT || validation.category === FileCategories.CODE) {
      attachment.data = await this.fileToText(file);
      attachment.preview = this.createTextPreview(attachment.data, file.name);
    } else if (validation.category === FileCategories.DOCUMENT) {
      attachment.data = await this.fileToBase64(file);
      attachment.preview = this.createDocumentPreview(file.name);
    }

    this.pendingAttachments.push(attachment);
    return attachment;
  }

  /**
   * Remove an attachment by ID
   */
  removeAttachment(id) {
    this.pendingAttachments = this.pendingAttachments.filter(a => a.id !== id);
  }

  /**
   * Clear all pending attachments
   */
  clearAttachments() {
    this.pendingAttachments = [];
  }

  /**
   * Get all pending attachments
   */
  getAttachments() {
    return [...this.pendingAttachments];
  }

  /**
   * Check if there are pending attachments
   */
  hasAttachments() {
    return this.pendingAttachments.length > 0;
  }

  /**
   * Convert file to base64
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove data URL prefix, keep only base64
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert file to text
   */
  fileToText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * Create image preview (thumbnail)
   */
  createImagePreview(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Create text/code preview (first few lines)
   */
  createTextPreview(content, filename) {
    const lines = content.split('\n').slice(0, 5);
    const preview = lines.join('\n');
    const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
    return { type: 'text', content: preview, ext, truncated: content.split('\n').length > 5 };
  }

  /**
   * Create document preview placeholder
   */
  createDocumentPreview(filename) {
    return { type: 'document', name: filename };
  }

  /**
   * Format attachments for API (OpenAI vision format)
   */
  formatForAPI(messageContent) {
    if (!this.hasAttachments()) {
      return messageContent;
    }

    // Build content array for vision API
    const content = [];
    
    // Add text content first
    if (messageContent) {
      content.push({
        type: 'text',
        text: messageContent
      });
    }

    // Add attachments
    for (const attachment of this.pendingAttachments) {
      if (attachment.category === FileCategories.IMAGE) {
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${attachment.mimeType};base64,${attachment.data}`,
            detail: 'auto'
          }
        });
      } else if (attachment.category === FileCategories.TEXT || attachment.category === FileCategories.CODE) {
        // For text/code, append to message content
        content.push({
          type: 'text',
          text: `\n\n--- File: ${attachment.name} ---\n\`\`\`\n${attachment.data}\n\`\`\``
        });
      } else if (attachment.category === FileCategories.DOCUMENT) {
        // For PDFs, note that they're attached (actual PDF processing would need server-side)
        content.push({
          type: 'text',
          text: `\n\n[Attached document: ${attachment.name}]`
        });
      }
    }

    return content;
  }

  /**
   * Get attachment summary for display
   */
  getAttachmentSummary() {
    if (!this.hasAttachments()) return '';
    
    const count = this.pendingAttachments.length;
    const images = this.pendingAttachments.filter(a => a.category === FileCategories.IMAGE).length;
    const files = count - images;
    
    const parts = [];
    if (images > 0) parts.push(`${images} image${images > 1 ? 's' : ''}`);
    if (files > 0) parts.push(`${files} file${files > 1 ? 's' : ''}`);
    
    return parts.join(', ');
  }
}

export const attachments = new AttachmentsHandler();
