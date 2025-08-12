import path from "node:path";
import fs from "fs-extra";

/** Default filename for history storage */
const DEFAULT_HISTORY_FILE_NAME = "inquirer-command-prompt-history.json";

/**
 * Configuration options for FileBackedHistory
 */
interface HistoryConfig {
 /** Whether to save history to a file */
 save?: boolean;
 /** Folder to save history file */
 folder?: string;
 /** Maximum number of history entries */
 limit?: number;
 /** Commands to exclude from history */
 blacklist?: string[];
 /** Name of the history file */
 fileName?: string;
}

/**
 * File storage structure for saved history
 */
interface HistoryFileData {
 history: string[];
}

/**
 * Default history handler implementation
 * Manages command history with persistence to file
 */
class FileBackedHistory {
 /** Array of commands */
 private history: string[];
 /** Current index in history array */
 private historyIndex: number;
 /** Current command line being edited */
 private currentLine: string;
 /** Configuration options */
 public config: HistoryConfig;
 /** Full path to history file */
 private _historyFile: string | null;

 /**
  * Create a new FileBackedHistory instance
  * @param config - Configuration options
  */
 constructor(config: HistoryConfig = {}) {
  this.history = [];
  this.historyIndex = 0;
  this.currentLine = "";

  this.config = {
   save: true,
   folder: ".",
   limit: 100,
   blacklist: [],
   fileName: DEFAULT_HISTORY_FILE_NAME,
   ...config, // User-provided config overrides defaults
  };

  this._historyFile = null;

  if (this.config.save) {
   this._historyFile = path.join(this.config.folder!, this.config.fileName!);
   this.load(); // Load history on initialization if saving is enabled
  }
 }

 /**
  * Update configuration settings
  * @param config - New configuration options
  */
 setConfig(config: HistoryConfig): void {
  if (typeof config === "object") {
   this.config = { ...this.config, ...config };
   // Re-evaluate history file path if folder or fileName changed
   if (config.folder || config.fileName) {
    this._historyFile = path.join(this.config.folder!, this.config.fileName!);
   }
  }
 }

 /**
  * Ensure the history file directory exists
  * @returns True if directory exists or was created, false otherwise
  * @private
  */
 private _ensureHistoryFile(): boolean {
  if (this._historyFile) {
   try {
    fs.ensureDirSync(path.dirname(this._historyFile));
    return true;
   } catch (e) {
    console.error(
     "DefaultHistory ERROR: Could not create history directory.",
     e,
    );
    // Optionally disable saving for this session if directory cannot be created
    // this.config.save = false;
    return false;
   }
  }
  return false; // No history file path available
 }

 /**
  * Add a command to history
  * @param value - The command to add
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

  if (this.config.save) {
   this.save();
  }
 }

 /**
  * Set the current line of input, for saving/restoring when navigating history
  * @param line - The current line of input
  */
 setCurrent(line: string): void {
  this.currentLine = line;
 }

 /**
  * Get the previous command in history
  * @returns The previous command or undefined if at beginning
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
  * @returns The next command or the saved current line
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
  * Get all commands in history
  * @returns Array of all commands in history
  */
 getAll(): string[] {
  return [...this.history]; // Return a copy
 }

 /**
  * Get a copy of history with entries limited to config.limit
  * @returns Limited history
  * @private
  */
 private _getLimitedHistory(): string[] {
  const limit = this.config.limit;
  if (limit && this.history.length > limit) {
   return this.history.slice(this.history.length - limit);
  }
  return [...this.history];
 }

 /**
  * Save history to file
  */
 save(): void {
  // Ensure we have a history file path (create it if needed)
  if (!this._historyFile) {
   this._historyFile = path.join(this.config.folder!, this.config.fileName!);
  }

  // _ensureHistoryFile now returns false if it fails, and logs the error.
  if (!this._ensureHistoryFile()) {
   // If directory creation failed, optionally disable future save attempts for this session
   // or simply return to prevent trying to write.
   // console.error('DefaultHistory: Skipping save due to directory issue.');
   // this.config.save = false; // Example: disable future saves
   return;
  }
  const historyToSave = this._getLimitedHistory();
  try {
   fs.writeFileSync(
    this._historyFile,
    JSON.stringify({ history: historyToSave } as HistoryFileData, null, 2),
  );
  } catch (e) {
   console.error("DefaultHistory ERROR: Could not save history file.", e);
  }
 }

 /**
  * Load history from file
  */
 load(): void {
  // Ensure we have a history file path (create it if needed)
  if (!this._historyFile) {
   this._historyFile = path.join(this.config.folder!, this.config.fileName!);
  }

  if (!fs.existsSync(this._historyFile)) {
   return;
  }
  try {
   const fileContents = fs.readFileSync(this._historyFile, 'utf8');
   const previousData = JSON.parse(fileContents) as HistoryFileData;
   if (previousData && previousData.history) {
    this.history = previousData.history;
    // Ensure index is correctly set after loading
    this.historyIndex = this.history.length;
   }
  } catch (e) {
   console.error(
    "DefaultHistory ERROR: Invalid or corrupted history file.",
    e,
   );
   try {
    const corruptedFilePath =
     this._historyFile + ".corrupted-" + Date.now();
    fs.renameSync(this._historyFile, corruptedFilePath);
    console.log(
     `DefaultHistory: Corrupted history file backed up to ${corruptedFilePath}`,
    );
   } catch (backupError) {
    console.error(
     "DefaultHistory ERROR: Could not back up corrupted history file.",
     backupError,
    );
   }
   this.history = []; // Start with empty history if file is corrupt
   this.historyIndex = 0;
  }
 }
}

export default FileBackedHistory;