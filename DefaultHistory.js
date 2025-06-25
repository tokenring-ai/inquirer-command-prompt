import fs from 'fs-extra';
import path from 'node:path';
import _ from 'lodash';

/** @type {string} Default filename for history storage */
const DEFAULT_HISTORY_FILE_NAME = 'inquirer-command-prompt-history.json';

/**
 * Default history handler implementation
 * Manages command history for different contexts with persistence to file
 */
class DefaultHistory {
  /**
   * Create a new DefaultHistory instance
   * @param {Object} [config={}] - Configuration options
   * @param {boolean} [config.save=true] - Whether to save history to a file
   * @param {string} [config.folder='.'] - Folder to save history file
   * @param {number} [config.limit=100] - Maximum number of history entries per context
   * @param {string[]} [config.blacklist=[]] - Commands to exclude from history
   * @param {string} [config.fileName='inquirer-command-prompt-history.json'] - Name of the history file
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
      save: true,
      folder: '.',
      limit: 100,
      blacklist: [],
      fileName: DEFAULT_HISTORY_FILE_NAME,
      ...config, // User-provided config overrides defaults
    };

    /** @type {string|null} Full path to history file */
    this._historyFile = null;

    if (this.config.save) {
      this._historyFile = path.join(this.config.folder, this.config.fileName);
      this.load(); // Load history on initialization if saving is enabled
    }
  }

  /**
   * Update configuration settings
   * @param {Object} config - New configuration options
   */
  setConfig(config) {
    if (typeof config === 'object') {
      this.config = { ...this.config, ...config };
      // Re-evaluate history file path if folder or fileName changed
      if (config.folder || config.fileName) {
        this._historyFile = path.join(this.config.folder, this.config.fileName);
      }
    }
  }

  /**
   * Ensure the history file directory exists
   * @returns {boolean} True if directory exists or was created, false otherwise
   * @private
   */
  _ensureHistoryFile() {
    if (this.config.save && this._historyFile) {
      try {
        fs.ensureDirSync(path.dirname(this._historyFile));
        return true;
      } catch (e) {
        console.error('DefaultHistory ERROR: Could not create history directory.', e);
        // Optionally disable saving for this session if directory cannot be created
        // this.config.save = false;
        return false;
      }
    }
    return true; // Or false if save is not enabled, depending on desired semantics
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

    if (this.config.save) {
      this.save();
    }
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
   * Get a copy of histories with entries limited to config.limit
   * @returns {Object.<string, string[]>} Limited histories
   * @private
   */
  _getLimitedHistories() {
    const limitedHistories = _.cloneDeep(this.histories); // Use cloneDeep for nested arrays
    const limit = this.config.limit;
    if (limit) {
      for (const c in limitedHistories) {
        const len = limitedHistories[c].length;
        if (len > limit) {
          limitedHistories[c] = limitedHistories[c].slice(len - limit);
        }
      }
    }
    return limitedHistories;
  }

  /**
   * Save history to file
   */
  save() {
    if (!this.config.save || !this._historyFile) {
      return;
    }
    // _ensureHistoryFile now returns false if it fails, and logs the error.
    if (!this._ensureHistoryFile()) {
      // If directory creation failed, optionally disable future save attempts for this session
      // or simply return to prevent trying to write.
      // console.error('DefaultHistory: Skipping save due to directory issue.');
      // this.config.save = false; // Example: disable future saves
      return;
    }
    const historiesToSave = this._getLimitedHistories();
    try {
      fs.writeFileSync(
        this._historyFile,
        JSON.stringify({ histories: historiesToSave }, null, 2)
      );
    } catch (e) {
      console.error('DefaultHistory ERROR: Could not save history file.', e);
    }
  }

  /**
   * Load history from file
   */
  load() {
    if (!this.config.save || !this._historyFile || !fs.existsSync(this._historyFile)) {
      return;
    }
    try {
      const fileContents = fs.readFileSync(this._historyFile);
      const previousData = JSON.parse(fileContents);
      if (previousData && previousData.histories) {
        this.histories = previousData.histories;
        for (const c in this.histories) {
          // Ensure indexes are correctly set after loading
          this.historyIndexes[c] = this.histories[c].length;
        }
      }
    } catch (e) {
      console.error('DefaultHistory ERROR: Invalid or corrupted history file.', e);
      try {
        const corruptedFilePath = this._historyFile + '.corrupted-' + Date.now();
        fs.renameSync(this._historyFile, corruptedFilePath);
        console.log(`DefaultHistory: Corrupted history file backed up to ${corruptedFilePath}`);
      } catch (backupError) {
        console.error('DefaultHistory ERROR: Could not back up corrupted history file.', backupError);
      }
      this.histories = {}; // Start with empty history if file is corrupt
      this.historyIndexes = {};
    }
  }
}

/**
 * Default history handler for command prompt
 * @exports DefaultHistory
 */
export default DefaultHistory;
