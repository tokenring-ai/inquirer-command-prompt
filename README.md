# @tokenring-ai/inquirer-command-prompt

A powerful command prompt with history navigation and auto-completion, built on `@inquirer/core` for modern Node.js CLI applications.

## Overview

The `@tokenring-ai/inquirer-command-prompt` package provides an interactive command-line interface that enhances user input handling with intelligent features:

- **History Navigation**: Navigate previous commands using up/down arrow keys
- **Auto-completion**: Tab-triggered suggestions from static arrays or dynamic async functions
- **Multi-line Support**: Toggle with Meta+M for entering commands across multiple lines
- **Input Validation**: Custom validation functions with error feedback
- **Theming**: Customizable colors and formatting via Inquirer themes
- **Transformers**: Custom display transformations while preserving original input

This package is designed for CLI tools, REPL environments, and interactive applications where users need to enter commands with intelligent suggestions and recall of previous inputs.

## Installation

```bash
npm install @tokenring-ai/inquirer-command-prompt
```

**Requirements:**
- Node.js >= 20 or bun (for native TypeScript module support)
- The package uses ES modules (`"type": "module"`)

## Quick Start

```typescript
import commandPrompt from '@tokenring-ai/inquirer-command-prompt';

// Basic usage
const answer = await commandPrompt({
  message: 'Enter command:',
});
console.log(`You entered: ${answer}`);

// With auto-completion
const answer = await commandPrompt({
  message: '>',
  autoCompletion: ['npm install', 'npm run build', 'git commit', 'ls -la'],
});
```

## Features

### History Management

Navigate through command history using arrow keys:

- **Up Arrow**: Navigate to previous commands
- **Down Arrow**: Navigate to forward commands
- **Shift+Right**: Display full history with indexed entries

```typescript
const answer = await commandPrompt({
  message: '>',
  history: ['npm install', 'git add .', 'git commit'], // Pre-populated history
});
```

### Auto-completion

Intelligent command suggestions triggered by Tab key:

```typescript
// Static array completion
const answer = await commandPrompt({
  message: '>',
  autoCompletion: ['start', 'stop', 'restart', 'status', 'help'],
});

// Dynamic function completion
const answer = await commandPrompt({
  message: '>',
  autoCompletion: async (line) => {
    const commands = await fetchCommandsFromAPI();
    return commands.filter(cmd => cmd.startsWith(line));
  },
});

// Customized completion display
const answer = await commandPrompt({
  message: '>',
  autoCompletion: ['long-command-name-1', 'long-command-name-2'],
  short: true, // Remove common prefix
  maxSize: 40, // Column width
  ellipsize: true, // Truncate long entries
  autocompletePrompt: 'Available commands:',
});
```

### Multi-line Input

Toggle multi-line mode for complex commands:

```typescript
const answer = await commandPrompt({
  message: 'Enter multi-line command:',
  // Press Meta+M (Cmd+M on macOS) to enable multi-line mode
  // Press Meta+Enter to submit, Enter for new lines
});
```

### Validation and Transformation

```typescript
const answer = await commandPrompt({
  message: 'Enter command:',
  validate: (input) => {
    if (!input.trim()) return 'Command cannot be empty';
    if (input.includes('rm -rf /')) return 'Dangerous command not allowed';
    return true;
  },
  transformer: (input) => input.toUpperCase(), // Display transformation only
  required: true,
});
```

### Custom Theming

```typescript
const answer = await commandPrompt({
  message: '>',
  theme: {
    style: {
      message: (text) => `🚀 ${text}`,
      error: (text) => `❌ ${text}`,
      answer: (text) => `✅ ${text}`,
    },
  },
});
```

## API Reference

### CommandPromptConfig

```typescript
interface CommandPromptConfig {
  /** The prompt message (required) */
  message: string;
  
  /** Array of previous commands for history navigation */
  history?: string[];
  
  /** Auto-completion function or array of suggestions */
  autoCompletion?: ((line: string) => Promise<string[]> | string[]) | string[];
  
  /** Transform the displayed value (original input remains unchanged) */
  transformer?: (value: string) => string;
  
  /** Validate the input */
  validate?: (value: string) => Promise<boolean | string> | boolean | string;
  
  /** Whether input is required */
  required?: boolean;
  
  /** Called before each keypress */
  onBeforeKeyPress?: (key: any, rl: any) => void;
  
  /** Called before rewriting the line */
  onBeforeRewrite?: (value: string) => void;
  
  /** Called when prompt closes */
  onClose?: (value: string) => void;
  
  /** Custom autocomplete prompt message */
  autocompletePrompt?: string;
  
  /** Whether to shorten autocomplete suggestions */
  short?: boolean | ((value: string, matches: string[]) => string[]);
  
  /** Maximum size for formatting columns */
  maxSize?: number;
  
  /** Whether to ellipsize long text */
  ellipsize?: boolean;
  
  /** Custom ellipsis character */
  ellipsis?: string;
  
  /** Disable color on answered */
  noColorOnAnswered?: boolean;
  
  /** Color to use on answered */
  colorOnAnswered?: string;
  
  /** Theme configuration */
  theme?: Partial<Theme>;
  
  /** Default value */
  default?: string;
}
```

