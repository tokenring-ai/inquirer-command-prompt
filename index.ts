import {
    createPrompt,
    isEnterKey,
    KeypressEvent,
    makeTheme,
    Status,
    Theme,
    useKeypress,
    useMemo,
    usePrefix,
    useState,
} from "@inquirer/core";
import chalk from "chalk";

import EphemeralHistory from "./EphemeralHistory.js";
import {formatIndex, formatList, short} from "./helpers.js";
import {InquirerReadline} from "@inquirer/type";

const defaultHistory = new EphemeralHistory();

/**
 * Result from auto-completion function
 */
export interface AutoCompleterResult {
    match?: string;
    matches?: string[];
}

/**
 * History handler interface for managing command history
 */
export interface HistoryHandler {
    init: () => void;
    add: (command: string) => void;
    getPrevious: () => string | null;
    getNext: () => string | null;
    getAll: () => string[];
    setCurrent?: (command: string) => void;
    setConfig?: (config: any) => void;
    config?: {
        limit?: number;
    };
}

/**
 * Configuration options for the command prompt
 */
export interface CommandPromptConfig {
    /** The prompt message */
    message: string;
    /** Custom history handler */
    historyHandler?: HistoryHandler;
    /** Auto-completion function or array */
    autoCompletion?: ((line: string) => Promise<string[]> | string[]) | string[];
    /** Transform the displayed value */
    transformer?: (value: string) => string;
    /** Validate the input */
    validate?: (value: string) => Promise<boolean | string> | boolean | string;
    /** Whether input is required */
    required?: boolean;
    /** Called before each keypress */
    onBeforeKeyPress?: (key: any, rl: any) => void;
    /** Called before rewriting the line */
    onBeforeRewrite?: (value: string) => void;
    /** Called when prompt closes */
    onClose?: (value: string) => void;
    /** Custom autocomplete prompt message */
    autocompletePrompt?: string;
    /** Whether to shorten autocomplete suggestions */
    short?: boolean | ((value: string, matches: string[]) => string[]);
    /** Maximum size for formatting */
    maxSize?: number;
    /** Whether to ellipsize long text */
    ellipsize?: boolean;
    /** Custom ellipsis character */
    ellipsis?: string;
    /** Disable color on answered */
    noColorOnAnswered?: boolean;
    /** Color to use on answered */
    colorOnAnswered?: string;
    /** Theme configuration */
    theme?: Partial<Theme>;
    /** Default value */
    default?: string;
}

/**
 * Internal state for managing prompt lines
 */
interface LinesState {
    activeLines: string[];
    inactiveLines: string[];
    displayContent?: string | null;
}

/**
 * Key press event interface
 */
interface KeyEvent {
    name: string;
    meta?: boolean;
    shift?: boolean;
}

/**
 * Readline interface
 */
interface ReadlineInterface {
    cursor?: number;
}

/**
 * Format auto-completion results
 * @param line - The current input line
 * @param cmds - Array of possible completions
 * @returns Formatted auto-completion result with matches as string[]
 */
