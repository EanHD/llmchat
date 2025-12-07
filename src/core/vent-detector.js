/**
 * Vent Detection System
 * Analyzes message tone and adjusts AI response style
 * Perfect for emotional support, motivation, and deep conversations
 */

class VentDetector {
  constructor() {
    // Emotion indicators
    this.ventKeywords = {
      frustration: ['frustrated', 'annoying', 'annoyed', 'irritating', 'stupid', 'hate', 'ugh', 'damn'],
      sadness: ['sad', 'depressed', 'down', 'lonely', 'hurt', 'crying', 'terrible', 'awful'],
      stress: ['stressed', 'overwhelmed', 'anxious', 'worried', 'tired', 'exhausted', 'burnt out', 'burnout'],
      selfDoubt: ['failure', 'can\'t do', 'not good enough', 'useless', 'hopeless', 'giving up', 'waste'],
      motivation: ['lazy', 'unmotivated', 'procrastinating', 'stuck', 'lost', 'no energy', 'can\'t focus']
    };

    this.ventPatterns = [
      /why (can't|cant|don't|dont) i/i,
      /i (hate|can't stand|despise)/i,
      /everything is/i,
      /nothing (works|matters|helps)/i,
      /feel like (shit|crap|garbage|trash)/i,
      /what's the point/i,
      /give up/i,
      /i'm (so|really) (tired|exhausted|done)/i,
      /can't (take|handle) (this|it)/i,
      /(?:^|\s)ugh(?:\s|$|,|\.)/i,
      /fuck|shit|damn/i, // Strong language = venting
    ];

    // Length patterns - long messages with personal pronouns
    this.ventLengthThreshold = 200; // chars
    this.personalPronouns = /\b(i|me|my|mine|myself|i'm|i've|i'd|i'll)\b/gi;
  }

  /**
   * Analyze message and detect if user is venting
   * Returns emotion type and confidence level
   */
  analyze(text) {
    const lowerText = text.toLowerCase();
    const result = {
      isVenting: false,
      confidence: 0, // 0-100
      emotions: [],
      intensity: 'low', // low, medium, high
      needsEmpathy: false,
      needsMotivation: false,
      needsValidation: false,
      systemPromptAddition: ''
    };

    // 1. Check for vent patterns
    let patternMatches = 0;
    for (const pattern of this.ventPatterns) {
      if (pattern.test(text)) {
        patternMatches++;
      }
    }

    // 2. Check for emotion keywords
    const emotionScores = {};
    let totalKeywordMatches = 0;

    for (const [emotion, keywords] of Object.entries(this.ventKeywords)) {
      const matches = keywords.filter(kw => lowerText.includes(kw)).length;
      if (matches > 0) {
        emotionScores[emotion] = matches;
        totalKeywordMatches += matches;
        result.emotions.push(emotion);
      }
    }

    // 3. Check message length and personal pronoun density
    const pronounMatches = (text.match(this.personalPronouns) || []).length;
    const pronounDensity = pronounMatches / (text.split(' ').length || 1);
    const isLongPersonal = text.length > this.ventLengthThreshold && pronounDensity > 0.08;

    // 4. Calculate confidence
    let confidence = 0;
    confidence += patternMatches * 20; // Each pattern = +20
    confidence += totalKeywordMatches * 10; // Each keyword = +10
    confidence += isLongPersonal ? 15 : 0; // Long personal message = +15
    confidence = Math.min(100, confidence);

    result.confidence = confidence;
    result.isVenting = confidence >= 30; // Threshold for "venting"

    // 5. Determine intensity
    if (confidence >= 70) {
      result.intensity = 'high';
      result.needsEmpathy = true;
      result.needsValidation = true;
      result.needsMotivation = true;
    } else if (confidence >= 50) {
      result.intensity = 'medium';
      result.needsEmpathy = true;
      result.needsMotivation = true;
    } else if (confidence >= 30) {
      result.intensity = 'low';
      result.needsEmpathy = true;
    }

    // 6. Generate system prompt addition
    if (result.isVenting) {
      result.systemPromptAddition = this.generateSystemPrompt(result);
    }

    return result;
  }

  /**
   * Generate system prompt addition based on vent analysis
   */
  generateSystemPrompt(analysis) {
    const { intensity, emotions, needsEmpathy, needsMotivation, needsValidation } = analysis;

    let prompt = '\n\n**SPECIAL INSTRUCTION - User is venting:**\n';

    // Intensity-based instructions
    if (intensity === 'high') {
      prompt += '- The user is experiencing INTENSE emotions right now\n';
      prompt += '- Respond with deep empathy and validation FIRST\n';
      prompt += '- Keep your response longer and more thoughtful (3-5 paragraphs)\n';
      prompt += '- Use warm, supportive language like you\'re their close friend\n';
      prompt += '- Don\'t rush to solutions - let them feel heard\n';
      prompt += '- Share relatable experiences or perspectives\n';
    } else if (intensity === 'medium') {
      prompt += '- The user is working through some emotions\n';
      prompt += '- Balance empathy with gentle guidance (2-3 paragraphs)\n';
      prompt += '- Validate their feelings before offering perspective\n';
      prompt += '- Be conversational and supportive\n';
    } else {
      prompt += '- The user is expressing mild frustration or stress\n';
      prompt += '- Acknowledge their feelings and offer brief support (1-2 paragraphs)\n';
      prompt += '- Keep it warm but not overly serious\n';
    }

    // Emotion-specific instructions
    if (emotions.includes('selfDoubt')) {
      prompt += '- **Self-doubt detected**: Remind them of their strengths and past wins\n';
      prompt += '- Counter negative self-talk with realistic, supportive perspective\n';
    }

    if (emotions.includes('frustration')) {
      prompt += '- **Frustration detected**: Validate that frustration is normal and okay\n';
      prompt += '- Help them externalize the problem (it\'s the situation, not them)\n';
    }

    if (emotions.includes('motivation')) {
      prompt += '- **Motivation issue detected**: Gently explore what\'s blocking them\n';
      prompt += '- Offer small, achievable first steps (not overwhelming advice)\n';
      prompt += '- Remind them that low motivation is temporary\n';
    }

    if (emotions.includes('stress')) {
      prompt += '- **Stress detected**: Acknowledge they\'re dealing with a lot\n';
      prompt += '- Suggest they\'re doing better than they think\n';
    }

    if (emotions.includes('sadness')) {
      prompt += '- **Sadness detected**: Sit with them in the feeling first\n';
      prompt += '- Don\'t rush to "cheer them up" - presence matters more\n';
    }

    // Final tone instruction
    prompt += '\n**Overall tone**: Be like a wise, caring friend who truly gets it. Match their energy - if they\'re ranting, let them rant. If they need motivation, inspire them. If they need validation, give it generously.';

    return prompt;
  }

  /**
   * Get suggested response length based on vent intensity
   */
  getSuggestedLength(analysis) {
    if (!analysis.isVenting) return null;
    
    switch (analysis.intensity) {
      case 'high':
        return { min: 300, max: 600, paragraphs: '3-5' };
      case 'medium':
        return { min: 150, max: 350, paragraphs: '2-3' };
      case 'low':
        return { min: 80, max: 200, paragraphs: '1-2' };
      default:
        return null;
    }
  }

  /**
   * Check if message is a quick question (opposite of venting)
   */
  isQuickQuestion(text) {
    const lowerText = text.toLowerCase();
    const questionWords = ['how', 'what', 'when', 'where', 'who', 'why', 'can you', 'could you', 'would you'];
    const hasQuestionWord = questionWords.some(q => lowerText.startsWith(q) || lowerText.includes(' ' + q + ' '));
    const hasQuestionMark = text.includes('?');
    const isShort = text.length < 100;
    
    return hasQuestionWord && hasQuestionMark && isShort;
  }
}

// Singleton instance
export const ventDetector = new VentDetector();
