/**
 * Kai API Client
 * Interface for Kai LLM server with streaming support
 */

export class KaiAPIClient {
  constructor(baseURL, customHeaders = {}) {
    this.baseURL = baseURL;
    this.customHeaders = customHeaders;
  }

  /**
   * Send chat completion request (non-streaming)
   */
  async sendMessage(messages, options = {}) {
    const {
      model = 'granite-local',
      temperature = 0.7,
      maxTokens = null,
      stream = false,
      timeout = 120000 // 120 second timeout
    } = options;

    const payload = {
      model: model || 'granite-local',
      messages,
      temperature,
      stream: false
    };

    if (maxTokens) {
      payload.max_tokens = maxTokens;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...this.customHeaders
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        
        try {
          const errorText = await response.text();
          // Try to parse as JSON for better error messages
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorJson.message || errorText;
          } catch {
            errorMessage = errorText || errorMessage;
          }
        } catch {
          // Ignore error reading response body
        }
        
        throw new Error(`API request failed: ${errorMessage}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error('Invalid API response: missing choices');
      }
      
      if (!data.choices[0].message || typeof data.choices[0].message.content !== 'string') {
        throw new Error('Invalid API response: missing message content');
      }

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Check your connection and API endpoint.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Send chat completion request (streaming)
   */
  async *streamMessage(messages, options = {}) {
    console.log('[API] streamMessage called with options:', options);
    const {
      model = 'granite-local',
      temperature = 0.7,
      maxTokens = null,
      timeout = 60000 // 60 second timeout
    } = options;

    const payload = {
      model: model || 'granite-local',
      messages,
      temperature,
      stream: true
    };

    if (maxTokens) {
      payload.max_tokens = maxTokens;
    }
    
    console.log('[API] Request payload:', payload);

    // Create AbortController for timeout if not provided
    const controller = options.signal ? null : new AbortController();
    const signal = options.signal || controller.signal;
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      if (controller) controller.abort();
    }, timeout);

    try {
      console.log('[API] Sending fetch request to:', `${this.baseURL}/v1/chat/completions`);
      const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...this.customHeaders
        },
        body: JSON.stringify(payload),
        signal
      });

      console.log('[API] Response received, status:', response.status);
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${response.status} - ${error}`);
      }

      console.log('[API] Starting to read response stream');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastChunkTime = Date.now();
      const CHUNK_TIMEOUT = 30000; // 30s max between chunks

      try {
        while (true) {
          const { done, value } = await reader.read();
          console.log('[API] Read chunk, done:', done, 'bytes:', value?.length);
          
          if (done) break;

          lastChunkTime = Date.now();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          console.log('[API] Buffer now has', lines.length, 'lines');
          
          // Keep the last incomplete line in buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            
            if (!trimmed) {
              continue;
            }
            
            console.log('[API] Processing line:', trimmed.substring(0, 100));
            
            // Handle various SSE formats
            let data = trimmed;
            
            // Remove 'data:' prefix (single or multiple)
            while (data.startsWith('data:')) {
              data = data.substring(5).trim();
            }
            
            // Skip empty data or non-data lines
            if (!data || (!data.startsWith('{') && data !== '[DONE]')) {
              console.log('[API] Skipping non-JSON line:', data.substring(0, 50));
              continue;
            }
            
            console.log('[API] Extracted data:', data.substring(0, 100));

            if (data === '[DONE]') {
              console.log('[API] Stream complete - received [DONE]');
              return;
            }

            try {
              const parsed = JSON.parse(data);
              console.log('[API] Parsed SSE chunk:', parsed);
              
              // Handle different response formats
              if (parsed.choices && parsed.choices[0]) {
                const choice = parsed.choices[0];
                
                // Check for delta (streaming format)
                if (choice.delta && choice.delta.content !== undefined) {
                  console.log('[API] Yielding delta:', choice.delta);
                  yield choice.delta;
                }
                // Fallback: check for message (some servers use this)
                else if (choice.message && choice.message.content) {
                  console.log('[API] Yielding message as delta:', choice.message);
                  yield { content: choice.message.content };
                }
              }
            } catch (e) {
              console.error('[API] Failed to parse SSE JSON:', data.substring(0, 200), 'Error:', e.message);
              // Continue processing other chunks instead of failing completely
            }
          }
          
          // Check for chunk timeout
          if (Date.now() - lastChunkTime > CHUNK_TIMEOUT) {
            throw new Error('Stream timeout: no data received for 10 seconds');
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out after 60 seconds');
      }
      console.error('[API] Stream error:', error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
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
