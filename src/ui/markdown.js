/**
 * Markdown Renderer
 * Converts markdown to HTML with syntax highlighting
 */

import { marked } from 'https://cdn.jsdelivr.net/npm/marked@11.0.0/+esm';

export class MarkdownRenderer {
  constructor() {
    this.initializeMarked();
  }

  /**
   * Configure marked options
   */
  initializeMarked() {
    marked.setOptions({
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // Convert \n to <br>
      headerIds: false, // Don't add IDs to headers
      mangle: false, // Don't escape email addresses
      sanitize: false // We'll handle sanitization separately
    });

    // Custom renderer for code blocks
    const renderer = new marked.Renderer();
    
    // Customize code block rendering
    renderer.code = (code, language) => {
      const lang = language || 'plaintext';
      const escaped = this.escapeHtml(code);
      
      return `
<div class="code-block">
  <div class="code-header">
    <span class="code-language">${lang}</span>
    <button class="code-copy-btn" data-code="${this.escapeAttribute(code)}">Copy</button>
  </div>
  <pre><code class="language-${lang}">${escaped}</code></pre>
</div>`;
    };

    // Customize inline code rendering
    renderer.codespan = (code) => {
      return `<code>${this.escapeHtml(code)}</code>`;
    };

    marked.use({ renderer });
  }

  /**
   * Render markdown to HTML
   */
  render(markdown) {
    if (!markdown) return '';

    try {
      const html = marked.parse(markdown);
      return this.sanitizeHtml(html);
    } catch (error) {
      console.error('Markdown rendering error:', error);
      return this.escapeHtml(markdown);
    }
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape attribute value
   */
  escapeAttribute(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Basic HTML sanitization
   * Allow only safe tags
   */
  sanitizeHtml(html) {
    const allowedTags = [
      'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span'
    ];

    const allowedAttributes = {
      'a': ['href', 'title', 'target', 'rel'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
      'code': ['class'],
      'div': ['class'],
      'span': ['class'],
      'button': ['class', 'data-code']
    };

    const div = document.createElement('div');
    div.innerHTML = html;

    // Recursively sanitize elements
    const sanitizeElement = (element) => {
      const tagName = element.tagName.toLowerCase();

      // Remove disallowed tags
      if (!allowedTags.includes(tagName)) {
        element.replaceWith(...element.childNodes);
        return;
      }

      // Remove disallowed attributes
      const allowed = allowedAttributes[tagName] || [];
      Array.from(element.attributes).forEach(attr => {
        if (!allowed.includes(attr.name)) {
          element.removeAttribute(attr.name);
        }
      });

      // Add security attributes to links
      if (tagName === 'a') {
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer');
      }

      // Sanitize children
      Array.from(element.children).forEach(sanitizeElement);
    };

    Array.from(div.children).forEach(sanitizeElement);

    return div.innerHTML;
  }

  /**
   * Set up copy button handlers
   */
  setupCopyButtons(container) {
    const copyButtons = container.querySelectorAll('.code-copy-btn');
    
    copyButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const code = button.getAttribute('data-code');
        
        try {
          await navigator.clipboard.writeText(code);
          button.textContent = 'Copied!';
          setTimeout(() => {
            button.textContent = 'Copy';
          }, 2000);
        } catch (error) {
          console.error('Failed to copy:', error);
          button.textContent = 'Failed';
          setTimeout(() => {
            button.textContent = 'Copy';
          }, 2000);
        }
      });
    });
  }
}

// Export singleton instance
export const markdownRenderer = new MarkdownRenderer();
