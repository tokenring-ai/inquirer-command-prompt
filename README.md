# @token-ring/inquirer-command-prompt

A modern command prompt with history and autocomplete built on `@inquirer/core`.

## Installation

```bash
npm install @token-ring/inquirer-command-prompt
```

## Usage

```javascript
import commandPrompt from '@token-ring/inquirer-command-prompt';

const answer = await commandPrompt({
  message: '>',
  autoCompletion: ['foo', 'bar', 'baz'],
  context: 'myContext',
  validate: val => val ? true : 'Please enter a command'
});

console.log(answer);
```

## Features

- **Modern API**: Built on `@inquirer/core` with modern JavaScript features
- **History Navigation**: Use up/down arrow keys to navigate through command history
- **Auto-completion**: Press TAB to auto-complete commands
- **Context Support**: Different contexts maintain separate histories
- **Persistent History**: History can be saved to disk
- **Validation**: Built-in input validation support
- **Async Support**: Full async/await support throughout
- **TypeScript Ready**: Comprehensive JSDoc types for excellent IDE support

## Basic Example

```javascript
import commandPrompt from '@token-ring/inquirer-command-prompt';

async function commandLoop() {
  while (true) {
    try {
      const command = await commandPrompt({
        message: '> ',
        context: 'shell',
        autoCompletion: ['help', 'exit', 'clear', 'history'],
        validate: (input) => input.trim() ? true : 'Please enter a command'
      });
      
      if (command === 'exit') break;
      
      console.log(`Executing: ${command}`);
      // Handle command here
      
    } catch (error) {
      if (error.name === 'ExitPromptError') {
        break; // User pressed Ctrl+C
      }
      throw error;
    }
  }
}

commandLoop();
```

## Configuration Options

### Basic Options

```javascript
const answer = await commandPrompt({
  message: 'Enter command:', // The prompt message
  context: 'myApp',         // Context for history/autocompletion
  default: 'help',          // Default value
  required: true,           // Whether input is required
  validate: (input) => {    // Validation function
    return input.length > 0 ? true : 'Input required';
  }
});
```

### History Configuration

```javascript
const answer = await commandPrompt({
  message: '>',
  history: {
    save: true,                    // Save to file
    folder: './my-history',        // History folder
    fileName: 'commands.json',     // History filename
    limit: 50,                     // Max entries
    blacklist: ['password', 'secret'] // Excluded commands
  }
});
```

### Auto-completion

```javascript
// Static array
const answer = await commandPrompt({
  message: '>',
  autoCompletion: ['start', 'stop', 'restart', 'status']
});

// Dynamic function
const answer = await commandPrompt({
  message: '>',
  autoCompletion: (line) => {
    return ['start', 'stop', 'restart'].filter(cmd => 
      cmd.startsWith(line)
    );
  }
});

// Async function
const answer = await commandPrompt({
  message: '>',
  autoCompletion: async (line) => {
    const response = await fetch(`/api/commands?q=${line}`);
    return response.json();
  }
});

// With filter option
const answer = await commandPrompt({
  message: '>',
  autoCompletion: [
    { filter: str => str.split(':')[0] }, // Remove hints after ':'
    'edit 12: Love is in the air',
    'edit 36: Like a virgin'
  ]
});
```

### Advanced Options

```javascript
const answer = await commandPrompt({
  message: '>',
  transformer: (value, answers, flags) => {
    // Transform display value
    return flags.isFinal ? `✓ ${value}` : value;
  },
  onBeforeKeyPress: ({ key }) => {
    // Called before each keypress
    console.log('Key pressed:', key.name);
  },
  onBeforeRewrite: (line) => {
    // Called before rewriting line
    return line.trim();
  },
  autocompletePrompt: '>> Available commands:',
  short: true, // Shorten long suggestion lists
  maxSize: 10, // Max items to display
  ellipsize: true,
  ellipsis: '...',
  noColorOnAnswered: false,
  colorOnAnswered: 'green'
});
```

## Custom History Handler

```javascript
const customHistoryHandler = {
  init: (context) => { /* initialize */ },
  add: (context, command) => { /* add command */ },
  getPrevious: (context) => { /* get previous */ },
  getNext: (context) => { /* get next */ },
  getAll: (context) => { /* get all */ }
};

const answer = await commandPrompt({
  message: '>',
  historyHandler: customHistoryHandler
});
```

## Global Configuration

```javascript
import { setGlobalConfig } from '@token-ring/inquirer-command-prompt';

setGlobalConfig({
  history: {
    save: true,
    folder: './global-history',
    limit: 100
  },
  onCtrlEnd: (line) => {
    // Transform line on Ctrl+End
    return line.toUpperCase();
  }
});
```

## Key Bindings

- **Up/Down Arrows**: Navigate command history
- **Tab**: Auto-complete current input
- **Shift+Right Arrow**: Display all history entries
- **Ctrl+Shift+Right Arrow**: Recall history entry by number
- **Ctrl+End**: Execute global onCtrlEnd function (if configured)
- **Enter**: Submit command
- **Ctrl+C**: Cancel prompt

## Examples

### File Path Completion

```javascript
import commandPrompt from '@token-ring/inquirer-command-prompt';
import { readdir } from 'fs/promises';
import { join } from 'path';

async function getFileCompletions(line) {
  try {
    const dir = line.includes('/') ? line.substring(0, line.lastIndexOf('/')) : '.';
    const files = await readdir(dir);
    return files.map(file => join(dir, file));
  } catch {
    return [];
  }
}

const filePath = await commandPrompt({
  message: 'Enter file path: ',
  autoCompletion: getFileCompletions,
  context: 'files'
});
```

### Multi-Context Application

```javascript
import commandPrompt from '@token-ring/inquirer-command-prompt';

async function databaseShell() {
  const commands = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP'];
  
  while (true) {
    const query = await commandPrompt({
      message: 'sql> ',
      context: 'database',
      autoCompletion: commands,
      transformer: (value, answers, { isFinal }) => {
        return isFinal ? `📊 ${value}` : value;
      }
    });
    
    if (query.toLowerCase() === 'exit') break;
    console.log(`Executing SQL: ${query}`);
  }
}

async function systemShell() {
  const commands = ['ls', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv'];
  
  while (true) {
    const command = await commandPrompt({
      message: '$ ',
      context: 'system', // Different context = separate history
      autoCompletion: commands
    });
    
    if (command === 'exit') break;
    console.log(`Executing: ${command}`);
  }
}
```

## Migration from v0.x

The new version uses a functional API instead of the class-based Inquirer.js plugin approach:

### Before (v0.x)
```javascript
const inquirer = require('inquirer');
inquirer.registerPrompt('command', require('inquirer-command-prompt'));

const answers = await inquirer.prompt([{
  type: 'command',
  name: 'cmd',
  message: '>',
  autoCompletion: ['foo', 'bar']
}]);
console.log(answers.cmd);
```

### After (v1.x)
```javascript
import commandPrompt from '@token-ring/inquirer-command-prompt';

const answer = await commandPrompt({
  message: '>',
  autoCompletion: ['foo', 'bar']
});
console.log(answer);
```

## Testing

Run the simple test:
```bash
node test-simple.js
```

Run the examples:
```bash
node examples/autocompletion.js
node examples/filecompletion.js
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.