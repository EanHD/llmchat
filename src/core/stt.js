export class SpeechInputController {
  constructor(options = {}) {
    this.recognition = null;
    this.isListening = false;
    this.onInterimText = options.onInterimText || (() => {});
    this.onFinalText = options.onFinalText || (() => {});
    this.onError = options.onError || (() => {});
    
    this.init();
  }

  init() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (interimTranscript) {
          this.onInterimText(interimTranscript);
        }

        if (finalTranscript) {
          this.onFinalText(finalTranscript);
        }
      };

      this.recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        this.onError(event.error);
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          // Restart if it stopped unexpectedly but we still want to listen
          try {
            this.recognition.start();
          } catch (e) {
            // Ignore
          }
        }
      };
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
  }

  startListening() {
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
      } catch (e) {
        console.error('Failed to start speech recognition:', e);
      }
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.isListening = false;
      this.recognition.stop();
    }
  }
}
