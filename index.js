import chalk from 'chalk';
import InputPrompt from 'inquirer/lib/prompts/input.js';
import DefaultHistory from './DefaultHistory.js';
import {formatIndex, formatList, isAsyncFunc, short} from './helpers.js';
import process from 'node:process';

/**
 * @typedef {Object} AutoCompleterResult
 * @property {string} [match] - The matched string for auto-completion
 * @property {string[]} [matches] - Array of possible matches
 */

/**
 * @typedef {Object} HistoryConfig
 * @property {boolean} [save] - Whether to save history to a file
 * @property {string} [folder] - Folder to save history file
 * @property {number} [limit] - Maximum number of history entries
 * @property {string[]} [blacklist] - Commands to exclude from history
 * @property {string} [fileName] - Name of the history file
 */

/**
 * @typedef {Object} GlobalConfig
 * @property {HistoryConfig} [history] - History configuration
 * @property {Function} [onCtrlEnd] - Function to call on Ctrl+End
 */

/**
 * @typedef {Object} HistoryHandler
 * @property {Function} init - Initialize history for a context
 * @property {Function} add - Add a command to history
 * @property {Function} getPrevious - Get previous command from history
 * @property {Function} getNext - Get next command from history
 * @property {Function} getAll - Get all commands from history
 * @property {Function} [setConfig] - Set history configuration
 */

/** @type {Object.<string, Function>} */
const autoCompleters = {};
/**
 * Command prompt with history and auto-completion
 * @extends InputPrompt
 */
export default class CommandPrompt extends InputPrompt {
  /**
   * Creates a new CommandPrompt instance
   * @param {...any} args - Arguments to pass to InputPrompt constructor
   */
  constructor(...args) {
    super(...args);

    this.historyHandler = this.opt.historyHandler ?? new DefaultHistory(this.opt.history);

    this.context = this.opt.context ?? '_default';
    this.historyHandler.init(this.context); // Initialize for the current context
  }


 /**
  * Initialize auto-completion for a context
  * @param {string} context - The context to initialize auto-completion for
  * @param {Function|null} autoCompletion - The auto-completion function or null
  * @returns {Promise<void>}
  */
 async initAutoCompletion(context, autoCompletion) {
  if (!autoCompleters[context]) {
      if (isAsyncFunc(autoCompletion)) { // Use CommandPrompt for static check
        autoCompleters[context] = async l => this.asyncAutoCompleter(l, autoCompletion);
      } else if (autoCompletion) {
        autoCompleters[context] = l => this.autoCompleter(l, autoCompletion);
   } else {
    autoCompleters[context] = () => [];
   }
  }
 }

 /**
  * Handle keypress events
  * @param {Object} e - The keypress event
  * @param {Object} e.key - The key information
  * @param {string} e.key.name - The name of the key
  * @param {boolean} [e.key.ctrl] - Whether the Ctrl key was pressed
  * @param {boolean} [e.key.shift] - Whether the Shift key was pressed
  * @returns {Promise<void>}
  */
 async onKeypress(e) {

  if (this.opt.onBeforeKeyPress) {
      try {
        this.opt.onBeforeKeyPress(e);
      } catch (err) {
        console.error('Error in onBeforeKeyPress:', err);
        // Decide if we should stop further processing or continue
      }
  }


    // this.context is initialized in the constructor.
    // Ensure history is initialized for the context (also done in constructor, but harmless here).
    this.historyHandler.init(this.context);

    // Ensure autocompleter is initialized for the current context.
    // Pass this.context, which is correctly set.
    await this.initAutoCompletion(this.context, this.opt.autoCompletion);

    /** go up commands history */
    if (e.key.name === 'up' || e.key.name === 'down') {
      this._handleHistoryNavigation(e);
    }
    /** search for command at an autoComplete option */
    else if (e.key.name === 'tab') {
      await this._handleTabCompletion();
    }
    /** Display history or recall specific history entry */
    else if (e.key.name === 'right' && e.key.shift) {
      this._handleHistoryDisplayOrRecall(e);
    }
    /** Execute onCtrlEnd if defined */
    else if (e.key.name === 'end' && e.key.ctrl) {
      this._handleCtrlEnd();
    }

    this.render();
  }

  /**
   * Rewrite the current line with a new value
   * @param {string} line - The new line value
   * @private
   */
  _rewriteLine(line) {
    if (this.opt.onBeforeRewrite) {
      try {
        line = this.opt.onBeforeRewrite(line);
      } catch (err) {
        console.error('Error in onBeforeRewrite:', err);
      }
    }
    this.rl.line = line;
    this.rl.write(null, {ctrl: true, name: 'e'});
  }

