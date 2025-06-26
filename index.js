import chalk from 'chalk';
import {
 createPrompt,
 useState,
 useKeypress,
 usePrefix,
 isEnterKey,
 isUpKey,
 isDownKey,
 makeTheme,
} from '@inquirer/core';
import DefaultHistory from './DefaultHistory.js';
import { formatIndex, formatList, isAsyncFunc, short } from './helpers.js';

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

/**
 * @typedef {Object} CommandPromptConfig
 * @property {string} message - The prompt message
 * @property {string} [context] - Context for history and autocompletion
 * @property {HistoryHandler} [historyHandler] - Custom history handler
 * @property {HistoryConfig} [history] - History configuration
 * @property {Function|Array<string>} [autoCompletion] - Auto-completion function or array
 * @property {Function} [transformer] - Transform the displayed value
 * @property {Function} [validate] - Validate the input
 * @property {string} [default] - Default value
 * @property {boolean} [required] - Whether input is required
 * @property {Function} [onBeforeKeyPress] - Called before each keypress
 * @property {Function} [onBeforeRewrite] - Called before rewriting the line
 * @property {Function} [onClose] - Called when prompt closes
 * @property {string} [autocompletePrompt] - Custom autocomplete prompt message
 * @property {boolean|Function} [short] - Whether to shorten autocomplete suggestions
 * @property {number} [maxSize] - Maximum size for formatting
 * @property {boolean} [ellipsize] - Whether to ellipsize long text
 * @property {string} [ellipsis] - Custom ellipsis character
 * @property {boolean} [noColorOnAnswered] - Disable color on answered
 * @property {string} [colorOnAnswered] - Color to use on answered
 * @property {Object} [theme] - Theme configuration
 */

/** @type {Object.<string, Function>} */
const autoCompleters = {};

/** @type {GlobalConfig} */
let globalConfig = {};

/**
 * Set global configuration
 * @param {GlobalConfig} config - Global configuration
 */
export function setGlobalConfig(config) {
 globalConfig = { ...globalConfig, ...config };
}

/**
 * Command prompt with history and auto-completion built on @inquirer/core
 * @param {CommandPromptConfig} config - Configuration options
 * @returns {Promise<string>} Promise that resolves with the user's input
 */
