/**
 * Speech Cleanup Layer
 * Normalizes STT output by removing disfluencies while preserving meaning
 */

// Common filler words to remove
const FILLER_WORDS = new Set([
  'um', 'uh', 'uhm', 'umm', 'er', 'ah', 'oh', 
  'like', 'you know', 'i mean', 'sort of', 'kind of',
  'basically', 'actually', 'literally', 'right',
  'hmm', 'huh', 'yeah yeah', 'okay okay'
]);

// False start patterns (word followed by itself or similar)
const FALSE_START_PATTERNS = [
  /\b(\w+)\s+\1\b/gi, // Repeated words: "the the"
  /\b(\w+)-\1\b/gi,   // Stuttered words: "p-person"
];

// Noise/laughter patterns to remove
const NOISE_PATTERNS = [
  /\b(ha)+h?\b/gi,      // Laughter: haha, hahaha
  /\b(he)+h?\b/gi,      // Laughter: hehe
  /\*\w+\*/g,           // Action markers: *cough*
  /\[.*?\]/g,           // Bracketed sounds: [clears throat]
  /\(.*?\)/g,           // Parenthetical sounds: (laughs)
];

export class SpeechCleanup {
  /**
   * Clean up speech transcript
   * @param {string} text - Raw STT transcript
   * @returns {object} - { cleaned: string, wasModified: boolean, confidence: number }
   */
  static cleanup(text) {
    if (!text || typeof text !== 'string') {
      return { cleaned: '', wasModified: false, confidence: 0 };
    }

    const original = text.trim();
    let cleaned = original;
    let wasModified = false;

    // Step 1: Remove noise patterns (laughter, coughs, etc.)
    NOISE_PATTERNS.forEach(pattern => {
      const before = cleaned;
      cleaned = cleaned.replace(pattern, ' ');
      if (before !== cleaned) wasModified = true;
    });

    // Step 2: Remove false starts (repeated words, stutters)
    FALSE_START_PATTERNS.forEach(pattern => {
      const before = cleaned;
      cleaned = cleaned.replace(pattern, '$1');
      if (before !== cleaned) wasModified = true;
    });

    // Step 3: Remove filler words
    const words = cleaned.split(/\s+/);
    const filteredWords = words.filter(word => {
      const normalized = word.toLowerCase().replace(/[.,!?;]/g, '');
      return !FILLER_WORDS.has(normalized);
    });
    
    if (filteredWords.length !== words.length) {
      wasModified = true;
      cleaned = filteredWords.join(' ');
    }

    // Step 4: Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Step 5: Fix punctuation
    cleaned = this.normalizePunctuation(cleaned);

    // Step 6: Calculate confidence
    const confidence = this.calculateConfidence(cleaned, original);

    return {
      cleaned,
      wasModified,
      confidence,
      shouldAskForClarification: confidence < 0.3 || cleaned.length < 3
    };
  }

  /**
   * Normalize punctuation
   */
  static normalizePunctuation(text) {
    let result = text;

    // Remove multiple punctuation
    result = result.replace(/([.!?]){2,}/g, '$1');
    
    // Ensure space after punctuation
    result = result.replace(/([.!?,;])(\w)/g, '$1 $2');
    
    // Remove space before punctuation
    result = result.replace(/\s+([.!?,;])/g, '$1');
    
    // Add period at end if missing and text is substantial
    if (result.length > 10 && !/[.!?]$/.test(result)) {
      // Check if it looks like a question
      if (/^(what|where|when|who|why|how|is|are|can|could|would|should|do|does)\b/i.test(result)) {
        result += '?';
      } else {
        result += '.';
      }
    }

    return result;
  }

  /**
   * Calculate confidence score (0-1)
   * Based on how much was cleaned and what remains
   */
  static calculateConfidence(cleaned, original) {
    if (!cleaned) return 0;
    if (cleaned === original) return 1;

    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    const originalWords = original.split(/\s+/).filter(w => w.length > 0);

    // If we removed too much (>70%), low confidence
    if (words.length < originalWords.length * 0.3) {
      return 0.2;
    }

    // If result is too short, lower confidence
    if (words.length < 2) {
      return 0.3;
    }

    // If result has good word count, higher confidence
    if (words.length >= 3) {
      return 0.8;
    }

    return 0.5;
  }

  /**
   * Check if text looks like gibberish or incomplete
   */
  static isGibberish(text) {
    if (!text || text.length < 2) return true;

    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    // Too short
    if (words.length === 0) return true;
    
    // Single very short word
    if (words.length === 1 && words[0].length < 3) return true;

    // Check for excessive repetition
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    if (uniqueWords.size === 1 && words.length > 2) return true;

    return false;
  }

  /**
   * Add voice metadata to message for Kai
   * This helps Kai understand the input came from speech
   */
  static addVoiceMetadata(text) {
    return {
      content: text,
      metadata: {
        inputType: 'voice',
        timestamp: Date.now(),
        cleanupApplied: true
      }
    };
  }
}

export default SpeechCleanup;