function autoCompleterFormatter(line: string, cmds: (string | any)[]): string[] {
    let max = 0;

    const filteredCmds = cmds.reduce((sum: string[], el: string | any) => {
        const sanitizedLine = line.replace(/[\\.+*?^$\[\](){}\/'#:!=|]/gi, "\\$&");
        // Convert any non-string elements to strings before testing and pushing
        const elStr = typeof el === "string" ? el : String(el);
        if (RegExp(`^${sanitizedLine}`).test(elStr)) {
            sum.push(elStr);
            max = Math.max(max, elStr.length);
        }
        return sum;
    }, []);

    return filteredCmds.slice(0, max);
}

/**
 * Command prompt with history and auto-completion built on @inquirer/core
 * @param config - Configuration options
 * @returns Promise that resolves with the user's input
 */
export default createPrompt<string, CommandPromptConfig>((config, done) => {
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
    const [status, setStatus] = useState<Status>("idle");
    const [lines, setLines] = useState<LinesState>({
        activeLines: defaultValue ? [defaultValue] : [""],
        inactiveLines: [],
        displayContent: null,
    });

    const [multiLine, setMultiLine] = useState<boolean>(false);

    const prefix = usePrefix({ status, theme });

    const { activeLines, inactiveLines, displayContent } = lines;

    const autoCompleter = useMemo(() => {
        if (autoCompletion) {
            return async (line: string): Promise<string[]> => {
                let commands: string[];
                if (Array.isArray(autoCompletion)) {
                    commands = autoCompletion.filter((cmd: string) => cmd.startsWith(line));
                } else {
                    commands = await autoCompletion(line);
                }
                return autoCompleterFormatter(line, commands);
            };
        }
        return (): string[] => [];
    }, [autoCompletion]);

    useKeypress(async (key: KeypressEvent & KeyEvent, rl: InquirerReadline & ReadlineInterface) => {
        // Ignore keypress while our prompt is doing other processing
        if (status !== "idle") {
            return;
        }

        // Multi-line toggle: meta+M
        if ((key.name === "m" || key.name === "M") && key.meta) {
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
            if (key.name === "backspace") {
                // If current line is empty and we're not on the first line, delete the current line
                if (
                    activeLines.length > 1 &&
                    activeLines[activeLines.length - 1] === ""
                ) {
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
            if (key.name === "up") {
                if (activeLines.length > 0) {
                    const newActiveLines = [...activeLines];
                    const lastLine = newActiveLines.pop()!;
                    setLines({
                        inactiveLines: [lastLine, ...inactiveLines],
                        activeLines: newActiveLines,
                    });
                }
                return;
            }

            if (key.name === "down") {
                if (inactiveLines.length > 0) {
                    const newInactiveLines = [...inactiveLines];
                    const firstLine = newInactiveLines.shift()!;
                    setLines({
                        activeLines: [...activeLines, firstLine],
                        inactiveLines: newInactiveLines,
                    });
                }
                return;
            }

            // In multi-line mode, handle Enter specially
            if (isEnterKey(key) && !key.meta) {
                rl.cursor = 0;
                setLines({
                    activeLines: [...activeLines, ""],
                    inactiveLines,
                });
                return;
            }
        }

        if (isEnterKey(key)) {
            const answer = [...activeLines, ...inactiveLines].join("\n");
            rl.cursor = activeLines[activeLines.length - 1].length;
            rl.line = activeLines[activeLines.length - 1];

            setStatus("loading");
            let isValid: boolean | string = true;
            if (required && !answer.trim()) {
                isValid = "You must provide a value";
            } else if (validate) {
                try {
                    isValid = await validate(answer);
                } catch (err) {
                    isValid = "Validation error";
                }
            }
            if (isValid === true) {
                historyHandler.add(answer);
                setStatus("done");
                done(answer);
            } else {
                setLines({
                    activeLines,
                    inactiveLines,
                    displayContent: theme.style.error(
                        typeof isValid === "string"
                            ? isValid
                            : "You must provide a valid value",
                    ),
                });
                setStatus("idle");
            }
            return;
        }

        if (key.name === "up") {
            if (historyHandler.setCurrent) {
                historyHandler.setCurrent(rl.line);
            }
            const previousCommand = historyHandler.getPrevious();
            if (previousCommand) {
                setLines({
                    activeLines: [previousCommand],
                    inactiveLines: [],
                });
                rl.line = previousCommand;
                rl.cursor = previousCommand.length;
            }
        } else if (key.name === "down") {
            if (historyHandler.setCurrent) {
                historyHandler.setCurrent(rl.line);
            }
            const nextCommand = historyHandler.getNext();
            if (nextCommand) {
                setLines({
                    activeLines: [nextCommand],
                    inactiveLines: [],
                });
                rl.line = nextCommand;
                rl.cursor = nextCommand.length;
            }
        } else if (key.name === "tab") {
            const value = activeLines[activeLines.length - 1];
            rl.cursor = value.length;
            rl.line = value;

            const trimmedValue = value.trim();
            // Handle tab completion
            //let line = (value.length > 1 ? value.join('\n') : value[0] || '').replace(/^ +/, '').replace(/\t/, '').replace(/ +/g, ' ');
            const matches = (await autoCompleter(trimmedValue)) ?? [];
            if (matches.length === 0) {
                setLines({
                    activeLines,
                    inactiveLines,
                    displayContent: chalk.grey("No available commands"),
                });
            } else if (matches.length === 1) {
                const match = matches[0];
                setLines({
                    activeLines: [match],
                    inactiveLines: [],
                });
                rl.line = match;
                rl.cursor = match.length;
            } else {
                // Display autocompletion suggestions
                const promptMessage =
                    autocompletePrompt || chalk.grey("Available commands:");
                const formattedList = formatList(
                    shortConfig
                        ? typeof shortConfig === "function"
                            ? shortConfig(value, matches)
                            : short(value, matches)
                        : matches,
                    maxSize,
                    ellipsize,
                    ellipsis,
                );
                setLines({
                    activeLines,
                    inactiveLines,
                    displayContent: `${promptMessage}\n${formattedList}`,
                });
            }
        } else if (key.name === "right" && key.shift) {
            // Display all history entries
            const historyEntries = historyHandler.getAll();
            const historyConfig = historyHandler.config || {};
            const historyLimit =
                historyConfig.limit !== undefined ? historyConfig.limit : 100;
            let historyDisplay = chalk.bold("History:");
            if (historyEntries.length === 0) {
                historyDisplay += "\n" + chalk.grey("  (No history)");
            } else {
                for (let i = 0; i < historyEntries.length; i++) {
                    historyDisplay += `\n${chalk.grey(formatIndex(i, historyLimit))}  ${historyEntries[i]}`;
                }
            }

            setLines({
                activeLines,
                inactiveLines,
                displayContent: historyDisplay,
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

    let activeLinesStr = activeLines.join("\n");
    if (transformer) {
        activeLinesStr = transformer(activeLinesStr);
    }

    activeLinesStr = theme.style.answer(activeLinesStr);

    if (activeLines.length > 1 && activeLines[activeLines.length - 1] === "") {
        activeLinesStr += "\r";
    }

    let inactiveLinesStr = inactiveLines.join("\n");
    if (transformer) {
        inactiveLinesStr = transformer(inactiveLinesStr);
    }

    if (inactiveLinesStr)
        inactiveLinesStr = theme.style.answer(inactiveLinesStr) + "\n";

    let defaultStr = "";
    if (
        defaultValue &&
        status !== "done" &&
        !activeLines?.[0]?.length &&
        !multiLine
    ) {
        defaultStr = theme.style.defaultAnswer(defaultValue);
    }

    // Build the display output
    const mainLine = [prefix, messageText, defaultStr, activeLinesStr]
        .filter((v) => v !== undefined && v !== "")
        .join(" ");

    if (multiLine) {
        return [
            mainLine,
            inactiveLinesStr +
            chalk.cyan(
                "Multi-line mode enabled. Press Meta+Enter to submit, Enter for new line.",
            ),
        ];
    }

    return [mainLine, inactiveLinesStr + (displayContent ?? "")];
});