/**
 * Settings Model
 * Application settings with default values and validation
 */

export const DEFAULT_SETTINGS = {
  apiEndpoint: 'https://api.eanhd.com',
  model: 'granite-local', // Default model
  agentModel: 'x-ai/grok-3-fast', // Model for agent mode
  theme: 'auto', // 'light', 'dark', 'auto'
  streaming: true,
  markdown: true,
  codeHighlighting: true,
  autoScroll: true,
  sendOnEnter: true,
  shakeToClear: true, // Shake device to start new chat
  lyricMode: false, // Echo Lyric Mode toggle
  temperature: 0.7,
  maxTokens: null, // Use model default
  customMemory: '', // Custom instructions/memory
  customHeaders: {} // Custom HTTP headers (e.g. for Cloudflare Access)
};

export class Settings {
  constructor(data = {}) {
    // Merge with defaults
    this.values = { ...DEFAULT_SETTINGS, ...data };
  }

  /**
   * Get setting value
   */
  get(key) {
    return this.values[key];
  }

  /**
   * Set setting value
   */
  set(key, value) {
    if (key in DEFAULT_SETTINGS) {
      this.values[key] = value;
    } else {
      throw new Error(`Unknown setting: ${key}`);
    }
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.values = { ...DEFAULT_SETTINGS };
  }

  /**
   * Reset a specific setting
   */
  resetKey(key) {
    if (key in DEFAULT_SETTINGS) {
      this.values[key] = DEFAULT_SETTINGS[key];
    }
  }

  /**
   * Validate settings
   */
  static validate(data) {
    const errors = [];

    // API endpoint
    if (data.apiEndpoint && typeof data.apiEndpoint !== 'string') {
      errors.push('Invalid API endpoint');
    } else if (data.apiEndpoint) {
      // Ensure API endpoint has protocol
      if (!data.apiEndpoint.startsWith('http://') && !data.apiEndpoint.startsWith('https://')) {
        // Auto-fix: prepend https://
        data.apiEndpoint = 'https://' + data.apiEndpoint;
      }
    }

    // Theme
    if (data.theme && !['light', 'dark', 'auto'].includes(data.theme)) {
      errors.push('Invalid theme value');
    }

    // Boolean flags
    const booleanKeys = ['streaming', 'markdown', 'codeHighlighting', 'autoScroll', 'sendOnEnter'];
    booleanKeys.forEach(key => {
      if (data[key] !== undefined && typeof data[key] !== 'boolean') {
        errors.push(`Invalid ${key} value`);
      }
    });

    // Temperature
    if (data.temperature !== undefined) {
      if (typeof data.temperature !== 'number' || data.temperature < 0 || data.temperature > 2) {
        errors.push('Temperature must be between 0 and 2');
      }
    }

    // Max tokens
    if (data.maxTokens !== undefined && data.maxTokens !== null) {
      if (!Number.isInteger(data.maxTokens) || data.maxTokens < 1) {
        errors.push('Max tokens must be a positive integer');
      }
    }

    // Custom Headers
    if (data.customHeaders !== undefined) {
      if (typeof data.customHeaders !== 'object' || data.customHeaders === null) {
        errors.push('Custom headers must be an object');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return { ...this.values };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data) {
    return new Settings(data);
  }
}
