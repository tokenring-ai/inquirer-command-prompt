import chalk from 'chalk';
import {createPrompt, isDownKey, isEnterKey, isUpKey, makeTheme, useKeypress, usePrefix, useState, useMemo} from '@inquirer/core';

import EphemeralHistory from './EphemeralHistory.js';
const defaultHistory = new EphemeralHistory();

import {formatIndex, formatList, short} from './helpers.js';

/**
 * @typedef {Object} AutoCompleterResult
 * @property {string} [match] - The matched string for auto-completion
 * @property {string[]} [matches] - Array of possible matches
 */

/**
 * @typedef {Object} HistoryHandler
 * @property {Function} init - Initialize history
 * @property {Function} add - Add a command to history
 * @property {Function} getPrevious - Get previous command from history
 * @property {Function} getNext - Get next command from history
 * @property {Function} getAll - Get all commands from history
 * @property {Function} [setConfig] - Set history configuration
 */

/**
 * @typedef {Object} CommandPromptConfig
 * @property {string} message - The prompt message
 * @property {HistoryHandler} [historyHandler] - Custom history handler
 * @property {(line: string) => Promise<string[]> | string[]} [autoCompletion] - Auto-completion function or array
 * @property {Function} [transformer] - Transform the displayed value
 * @property {Function} [validate] - Validate the input
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


/**
 * Format auto-completion results
 * @param {string} line - The current input line
 * @param {string[]} cmds - Array of possible completions
 * @returns {string[]} Formatted auto-completion result with matches as string[]
 */
function autoCompleterFormatter(line, cmds) {
 let max = 0;

 const filteredCmds = cmds.reduce(( sum, el) => {
  const sanitizedLine = line.replace(/[\\.+*?^$\[\](){}\/'#:!=|]/ig, '\\$&');
  // Convert any non-string elements to strings before testing and pushing
  const elStr = typeof el === 'string' ? el : String(el);
  if (RegExp(`^${sanitizedLine}`).test(elStr)) {
   sum.push(elStr);
   max = Math.max(max, elStr.length);
  }
  return sum;
 }, []);

 return filteredCmds.slice(0,max);
}


/**
 * Command prompt with history and auto-completion built on @inquirer/core
 * @param {CommandPromptConfig} config - Configuration options
 * @returns {Promise<string>} Promise that resolves with the user's input
 */
export default createPrompt((config, done) => {
 const {
  theme: themeConfig,
  default: defaultValue,
  historyHandler = defaultHistory,
  autoCompletion,
  transformer,
  validate,
  required,
  autocompletePrompt,
  short: shortConfig,
  maxSize,
  ellipsize,
  ellipsis,
  message
 } = config;

 const theme = makeTheme({}, themeConfig);
 const [status, setStatus] = useState('idle');
 const [value, setValue] = useState(defaultValue || '');

 const [displayContent, setDisplayContent] = useState('');

 const prefix = usePrefix({status, theme});

 const autoCompleter = useMemo(() => {
  if (autoCompletion) {
   return async (line) => {
    let commands;
    if (Array.isArray(autoCompletion)) {
     commands = autoCompletion.filter( cmd => cmd.startsWith(line));
    } else {
     commands = await autoCompletion(line);
    }
    return autoCompleterFormatter(line, commands);
   };
  }
  return () => [];
 }, [autoCompletion]);

 useKeypress(async (key, rl) => {
  // Ignore keypress while our prompt is doing other processing
  if (status !== 'idle') {
   return;
  }

  function resetValue(newValue, displayContent = '') {
   rl.line = newValue;
   rl.cursor = newValue.length;
   setValue(newValue);
   setDisplayContent(displayContent);
  }

  if (isEnterKey(key)) {
   // Use the current value state, which should be synced with rl.line
   const answer = value || '';
   setStatus('loading');

   // Validate input
   let isValid = true;
   if (required && !answer) {
    isValid = 'You must provide a value';
   } else if (validate) {
    try {
     isValid = await validate(answer);
    } catch (err) {
     isValid = 'Validation error';
    }
   }

   if (isValid === true) {
    // Add to history
    historyHandler.add(answer);
    setStatus('done');
    setDisplayContent('');
    done(answer);
   } else {
    resetValue(
     value,
     theme.style.error(typeof isValid === 'string' ? isValid : 'You must provide a valid value')
    );
    setStatus('idle');
   }
  } else if (key.name === 'up') {
   const previousCommand = historyHandler.getPrevious();
   resetValue(previousCommand ?? rl.line);
  } else if (key.name === 'down') {
   const nextCommand = historyHandler.getNext();
   resetValue(nextCommand ?? '');
  } else if (key.name === 'tab') {
   // Handle tab completion
   let line = value.replace(/^ +/, '').replace(/\t/, '').replace(/ +/g, ' ');

   let matches = await autoCompleter(line) ?? [];

   if (matches.length === 0) {
    resetValue(
     value,
     chalk.red('>> ') + chalk.grey('No available commands')
    );
   } else if (matches.length === 1) {
    resetValue(matches[0]);
   } else {
    // Keep the current value
    rl.line = value;
    rl.cursor = value.length;

    // Display autocompletion suggestions
    const promptMessage = autocompletePrompt || chalk.red('>> ') + chalk.grey('Available commands:');
    const formattedList = formatList(
     shortConfig
      ? (typeof shortConfig === 'function'
       ? shortConfig(line, matches)
       : short(line, matches))
      : matches,
     maxSize,
     ellipsize,
     ellipsis
    );

    resetValue(
     value,
     `${promptMessage}\n${formattedList}`
    );
   }
  } else if (key.name === 'right' && key.shift) {
   // Display all history entries
   const historyEntries = historyHandler.getAll();
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

   resetValue(
    value,
    historyDisplay
   );
  } else {
   // Update the value without transformation - transformer is only for display
   setValue(rl.line);
   setDisplayContent('');
   }
 });

 const messageText = theme.style.message(message, status);

 // Apply transformer only for display purposes
 const displayValue = transformer ? transformer(value) : value;
 let formattedValue = theme.style.answer(displayValue);

 let defaultStr = '';
 if (defaultValue && status !== 'done' && !value) {
  defaultStr = theme.style.defaultAnswer(defaultValue);
 }

 // Build the display output
 const mainLine = [prefix, messageText, defaultStr, formattedValue]
 .filter((v) => v !== undefined && v !== '')
 .join(' ');


 return [mainLine, displayContent];
});