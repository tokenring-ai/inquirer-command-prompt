import chalk from 'chalk';
import {createPrompt, isDownKey, isEnterKey, isUpKey, makeTheme, useKeypress, usePrefix, useState, useMemo} from '@inquirer/core';

import EphemeralHistory from './EphemeralHistory.js';

import {formatIndex, formatList, isAsyncFunc, short} from './helpers.js';

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
 * @param {Array<string[]>} cmds - Array of possible completions
 * @returns {AutoCompleterResult} Formatted auto-completion result with matches as string[]
 */
function autoCompleterFormatter(line, cmds) {
 if (!Array.isArray(cmds)) {
  return {match: line, matches: []};
 }

 let max = 0;
 let options = {filter: str => str};

 // First element in cmds can be an object with special instructions
 if (typeof cmds[0] === 'object' && cmds[0] !== null && !Array.isArray(cmds[0])) {
  const f = cmds[0].filter;
  if (typeof f === 'function') {
   options.filter = f;
  }
  cmds = cmds.slice(1);
 }

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
   return {match: options.filter(line + commonStr)};
  } else {
   return {matches: filteredCmds};
  }
 } else if (filteredCmds.length === 1) {
  return {match: options.filter(filteredCmds[0])};
 } else {
  return {match: options.filter(line)};
 }
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
  historyHandler: configHistoryHandler,
  autoCompletion,
  transformer,
  validate,
  required,
  onBeforeKeyPress,
  onBeforeRewrite,
  autocompletePrompt,
  short: shortConfig,
  maxSize,
  ellipsize,
  ellipsis,
  message,
  noColorOnAnswered,
  colorOnAnswered
 } = config;

 const theme = makeTheme({}, themeConfig);
 const [status, setStatus] = useState('idle');
 const [value, setValue] = useState(defaultValue || '');
 const [errorMsg, setError] = useState();
 const [displayMode, setDisplayMode] = useState('normal'); // 'normal', 'history', 'autocomplete'
 const [displayContent, setDisplayContent] = useState('');

 // Initialize history handler
 const historyHandler = useMemo(() => configHistoryHandler ?? new EphemeralHistory(), [configHistoryHandler]);

 const prefix = usePrefix({status, theme});

 const autoCompleter = useMemo(() => {
  if (autoCompletion) {
   return async (line) => {
    const commands = await autoCompletion(line);
    return autoCompleterFormatter(line, commands);
   };
  }
  return () => ({match: '', matches: []});
 }, [autoCompletion]);

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
  if (onBeforeKeyPress) {
   try {
    onBeforeKeyPress({key});
   } catch (err) {
    console.error('Error in onBeforeKeyPress:', err);
   }
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
  } else if (isUpKey(key)) {
   const previousCommand = historyHandler.getPrevious();
   if (previousCommand !== undefined) {
    setValue(previousCommand);
    rl.line = previousCommand;
    rl.cursor = previousCommand.length;
   }
   if (displayMode !== 'normal') {
    setDisplayMode('normal');
    setDisplayContent('');
   }
  } else if (isDownKey(key)) {
   const nextCommand = historyHandler.getNext();
   const lineValue = nextCommand !== undefined ? nextCommand : '';
   setValue(lineValue);
   rl.line = lineValue;
   rl.cursor = lineValue.length;
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
    if (isAsyncFunc(autoCompletion)) {
     ac = await autoCompleter(line);
    } else {
     ac = autoCompleter(line);
    }

    if (ac.match && ac.match !== line) {
     const newValue = onBeforeRewrite ? onBeforeRewrite(ac.match) : ac.match;
     setValue(newValue);
     rl.line = newValue;
     rl.cursor = newValue.length;
     setDisplayMode('normal');
     setDisplayContent('');
    } else if (ac.matches && ac.matches.length > 0) {
     // Display autocompletion suggestions
     const promptMessage = autocompletePrompt || chalk.red('>> ') + chalk.grey('Available commands:');
     const formattedList = formatList(
      shortConfig
       ? (typeof shortConfig === 'function'
        ? shortConfig(line, ac.matches)
        : short(line, ac.matches))
       : ac.matches,
      maxSize,
      ellipsize,
      ellipsis
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

   setDisplayMode('history');
   setDisplayContent(historyDisplay);
   setValue('');
   rl.line = '';
   rl.cursor = 0;
  } else {
   // For all other keys, clear any error and display mode
   setError(undefined);
   if (displayMode !== 'normal') {
    setDisplayMode('normal');
    setDisplayContent('');
   }
  }
 });

 const messageText = theme.style.message(message, status);

 let formattedValue = value;
 if (typeof transformer === 'function') {
  try {
   formattedValue = transformer(value, {}, {isFinal: status === 'done'});
  } catch (err) {
   console.error('Error in transformer function:', err);
  }
 } else if (status === 'done') {
  formattedValue = noColorOnAnswered
   ? value
   : chalk[colorOnAnswered || 'cyan'](value);
 }

 let defaultStr = '';
 if (defaultValue && status !== 'done' && !value) {
  defaultStr = theme.style.defaultAnswer(defaultValue);
 }

 let error = '';
 if (errorMsg) {
  error = theme.style.error(errorMsg);
 }

 // Build the display output
 const mainLine = [prefix, messageText, defaultStr, formattedValue]
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