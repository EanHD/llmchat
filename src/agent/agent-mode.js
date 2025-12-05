/**
 * Agent Mode - CLI-style coding agent experience
 * Transforms chat UI into a Claude Code / OpenCode-like experience
 * Messages stream as sequential progress updates (thinking, executing, etc.)
 */

import { state } from '../core/state.js';
import { storage } from '../core/storage.js';
import { toast } from '../ui/toast.js';

class AgentMode {
  constructor() {
    this.isActive = false;
    this.abortController = null;
    this.currentProject = null;
  }

  /**
   * Toggle agent mode on/off
   */
  toggle() {
    this.isActive = !this.isActive;
    document.body.classList.toggle('agent-mode', this.isActive);
    
    const toggleBtn = document.getElementById('agent-mode-toggle');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', this.isActive);
      toggleBtn.setAttribute('aria-pressed', this.isActive);
    }
    
    // Update placeholder text
    const input = document.getElementById('message-input');
    if (input) {
      input.placeholder = this.isActive 
        ? 'Describe what you want to build...' 
        : 'Ask anything...';
    }
    
    toast.info(this.isActive ? 'Agent mode ON' : 'Agent mode OFF');
    return this.isActive;
  }

  /**
   * Check if agent mode is active
   */
  get active() {
    return this.isActive;
  }

  /**
   * Process message in agent mode
   * Returns an async generator that yields progress updates
   */
  async *processMessage(userMessage, conversationId) {
    this.abortController = new AbortController();
    
    try {
      // Step 1: Planning phase
      yield this.createAgentMessage('thinking', '🧠 Analyzing request...');
      
      const settings = await storage.getAllSettings();
      let apiEndpoint = settings.apiEndpoint || 'https://api.eanhd.com';
      if (!apiEndpoint.startsWith('http')) {
        apiEndpoint = 'https://' + apiEndpoint;
      }

      // Use standard chat completions with agent-style system prompt
      yield this.createAgentMessage('planning', '📋 Planning approach...');
      
      // Small delay to show planning step
      await this.delay(300);
      
      const response = await fetch(`${apiEndpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.agentModel || settings.model || 'x-ai/grok-3-fast',
          messages: [
            {
              role: 'system',
              content: `You are Kai, an expert coding assistant operating in agent mode. You help users build software projects step by step.

When responding:
1. Start with a brief summary of what you'll do (1-2 sentences)
2. Break down your approach into clear steps
3. For code: show complete, working code with clear file paths
4. Explain key decisions briefly
5. Be practical and action-oriented

Format code blocks with language specifiers:
\`\`\`javascript
// code here
\`\`\`

For file operations, clearly indicate the file path:
📁 **File: src/example.js**

Be thorough but concise. Focus on working solutions.`
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          stream: true,
          temperature: 0.3
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      yield this.createAgentMessage('executing', '⚡ Generating response...');

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let hasYieldedContent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            if (!data) continue;
            
            try {
              const parsed = JSON.parse(data);
              
              // Handle standard OpenAI-style streaming
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                accumulatedContent += content;
                hasYieldedContent = true;
                yield this.createAgentMessage('content', content);
              }
            } catch (e) {
              // JSON parse error - skip
              console.debug('Non-JSON chunk:', data);
            }
          }
        }
      }

      // Only yield complete if we actually got content
      if (hasYieldedContent) {
        yield this.createAgentMessage('complete', '✓ Done');
      } else {
        yield this.createAgentMessage('error', '❌ No response received from model');
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        yield this.createAgentMessage('cancelled', '⏹ Stopped by user');
      } else {
        console.error('Agent error:', error);
        yield this.createAgentMessage('error', `❌ Error: ${error.message}`);
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Helper to add delays between steps
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a structured agent message
   */
  createAgentMessage(type, content, metadata = {}) {
    return {
      type,
      content,
      metadata,
      timestamp: Date.now()
    };
  }

  /**
   * Stop current agent execution
   */
  stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Format agent message for display in chat
   * Returns HTML string
   */
  formatMessage(agentMsg) {
    const { type, content, metadata } = agentMsg;

    switch (type) {
      case 'thinking':
        return `<div class="agent-step agent-thinking"><span class="agent-icon">🧠</span><span class="agent-text">${this.escapeHtml(content.replace(/^🧠\s*/, ''))}</span></div>`;
      
      case 'planning':
        return `<div class="agent-step agent-planning"><span class="agent-icon">📋</span><span class="agent-text">${this.escapeHtml(content.replace(/^📋\s*/, ''))}</span></div>`;
      
      case 'executing':
        return `<div class="agent-step agent-executing"><span class="agent-icon">⚡</span><span class="agent-text">${this.escapeHtml(content.replace(/^⚡\s*/, ''))}</span></div>`;
      
      case 'tool':
        return `<div class="agent-step agent-tool"><span class="agent-icon">🔧</span><span class="agent-text">${this.escapeHtml(content.replace(/^🔧\s*/, ''))}</span></div>`;
      
      case 'tool_result':
        return `<div class="agent-step agent-tool-result"><pre class="agent-output">${this.escapeHtml(content)}</pre></div>`;
      
      case 'file':
        const fileIcon = content.includes('Creating') ? '📝' : content.includes('Editing') ? '✏️' : '📖';
        return `<div class="agent-step agent-file"><span class="agent-icon">${fileIcon}</span><span class="agent-text">${this.escapeHtml(content.replace(/^[📝✏️📖]\s*/, ''))}</span></div>`;
      
      case 'command':
        return `<div class="agent-step agent-command"><span class="agent-prompt">$</span><code class="agent-cmd">${this.escapeHtml(content.replace(/^\$\s*/, ''))}</code></div>`;
      
      case 'output':
        return `<div class="agent-step agent-output"><pre class="agent-output-text">${this.escapeHtml(content)}</pre></div>`;
      
      case 'code':
        const lang = metadata?.language || '';
        return `<div class="agent-step agent-code"><pre><code class="language-${lang}">${this.escapeHtml(content)}</code></pre></div>`;
      
      case 'error':
        return `<div class="agent-step agent-error"><span class="agent-icon">❌</span><span class="agent-text">${this.escapeHtml(content.replace(/^❌\s*/, ''))}</span></div>`;
      
      case 'success':
        return `<div class="agent-step agent-success"><span class="agent-icon">✅</span><span class="agent-text">${this.escapeHtml(content.replace(/^✅\s*/, ''))}</span></div>`;
      
      case 'complete':
        return `<div class="agent-step agent-complete"><span class="agent-icon">✓</span><span class="agent-text">${this.escapeHtml(content.replace(/^✓\s*/, ''))}</span></div>`;
      
      case 'cancelled':
        return `<div class="agent-step agent-cancelled"><span class="agent-icon">⏹</span><span class="agent-text">${this.escapeHtml(content.replace(/^⏹\s*/, ''))}</span></div>`;
      
      case 'progress':
        const percent = metadata?.percent || 0;
        return `<div class="agent-step agent-progress"><div class="agent-progress-bar"><div class="agent-progress-fill" style="width: ${percent}%"></div></div><span class="agent-text">${this.escapeHtml(content)}</span></div>`;
      
      case 'content':
      default:
        // For regular content, don't escape - it will be rendered with markdown
        return `<span class="agent-content-text">${content}</span>`;
    }
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export const agentMode = new AgentMode();
