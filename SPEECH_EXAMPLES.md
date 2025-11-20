# Speech Cleanup Examples - Quick Reference

## Real-World Examples

### Example 1: Natural Question
```
👤 You say: "um so like what's the weather today you know"
🧹 Cleanup:  "what's the weather today?"
📊 Confidence: 0.8 (high)
✅ Action: Send to Kai
```

### Example 2: With False Starts
```
👤 You say: "can you can you help me with uh with this problem"
🧹 Cleanup:  "can you help me with this problem?"
📊 Confidence: 0.8 (high)
✅ Action: Send to Kai
```

### Example 3: Laughter & Fillers
```
👤 You say: "haha that's that's so funny like basically yeah"
🧹 Cleanup:  "that's so funny."
📊 Confidence: 0.7 (good)
✅ Action: Send to Kai
```

### Example 4: Too Much Noise
```
👤 You say: "um uh haha *cough* er"
🧹 Cleanup:  ""
📊 Confidence: 0.0 (none)
❌ Action: Ask to rephrase
🔊 System says: "I didn't quite catch that. Could you rephrase?"
```

### Example 5: Just Gibberish
```
👤 You say: "the the the"
🧹 Cleanup:  "the"
📊 Confidence: 0.3 (low - too short)
❌ Action: Ask to rephrase
```

### Example 6: Clean Command
```
👤 You say: "search for cats in my documents"
🧹 Cleanup:  "search for cats in my documents."
📊 Confidence: 1.0 (perfect - no changes)
✅ Action: Send to Kai
```

### Example 7: Heavy Fillers but Clear Intent
```
👤 You say: "I mean like basically I want to literally search for um cats"
🧹 Cleanup:  "I want to search for cats."
📊 Confidence: 0.8 (high)
✅ Action: Send to Kai
```

## What Gets Removed

### Filler Words ❌
- um, uh, uhm, umm
- er, ah, oh
- like, you know, i mean
- sort of, kind of
- basically, actually, literally
- right, okay okay, yeah yeah
- hmm, huh

### False Starts ❌
- Repeated words: "I I want" → "I want"
- Stutters: "p-person" → "person"
- Double phrases: "with uh with" → "with"

### Noise & Laughter ❌
- haha, hehe, hahaha
- *cough*, *clears throat*
- [noise markers]
- (parenthetical sounds)

## What's Preserved ✅

- **Meaning**: Core intent always preserved
- **Context**: Relevant words kept
- **Questions**: Detected and punctuated with ?
- **Commands**: Action words maintained
- **Entities**: Names, places, specific terms

## Confidence Levels

| Score | Meaning | Action |
|-------|---------|--------|
| 0.0 - 0.3 | Low - unclear or too short | Ask to rephrase |
| 0.3 - 0.7 | Medium - some cleanup needed | Proceed with caution |
| 0.7 - 1.0 | High - clear intent | Send to Kai |
| 1.0 | Perfect - no changes needed | Send as-is |

## Voice-Aware Kai Prompt

When you use voice mode, Kai receives this system instruction:

```
You are a helpful AI assistant. The user is interacting with you via voice.

IMPORTANT VOICE INPUT GUIDELINES:
- User input may contain minor speech disfluencies even after cleanup
- Focus on the user's INTENT and MEANING, not exact phrasing
- If you're uncertain about what the user meant, ask for clarification
- NEVER assume or invent meaning from unclear input
- Respond naturally and conversationally
- Keep responses concise for voice output (2-3 sentences unless requested)
```

This helps Kai:
1. Understand input came from voice
2. Focus on intent over exact words
3. Ask for clarification when needed
4. Never invent meaning from noise
5. Keep responses brief for TTS

## Testing in Browser Console

```javascript
import { SpeechCleanup } from './src/core/speech-cleanup.js';

// Test a phrase
const result = SpeechCleanup.cleanup("um so like I want to search for cats");
console.log(result);
// {
//   cleaned: "I want to search for cats.",
//   wasModified: true,
//   confidence: 0.8,
//   shouldAskForClarification: false
// }

// Test gibberish
const gibberish = SpeechCleanup.cleanup("um uh haha");
console.log(gibberish);
// {
//   cleaned: "",
//   wasModified: true,
//   confidence: 0.0,
//   shouldAskForClarification: true
// }
```

## Common Scenarios

### 🎯 Perfect Cleanup
"um so what's the capital of France you know"
→ "what's the capital of France?"
→ Kai responds with Paris

### 🎯 Preserves Meaning
"I I want to like search for uh cat pictures basically"
→ "I want to search for cat pictures."
→ Kai searches for cat pictures

### 🎯 Asks for Clarification
"um haha uh *cough*"
→ "" (empty)
→ "I didn't quite catch that. Could you rephrase?"

### 🎯 Handles Natural Speech
"so like I was thinking we could maybe um check the weather"
→ "I was thinking we could check the weather."
→ Kai checks weather

## Edge Cases

### Intentional Fillers
If you literally want to search for "um":
- Current: Gets removed ❌
- Workaround: Say "search for the word um"

### Proper Nouns
Names might get partially cleaned:
- "Erin" might sound like "er in" and get cleaned
- Workaround: Speak clearly, repeat if needed

### Accents
Heavy accents may produce unusual STT:
- System may misinterpret as disfluencies
- Low confidence will trigger clarification request

## Debugging

Check browser console for:
```
[VoiceMode] Raw transcript: "um so like I want to search"
[VoiceMode] Cleanup result: { cleaned: "I want to search.", confidence: 0.8 }
[VoiceMode] Cleaned text: "I want to search."
```

If cleanup is too aggressive:
1. Check console logs
2. Adjust `FILLER_WORDS` in `speech-cleanup.js`
3. Lower confidence threshold

If too lenient:
1. Add more patterns to `FILLER_WORDS`
2. Raise confidence threshold
3. Add custom noise patterns

## Quick Tips

✅ **DO:**
- Speak naturally - cleanup handles disfluencies
- Pause briefly between thoughts
- Rephrase if asked
- Check console for debugging

❌ **DON'T:**
- Speak too fast - STT may miss words
- Overlap speech with TTS response
- Use complex technical jargon without pausing
- Expect 100% accuracy with heavy accents

## See Also

- [SPEECH_CLEANUP.md](./SPEECH_CLEANUP.md) - Full technical documentation
- [VOICE_SETUP.md](./VOICE_SETUP.md) - Voice mode setup guide
- [VOICE_MODE.md](./VOICE_MODE.md) - Voice mode implementation
