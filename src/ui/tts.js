/**
 * Text-to-Speech Component
 * Handles reading assistant responses aloud
 */

export class TextToSpeech {
  constructor() {
    this.synth = window.speechSynthesis;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.currentMessageId = null;
  }
  
  /**
   * Speak text with TTS
   */
  speak(text, messageId) {
    // Cancel any ongoing speech
    this.stop();
    
    if (!this.synth) {
      throw new Error('Text-to-speech not supported in this browser');
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure voice (prefer natural sounding voices)
    const voices = this.synth.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google US English')) || 
                          voices.find(v => v.name.includes('Samantha')) ||
                          voices.find(v => v.name.includes('Natural')) ||
                          voices.find(v => v.lang === 'en-US' && !v.localService) || 
                          voices.find(v => v.lang === 'en-US') ||
                          voices.find(voice => voice.lang.startsWith('en'));
                          
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onstart = () => {
      this.isPlaying = true;
      this.currentMessageId = messageId;
      this.updateButtonState(messageId, true);
    };
    
    utterance.onend = () => {
      this.isPlaying = false;
      this.currentMessageId = null;
      this.updateButtonState(messageId, false);
      this.currentUtterance = null;
    };
    
    utterance.onerror = (event) => {
      console.error('TTS error:', event);
      this.isPlaying = false;
      this.currentMessageId = null;
      this.updateButtonState(messageId, false);
      this.currentUtterance = null;
    };
    
    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }
  
  /**
   * Stop current speech
   */
  stop() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
      
      if (this.currentMessageId) {
        this.updateButtonState(this.currentMessageId, false);
      }
      
      this.isPlaying = false;
      this.currentMessageId = null;
      this.currentUtterance = null;
    }
  }
  
  /**
   * Toggle speech for a message
   */
  toggle(text, messageId) {
    if (this.isPlaying && this.currentMessageId === messageId) {
      this.stop();
    } else {
      this.speak(text, messageId);
    }
  }
  
  /**
   * Update TTS button state
   */
  updateButtonState(messageId, isPlaying) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) return;
    
    const ttsBtn = messageEl.querySelector('.tts-btn');
    if (!ttsBtn) return;
    
    if (isPlaying) {
      ttsBtn.classList.add('playing');
      ttsBtn.setAttribute('aria-label', 'Stop reading');
    } else {
      ttsBtn.classList.remove('playing');
      ttsBtn.setAttribute('aria-label', 'Read aloud');
    }
  }
  
  /**
   * Check if TTS is available
   */
  static isSupported() {
    return 'speechSynthesis' in window;
  }
}
