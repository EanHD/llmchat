# Speech Cleanup Layer

## Overview

The speech cleanup layer processes raw STT (Speech-to-Text) output to normalize natural speech patterns before sending to the Kai API. This ensures that disfluencies, filler words, and speech artifacts don't confuse the AI or break functionality.

## Architecture

```
User speaks
    ↓
Web Speech API (STT)
    ↓
Raw transcript with disfluencies
    ↓
SpeechCleanup.cleanup()
    ↓
Cleaned, normalized text
    ↓
Confidence check
    ↓
[Low confidence] → Ask user to rephrase
[High confidence] → Send to Kai API
    ↓
Kai processes with voice-aware system prompt
    ↓
Response → TTS → User hears
```

## Cleanup Operations

### 1. Noise Removal
Removes laughter, coughs, and other non-speech sounds:
- `haha`, `hehe` → removed
- `*cough*`, `[clears throat]` → removed
- `(laughs)` → removed

### 2. False Start Removal
Handles repeated words and stutters:
- `the the cat` → `the cat`
- `I I think` → `I think`
- `p-person` → `person`

### 3. Filler Word Removal
Strips common filler words:
- `um`, `uh`, `uhm`, `er`, `ah`
- `like`, `you know`, `i mean`
- `basically`, `actually`, `literally`
- `sort of`, `kind of`

### 4. Punctuation Normalization
- Removes duplicate punctuation: `...` → `.`
- Adds spacing after punctuation
- Removes spacing before punctuation
- Adds terminal punctuation if missing
- Detects questions and adds `?`

## Confidence Scoring

The cleanup process calculates a confidence score (0-1) based on:

- **Amount removed**: If >70% of words removed → low confidence
- **Result length**: Very short results → lower confidence
- **Word count**: 3+ words → higher confidence
- **Gibberish detection**: Excessive repetition or single short word → low confidence

### Confidence Thresholds

- **< 0.3**: Ask user to rephrase
- **0.3 - 0.7**: Proceed with caution
- **> 0.7**: High confidence, proceed normally

## Clarification Requests

When input is unclear (low confidence or gibberish), the system:

1. **Logs warning** to console
2. **Updates placeholder**: "Could you rephrase that? (unclear input)"
3. **Speaks**: "I didn't quite catch that. Could you rephrase?"
4. **Waits** for user to speak again
5. **Resets** after 3 seconds

This prevents:
- Sending nonsense to the API
- Confusing Kai with incomplete thoughts
- Processing random noises as commands

## Voice-Aware System Prompt

When using voice mode, messages to Kai include a special system prompt:

```
You are a helpful AI assistant. The user is interacting with you via voice.

IMPORTANT VOICE INPUT GUIDELINES:
- User input may contain minor speech disfluencies even after cleanup
- Disfluencies have been mostly removed, but some natural speech patterns may remain
- Focus on the user's INTENT and MEANING, not exact phrasing
- If you're uncertain about what the user meant, ask for clarification
- NEVER assume or invent meaning from unclear input
- Respond naturally and conversationally
- Keep responses concise for voice output (aim for 2-3 sentences unless more detail is requested)
```

This ensures Kai:
- **Understands** input came from voice
- **Focuses** on intent over exact wording
- **Asks** for clarification when needed
- **Never invents** meaning from noise
- **Responds concisely** for TTS playback

## Usage

### Automatic Integration

Speech cleanup is automatically applied in voice mode:

```javascript
// In VoiceModeUI.handleFinalTranscript()
const cleanupResult = SpeechCleanup.cleanup(rawTranscript);

if (cleanupResult.shouldAskForClarification) {
  // Ask user to rephrase
  speechOutput.speak("I didn't quite catch that. Could you rephrase?");
  return;
}

// Send cleaned text to Kai
await this.sendMessageToKai(cleanupResult.cleaned);
```

### Manual Usage

You can also use the cleanup layer directly:

```javascript
import { SpeechCleanup } from './src/core/speech-cleanup.js';

const result = SpeechCleanup.cleanup("um so like I I want to uh search for haha cats");
console.log(result);
// {
//   cleaned: "I want to search for cats.",
//   wasModified: true,
//   confidence: 0.8,
//   shouldAskForClarification: false
// }
```

## Examples

### Example 1: Filler Words
```
Input:  "um so like I want to uh search for cats you know"
Output: "I want to search for cats."
Confidence: 0.8
Action: Send to Kai
```

### Example 2: False Starts
```
Input:  "can you can you help me with uh with this problem"
Output: "can you help me with this problem?"
Confidence: 0.8
Action: Send to Kai
```

### Example 3: Laughter + Noise
```
Input:  "haha that's that's funny *cough* okay so"
Output: "that's funny okay so."
Confidence: 0.5
Action: Send to Kai (moderate confidence)
```