  /**
   * Handle up/down arrow keys for history navigation
   * @param {Object} e - The keypress event
   * @param {Object} e.key - The key information
   * @param {string} e.key.name - The name of the key ('up' or 'down')
   * @private
   */
  _handleHistoryNavigation(e) {
    if (e.key.name === 'up') {
      const previousCommand = this.historyHandler.getPrevious(this.context);
      if (previousCommand !== undefined) {
        this._rewriteLine(previousCommand);
      }
    } else if (e.key.name === 'down') {
      const nextCommand = this.historyHandler.getNext(this.context);
      const lineValue = nextCommand !== undefined ? nextCommand : '';
      this._rewriteLine(lineValue);
    }
  }

  /**
   * Handle tab key for auto-completion
   * @returns {Promise<void>}
   * @private
   */
  async _handleTabCompletion() {
    let line = this.rl.line.replace(/^ +/, '').replace(/\t/, '').replace(/ +/g, ' ');
    try {
     /** @type {AutoCompleterResult} */
     let ac; // auto-completion result
      if (isAsyncFunc(this.opt.autoCompletion)) {
        ac = await autoCompleters[this.context](line);
      } else {
        ac = autoCompleters[this.context](line);
      }

      if (ac.match) {
        this._rewriteLine(ac.match);
      } else if (ac.matches) {
        console.log(); // Newline before list
        if (typeof process.stdout.cursorTo === 'function') {
          process.stdout.cursorTo(0); // Move cursor to beginning of line
        }
        console.log(this.opt.autocompletePrompt || chalk.red('>> ') + chalk.grey('Available commands:'));
        console.log(formatList(
          this.opt.short
            ? (
              typeof this.opt.short === 'function'
                ? this.opt.short(line, ac.matches) // User-provided shortener
                : short(line, ac.matches) // Default shortener
            )
            : ac.matches,
          this.opt.maxSize,
          this.opt.ellipsize,
          this.opt.ellipsis
        ));
        this._rewriteLine(line); // Rewrite the original line after displaying suggestions
      }
    } catch (err) {
      console.error('Error during tab completion:', err);
      this._rewriteLine(line); // Rewrite the original line on error
    }
  }

  /**
   * Handle Shift+Right Arrow to display history or Ctrl+Shift+Right Arrow to recall a specific history entry
   * @param {Object} e - The keypress event
   * @param {Object} e.key - The key information
   * @param {boolean} e.key.ctrl - Whether the Ctrl key was pressed
   * @param {boolean} e.key.shift - Whether the Shift key was pressed
   * @private
   */
  _handleHistoryDisplayOrRecall(e) {
    if (e.key.ctrl) {
      // History recall by number if current line is a number
      const lineAsIndex = parseInt(this.rl.line, 10);
      if (!isNaN(lineAsIndex)) {
        const historyEntries = this.historyHandler.getAll(this.context);
        if (lineAsIndex >= 0 && lineAsIndex < historyEntries.length) {
          this._rewriteLine(historyEntries[lineAsIndex]);
        } else {
          this._rewriteLine(''); // Index out of bounds or invalid
        }
      } else {
        this._rewriteLine(''); // Current line is not a number
      }
    } else {
      // Display all history entries
      const historyEntries = this.historyHandler.getAll(this.context);
      const historyConfig = this.historyHandler.config || {};
      const historyLimit = historyConfig.limit !== undefined ? historyConfig.limit : 100;

      console.log(); // Newline before history list
      console.log(chalk.bold('History:'));
      if (historyEntries.length === 0) {
        console.log(chalk.grey('  (No history)'));
      } else {
        for (let i = 0; i < historyEntries.length; i++) {
          console.log(`${chalk.grey(formatIndex(i, historyLimit))}  ${historyEntries[i]}`);
        }
      }
      this._rewriteLine(''); // Clear the current line after displaying history
    }
  }

  /**
   * Handle Ctrl+End key combination
   * @private
   */
  _handleCtrlEnd() {
    if (globalConfig && typeof globalConfig.onCtrlEnd === 'function') {
      try {
        this._rewriteLine(globalConfig.onCtrlEnd(this.rl.line));
      } catch (err) {
        console.error('Error in globalConfig.onCtrlEnd:', err);
        this._rewriteLine(this.rl.line); // Keep current line on error
      }
    } else {
      this._rewriteLine('');
    }
  }

