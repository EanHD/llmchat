export class SpeechOutputController {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voice = null;
  }

  /**
   * Speak text
   */
  speak(text) {
    if (!this.synth) return;

    // Cancel any current speech
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select a voice (prefer English)
    const voices = this.synth.getVoices();
    this.voice = voices.find(v => v.lang === 'en-US' && !v.localService) || voices.find(v => v.lang === 'en-US');
    
    if (this.voice) {
      utterance.voice = this.voice;
    }

    this.synth.speak(utterance);
  }

  /**
   * Stop speaking
   */
  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

export const speechOutput = new SpeechOutputController();
