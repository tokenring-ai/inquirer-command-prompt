import process from 'node:process';

/**
 * Default ellipsis character
 * @type {string}
 */
const ELLIPSIS = '…';

/**
 * Format an index number with leading spaces to align with the maximum index
 * @param {number} i - The index to format
 * @param {number} [limit=100] - The maximum index value (determines padding)
 * @returns {string} The formatted index with leading spaces
 */
export function formatIndex(i, limit = 100) {
 let len = (limit || 100).toString().length;
 return ' '.repeat(len - `${i}`.length) + i;
}

/**
 * Shorten command suggestions by removing the common prefix
 * @param {string} l - The current input line
 * @param {string[]} m - Array of command suggestions
 * @returns {string[]} Array of shortened command suggestions
 */
export function short(l, m) {
 if (l) {
  l = l.replace(/ $/, '');
  for (let i = 0; i < m.length; i++) {
   if (m[i] === l) {
    m.splice(i, 1);
    i--;
   } else {
    if (m[i][l.length] === ' ') {
     m[i] = m[i].replace(RegExp(l + ' '), '');
    } else {
     m[i] = m[i].replace(RegExp(l.replace(/ [^ ]+$/, '') + ' '), '');
    }
   }
  }
 }
 return m;
}

/**
 * Check if a value is a function
 * @param {*} func - The value to check
 * @returns {boolean} True if the value is a function
 */
export function isFunc(func) {
 return typeof func === 'function';
}

/**
 * Check if a value is an async function
 * @param {*} func - The value to check
 * @returns {boolean} True if the value is an async function
 */
export function isAsyncFunc(func) {
 return isFunc(func) && func.constructor.name === 'AsyncFunction';
}

/**
 * Format a list of elements into columns for display
 * @param {string[]} elems - Array of elements to format
 * @param {number} [maxSize=32] - Maximum size of each column
 * @param {boolean} [ellipsized] - Whether to ellipsize long elements
 * @param {string} [ellipsis] - Custom ellipsis character
 * @returns {string} Formatted string with elements in columns
 */
export function formatList(elems, maxSize = 32, ellipsized, ellipsis) {
 const cols = process.stdout.columns;
 let ratio = Math.floor((cols - 1) / maxSize);
 let remainder = (cols - 1) % maxSize;
 maxSize += Math.floor(remainder / ratio);
 let max = 0;
 for (let elem of elems) {
  max = Math.max(max, elem.length + 4);
 }
 if (ellipsized && max > maxSize) {
  max = maxSize;
 }
 let columns = (cols / max) | 0;
 let str = '';
 let c = 1;
 for (let elem of elems) {
  str += setSpaces(elem, max, ellipsized, ellipsis);
  if (c === columns) {
   str += ' '.repeat(cols - max * columns);
   c = 1;
  } else {
   c++;
  }
 }
 return str;
}

/**
 * Add spaces to a string to make it a fixed length
 * @param {string} str - The string to pad
 * @param {number} len - The target length
 * @param {boolean} [ellipsized] - Whether to ellipsize long strings
 * @param {string} [ellipsis] - Custom ellipsis character
 * @returns {string} Padded string
 */
export function setSpaces(str, len, ellipsized, ellipsis) {
 if (ellipsized && str.length > len - 1) {
  str = ellipsize(str, len - 1, ellipsis);
 }
 return str + ' '.repeat(len - decolorize(str).length);
}

/**
 * Truncate a string and add an ellipsis if it's too long
 * @param {string} str - The string to ellipsize
 * @param {number} len - The maximum length
 * @param {string} [ellipsis=ELLIPSIS] - Custom ellipsis character
 * @returns {string} Ellipsized string
 */
export function ellipsize(str, len, ellipsis = ELLIPSIS) {
 if (str.length > len) {
  let l = decolorize(ellipsis).length + 1;
  return str.substring(0, len - l) + ellipsis;
 }
 return str;
}

/**
 * Remove ANSI color codes from a string
 * @param {string} str - The string to decolorize
 * @returns {string} String without color codes
 */
export function decolorize(str) {
 return str.replace(/\x1b\[[0-9;]*m/g, '');
}

