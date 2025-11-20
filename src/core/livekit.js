import { Room, RoomEvent, createLocalAudioTrack } from 'livekit-client';
import { state } from './state.js';

export class LiveKitManager {
  constructor() {
    this.room = null;
    this.isConnected = false;
    this.localTrack = null;
  }

  /**
   * Get token from backend
   */
  async getToken(roomName, identity) {
    const response = await fetch('/livekit/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roomName, identity }),
    });

    if (!response.ok) {
      throw new Error('Failed to get LiveKit token');
    }

    return response.json();
  }

  /**
   * Connect to LiveKit room
   */
  async connect(roomName, identity) {
    if (this.isConnected) return;

    try {
      const { token, url } = await this.getToken(roomName, identity);

      this.room = new Room();
      
      // Handle room events
      this.room.on(RoomEvent.Connected, () => {
        console.log('Connected to LiveKit room:', roomName);
        this.isConnected = true;
      });

      this.room.on(RoomEvent.Disconnected, () => {
        console.log('Disconnected from LiveKit room');
        this.isConnected = false;
        this.room = null;
      });

      await this.room.connect(url, token);
      
    } catch (error) {
      console.error('Failed to connect to LiveKit:', error);
      throw error;
    }
  }

  /**
   * Disconnect from room
   */
  async disconnect() {
    if (this.room) {
      await this.room.disconnect();
    }
  }

  /**
   * Start publishing microphone audio
   */
  async startAudio() {
    if (!this.room || !this.isConnected) {
      throw new Error('Not connected to LiveKit room');
    }

    try {
      this.localTrack = await createLocalAudioTrack();
      await this.room.localParticipant.publishTrack(this.localTrack);
      console.log('Published local audio track');
    } catch (error) {
      console.error('Failed to publish audio:', error);
      throw error;
    }
  }

  /**
   * Stop publishing microphone audio
   */
  async stopAudio() {
    if (this.localTrack) {
      this.localTrack.stop();
      if (this.room && this.room.localParticipant) {
        await this.room.localParticipant.unpublishTrack(this.localTrack);
      }
      this.localTrack = null;
      console.log('Stopped local audio track');
    }
  }
}

export const livekitManager = new LiveKitManager();
