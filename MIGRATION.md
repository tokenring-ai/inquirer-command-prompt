# Migration Guide: inquirer-command-prompt v0.x → @token-ring/inquirer-command-prompt v1.x

## Overview

This package has been completely rewritten to use the modern `@inquirer/core` framework instead of the legacy Inquirer.js plugin system. This provides better performance, modern JavaScript features, and improved maintainability.

## Breaking Changes

### 1. Package Name
- **Old**: `inquirer-command-prompt`
- **New**: `@token-ring/inquirer-command-prompt`

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
 context: 'myContext'
});
console.log(answer);
```

### 4. Context Changes
- **Old**: Numeric contexts (0, 1, 2, ...)
- **New**: String contexts ('default', 'myApp', 'database', ...)

### 5. Configuration

#### Global Configuration

```javascript
// Old
const inquirerCommandPrompt = require('inquirer-command-prompt');
inquirerCommandPrompt.setConfig({ /* ... */});

// New
import {setGlobalConfig} from 'pkg/inquirer-command-prompt/index';

setGlobalConfig({ /* ... */});
```

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

// New - per prompt
const answer = await commandPrompt({
  message: '>',
  history: {
    save: true,
    folder: historyFolder,
    limit: 10,
    blacklist: ['exit']
  }
});

// New - global
setGlobalConfig({
  history: {
    save: true,
    folder: historyFolder,
    limit: 10,
    blacklist: ['exit']
  }
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

## Migration Steps

1. **Update package.json**
   ```bash
   npm uninstall inquirer-command-prompt
   npm install @token-ring/inquirer-command-prompt
   ```

2. **Update imports**
   ```javascript
   // Old
   const inquirer = require('inquirer');
   inquirer.registerPrompt('command', require('inquirer-command-prompt'));
   
   // New
   import commandPrompt from 'pkg/inquirer-command-prompt/index';
   ```

3. **Update usage**
   ```javascript
   // Old
   const answers = await inquirer.prompt([{
     type: 'command',
     name: 'cmd',
     message: '>',
     // ... other options
   }]);
   const result = answers.cmd;
   
   // New
   const result = await commandPrompt({
     message: '>',
     // ... other options
   });
   ```

4. **Update contexts**
   ```javascript
   // Old
   context: 0
   
   // New
   context: 'myApp'
   ```

5. **Update global configuration**
   ```javascript
   // Old
   inquirerCommandPrompt.setConfig({ /* ... */ });
   
   // New
   import { setGlobalConfig } from 'pkg/inquirer-command-prompt/index';
   setGlobalConfig({ /* ... */ });
   ```

## Compatibility Notes

- All core features are preserved
- History functionality works the same way
- Auto-completion API is unchanged
- Key bindings remain the same
- Configuration options are mostly compatible

## Need Help?

- Check the [README.md](./README.md) for full documentation
- See [examples/](./examples/) for working examples
- Run `node test-basic.js` to verify your installation
- Open an issue on GitHub for specific migration questions