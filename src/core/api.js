/**
 * Kai API Client
 * Interface for Kai LLM server with streaming support
 */

export class KaiAPIClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  /**
   * Send chat completion request (non-streaming)
   */
  async sendMessage(messages, options = {}) {
    const {
      model = null,
      temperature = 0.7,
      maxTokens = null,
      stream = false
    } = options;

    const payload = {
      model: model || undefined,
      messages,
      temperature,
      stream: false
    };

    if (maxTokens) {
      payload.max_tokens = maxTokens;
    }

    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Send chat completion request (streaming)
   */
  async *streamMessage(messages, options = {}) {
    const {
      model = null,
      temperature = 0.7,
      maxTokens = null
    } = options;

    const payload = {
      model: model || undefined,
      messages,
      temperature,
      stream: true
    };

    if (maxTokens) {
      payload.max_tokens = maxTokens;
    }

    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: options.signal // For AbortController
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          
          if (!trimmed || !trimmed.startsWith('data: ')) {
            continue;
          }

          const data = trimmed.substring(6); // Remove 'data: ' prefix

          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            
            if (parsed.choices && parsed.choices[0].delta) {
              yield parsed.choices[0].delta;
            }
          } catch (e) {
            console.warn('Failed to parse SSE data:', data, e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get available models
   */
  async getModels() {
    const response = await fetch(`${this.baseURL}/v1/models`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
