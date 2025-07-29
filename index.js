import chalk from 'chalk';
import {createPrompt, isEnterKey, makeTheme, useKeypress, usePrefix, useState, useMemo} from '@inquirer/core';

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
  message,
 } = config;

 const theme = makeTheme({}, themeConfig);
 const [status, setStatus] = useState('idle');
 const [lines, setLines] = useState({
  activeLines: defaultValue ? [defaultValue] : [''],
  inactiveLines: [],
  displayContent: null
 });

 const [multiLine, setMultiLine] = useState(false);

 const prefix = usePrefix({status, theme});

 const {
  activeLines,
  inactiveLines,
  displayContent,
 } = lines;

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

  // Multi-line toggle: meta+M
  if ((key.name === 'm' || key.name === 'M') && key.meta) {
   if (multiLine) {
    // Exit multi-line mode
    setMultiLine(false);
    setLines({
     activeLines: [activeLines[0]],
     inactiveLines: [],
    });
   } else {
    // Enter multi-line mode
    setMultiLine(true);
   }
   return;
  }

  if (multiLine) {
   // Handle backspace in multi-line mode
   if (key.name === 'backspace') {
    // If current line is empty and we're not on the first line, delete the current line
    if (activeLines.length > 1 && activeLines[activeLines.length - 1] === '') {
     rl.line = activeLines[activeLines.length - 2];
     rl.cursor = activeLines[activeLines.length - 2].length;
     setLines({
      activeLines: activeLines.slice(0, activeLines.length - 1),
      inactiveLines,
     });
     return;
    }
    // Otherwise, let the default backspace behavior handle character deletion
   }

   // Handle up/down arrow navigation in multi-line mode
   if (key.name === 'up') {
    if (activeLines.length > 0) {
     setLines({
      inactiveLines: [activeLines.pop(), ...inactiveLines],
      activeLines: [...activeLines]
     });
    }
    return;
   }

   if (key.name === 'down') {
    if (inactiveLines.length > 0) {
     setLines({
      activeLines: [...activeLines, inactiveLines.shift()], 
      inactiveLines: [...inactiveLines]
     });
    }
    return;
   }

   // In multi-line mode, handle Enter specially
   if (isEnterKey(key) && !key.meta) {
    rl.cursor = 0;
    setLines({
     activeLines: [...activeLines, ''],
     inactiveLines
    });
    return;
   }
  }

  if (isEnterKey(key)) {
   const answer = [...activeLines, ...inactiveLines].join('\n');
   rl.cursor = activeLines[activeLines.length - 1].length;
   rl.line = activeLines[activeLines.length - 1];

   setStatus('loading');
   let isValid = true;
   if (required && !answer.trim()) {
    isValid = 'You must provide a value';
   } else if (validate) {
    try {
     isValid = await validate(answer);
    } catch (err) {
     isValid = 'Validation error';
    }
   }
   if (isValid === true) {
    historyHandler.add(answer);
    setStatus('done');
    done(answer);
   } else {
    setLines({
     activeLines,
     inactiveLines,
     displayContent: theme.style.error(typeof isValid === 'string' ? isValid : 'You must provide a valid value')
    });
    setStatus('idle');
   }
   return;
  }


  if (key.name === 'up') {
   const previousCommand = historyHandler.getPrevious();
   if (previousCommand) {
    setLines(
     {
      activeLines: [previousCommand],
      inactiveLines: []
     },
    );
    rl.line = previousCommand;
    rl.cursor = previousCommand.length;
   }
  } else if (key.name === 'down') {
   const nextCommand = historyHandler.getNext();
   if (nextCommand) {
    setLines(
     {
      activeLines: [nextCommand],
      inactiveLines: []
     },
    );
    rl.line = nextCommand;
    rl.cursor = nextCommand.length;
   }
  } else if (key.name === 'tab') {
   const value = activeLines[activeLines.length - 1];
   rl.cursor = value.length;
   rl.line = value;

   const trimmedValue = value.trim();
   // Handle tab completion
   //let line = (value.length > 1 ? value.join('\n') : value[0] || '').replace(/^ +/, '').replace(/\t/, '').replace(/ +/g, ' ');
   let matches = await autoCompleter(trimmedValue) ?? [];
   if (matches.length === 0) {
    setLines({
      activeLines,
      inactiveLines,
      displayContent: chalk.grey('No available commands')
     });
   } else if (matches.length === 1) {
    setLines({
     activeLines: [matches[0]],
     inactiveLines: [],
    });
   } else {
    // Display autocompletion suggestions
    const promptMessage = autocompletePrompt || chalk.grey('Available commands:');
    const formattedList = formatList(
     shortConfig
      ? (typeof shortConfig === 'function'
       ? shortConfig(value, matches)
       : short(value, matches))
      : matches,
     maxSize,
     ellipsize,
     ellipsis
    );
    setLines({
     activeLines,
     inactiveLines,
     displayContent: `${promptMessage}\n${formattedList}`
    });
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
   
   setLines({
    activeLines,
    inactiveLines,
    displayContent: historyDisplay
   });
  } else {
   activeLines[activeLines.length - 1] = rl.line;
   setLines({
    activeLines: [...activeLines],
    inactiveLines,
   });
  }
 });

 const messageText = theme.style.message(message, status);

 let activeLinesStr = activeLines.join('\n');
 if (transformer) {
  activeLinesStr = transformer(activeLinesStr);
 }

 activeLinesStr = theme.style.answer(activeLinesStr);

 if (activeLines.length > 1 && activeLines[activeLines.length - 1] === '') {
  activeLinesStr += '\r';
 }

 let inactiveLinesStr = inactiveLines.join('\n');
 if (transformer) {
  inactiveLinesStr = transformer(inactiveLinesStr);
 }

 if (inactiveLinesStr) inactiveLinesStr = theme.style.answer(inactiveLinesStr) + '\n';

 let defaultStr = '';
 if (defaultValue && status !== 'done' && ! activeLines?.[0]?.length > 0 && !multiLine) {
  defaultStr = theme.style.defaultAnswer(defaultValue);
 }


 // Build the display output
 const mainLine = [prefix, messageText, defaultStr, activeLinesStr]
 .filter((v) => v !== undefined && v !== '')
 .join(' ');

 if (multiLine) {
  return [
   mainLine,
   inactiveLinesStr +
   chalk.cyan('Multi-line mode enabled. Press Meta+Enter to submit, Enter for new line.')
  ];
 }

 return [mainLine, inactiveLinesStr + (displayContent ?? '')];
});