### Example 4: Gibberish
```
Input:  "uh um haha *cough*"
Output: ""
Confidence: 0.0
Action: Ask to rephrase
```

### Example 5: Single Word Fragment
```
Input:  "um"
Output: ""
Confidence: 0.0
Action: Ask to rephrase
```

### Example 6: Natural Question
```
Input:  "so like what's the weather today"
Output: "what's the weather today?"
Confidence: 0.8
Action: Send to Kai
```

## Configuration

### Customizing Filler Words

Edit `src/core/speech-cleanup.js`:

```javascript
const FILLER_WORDS = new Set([
  'um', 'uh', 'uhm', 'umm', 'er', 'ah', 'oh',
  // Add your own:
  'basically', 'literally', 'actually'
]);
```

### Adjusting Confidence Threshold

Modify the threshold in `VoiceModeUI.handleFinalTranscript()`:

```javascript
// More strict (fewer false positives)
if (cleanupResult.confidence < 0.5) {
  // Ask to rephrase
}

// More lenient (allow more unclear input)
if (cleanupResult.confidence < 0.2) {
  // Ask to rephrase
}
```

### Adding Custom Noise Patterns

Edit `NOISE_PATTERNS` in `speech-cleanup.js`:

```javascript
const NOISE_PATTERNS = [
  /\b(ha)+h?\b/gi,
  /\*\w+\*/g,
  // Add your own regex patterns
  /\bsniff\b/gi,
  /\byawn\b/gi
];
```

## Testing

### Browser Console Testing

```javascript
// Test cleanup
const result = SpeechCleanup.cleanup("um so I I want to uh test this");
console.log('Cleaned:', result.cleaned);
console.log('Confidence:', result.confidence);
console.log('Modified:', result.wasModified);
```

### Common Test Cases

```javascript
// Test cases
const tests = [
  "um so like what's the weather",
  "I I want to uh search for cats",
  "haha that's funny",
  "um uh er ah",
  "the the quick brown fox",
  "can you help me with with this"
];

tests.forEach(input => {
  const result = SpeechCleanup.cleanup(input);
  console.log(`"${input}" → "${result.cleaned}" (${result.confidence})`);
});
```

## Limitations

### What Cleanup DOES:
- ✅ Remove filler words
- ✅ Remove repeated words
- ✅ Remove laughter/coughs
- ✅ Fix basic punctuation
- ✅ Detect gibberish

### What Cleanup DOES NOT:
- ❌ Fix grammar errors
- ❌ Correct pronunciation mistakes
- ❌ Translate languages
- ❌ Add missing words
- ❌ Guess intent from very unclear input

### Edge Cases

1. **Intentional Fillers**: If user says "I want to search for 'um'", it will be removed
2. **Proper Nouns**: Names like "Erin" might sound like "er in" and get partially cleaned
3. **Accents**: Heavy accents may produce unusual STT output that looks like disfluencies
4. **Background Noise**: STT may pick up noise as words, cleanup can only remove known patterns

### Mitigation Strategies

- **Low confidence → clarification**: Prevents bad input from reaching Kai
- **Logging**: All cleanup operations logged for debugging
- **Voice-aware prompt**: Kai knows to expect some irregularities
- **User can retry**: Easy to speak again if misunderstood

## Debugging

### Enable Verbose Logging

Check browser console for:

```
[VoiceMode] Raw transcript: "um so like I want to search for cats"
[VoiceMode] Cleanup result: { cleaned: "I want to search for cats.", confidence: 0.8, ... }
[VoiceMode] Cleaned text: "I want to search for cats."
```

### Common Issues

**Issue**: Good input gets rejected
- **Cause**: Confidence threshold too high
- **Fix**: Lower threshold in `handleFinalTranscript()`

**Issue**: Too many fillers getting through
- **Cause**: Fillers not in `FILLER_WORDS` set
- **Fix**: Add more patterns to `speech-cleanup.js`

**Issue**: Legitimate words removed
- **Cause**: Word matches filler pattern
- **Fix**: Remove from `FILLER_WORDS` or make patterns more specific

## Future Enhancements

Potential improvements:

1. **Machine Learning**: Train model to detect disfluencies contextually
2. **Language Detection**: Apply language-specific cleanup rules
3. **User Profiles**: Learn individual speech patterns
4. **Accent Adaptation**: Adjust cleanup based on detected accent
5. **Context Awareness**: Use conversation history to improve cleanup
6. **Custom Dictionaries**: Per-user allowlist/blocklist for words
7. **Confidence Calibration**: Learn optimal threshold per user

## See Also

- [VOICE_MODE.md](./VOICE_MODE.md) - Voice mode implementation
- [VOICE_SETUP.md](./VOICE_SETUP.md) - Voice mode setup guide
- [src/core/speech-cleanup.js](./src/core/speech-cleanup.js) - Cleanup implementation
- [src/ui/voicemode.js](./src/ui/voicemode.js) - Integration point
