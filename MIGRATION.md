# Migration Guide: inquirer-command-prompt v0.x → @tokenring-ai/inquirer-command-prompt v1.x

## Overview

This package has been completely rewritten to use the modern `@inquirer/core` framework instead of the legacy
Inquirer.js plugin system. This provides better performance, modern JavaScript features, and improved maintainability.

## Breaking Changes

### 1. Package Name

- **Old**: `inquirer-command-prompt`
- **New**: `@tokenring-ai/inquirer-command-prompt`

### 2. API Style

- **Old**: Class-based Inquirer.js plugin
- **New**: Functional API with async/await

### 3. Import/Usage

#### Before (v0.x)

```javascript
const inquirer = require('inquirer');
inquirer.registerPrompt('command', require('inquirer-command-prompt'));

const answers = await inquirer.prompt([{
 type: 'command',
 name: 'cmd',
 message: '>',
 autoCompletion: ['foo', 'bar'],
 context: 0
}]);
console.log(answers.cmd);
```

#### After (v1.x)

```javascript
import commandPrompt from 'pkg/inquirer-command-prompt/index';

const answer = await commandPrompt({
 message: '>',
 autoCompletion: ['foo', 'bar'],
 history: ['hello', 'world'],
});
console.log(answer);
```

### 4. Context Changes

- **Old**: Numeric contexts (0, 1, 2, ...)
- **New**: Not needed anymore

### 5. Configuration

#### Global Configuration

Global configuration has been removed.

#### History Configuration

```javascript
// Old
inquirerCommandPrompt.setConfig({
  history: {
    save: true,
    folder: historyFolder,
    limit: 10,
    blacklist: ['exit']
  }
});

// New - history is passed in from an outside service
const answer = await commandPrompt({
  message: '>',
  history: ['hello', 'world'],
});
```

## New Features

### 1. Modern JavaScript

- Full ES modules support
- Async/await throughout
- Better error handling

### 2. Improved TypeScript Support

- Comprehensive JSDoc types
- Better IDE integration
- Type-safe configuration

### 3. Enhanced API

- Cleaner functional interface
- Better async support
- More flexible configuration

### 4. Better Performance

- Built on modern `@inquirer/core`
- Reduced dependencies
- Optimized rendering