/**
 * Voice Mode Component
 * Integrates LiveKit, STT, and TTS for conversational voice experience
 */

import { $ } from '../utils/dom.js';
import { state } from '../core/state.js';
import { storage } from '../core/storage.js';
import { livekitManager } from '../core/livekit.js';
import { SpeechInputController } from '../core/stt.js';
import { speechOutput } from '../core/tts.js';
import { SpeechCleanup } from '../core/speech-cleanup.js';
import { Message, MessageStatus, MessageRole } from '../models/message.js';
import { Conversation } from '../models/conversation.js';
import { generateTitle } from '../utils/format.js';
import { KaiAPIClient } from '../core/api.js';

export class VoiceModeUI {
  constructor(chatUI) {
    this.chatUI = chatUI;
    this.livekitBtn = $('#livekit-btn');
    this.messageInput = $('#message-input');
    
    this.isVoiceModeActive = false;
    this.sessionId = null;
    this.userId = null;
    
    this.sttController = null;
    this.interimTranscript = '';
    
    this.init();
  }

  init() {
    if (!this.livekitBtn) {
      console.warn('LiveKit button not found');
      return;
    }

    // Generate user identity
    this.userId = this.getUserId();

    // Setup click handler
    this.livekitBtn.addEventListener('click', () => {
      this.toggleVoiceMode();
    });
  }

  getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('userId', userId);
    }
    return userId;
  }

  getSessionId() {
    const conversationId = state.getState('currentConversationId');
    if (conversationId) {
      return conversationId;
    }
    // Generate new session ID
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  async toggleVoiceMode() {
    if (this.isVoiceModeActive) {
      await this.stopVoiceMode();
    } else {
      await this.startVoiceMode();
    }
  }

  async startVoiceMode() {
    try {
      // Get session ID
      this.sessionId = this.getSessionId();
      const roomName = `room_llmchat_${this.sessionId}`;

      // Connect to LiveKit
      state.showToast('Connecting to voice mode...', 'info');
      await livekitManager.connect(roomName, this.userId);

      // Start audio publishing
      await livekitManager.startAudio();

      // Initialize STT
      this.sttController = new SpeechInputController({
        onInterimText: (text) => this.handleInterimTranscript(text),
        onFinalText: (text) => this.handleFinalTranscript(text),
        onError: (error) => {
          console.error('STT error:', error);
          state.showToast('Speech recognition error', 'error');
        }
      });

      this.sttController.startListening();

      // Update UI
      this.isVoiceModeActive = true;
      this.updateButtonState();
      state.showToast('Voice mode active - speak to chat', 'success');

    } catch (error) {
      console.error('Failed to start voice mode:', error);
      state.showToast('Failed to start voice mode: ' + error.message, 'error');
      await this.stopVoiceMode();
    }
  }

  async stopVoiceMode() {
    try {
      // Stop STT
      if (this.sttController) {
        this.sttController.stopListening();
        this.sttController = null;
      }

      // Stop TTS
      speechOutput.stop();

      // Stop LiveKit audio and disconnect
      await livekitManager.stopAudio();
      await livekitManager.disconnect();

      // Clear interim transcript
      this.interimTranscript = '';
      this.messageInput.placeholder = 'Send a message...';

      // Update UI
      this.isVoiceModeActive = false;
      this.updateButtonState();
      state.showToast('Voice mode stopped', 'info');

    } catch (error) {
      console.error('Error stopping voice mode:', error);
    }
  }

  handleInterimTranscript(text) {
    // Show interim transcript in input as placeholder
    this.interimTranscript = text;
    this.messageInput.placeholder = `Listening: "${text}"...`;
  }

  async handleFinalTranscript(text) {
    // Reset interim
    this.interimTranscript = '';
    this.messageInput.placeholder = 'Listening...';

    if (!text || !text.trim()) {
      return;
    }

    console.log('[VoiceMode] Raw transcript:', text);

    // Clean up speech disfluencies
    const cleanupResult = SpeechCleanup.cleanup(text);
    console.log('[VoiceMode] Cleanup result:', cleanupResult);

    // Check if we should ask for clarification
    if (cleanupResult.shouldAskForClarification || SpeechCleanup.isGibberish(cleanupResult.cleaned)) {
      console.warn('[VoiceMode] Input unclear after cleanup, asking for rephrase');
      this.messageInput.placeholder = 'Could you rephrase that? (unclear input)';
      
      // Speak the clarification request
      speechOutput.speak("I didn't quite catch that. Could you rephrase?");
      
      // Reset placeholder after a moment
      setTimeout(() => {
        if (this.isVoiceModeActive) {
          this.messageInput.placeholder = 'Listening...';
        }
      }, 3000);
      
      return;
    }

    // Log if cleanup was applied
    if (cleanupResult.wasModified) {
      console.log('[VoiceMode] Cleaned text:', cleanupResult.cleaned);
      console.log('[VoiceMode] Confidence:', cleanupResult.confidence);
    }

    try {
      // Send cleaned text to Kai
      await this.sendMessageToKai(cleanupResult.cleaned);
    } catch (error) {
      console.error('Failed to process voice message:', error);
      state.showToast('Failed to process message', 'error');
    }
  }

  async sendMessageToKai(content) {
    try {
      // Get or create conversation
      let conversationId = state.getState('currentConversationId');
      
      if (!conversationId) {
        const conversation = new Conversation({
          title: generateTitle(content, 50),
          model: null
        });
        
        await storage.saveConversation(conversation.toJSON());
        conversationId = conversation.id;
        state.setCurrentConversation(conversationId);
        
        const conversations = await storage.getAllConversations();
        state.setConversations(conversations);
      }

      // Create user message
      const userMessage = Message.createUserMessage(conversationId, content);
      await storage.saveMessage(userMessage.toJSON());
      state.addMessage(userMessage.toJSON());

      // Create assistant message (pending)
      const assistantMessage = Message.createAssistantMessage(conversationId);
      await storage.saveMessage(assistantMessage.toJSON());
      state.addMessage(assistantMessage.toJSON());

      // Get conversation history
      const stateMessages = state.getState('messages');
      const apiMessages = stateMessages
        .filter(m => m.role !== 'system' && m.status === MessageStatus.COMPLETE)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      // Add voice-aware system prompt
      const systemPrompt = {
        role: 'system',
        content: `You are a helpful AI assistant. The user is interacting with you via voice.

IMPORTANT VOICE INPUT GUIDELINES:
- User input may contain minor speech disfluencies (repeated words, filler sounds, etc.) even after cleanup
- Disfluencies have been mostly removed, but some natural speech patterns may remain
- Focus on the user's INTENT and MEANING, not exact phrasing
- If you're uncertain about what the user meant, ask for clarification
- NEVER assume or invent meaning from unclear input
- Respond naturally and conversationally
- Keep responses concise for voice output (aim for 2-3 sentences unless more detail is requested)`
      };

      // Prepend system message
      const messagesWithSystem = [systemPrompt, ...apiMessages];

      // Get settings and API client
      const settings = await storage.getAllSettings();
      let apiEndpoint = settings.apiEndpoint || 'https://api.eanhd.com';
      if (!apiEndpoint.startsWith('http://') && !apiEndpoint.startsWith('https://')) {
        apiEndpoint = 'https://' + apiEndpoint;
      }
      
      const customHeaders = settings.customHeaders || {};
      const apiClient = new KaiAPIClient(apiEndpoint, customHeaders);
      
      const modelToUse = settings.model || 'granite-local';

      // Call Kai API (non-streaming for voice mode)
      const response = await apiClient.sendMessage(messagesWithSystem, {
        model: modelToUse,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens
      });

      // Update assistant message
      const responseContent = response.choices[0].message.content;
      assistantMessage.updateContent(responseContent);
      assistantMessage.updateStatus(MessageStatus.COMPLETE);
      
      if (response.usage) {
        assistantMessage.tokenCount = response.usage.total_tokens;
      }

      await storage.saveMessage(assistantMessage.toJSON());
      state.updateMessage(assistantMessage.id, assistantMessage.toJSON());

      // Speak the response
      speechOutput.speak(responseContent);

      // Update conversation metadata
      const conversation = await storage.getConversation(conversationId);
      if (conversation) {
        const currentMessages = state.getState('messages');
        conversation.messageCount = currentMessages.length;
        conversation.updatedAt = Date.now();
        
        if (conversation.title === 'New Chat' && currentMessages.length >= 2) {
          const firstUserMsg = currentMessages.find(m => m.role === MessageRole.USER);
          if (firstUserMsg) {
            conversation.title = generateTitle(firstUserMsg.content, 60);
          }
        }
        
        await storage.saveConversation(conversation);
        const conversations = await storage.getAllConversations();
        state.setConversations(conversations);
      }

    } catch (error) {
      console.error('Failed to send message to Kai:', error);
      
      // Update last assistant message to error
      const messages = state.getState('messages');
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === MessageRole.ASSISTANT) {
        lastMessage.status = MessageStatus.ERROR;
        lastMessage.content = 'Failed to get response. Please try again.';
        await storage.saveMessage(lastMessage);
        state.updateMessage(lastMessage.id, lastMessage);
      }
      
      throw error;
    }
  }

  updateButtonState() {
    if (this.isVoiceModeActive) {
      this.livekitBtn.classList.add('active');
      this.livekitBtn.setAttribute('aria-label', 'Stop Voice Mode');
      this.livekitBtn.style.color = '#ef4444'; // Red when active
    } else {
      this.livekitBtn.classList.remove('active');
      this.livekitBtn.setAttribute('aria-label', 'Voice Mode');
      this.livekitBtn.style.color = '';
    }
  }
}
