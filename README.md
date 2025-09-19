# Inquirer Command Prompt Package Documentation

## Overview

The `@tokenring-ai/inquirer-command-prompt` package provides an interactive command prompt for Node.js CLI applications, built on top of `@inquirer/core`. It enhances user input handling with features like command history navigation (using up/down arrow keys), auto-completion (via Tab key), multi-line input support, input validation, and customizable history persistence. This package is ideal for building interactive command-line interfaces where users need to enter commands, with intelligent suggestions and recall of previous inputs.

The prompt integrates seamlessly with the Inquirer ecosystem, leveraging its readline-based input system while adding specialized functionality for command-like interactions. It supports both ephemeral (in-memory) and file-backed history, allowing commands to be saved across sessions.

Key features:
- **History Management**: Navigate previous commands with arrow keys; supports persistent storage.
- **Auto-Completion**: Tab-triggered suggestions from a static array or dynamic async function.
- **Multi-Line Mode**: Toggle with Meta+M (Cmd+M on macOS) for entering commands across multiple lines.
- **Validation and Transformation**: Custom validators and display transformers.
- **Theming and Styling**: Customizable colors and formatting via themes.

This package plays a role in larger CLI tools by providing a robust, user-friendly way to capture complex command inputs.

## Installation/Setup

To use this package in your Node.js project:

1. Ensure you have Node.js >= 20 or bun installed, which can use native TypeScript modules.
2. Install the package via npm:

   ```bash
   npm install @tokenring-ai/inquirer-command-prompt
   ```

The package is written in TypeScript and uses ES modules (`"type": "module"`). Your project must be configured to compile native TypeScript modules.

Dependencies like `@inquirer/core` and `chalk` are installed automatically. For file-backed history, `fs-extra` is used for file operations.

## Package Structure

The package is organized as a standard npm module under `pkg/inquirer-command-prompt/`:

