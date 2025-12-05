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

      // Try agent endpoint first
      let useAgentEndpoint = true;
      let response;
      
      try {
        response = await fetch(`${apiEndpoint}/v1/agent/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            conversation_id: conversationId,
            model: settings.agentModel || 'x-ai/grok-3-fast',
            stream: true
          }),
          signal: this.abortController.signal
        });
        
        if (!response.ok) {
          useAgentEndpoint = false;
        }
      } catch (e) {
        useAgentEndpoint = false;
      }

      // Fallback to standard chat completions with agent-style formatting
      if (!useAgentEndpoint) {
        yield this.createAgentMessage('planning', '📋 Using standard model with agent formatting...');
        
        response = await fetch(`${apiEndpoint}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: settings.agentModel || settings.model || 'granite-local',
            messages: [
              {
                role: 'system',
                content: `You are a coding assistant in agent mode. Format your responses like a CLI tool:
- Start with a brief plan of what you'll do
- Show your thought process step by step
- When writing code, show the filename and content clearly
- Use clear sections for different parts of your response
- Be concise but thorough`
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
          throw new Error(`API error: ${response.status}`);
        }
      }

      // Step 3: Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              
              // Handle agent-specific events
              if (parsed.type) {
                yield this.processAgentEvent(parsed);
              } 
              // Handle standard OpenAI-style streaming
              else if (parsed.choices?.[0]?.delta?.content) {
                const content = parsed.choices[0].delta.content;
                accumulatedContent += content;
                yield this.createAgentMessage('content', content);
              }
            } catch (e) {
              // Not JSON, might be raw content
              if (data.trim()) {
                yield this.createAgentMessage('content', data);
              }
            }
          }
        }
      }

      yield this.createAgentMessage('complete', '✓ Task complete');

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
   * Process an agent event from the stream
   */
  processAgentEvent(event) {
    const { type, content, metadata } = event;

    switch (type) {
      case 'thinking':
        return this.createAgentMessage('thinking', `🧠 ${content || 'Thinking...'}`);
      
      case 'planning':
        return this.createAgentMessage('planning', `📋 ${content || 'Planning approach...'}`);
      
      case 'tool_start':
        const toolName = metadata?.tool || 'tool';
        return this.createAgentMessage('tool', `🔧 Running ${toolName}...`, metadata);
      
      case 'tool_result':
        return this.createAgentMessage('tool_result', content, metadata);
      
      case 'file_create':
        return this.createAgentMessage('file', `📝 Creating ${metadata?.path || 'file'}...`, metadata);
      
      case 'file_edit':
        return this.createAgentMessage('file', `✏️ Editing ${metadata?.path || 'file'}...`, metadata);
      
      case 'file_read':
        return this.createAgentMessage('file', `📖 Reading ${metadata?.path || 'file'}...`, metadata);
      
      case 'command':
        return this.createAgentMessage('command', `$ ${content}`, metadata);
      
      case 'command_output':
        return this.createAgentMessage('output', content, metadata);
      
      case 'content':
      case 'text':
        return this.createAgentMessage('content', content);
      
      case 'code':
        return this.createAgentMessage('code', content, { language: metadata?.language });
      
      case 'error':
        return this.createAgentMessage('error', `❌ ${content}`);
      
      case 'success':
        return this.createAgentMessage('success', `✅ ${content}`);
      
      case 'progress':
        return this.createAgentMessage('progress', content, { percent: metadata?.percent });
      
      default:
        return this.createAgentMessage('content', content || '');
    }
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
        // For regular content, preserve newlines and format nicely
        const escaped = this.escapeHtml(content);
        return `<span class="agent-content-text">${escaped}</span>`;
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
