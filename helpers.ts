import process from "node:process";

/**
 * Default ellipsis character
 */
const ELLIPSIS: string = "…";

/**
 * Format an index number with leading spaces to align with the maximum index
 * @param i - The index to format
 * @param limit - The maximum index value (determines padding)
 * @returns The formatted index with leading spaces
 */
export function formatIndex(i: number, limit: number = 100): string {
  const len = (limit || 100).toString().length;
  return " ".repeat(len - `${i}`.length) + i;
}

/**
 * Shorten command suggestions by removing the common prefix
 * @param l - The current input line
 * @param m - Array of command suggestions
 * @returns Array of shortened command suggestions
 */
export function short(l: string, m: string[]): string[] {
  if (l) {
    l = l.replace(/ $/, "");
    for (let i = 0; i < m.length; i++) {
      if (m[i] === l) {
        m.splice(i, 1);
        i--;
      } else {
        if (m[i][l.length] === " ") {
          m[i] = m[i].replace(RegExp(l + " "), "");
        } else {
          m[i] = m[i].replace(RegExp(l.replace(/ [^ ]+$/, "") + " "), "");
        }
      }
    }
  }
  return m;
}

/**
 * Format a list of elements into columns for display
 * @param elems - Array of elements to format
 * @param maxSize - Maximum size of each column
 * @param ellipsized - Whether to ellipsize long elements
 * @param ellipsis - Custom ellipsis character
 * @returns Formatted string with elements in columns
 */
export function formatList(elems: string[], maxSize: number = 32, ellipsized?: boolean, ellipsis?: string): string {
  const cols = process.stdout.columns;
  const ratio = Math.floor((cols - 1) / maxSize);
  const remainder = (cols - 1) % maxSize;
  maxSize += Math.floor(remainder / ratio);
  let max = 0;
  for (const elem of elems) {
    max = Math.max(max, elem.length + 4);
  }
  if (ellipsized && max > maxSize) {
    max = maxSize;
  }
  const columns = (cols / max) | 0;
  let str = "";
  let c = 1;
  for (const elem of elems) {
    str += setSpaces(elem, max, ellipsized, ellipsis);
    if (c === columns) {
      str += " ".repeat(cols - max * columns);
      c = 1;
    } else {
      c++;
    }
  }
  return str;
}

/**
 * Add spaces to a string to make it a fixed length
 * @param str - The string to pad
 * @param len - The target length
 * @param ellipsized - Whether to ellipsize long strings
 * @param ellipsis - Custom ellipsis character
 * @returns Padded string
 */
export function setSpaces(str: string, len: number, ellipsized?: boolean, ellipsis?: string): string {
  if (ellipsized && str.length > len - 1) {
    str = ellipsize(str, len - 1, ellipsis);
  }
  return str + " ".repeat(len - decolorize(str).length);
}

/**
 * Truncate a string and add an ellipsis if it's too long
 * @param str - The string to ellipsize
 * @param len - The maximum length
 * @param ellipsis - Custom ellipsis character
 * @returns Ellipsized string
 */
export function ellipsize(str: string, len: number, ellipsis: string = ELLIPSIS): string {
  if (str.length > len) {
    const l = decolorize(ellipsis).length + 1;
    return str.substring(0, len - l) + ellipsis;
  }
  return str;
}

/**
 * Remove ANSI color codes from a string
 * @param str - The string to decolorize
 * @returns String without color codes
 */
export function decolorize(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}