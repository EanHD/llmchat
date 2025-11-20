/**
 * Speech Cleanup Tests
 * Run these in browser console to verify cleanup functionality
 */

import { SpeechCleanup } from '../src/core/speech-cleanup.js';

console.log('🧪 Running Speech Cleanup Tests...\n');

const tests = [
  {
    name: 'Filler words removal',
    input: 'um so like I want to uh search for cats you know',
    expectedContains: 'I want to search for cats'
  },
  {
    name: 'False starts removal',
    input: 'can you can you help me with uh with this problem',
    expectedContains: 'can you help me'
  },
  {
    name: 'Laughter removal',
    input: 'haha that\'s that\'s funny okay so',
    expectedContains: 'that\'s funny okay so'
  },
  {
    name: 'Gibberish detection',
    input: 'um uh haha',
    shouldAskClarification: true
  },
  {
    name: 'Single word fragment',
    input: 'um',
    shouldAskClarification: true
  },
  {
    name: 'Natural question',
    input: 'so like what\'s the weather today',
    expectedContains: 'what\'s the weather today'
  },
  {
    name: 'Repeated words',
    input: 'the the cat sat on the mat',
    expectedContains: 'the cat sat on the mat'
  },
  {
    name: 'Multiple fillers',
    input: 'I mean basically like literally it\'s actually sort of good',
    expectedContains: 'it\'s good'
  },
  {
    name: 'Clean input (no modification)',
    input: 'This is a clean sentence.',
    expectedContains: 'This is a clean sentence'
  },
  {
    name: 'Question detection',
    input: 'what is the capital of France',
    expectedContains: '?'
  }
];

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  console.log(`\n📋 Test ${index + 1}: ${test.name}`);
  console.log(`   Input: "${test.input}"`);
  
  const result = SpeechCleanup.cleanup(test.input);
  
  console.log(`   Output: "${result.cleaned}"`);
  console.log(`   Modified: ${result.wasModified}`);
  console.log(`   Confidence: ${result.confidence.toFixed(2)}`);
  console.log(`   Should ask clarification: ${result.shouldAskForClarification}`);
  
  let testPassed = true;
  
  if (test.expectedContains) {
    const contains = result.cleaned.toLowerCase().includes(test.expectedContains.toLowerCase());
    if (!contains) {
      console.log(`   ❌ FAIL: Expected output to contain "${test.expectedContains}"`);
      testPassed = false;
    }
  }
  
  if (test.shouldAskClarification !== undefined) {
    if (result.shouldAskForClarification !== test.shouldAskClarification) {
      console.log(`   ❌ FAIL: Expected shouldAskForClarification to be ${test.shouldAskClarification}, got ${result.shouldAskForClarification}`);
      testPassed = false;
    }
  }
  
  if (testPassed) {
    console.log(`   ✅ PASS`);
    passed++;
  } else {
    failed++;
  }
});

console.log(`\n\n📊 Test Summary`);
console.log(`   Total: ${tests.length}`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 All tests passed!');
} else {
  console.log('\n⚠️  Some tests failed. Review the output above.');
}