- **index.ts**: Main entry point. Exports the default `createPrompt` function for the command prompt, along with interfaces like `CommandPromptConfig`, `HistoryHandler`, and `AutoCompleterResult`. Handles core logic for keypress events, state management, and rendering.
- **helpers.ts**: Utility functions for formatting auto-completion lists, shortening suggestions, ellipsizing long text, and removing ANSI colors. Includes `formatList`, `short`, `ellipsize`, `decolorize`, `formatIndex`, and `setSpaces`.
- **package.json**: Package metadata, scripts (lint, test), and dependencies.
- **examples/**: Sample usage files like `test-simple.ts`, `test-basic.ts`, `filecompletion.ts`, and `autocompletion.ts` demonstrating basic prompts, history, and completion.
- **test/**: Unit and integration tests using Vitest, covering history handlers and prompt behavior.
- **MIGRATION.md**: Notes on version changes (if applicable).
- Other files: `package-lock.json`, `_config.yml` (likely for GitHub Pages or docs).

Directories are auto-created as needed for history files.

## Core Components

### Command Prompt (Default Export)

The main component is a prompt factory created via `@inquirer/core`'s `createPrompt`. It manages the interactive session, handling input, key events, and output rendering.

- **Description**: Renders a prompt with a message, captures user input (single or multi-line), processes keypresses for history/auto-completion, validates input, and resolves with the final command string.
- **Key Methods/Properties**:
  - No direct methods on the prompt instance; it's a function that returns a prompt creator. Usage: `const prompt = commandPrompt(config); await prompt();`
  - Internal hooks: Uses `useState`, `useKeypress`, `usePrefix`, `useMemo` from `@inquirer/core` for state and event management.
  - Interactions: Keypress handler processes Enter (submit), Up/Down (history), Tab (completion), Meta+M (multi-line toggle). On submit, adds to history, runs validation, and calls `done(value)`.
- **Example**:
  ```typescript
  import commandPrompt from '@tokenring-ai/inquirer-command-prompt';
  const answer = await commandPrompt({ message: 'Enter a command:' })();
  console.log(answer); // e.g., "npm install"
  ```

### Helpers

Utility functions for display formatting, used in auto-completion rendering.

- `formatList(elems: string[], maxSize?: number, ellipsize?: boolean, ellipsis?: string): string` - Columns matched elements.
- `short(line: string, matches: string[]): string[]` - Removes common prefix from suggestions.
- `ellipsize(str: string, len: number, ellipsis?: string): string` - Truncates with ellipsis.
- Others as listed in helpers.ts.

## Usage Examples

### Basic Single-Line Prompt

```typescript
import commandPrompt from '@tokenring-ai/inquirer-command-prompt';

async function main() {
  const answer = await commandPrompt({
    message: 'What command would you like to run?',
    default: 'npm start'
  })();
  console.log('You entered:', answer);
}

main();
```

### With Auto-Completion and File History

```typescript
import commandPrompt from '@tokenring-ai/inquirer-command-prompt';
import FileBackedHistory from '@tokenring-ai/inquirer-command-prompt/FileBackedHistory';

const history = new FileBackedHistory({ folder: './.history', limit: 20 });

const commands = ['npm install', 'npm run build', 'git commit', 'yarn add lodash'];

async function main() {
  const answer = await commandPrompt({
    message: 'Enter a dev command:',
    historyHandler: history,
    autoCompletion: commands,
    validate: (value) => value.trim() ? true : 'Command required!',
    short: true  // Shorten suggestions
  })();
  console.log('Command:', answer);
  history.add(answer);  // Explicit add if needed
}

main();
```

### Multi-Line Input

Toggle multi-line with Meta+M, submit with Meta+Enter.

```typescript
// Same setup as above, but add:
const answer = await commandPrompt({
  message: 'Enter multi-line notes:',
  // Multi-line enabled via keypress (Meta+M)
})();
```

For more examples, see the `examples/` directory.

## Configuration Options

The `CommandPromptConfig` interface defines all options:

- `message: string` (required) - Prompt text.
- `historyHandler?: HistoryHandler` - Custom history (defaults to `EphemeralHistory`).
- `autoCompletion?: ((line: string) => Promise<string[]>) | string[]` - Static array or async completer function.
- `transformer?: (value: string) => string` - Transform displayed input.
- `validate?: (value: string) => Promise<boolean | string> | boolean | string` - Input validation.
- `required?: boolean` - Enforce non-empty input.
- `onBeforeKeyPress?: (key: any, rl: any) => void` - Pre-keypress hook.
- `onBeforeRewrite?: (value: string) => void` - Before line rewrite.
- `onClose?: (value: string) => void` - Post-submit callback.
- `autocompletePrompt?: string` - Custom completion header (default: "Available commands:").
- `short?: boolean | ((value: string, matches: string[]) => string[])` - Shorten suggestions.
- `maxSize?: number` - Max column width for lists (default: 32).
- `ellipsize?: boolean` - Truncate long suggestions.
- `ellipsis?: string` - Ellipsis char (default: "…").
- `noColorOnAnswered?: boolean` - Disable color on submit.
- `colorOnAnswered?: string` - Custom submit color.
- `theme?: Partial<Theme>` - Inquirer theme overrides.
- `default?: string` - Initial/default value.

For history configs, see `HistoryConfig` in respective classes (e.g., `limit`, `blacklist`, `folder` for file-backed).

Environment variables: None explicitly used; relies on Node.js process.stdout for terminal width.

## API Reference

- **default export**: `createPrompt<CommandPromptConfig>(config: CommandPromptConfig) => Promise<string>` - Creates and runs the prompt.
- **AutoCompleterResult**: `{ match?: string; matches?: string[] }` - Completion result type.
- Helpers: `formatList(...)`, `short(...)`, etc., as utility exports.

All public APIs are typed for TypeScript.

## Dependencies

- `@inquirer/core@^10.1.15` - Core prompt engine.
- `@inquirer/type@^3.0.8` - Readline extensions.
- `chalk@^5.5.0` - Terminal coloring.
- `fs-extra@^11.3.1` - File system operations for history.
- `lodash@^4.17.21` - Utility library (used in tests or internals).

Dev dependencies include Vitest for testing, ESLint, TypeScript.

## Contributing/Notes

- **Testing**: Run `npm test` for Vitest suite covering history, completion, and integration.
- **Building**: No build script; TypeScript compiles on-the-fly.
- **Known Limitations**: Auto-completion is prefix-based; multi-line mode is basic (no advanced editing). File history uses synchronous I/O—suitable for CLIs but may block in high-load scenarios. Binary files and .gitignore are skipped in searches (per tool constraints, but irrelevant here).
- **License**: MIT.
- Contributions: Fork the repo, add tests, and submit PRs. Lint with ESLint.
- Inspired by Inquirer.js issue #306.

For issues, see the GitHub repository.