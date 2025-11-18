/**
 * Voice Recording Component
 * Handles voice input with pause/resume functionality
 */

import { $ } from '../utils/dom.js';
import { state } from '../core/state.js';

export class VoiceRecorder {
  constructor(onTranscriptionComplete) {
    this.voiceBtn = $('#voice-btn');
    this.micIcon = $('#mic-icon');
    this.pauseIcon = $('#pause-icon');
    this.messageInput = $('#message-input');
    
    this.onTranscriptionComplete = onTranscriptionComplete;
    
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.isPaused = false;
    this.stream = null;
    
    this.init();
  }
  
  init() {
    if (!this.voiceBtn) return;
    
    this.voiceBtn.addEventListener('click', () => {
      if (!this.isRecording) {
        this.startRecording();
      } else if (this.isPaused) {
        this.resumeRecording();
      } else {
        this.pauseRecording();
      }
    });
    
    // Double click to stop and transcribe
    this.voiceBtn.addEventListener('dblclick', () => {
      if (this.isRecording) {
        this.stopRecording();
      }
    });
  }
  
  async startRecording() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm'
      });
      
      this.audioChunks = [];
      
      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      });
      
      this.mediaRecorder.addEventListener('stop', async () => {
        await this.handleRecordingComplete();
      });
      
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;
      this.isPaused = false;
      
      this.updateUI();
      state.showToast('Recording... Click to pause, double-click to stop', 'info');
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      state.showToast('Microphone access denied or not available', 'error');
    }
  }
  
  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPaused = true;
      this.updateUI();
      state.showToast('Recording paused', 'info');
    }
  }
  
  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPaused = false;
      this.updateUI();
      state.showToast('Recording resumed', 'info');
    }
  }
  
  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      
      this.isRecording = false;
      this.isPaused = false;
      this.updateUI();
    }
  }
  
  async handleRecordingComplete() {
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    
    // Transcribe audio
    state.showToast('Transcribing audio...', 'info');
    
    try {
      const transcription = await this.transcribeAudio(audioBlob);
      
      if (transcription) {
        // Populate input with transcription
        this.messageInput.value = transcription;
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = `${this.messageInput.scrollHeight}px`;
        this.messageInput.focus();
        
        if (this.onTranscriptionComplete) {
          this.onTranscriptionComplete(transcription);
        }
        
        state.showToast('Transcription complete', 'success');
      }
    } catch (error) {
      console.error('Transcription failed:', error);
      state.showToast('Transcription failed: ' + error.message, 'error');
    }
  }
  
  async transcribeAudio(audioBlob) {
    // Use Web Speech API for transcription
    return new Promise((resolve, reject) => {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        // Fallback: Try to use the Kai API for transcription
        this.transcribeWithAPI(audioBlob).then(resolve).catch(reject);
        return;
      }
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      // Convert blob to audio for recognition
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        resolve(transcript);
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        // Fallback to API
        this.transcribeWithAPI(audioBlob).then(resolve).catch(reject);
      };
      
      recognition.start();
      
      // Play audio to trigger recognition
      audio.play().catch(() => {
        // Silent fail if audio can't play
      });
    });
  }
  
  async transcribeWithAPI(audioBlob) {
    // Placeholder for API-based transcription
    // You would send the audio to Kai API or OpenAI Whisper endpoint
    throw new Error('API transcription not yet implemented. Please use browser speech recognition.');
  }
  
  updateUI() {
    if (this.isRecording) {
      this.voiceBtn.classList.add('recording');
      if (this.isPaused) {
        this.micIcon.style.display = 'block';
        this.pauseIcon.style.display = 'none';
        this.voiceBtn.setAttribute('aria-label', 'Resume recording');
      } else {
        this.micIcon.style.display = 'none';
        this.pauseIcon.style.display = 'block';
        this.voiceBtn.setAttribute('aria-label', 'Pause recording');
      }
    } else {
      this.voiceBtn.classList.remove('recording');
      this.micIcon.style.display = 'block';
      this.pauseIcon.style.display = 'none';
      this.voiceBtn.setAttribute('aria-label', 'Voice input');
    }
  }
  
  cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.isRecording = false;
    this.isPaused = false;
    this.updateUI();
  }
}
