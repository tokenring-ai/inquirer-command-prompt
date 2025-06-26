#!/usr/bin/env node

import commandPrompt from './index.js';

async function testValidationBug() {
  console.log('🐛 Testing validation input bug');
  console.log('Instructions:');
  console.log('1. Type "t" and press Enter (should show validation error)');
  console.log('2. Type "e" (the "t" should NOT disappear)');
  console.log('3. Continue typing "st" to complete "test"');
  console.log('4. Press Enter (should accept "test")');
  console.log('='.repeat(50));
  
  try {
    const answer = await commandPrompt({
      message: 'Enter something with "test":',
      context: 'validation-bug-test',
      validate: (input) => {
        return input.includes('test') ? true : 'Input must contain "test"';
      }
    });
    console.log(`✅ Final answer: "${answer}"`);
  } catch (error) {
    if (error.name === 'ExitPromptError') {
      console.log('\n❌ Test interrupted by user (Ctrl+C)');
    } else {
      console.error('❌ Test failed:', error);
    }
  }
}

testValidationBug();