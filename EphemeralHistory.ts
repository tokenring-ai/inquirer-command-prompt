/**
 * Configuration options for EphemeralHistory
 */
interface HistoryConfig {
  /** Maximum number of history entries per context */
  limit?: number;
  /** Commands to exclude from history */
  blacklist?: string[];
}

/**
 * Ephemeral history handler implementation
 * Manages command history for different contexts in memory only
 */
class EphemeralHistory {
  /** Configuration options */
  public config: HistoryConfig;
  /** Maps context to array of commands */
  private history: string[];
  /** Maps context to current index in its history array */
  private historyIndex: number;
  /** Current command line being edited */
  private currentLine: string;

  /**
   * Create a new EphemeralHistory instance
   */
  constructor(config: HistoryConfig = {}) {
    this.history = [];
    this.historyIndex = -1;
    this.currentLine = "";

    this.config = {
      limit: 100,
      blacklist: [],
      ...config, // User-provided config overrides defaults
    };
  }

  /**
   * Update configuration settings
   */
  setConfig(config: HistoryConfig): void {
    if (typeof config === "object") {
      this.config = {...this.config, ...config};
    }
  }

  /**
   * Add a command to history
   */
  add(value: string): void {
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
   */
  setCurrent(line: string): void {
    this.currentLine = line;
  }

  /**
   * Get the previous command in history
   */
  getPrevious(): string | undefined {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      return this.history[this.historyIndex];
    }
    return undefined; // At the beginning or no history
  }

  /**
   * Get the next command in history
   */
  getNext(): string | undefined {
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
   */
  getAll(): string[] {
    return [...this.history]; // Return a copy
  }

  /**
   * Clear all history for a specific context
   */
  clear(): void {
    if (this.history) {
      this.history = [];
      this.historyIndex = 0;
    }
  }
}

export default EphemeralHistory;