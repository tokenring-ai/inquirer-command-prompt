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
		/** @type {string[]} Maps context to array of commands */
		this.history = [];

		/** @type {number} Maps context to current index in its history array */
		this.historyIndex = -1;
		this.currentLine = "";

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
		if (typeof config === "object") {
			this.config = { ...this.config, ...config };
		}
	}

	/**
	 * Add a command to history
	 * @param {string} value - The command to add
	 */
	add(value) {
		if (this.config.blacklist && this.config.blacklist.includes(value)) {
			return;
		}

		// Avoid adding duplicate of the last command
		if (this.history[this.history.length - 1] !== value) {
			this.history.push(value);
			// If history limit is exceeded, remove the oldest entry
			if (this.config.limit && this.history.length > this.config.limit) {
				this.history.shift();
			}
		}
		// Always reset index to the end (pointing to the new empty line) after adding
		this.historyIndex = this.history.length;
	}

	/**
	 * Set the current line of input, for saving/restoring when navigating history
	 * @param {string} line - The current line of input
	 */
	setCurrent(line) {
		this.currentLine = line;
	}

	/**
	 * Get the previous command in history
	 * @returns {string|undefined} The previous command or undefined if at beginning
	 */
	getPrevious() {
		if (this.historyIndex > 0) {
			this.historyIndex--;
			return this.history[this.historyIndex];
		}
		return undefined; // At the beginning or no history
	}

	/**
	 * Get the next command in history
	 * @returns {string|undefined} The next command or the saved current line
	 */
	getNext() {
		if (this.historyIndex < this.history.length - 1) {
			this.historyIndex++;
			return this.history[this.historyIndex];
		} else if (this.historyIndex === this.history.length - 1) {
			// If at the last item, increment index to point "after" it (for new input)
			this.historyIndex++;
			return this.currentLine; // Return the saved current line
		}
		return undefined; // Already at the "new input" line or no history
	}

	/**
	 * Get all commands in history for a context
	 * @returns {string[]} Array of all commands in history
	 */
	getAll() {
		return [...this.history]; // Return a copy
	}

	/**
	 * Clear all history for a specific context
	 */
	clear() {
		if (this.history) {
			this.history = [];
			this.historyIndex = 0;
		}
	}
}

export default EphemeralHistory;
