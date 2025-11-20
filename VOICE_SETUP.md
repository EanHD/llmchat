# LLMChat - Voice Mode Setup & Usage

## 🎙️ Voice Mode Overview

Voice Mode enables hands-free conversation with your AI using LiveKit for audio transport, browser-based Speech-to-Text (STT), and Text-to-Speech (TTS).

**Flow**: Speak → STT → Kai API (text) → TTS → Hear Response

All messages appear as normal text in the chat UI.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure LiveKit

Create or update `.env`:

```env
LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
```

### 3. Start Server

```bash
npm start
```

Server runs at `http://localhost:3000`

### 4. Use Voice Mode

1. Open `http://localhost:3000` in Chrome/Edge (best STT support)
1. Click the **microphone button** (leftmost in input area)
1. Grant microphone permissions
1. Speak your message
1. Wait for transcript to finalize
1. Hear AI response via TTS
1. Continue conversation hands-free!

## 🏗️ Architecture

### Components

| Component | File | Purpose |
|-----------|------|---------|
| **Backend Server** | `/server/index.js` | Express server with `/livekit/token` endpoint |
| **LiveKit Manager** | `/src/core/livekit.js` | Connects to LiveKit rooms, publishes audio |
| **STT Controller** | `/src/core/stt.js` | Browser Speech Recognition API wrapper |
| **TTS Controller** | `/src/core/tts.js` | Browser Speech Synthesis API wrapper |
| **Voice Mode UI** | `/src/ui/voicemode.js` | Orchestrates voice flow + Kai integration |

### Data Flow

```
┌─────────────┐
│  User Speaks│
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│   LiveKit       │ Audio Transport
│   Room          │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│   STT (Browser) │ Speech → Text
│   Web Speech API│
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ User Message    │ Text stored in
│ (IndexedDB)     │ conversation
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Kai API         │ POST /v1/chat/completions
│ https://api.    │
│   eanhd.com     │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Assistant       │ Text response
│ Message         │ stored + displayed
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ TTS (Browser)   │ Text → Speech
│ Speech Synthesis│
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ User Hears      │
│ Response        │
└─────────────────┘
```

## 🔧 API Reference

### Backend Endpoint

#### `POST /livekit/token`

Generates LiveKit access token for client.

**Request**:
```json
{
  "roomName": "room_llmchat_<session_id>",
  "identity": "user_abc123"
}
```

**Response**:
```json
{
  "token": "eyJhbGci...",
  "url": "wss://kai-eirik1q6.livekit.cloud"
}
```

### Frontend Classes

#### `LiveKitManager`

```javascript
import { livekitManager } from './src/core/livekit.js';

// Connect to room
await livekitManager.connect('room_name', 'user_id');

// Start publishing audio
await livekitManager.startAudio();

// Stop and disconnect
await livekitManager.stopAudio();
await livekitManager.disconnect();
```

#### `SpeechInputController`

```javascript
import { SpeechInputController } from './src/core/stt.js';

const stt = new SpeechInputController({
  onInterimText: (text) => console.log('Interim:', text),
  onFinalText: (text) => console.log('Final:', text),
  onError: (err) => console.error(err)
});

stt.startListening();
stt.stopListening();
```

#### `SpeechOutputController`

```javascript
import { speechOutput } from './src/core/tts.js';

speechOutput.speak('Hello, this is AI speaking');
speechOutput.stop();
```

## 🎛️ Configuration

### LiveKit Credentials

Get your LiveKit credentials:

1. Sign up at [livekit.io](https://livekit.io)
1. Create a new project
1. Copy API Key, Secret, and WebSocket URL
1. Add to `.env`

### Session & Identity Mapping

- **Room Name**: `room_llmchat_<conversation_id>`
- **User Identity**: `user_<random_id>` (stored in localStorage)
- **Session ID**: Uses current conversation ID or generates new one

Each chat conversation maps to a unique LiveKit room.

## 🧪 Testing

### Manual Test

1. Start server: `npm start`
1. Open browser console
1. Click voice mode button
1. Speak: "Hello AI"
1. Check console for:
   - `[VoiceMode] Final transcript: Hello AI`
   - `Connected to LiveKit room: room_llmchat_...`
   - Message appears in chat
   - TTS speaks response

### Test Token Endpoint

```bash
curl -X POST http://localhost:3000/livekit/token \
  -H "Content-Type: application/json" \
  -d '{"roomName":"test_room","identity":"test_user"}'
```

Expected response:
```json
{
  "token": "eyJ...",
  "url": "wss://..."
}
```

## 🐛 Troubleshooting

### "Microphone access denied"

- Grant permissions in browser settings
- Try `https://` instead of `http://` (required for some browsers)

### "Speech recognition not supported"

- Use Chrome or Edge (best support)
- Firefox has limited Web Speech API support
- Safari: experimental support, enable in settings

### "Failed to connect to LiveKit"

- Check `.env` credentials are correct
- Verify LiveKit URL is reachable
- Check server logs for token generation errors

### "No audio playing"

- Check system volume
- Verify TTS is working: open console and run `speechSynthesis.speak(new SpeechSynthesisUtterance('test'))`
- Try different browser

## 🔮 Future Enhancements

- [ ] Server-side STT/TTS endpoints (`/stt`, `/tts`) for better quality
- [ ] LiveKit Voice Agents for server-side processing
- [ ] Voice Activity Detection (VAD) for natural turn-taking
- [ ] Interruption support
- [ ] Multi-language support
- [ ] Voice settings UI (speed, pitch, volume)
- [ ] Visual waveform indicators
- [ ] Push-to-talk mode

## 📝 Notes

- **Browser Compatibility**: Best in Chrome/Edge (STT/TTS)
- **Privacy**: All audio processed locally in browser (Phase 1)
- **Kai Integration**: Voice mode uses same `/v1/chat/completions` API as text chat
- **Message History**: All voice messages stored as text in IndexedDB
- **Offline**: Voice mode requires internet for Kai API connection

## 🆘 Support

Issues? Check:
1. Server logs: `npm start` output
1. Browser console: F12 → Console tab
1. LiveKit dashboard: Check room connections
1. Network tab: Verify `/livekit/token` returns 200

---

**Next**: See [VOICE_MODE.md](./VOICE_MODE.md) for implementation details.
