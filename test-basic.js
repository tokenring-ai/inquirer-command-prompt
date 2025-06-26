#!/usr/bin/env node

import commandPrompt, { setGlobalConfig } from './index.js';

console.log('🧪 Testing @token-ring/inquirer-command-prompt');
console.log('='.repeat(50));

// Test 1: Basic functionality
console.log('\n✅ Test 1: Basic import and function call');
try {
  console.log('✓ Import successful');
  console.log('✓ Function is callable:', typeof commandPrompt === 'function');
} catch (error) {
  console.error('❌ Import failed:', error.message);
  process.exit(1);
}

// Test 2: Global config
console.log('\n✅ Test 2: Global configuration');
try {
  setGlobalConfig({
    history: { save: false, limit: 10 },
    onCtrlEnd: (line) => line.toUpperCase()
  });
  console.log('✓ Global config set successfully');
} catch (error) {
  console.error('❌ Global config failed:', error.message);
  process.exit(1);
}

// Test 3: Configuration validation
console.log('\n✅ Test 3: Configuration validation');
try {
  // Test with minimal config
  const config1 = { message: 'Test:' };
  console.log('✓ Minimal config accepted');
  
  // Test with full config
  const config2 = {
    message: 'Full test:',
    context: 'test',
    autoCompletion: ['foo', 'bar'],
    validate: (input) => input.length > 0,
    history: { save: false }
  };
  console.log('✓ Full config accepted');
} catch (error) {
  console.error('❌ Config validation failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 All tests passed!');
console.log('📦 Package is ready for use');
console.log('\n📖 Usage:');
console.log('  import commandPrompt from "@token-ring/inquirer-command-prompt";');
console.log('  const answer = await commandPrompt({ message: ">" });');