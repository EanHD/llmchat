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
    
    // Select a voice (prefer natural sounding voices)
    const voices = this.synth.getVoices();
    
    // Priority list for better voices
    this.voice = voices.find(v => v.name.includes('Google US English')) || 
                 voices.find(v => v.name.includes('Samantha')) ||
                 voices.find(v => v.name.includes('Natural')) ||
                 voices.find(v => v.lang === 'en-US' && !v.localService) || 
                 voices.find(v => v.lang === 'en-US');
    
    if (this.voice) {
      utterance.voice = this.voice;
    }

    // Adjust rate and pitch for more natural feel
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

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
