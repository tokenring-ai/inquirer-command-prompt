/**
 * Ephemeral history handler implementation
 * Manages command history for different contexts in memory only
 */
class EphemeralHistory {
 /**
  * Create a new EphemeralHistory instance
  * @param {Object} [config={}] - Configuration options
  * @param {number} [config.limit=100] - Maximum number of history entries per context
  * @param {string[]} [config.blacklist=[]] - Commands to exclude from history
  */
 constructor(config = {}) {
  /** @type {Object.<string, string[]>} Maps context to array of commands */
  this.histories = {};

  /** @type {Object.<string, number>} Maps context to current index in its history array */
  this.historyIndexes = {};

  /**
   * @type {Object} Configuration options
   */
  this.config = {
   limit: 100,
   blacklist: [],
   ...config, // User-provided config overrides defaults
  };
 }

 /**
  * Update configuration settings
  * @param {Object} config - New configuration options
  */
 setConfig(config) {
  if (typeof config === 'object') {
   this.config = { ...this.config, ...config };
  }
 }

 /**
  * Initialize history for a context
  * @param {string} context - The context to initialize
  */
 init(context) {
  if (!this.histories[context]) {
   this.histories[context] = [];
   this.historyIndexes[context] = 0;
  }
 }

 /**
  * Add a command to history
  * @param {string} context - The context to add to
  * @param {string} value - The command to add
  */
 add(context, value) {
  this.init(context); // Ensure context is initialized

  if (this.config.blacklist && this.config.blacklist.includes(value)) {
   return;
  }

  // Avoid adding duplicate of the last command
  if (this.histories[context][this.histories[context].length - 1] !== value) {
   this.histories[context].push(value);
   // If history limit is exceeded, remove the oldest entry
   if (this.config.limit && this.histories[context].length > this.config.limit) {
    this.histories[context].shift();
   }
  }
  // Always reset index to the end (pointing to the new empty line) after adding
  this.historyIndexes[context] = this.histories[context].length;
 }

 /**
  * Get the previous command in history
  * @param {string} context - The context to get from
  * @returns {string|undefined} The previous command or undefined if at beginning
  */
 getPrevious(context) {
  this.init(context); // Ensure context is initialized
  if (this.historyIndexes[context] > 0) {
   this.historyIndexes[context]--;
   return this.histories[context][this.historyIndexes[context]];
  }
  return undefined; // At the beginning or no history
 }

 /**
  * Get the next command in history
  * @param {string} context - The context to get from
  * @returns {string|undefined} The next command or undefined if at end
  */
 getNext(context) {
  this.init(context); // Ensure context is initialized
  if (this.historyIndexes[context] < this.histories[context].length - 1) {
   this.historyIndexes[context]++;
   return this.histories[context][this.historyIndexes[context]];
  } else if (this.historyIndexes[context] === this.histories[context].length - 1) {
   // If at the last item, increment index to point "after" it (for new input)
   this.historyIndexes[context]++;
   return undefined; // Indicates user should see an empty line
  }
  return undefined; // Already at the "new input" line or no history
 }

 /**
  * Get all commands in history for a context
  * @param {string} context - The context to get from
  * @returns {string[]} Array of all commands in history
  */
 getAll(context) {
  this.init(context);
  return [...this.histories[context]]; // Return a copy
 }

 /**
  * Clear all history for a specific context
  * @param {string} context - The context to clear
  */
 clear(context) {
  if (this.histories[context]) {
   this.histories[context] = [];
   this.historyIndexes[context] = 0;
  }
 }

 /**
  * Clear all history for all contexts
  */
 clearAll() {
  this.histories = {};
  this.historyIndexes = {};
 }
}

export default EphemeralHistory;