### Helper Functions

The package exports utility functions for formatting:

```typescript
import { formatList, short, ellipsize, formatIndex } from '@tokenring-ai/inquirer-command-prompt';

// Format list into columns
const formatted = formatList(['item1', 'item2', 'item3'], 30, true);

// Shorten suggestions by removing common prefix
const shortened = short('git ', ['git add', 'git commit', 'git push']);

// Ellipsize long text
const truncated = ellipsize('very-long-command-name', 20, '...');

// Format index with proper padding
const index = formatIndex(5, 100); // "  5"
```

## Examples

### Basic CLI Tool

```typescript
import commandPrompt from '@tokenring-ai/inquirer-command-prompt';

async function cli() {
  console.log('🔧 Interactive CLI Tool');
  
  while (true) {
    try {
      const command = await commandPrompt({
        message: '$ ',
        history: [], // Could be loaded from file
        autoCompletion: ['help', 'exit', 'status', 'config'],
        validate: (cmd) => {
          if (cmd === 'exit') return true;
          if (!cmd.trim()) return 'Empty command';
          return true;
        },
      });

      if (command === 'exit') break;
      
      // Execute command
      console.log(`Executing: ${command}`);
      // ... your command logic here
    } catch (error) {
      console.log('Interrupted by user');
      break;
    }
  }
}

cli();
```

### File System Navigator

```typescript
import commandPrompt from '@tokenring-ai/inquirer-command-prompt';
import { promises as fs } from 'fs';

async function fileNavigator() {
  const commands = [
    'ls', 'cd', 'pwd', 'cat', 'mkdir', 'rm', 'cp', 'mv',
    'find', 'grep', 'chmod', 'chown', 'tar', 'zip'
  ];

  const answer = await commandPrompt({
    message: 'fs> ',
    autoCompletion: commands,
    short: (line, matches) => {
      // Custom shortening for file commands
      return matches.map(cmd => cmd.replace(line, ''));
    },
    transformer: (input) => input.bold,
  });

  console.log(`Navigating with: ${answer}`);
}

fileNavigator();
```

### Development REPL

```typescript
import commandPrompt from '@tokenring-ai/inquirer-command-prompt';

const devCommands = [
  'build', 'test', 'lint', 'format', 'deploy', 'rollback',
  'npm run dev', 'npm run build', 'npm test'
];

async function devREPL() {
  const history = [];
  
  while (true) {
    const command = await commandPrompt({
      message: 'dev> ',
      history,
      autoCompletion: devCommands,
      autocompletePrompt: '🛠️ Available commands:',
      transformer: (input) => input.cyan,
    });

    history.push(command);
    
    if (command === 'exit') break;
    
    // Execute development command
    console.log(`🚀 Executing: ${command}`);
    // ... your dev logic here
  }
}

devREPL();
```

## Key Bindings

| Key | Action |
|-----|--------|
| **Enter** | Submit command |
| **Up Arrow** | Navigate to previous command |
| **Down Arrow** | Navigate to next command |
| **Tab** | Trigger auto-completion |
| **Shift+Right** | Display full history |
| **Meta+M** | Toggle multi-line mode |
| **Meta+Enter** | Submit in multi-line mode |
| **Ctrl+C** | Cancel prompt |

## Dependencies

- `@inquirer/core@^11.0.1` - Core prompt engine
- `@inquirer/type@^4.0.1` - Readline extensions
- `chalk@^5.6.2` - Terminal coloring
- `fs-extra@^11.3.2` - File system operations
- `lodash@^4.17.21` - Utility functions

## Development

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Building

The package uses TypeScript with native ES modules. No build step is required - TypeScript is compiled on-the-fly by Node.js.

## Migration from v0.x

This package was completely rewritten for v1.x. If you're migrating from the old `inquirer-command-prompt`:

### Before (v0.x)
```javascript
const inquirer = require('inquirer');
inquirer.registerPrompt('command', require('inquirer-command-prompt'));

const answers = await inquirer.prompt([{
  type: 'command',
  name: 'cmd',
  message: '>',
  autoCompletion: ['foo', 'bar'],
}]);
```

### After (v1.x)
```typescript
import commandPrompt from '@tokenring-ai/inquirer-command-prompt';

const answer = await commandPrompt({
  message: '>',
  autoCompletion: ['foo', 'bar'],
});
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Support

For issues and questions, please visit the [GitHub repository](https://github.com/tokenring-ai/inquirer-command-prompt/issues).