export default createPrompt((config, done) => {
 const theme = makeTheme({}, config.theme);
 const [status, setStatus] = useState('idle');
 const [value, setValue] = useState(config.default || '');
 const [errorMsg, setError] = useState();
 const [displayMode, setDisplayMode] = useState('normal'); // 'normal', 'history', 'autocomplete'
 const [displayContent, setDisplayContent] = useState('');

 // Initialize history handler
 const historyHandler = config.historyHandler ?? new DefaultHistory(config.history);
 const context = config.context ?? '_default';
 historyHandler.init(context);

 const prefix = usePrefix({ status, theme });

 /**
  * Initialize auto-completion for a context
  * @param {string} context - The context to initialize auto-completion for
  * @param {Function|Array<string>|null} autoCompletion - The auto-completion function or array
  */
 const initAutoCompletion = (context, autoCompletion) => {
  if (!autoCompleters[context]) {
   if (isAsyncFunc(autoCompletion)) {
    autoCompleters[context] = async (l) => asyncAutoCompleter(l, autoCompletion);
   } else if (autoCompletion) {
    autoCompleters[context] = (l) => autoCompleter(l, autoCompletion);
   } else {
    autoCompleters[context] = () => ({ match: '', matches: [] });
   }
  }
 };

 /**
  * Process async auto-completion
  * @param {string} line - The current input line
  * @param {Function} cmds - Async function that returns auto-completion commands
  * @returns {Promise<AutoCompleterResult>} Auto-completion result
  */
 const asyncAutoCompleter = async (line, cmds) => {
  const commands = await cmds(line);
  return autoCompleterFormatter(line, commands);
 };

 /**
  * Process synchronous auto-completion
  * @param {string} line - The current input line
  * @param {Function|Array<string>} cmds - Function that returns commands or array of commands
  * @returns {AutoCompleterResult} Auto-completion result
  */
 const autoCompleter = (line, cmds) => {
  if (typeof cmds === 'function') {
   cmds = cmds(line);
  }
  return autoCompleterFormatter(line, cmds);
 };

 /**
  * Format auto-completion results
  * @param {string} line - The current input line
  * @param {Array<string|Object>} cmds - Array of possible completions
  * @returns {AutoCompleterResult} Formatted auto-completion result
  */
 const autoCompleterFormatter = (line, cmds) => {
  if (!Array.isArray(cmds)) {
   return { match: line, matches: [] };
  }

  let max = 0;
  let options = { filter: str => str };

  // First element in cmds can be an object with special instructions
  if (typeof cmds[0] === 'object' && cmds[0] !== null && !Array.isArray(cmds[0])) {
   const f = cmds[0].filter;
   if (typeof f === 'function') {
    options.filter = f;
   }
   cmds = cmds.slice(1);
  }

  const filteredCmds = cmds.reduce((sum, el) => {
   const sanitizedLine = line.replace(/[\\.+*?^$\[\](){}\/'#:!=|]/ig, '\\$&');
   if (RegExp(`^${sanitizedLine}`).test(el)) {
    sum.push(el);
    max = Math.max(max, el.length);
   }
   return sum;
  }, []);

  if (filteredCmds.length > 1) {
   let commonStr = '';
   LOOP: for (let i = line.length; i < max; i++) {
    let c = null;
    for (let l of filteredCmds) {
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
    return { match: options.filter(line + commonStr) };
   } else {
    return { matches: filteredCmds };
   }
  } else if (filteredCmds.length === 1) {
   return { match: options.filter(filteredCmds[0]) };
  } else {
   return { match: options.filter(line) };
  }
 };

 useKeypress(async (key, rl) => {
  // Ignore keypress while our prompt is doing other processing
  if (status !== 'idle') {
   return;
  }

  // Always sync our state with readline first (except for special keys)
  if (!isEnterKey(key) && !isUpKey(key) && !isDownKey(key) && key.name !== 'tab' &&
   !(key.name === 'right' && key.shift) && !(key.name === 'end' && key.ctrl)) {
   setValue(rl.line);
   // Clear display mode when typing
   if (displayMode !== 'normal') {
    setDisplayMode('normal');
    setDisplayContent('');
   }
  }

  // Call onBeforeKeyPress if provided
  if (config.onBeforeKeyPress) {
   try {
    config.onBeforeKeyPress({ key });
   } catch (err) {
    console.error('Error in onBeforeKeyPress:', err);
   }
  }

  // Initialize autocompleter for current context
  initAutoCompletion(context, config.autoCompletion);

  if (isEnterKey(key)) {
   // Use the current value state, which should be synced with rl.line
   const answer = value || config.default || '';
   setStatus('loading');

   // Validate input
   let isValid = true;
   if (config.required && !answer) {
    isValid = 'You must provide a value';
   } else if (config.validate) {
    try {
     isValid = await config.validate(answer);
    } catch (err) {
     isValid = 'Validation error';
    }
   }

   if (isValid === true) {
    // Add to history
    historyHandler.add(context, answer);
    setStatus('done');
    setDisplayMode('normal');
    setDisplayContent('');
    done(answer);
   } else {
    setError(typeof isValid === 'string' ? isValid : 'You must provide a valid value');
    setStatus('idle');
    // Ensure rl.line stays in sync with our value state after validation failure
    rl.line = value;
    rl.cursor = value.length;
   }
  } else if (isUpKey(key) || isDownKey(key)) {
   // Handle history navigation
   if (isUpKey(key)) {
    const previousCommand = historyHandler.getPrevious(context);
    if (previousCommand !== undefined) {
     setValue(previousCommand);
     rl.line = previousCommand;
     rl.cursor = previousCommand.length;
    }
   } else if (isDownKey(key)) {
    const nextCommand = historyHandler.getNext(context);
    const lineValue = nextCommand !== undefined ? nextCommand : '';
    setValue(lineValue);
    rl.line = lineValue;
    rl.cursor = lineValue.length;
   }
   // Clear display mode when navigating history
   if (displayMode !== 'normal') {
    setDisplayMode('normal');
    setDisplayContent('');
   }
  } else if (key.name === 'tab') {
   // Handle tab completion
   let line = value.replace(/^ +/, '').replace(/\t/, '').replace(/ +/g, ' ');
   try {
    let ac;
    if (isAsyncFunc(config.autoCompletion)) {
     ac = await autoCompleters[context](line);
    } else {
     ac = autoCompleters[context](line);
    }

    if (ac.match && ac.match !== line) {
     const newValue = config.onBeforeRewrite ? config.onBeforeRewrite(ac.match) : ac.match;
     setValue(newValue);
     rl.line = newValue;
     rl.cursor = newValue.length;
     setDisplayMode('normal');
     setDisplayContent('');
    } else if (ac.matches && ac.matches.length > 0) {
     // Display autocompletion suggestions
     const promptMessage = config.autocompletePrompt || chalk.red('>> ') + chalk.grey('Available commands:');
     const formattedList = formatList(
      config.short
       ? (typeof config.short === 'function'
        ? config.short(line, ac.matches)
        : short(line, ac.matches))
       : ac.matches,
      config.maxSize,
      config.ellipsize,
      config.ellipsis
     );
     setDisplayMode('autocomplete');
     setDisplayContent(`${promptMessage}\n${formattedList}`);
     // Keep the current value
     rl.line = value;
     rl.cursor = value.length;
    }
   } catch (err) {
    console.error('Error during tab completion:', err);
    rl.line = value;
    rl.cursor = value.length;
   }
  } else if (key.name === 'right' && key.shift) {
   // Handle history display or recall
   if (key.ctrl) {
    // History recall by number if current line is a number
    const lineAsIndex = parseInt(value, 10);
    if (!isNaN(lineAsIndex)) {
     const historyEntries = historyHandler.getAll(context);
     if (lineAsIndex >= 0 && lineAsIndex < historyEntries.length) {
      const newValue = historyEntries[lineAsIndex];
      setValue(newValue);
      rl.line = newValue;
      rl.cursor = newValue.length;
     } else {
      setValue('');
      rl.line = '';
      rl.cursor = 0;
     }
    } else {
     setValue('');
     rl.line = '';
     rl.cursor = 0;
    }
    setDisplayMode('normal');
    setDisplayContent('');
   } else {
    // Display all history entries
    const historyEntries = historyHandler.getAll(context);
    const historyConfig = historyHandler.config || {};
    const historyLimit = historyConfig.limit !== undefined ? historyConfig.limit : 100;

    let historyDisplay = chalk.bold('History:');
    if (historyEntries.length === 0) {
     historyDisplay += '\n' + chalk.grey('  (No history)');
    } else {
     for (let i = 0; i < historyEntries.length; i++) {
      historyDisplay += `\n${chalk.grey(formatIndex(i, historyLimit))}  ${historyEntries[i]}`;
     }
    }

    setDisplayMode('history');
    setDisplayContent(historyDisplay);
    setValue('');
    rl.line = '';
    rl.cursor = 0;
   }
  } else if (key.name === 'end' && key.ctrl) {
   // Handle Ctrl+End
   if (globalConfig && typeof globalConfig.onCtrlEnd === 'function') {
    try {
     const newValue = globalConfig.onCtrlEnd(value);
     setValue(newValue);
     rl.line = newValue;
     rl.cursor = newValue.length;
    } catch (err) {
     console.error('Error in globalConfig.onCtrlEnd:', err);
    }
   } else {
    setValue('');
    rl.line = '';
    rl.cursor = 0;
   }
   setDisplayMode('normal');
   setDisplayContent('');
  } else {
   // For all other keys, clear any error and display mode
   setError(undefined);
   if (displayMode !== 'normal') {
    setDisplayMode('normal');
    setDisplayContent('');
   }
  }
 });

 const message = theme.style.message(config.message, status);

 let formattedValue = value;
 if (typeof config.transformer === 'function') {
  try {
   formattedValue = config.transformer(value, {}, { isFinal: status === 'done' });
  } catch (err) {
   console.error('Error in transformer function:', err);
  }
 } else if (status === 'done') {
  formattedValue = config.noColorOnAnswered
   ? value
   : chalk[config.colorOnAnswered || 'cyan'](value);
 }

 let defaultStr = '';
 if (config.default && status !== 'done' && !value) {
  defaultStr = theme.style.defaultAnswer(config.default);
 }

 let error = '';
 if (errorMsg) {
  error = theme.style.error(errorMsg);
 }

 // Build the display output
 const mainLine = [prefix, message, defaultStr, formattedValue]
 .filter((v) => v !== undefined && v !== '')
 .join(' ');

 const output = [mainLine];

 if (error) {
  output.push(error);
 }

 // Add display content for history or autocomplete
 if (displayMode !== 'normal' && displayContent) {
  output.push(displayContent);
 }

 return output.join('\n');
});