  // --- End of onKeypress helper methods ---

  /**
   * Process async auto-completion
   * @param {string} line - The current input line
   * @param {Function} cmds - Async function that returns auto-completion commands
   * @returns {Promise<AutoCompleterResult>} Auto-completion result
   */
  async asyncAutoCompleter(line, cmds) {
    cmds = await cmds(line);
    return this.autoCompleterFormatter(line, cmds);
  }

  /**
   * Process synchronous auto-completion
   * @param {string} line - The current input line
   * @param {Function|Array<string>} cmds - Function that returns commands or array of commands
   * @returns {AutoCompleterResult} Auto-completion result
   */
  autoCompleter(line, cmds) {
    if (typeof cmds === 'function') {
      cmds = cmds(line);
    }
    return this.autoCompleterFormatter(line, cmds);
  }

 /**
  * Format auto-completion results
  * @param {string} line - The current input line
  * @param {Array<string|Object>} cmds - Array of possible completions
  * @returns {AutoCompleterResult} Formatted auto-completion result
  */
 autoCompleterFormatter(line, cmds) {
  let max = 0;

  // first element in cmds can be an object with special instructions
  let options = {
   filter: str => str
  };
  if (typeof cmds[0] === 'object') {
   const f = cmds[0].filter;
   if (typeof f === 'function') {
    options.filter = f;
   }
   cmds = cmds.slice(1);
  }

  cmds = cmds.reduce((sum, el) => {
   let sanitizedLine = line.replace(/[\\.+*?^$\[\](){}\/'#:!=|]/ig, '\\$&');
   RegExp(`^${sanitizedLine}`).test(el) && sum.push(el) && (max = Math.max(max, el.length));
   return sum;
  }, []);
  if (cmds.length > 1) {
   let commonStr = '';
   LOOP: for (let i = line.length; i < max; i++) {
    let c = null;
    for (let l of cmds) {
     if (!l[i]) {
      break LOOP;
     } else if (!c) {
      c = l[i];
     } else if (c !== l[i]) {
      break LOOP;
     }
    }
    commonStr += c;
   }
   if (commonStr) {
    return {match: options.filter(line + commonStr)};
   } else {
    return {matches: cmds};
   }
  } else if (cmds.length === 1) {
   return {match: options.filter(cmds[0])};
  } else {
   return {match: options.filter(line)};
  }
 }

  /**
   * Run the prompt and return a promise that resolves with the user's input
   * @returns {Promise<string>} Promise that resolves with the user's input
   * @override
   */
  run() {
    return new Promise( (resolve) => { // Using arrow function to preserve `this`
      this._run( (value) => { // Using arrow function to preserve `this`
        // Use this.historyHandler to add command, with this.context
        this.historyHandler.add(this.context, value);
        // No need to manage historyIndexes here, DefaultHistory's add() handles it.
        resolve(value);
      });
    }); // No need for .bind(this) if using arrow functions
  }

  /**
   * Render the prompt to the screen
   * @param {string} [error] - Error message to display
   * @override
   */
  render(error) {
    let bottomContent = '';
    let appendContent;
    let message = this.getQuestion();
    let transformer = this.opt.transformer;
    let isFinal = this.status === 'answered';
    if (isFinal) {
      appendContent = this.answer;
    } else {
      appendContent = this.rl.line;
    }

  let transformedAppendContent = appendContent;
  if (transformer) {
    try {
      transformedAppendContent = transformer(appendContent, this.answers, {isFinal});
      message += transformedAppendContent;
    } catch (err) {
      console.error('Error in transformer function:', err);
      // Fallback to using the original appendContent if transformer fails
      message += isFinal && !this.opt.noColorOnAnswered ? chalk[this.opt.colorOnAnswered || 'cyan'](appendContent) : appendContent;
    }
  } else {
   message += isFinal && !this.opt.noColorOnAnswered ? chalk[this.opt.colorOnAnswered || 'cyan'](appendContent) : appendContent;
  }

  if (error) {
   bottomContent = chalk.red('>> ') + error;
  }
  this.screen.render(message, bottomContent);
 }

 /**
 * Clean up when the prompt is closed
 * @override
 */
close() {
  if (typeof this.opt.onClose === 'function') {
    try {
      this.opt.onClose();
    } catch (err) {
      console.error('Error in onClose function:', err);
    }
  }
}

}
