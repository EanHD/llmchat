/**
 * Voice Mode Component
 * Browser-only voice mode using Web Speech API (STT) and Speech Synthesis (TTS)
 * No backend required - works fully on GitHub Pages
 */

import { $ } from '../utils/dom.js';
import { state } from '../core/state.js';
import { storage } from '../core/storage.js';
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
    this.voiceBtn = $('#livekit-btn');
    this.messageInput = $('#message-input');
    
    this.isVoiceModeActive = false;
    this.sttController = null;
    this.interimTranscript = '';
    
    this.init();
  }

  init() {
    if (!this.voiceBtn) {
      console.warn('Voice button not found');
      return;
    }

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.voiceBtn.addEventListener('click', () => this.toggleVoiceMode());
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
      console.log('[VoiceMode] Starting browser-only voice mode...');
      
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
      this.messageInput.placeholder = 'Listening...';
      
      state.showToast('Voice mode active - speak now', 'success');
      console.log('[VoiceMode] Voice mode started');
    } catch (error) {
      console.error('[VoiceMode] Failed to start:', error);
      state.showToast('Failed to start voice mode: ' + error.message, 'error');
    }
  }

  async stopVoiceMode() {
    try {
      console.log('[VoiceMode] Stopping voice mode...');
      
      // Stop STT
      if (this.sttController) {
        this.sttController.stopListening();
        this.sttController = null;
      }

      // Stop TTS
      speechOutput.stop();

      // Clear interim
      this.interimTranscript = '';
      this.messageInput.value = '';
      this.messageInput.placeholder = 'Send a message...';

      // Update UI
      this.isVoiceModeActive = false;
      this.updateButtonState();
      
      state.showToast('Voice mode stopped', 'info');
      console.log('[VoiceMode] Voice mode stopped');
    } catch (error) {
      console.error('[VoiceMode] Error stopping voice mode:', error);
    }
  }

  handleInterimTranscript(text) {
    // Show interim transcript in message input
    this.interimTranscript = text;
    this.messageInput.value = text;
  }

  async handleFinalTranscript(text) {
    // Reset interim
    this.interimTranscript = '';
    this.messageInput.value = '';

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
      
      // Speak the clarification request
      speechOutput.speak("I didn't quite catch that. Could you rephrase?");
      
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
      // Speak error message
      speechOutput.speak("Sorry, there was an error processing your message.");
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
      this.voiceBtn.classList.add('active');
      this.voiceBtn.setAttribute('aria-label', 'Stop Voice Mode');
      this.voiceBtn.style.color = '#ef4444'; // Red when active
    } else {
      this.voiceBtn.classList.remove('active');
      this.voiceBtn.setAttribute('aria-label', 'Voice Mode');
      this.voiceBtn.style.color = '';
    }
  }
}
