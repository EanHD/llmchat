/**
 * Personal Shortcuts System
 * Expands text shortcuts before sending messages
 */

import { storage } from './storage.js';

// Default shortcuts for personal use
const DEFAULT_SHORTCUTS = {
  'wtf': 'What the fuck is going on with',
  'tldr': 'Give me a brief summary:',
  'eli5': 'Explain like I\'m 5 and drunk:',
  'roast': 'Be brutally honest about why this sucks:',
  'debug': 'Debug this code and tell me what\'s wrong:',
  'explain': 'Explain this clearly and concisely:',
  'fix': 'Fix this code:',
  'continue': 'Continue from where you left off',
  'shorter': 'Make your last response shorter and more concise',
  'longer': 'Expand on your last response with more details'
};

class ShortcutsManager {
  constructor() {
    this.shortcuts = { ...DEFAULT_SHORTCUTS };
  }

  /**
   * Initialize shortcuts from storage
   */
  async init() {
    const customShortcuts = await storage.getSetting('personalShortcuts');
    if (customShortcuts) {
      this.shortcuts = { ...DEFAULT_SHORTCUTS, ...customShortcuts };
    } else {
      // Save defaults on first run
      await storage.saveSetting('personalShortcuts', DEFAULT_SHORTCUTS);
    }
  }

  /**
   * Expand shortcuts in text
   * @param {string} text - Input text
   * @returns {string} - Expanded text
   */
  expand(text) {
    if (!text || !text.trim()) return text;

    const trimmed = text.trim();
    const words = trimmed.split(/\s+/);
    const firstWord = words[0].toLowerCase();

    // Check if first word is a shortcut
    if (this.shortcuts[firstWord]) {
      const expansion = this.shortcuts[firstWord];
      const rest = words.slice(1).join(' ');
      return rest ? `${expansion} ${rest}` : expansion;
    }

    return text;
  }

  /**
   * Add or update a shortcut
   */
  async addShortcut(key, value) {
    this.shortcuts[key.toLowerCase()] = value;
    await this.saveShortcuts();
  }

  /**
   * Remove a shortcut
   */
  async removeShortcut(key) {
    delete this.shortcuts[key.toLowerCase()];
    await this.saveShortcuts();
  }

  /**
   * Get all shortcuts
   */
  getAll() {
    return { ...this.shortcuts };
  }

  /**
   * Save shortcuts to storage
   */
  async saveShortcuts() {
    await storage.saveSetting('personalShortcuts', this.shortcuts);
  }

  /**
   * Reset to defaults
   */
  async resetToDefaults() {
    this.shortcuts = { ...DEFAULT_SHORTCUTS };
    await this.saveShortcuts();
  }
}

export const shortcuts = new ShortcutsManager();
