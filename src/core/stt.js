/**
 * Speech-to-Text Module using Deepgram
 * Replaces unreliable browser SpeechRecognition
 */

import { storage } from './storage.js';

class STTController {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.onResult = null;
    this.onError = null;
  }

  /**
   * Start recording audio
   */
  async startRecording() {
    if (this.isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Use webm/opus for best quality and compatibility
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.audioChunks = [];

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      });

      this.mediaRecorder.addEventListener('stop', async () => {
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        await this.transcribe(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      });

      this.mediaRecorder.start();
      this.isRecording = true;

    } catch (error) {
      console.error('Failed to start recording:', error);
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  /**
   * Stop recording and transcribe
   */
  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;

    this.mediaRecorder.stop();
    this.isRecording = false;
  }

  /**
   * Transcribe audio using backend (Deepgram)
   */
  async transcribe(audioBlob) {
    try {
      const settings = await storage.getAllSettings();
      const apiUrl = settings.apiUrl || 'https://api.eanhd.com';
      const customHeaders = settings.customHeaders || {};

      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const response = await fetch(`${apiUrl}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: customHeaders,
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Transcription failed: ${errorText}`);
      }

      const result = await response.json();
      
      if (this.onResult && result.text) {
        this.onResult(result.text);
      }

      return result.text;

    } catch (error) {
      console.error('Transcription error:', error);
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  /**
   * Check if recording is active
   */
  isActive() {
    return this.isRecording;
  }

  /**
   * Cancel recording without transcription
   */
  cancel() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.audioChunks = [];
    }
  }
}

export const stt = new STTController();
