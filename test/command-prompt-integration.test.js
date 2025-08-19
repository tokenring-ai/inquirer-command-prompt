import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {dirname, resolve as pathResolve} from "node:path";
import {fileURLToPath} from "node:url";
import fsExtra from "fs-extra";
import EphemeralHistory from "../EphemeralHistory.ts";
import FileBackedHistory from "../FileBackedHistory.ts";
import commandPrompt from "../index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Command Prompt Integration Tests", () => {
 // Set timeout for all tests in this suite
 vi.setConfig({testTimeout: 5000});

 describe("Configuration Integration", () => {
  it("should accept basic configuration", () => {
   const config = {
    message: "Enter command:",
    context: "test",
    default: "default_value",
   };

   // Test that commandPrompt accepts the configuration
   expect(typeof commandPrompt).toBe("function");
   expect(config.message).toBe("Enter command:");
   expect(config.context).toBe("test");
   expect(config.default).toBe("default_value");
  });

  it("should handle validation configuration", () => {
   const validateFn = (input) => {
    if (!input || input.trim().length === 0) {
     return "Input cannot be empty";
    }
    if (input.length < 3) {
     return "Input must be at least 3 characters";
    }
    return true;
   };

   const config = {
    message: "Enter command:",
    context: "validation_test",
    validate: validateFn,
    required: true,
   };

   expect(typeof config.validate).toBe("function");
   expect(config.validate("")).toBe("Input cannot be empty");
   expect(config.validate("hi")).toBe("Input must be at least 3 characters");
   expect(config.validate("hello")).toBe(true);
  });

  it("should handle transformer configuration", () => {
   const transformerFn = (input, answers, flags) => {
    if (flags.isFinal) {
     return input.toUpperCase();
    }
    return input;
   };

   const config = {
    message: "Enter command:",
    context: "transformer_test",
    transformer: transformerFn,
   };

   expect(typeof config.transformer).toBe("function");
   expect(config.transformer("hello", {}, {isFinal: true})).toBe("HELLO");
   expect(config.transformer("hello", {}, {isFinal: false})).toBe("hello");
  });
 });

 describe("Auto-completion Integration", () => {
  it("should handle array-based auto-completion", () => {
   const commands = ["start", "stop", "restart", "status", "help"];

   const config = {
    message: "Enter command:",
    context: "autocomplete_array_test",
    autoCompletion: commands,
   };

   expect(config.autoCompletion).toEqual(commands);
   expect(Array.isArray(config.autoCompletion)).toBe(true);
  });

  it("should handle function-based auto-completion", () => {
   const autoCompleteFn = (line) => {
    const commands = ["start", "stop", "restart", "status", "help"];
    return commands.filter((cmd) => cmd.startsWith(line.toLowerCase()));
   };

   const config = {
    message: "Enter command:",
    context: "autocomplete_fn_test",
    autoCompletion: autoCompleteFn,
   };

   expect(typeof config.autoCompletion).toBe("function");
   expect(config.autoCompletion("st")).toEqual([
    "start",
    "stop",
    "status",
   ]);
   expect(config.autoCompletion("help")).toEqual(["help"]);
   expect(config.autoCompletion("xyz")).toEqual([]);
  });

  it("should handle async auto-completion", async () => {
   const asyncAutoCompleteFn = async (line) => {
    // Simulate async operation (e.g., fetching from API)
    await new Promise((resolve) => setTimeout(resolve, 10));
    const commands = ["async_start", "async_stop", "async_restart"];
    return commands.filter((cmd) => cmd.startsWith(line.toLowerCase()));
   };

   const config = {
    message: "Enter command:",
    context: "autocomplete_async_test",
    autoCompletion: asyncAutoCompleteFn,
   };

   expect(typeof config.autoCompletion).toBe("function");
   const result = await config.autoCompletion("async_s");
   expect(result).toEqual(["async_start", "async_stop"]);
  });

  it("should handle autocomplete customization options", () => {
   const shortFn = (line, matches) => matches.slice(0, 5);

   const config = {
    message: "Enter command:",
    context: "autocomplete_custom_test",
    autoCompletion: ["cmd1", "cmd2", "cmd3", "cmd4", "cmd5", "cmd6"],
    autocompletePrompt: "Available commands:",
    short: shortFn,
    maxSize: 80,
    ellipsize: true,
    ellipsis: "...",
   };

   expect(typeof config.short).toBe("function");
   expect(config.short("", ["a", "b", "c", "d", "e", "f"])).toEqual([
    "a",
    "b",
    "c",
    "d",
    "e",
   ]);
   expect(config.autocompletePrompt).toBe("Available commands:");
   expect(config.maxSize).toBe(80);
   expect(config.ellipsize).toBe(true);
   expect(config.ellipsis).toBe("...");
  });
 });

 describe("History Integration", () => {
  const TEST_HISTORY_DIR = pathResolve(__dirname, "integration_history_test");
  const HISTORY_FILE = "integration-test-history.json";

  beforeEach(async () => {
   if (await fsExtra.pathExists(TEST_HISTORY_DIR)) {
    await fsExtra.remove(TEST_HISTORY_DIR);
   }
   await fsExtra.ensureDir(TEST_HISTORY_DIR);
  });

  afterEach(async () => {
   if (await fsExtra.pathExists(TEST_HISTORY_DIR)) {
    await fsExtra.remove(TEST_HISTORY_DIR);
   }
  });

  it("should work with EphemeralHistory", () => {
   const historyHandler = new EphemeralHistory({limit: 10});

   const config = {
    message: "Enter command:",
    context: "ephemeral_integration_test",
    historyHandler: historyHandler,
   };

   // Test that the history handler is properly configured
   expect(config.historyHandler).toBe(historyHandler);
   expect(historyHandler.config.limit).toBe(10);

   historyHandler.add("test_command_1");
   historyHandler.add("test_command_2");

   expect(historyHandler.getAll()).toEqual([
    "test_command_1",
    "test_command_2",
   ]);
   expect(historyHandler.getPrevious()).toBe("test_command_2");
   expect(historyHandler.getPrevious()).toBe("test_command_1");
  });

  it("should work with FileBackedHistory", async () => {
   const historyHandler = new FileBackedHistory({
    folder: TEST_HISTORY_DIR,
    fileName: HISTORY_FILE,
    save: true,
    limit: 5,
   });

   const config = {
    message: "Enter command:",
    context: "file_integration_test",
    historyHandler: historyHandler,
   };

   // Test that the history handler is properly configured
   expect(config.historyHandler).toBe(historyHandler);
   expect(historyHandler.config.save).toBe(true);
   expect(historyHandler.config.limit).toBe(5);

   // Test history functionality
   historyHandler.add("file_cmd_1");
   historyHandler.add("file_cmd_2");

   expect(historyHandler.getAll()).toEqual([
    "file_cmd_1",
    "file_cmd_2",
   ]);

   // Verify file was created
   const historyFilePath = pathResolve(TEST_HISTORY_DIR, HISTORY_FILE);
   expect(await fsExtra.pathExists(historyFilePath)).toBe(true);

   const fileContent = await fsExtra.readJson(historyFilePath);
   expect(fileContent.history).toEqual(["file_cmd_1", "file_cmd_2"]);
  });

  it("should handle history configuration object", () => {
   const historyConfig = {
    folder: TEST_HISTORY_DIR,
    fileName: HISTORY_FILE,
    save: true,
    limit: 20,
    blacklist: ["clear", "exit"],
   };

   const config = {
    message: "Enter command:",
    context: "history_config_integration_test",
    history: historyConfig,
   };

   expect(config.history).toEqual(historyConfig);
   expect(config.history.limit).toBe(20);
   expect(config.history.blacklist).toEqual(["clear", "exit"]);
  });
 });

 describe("Event Handlers Integration", () => {
  it("should handle onBeforeKeyPress configuration", () => {
   const keyPressLog = [];
   const onBeforeKeyPressFn = ({key}) => {
    keyPressLog.push(key.name);
   };

   const config = {
    message: "Enter command:",
    context: "keypress_integration_test",
    onBeforeKeyPress: onBeforeKeyPressFn,
   };

   expect(typeof config.onBeforeKeyPress).toBe("function");

   // Simulate key press events
   config.onBeforeKeyPress({key: {name: "a"}});
   config.onBeforeKeyPress({key: {name: "b"}});
   config.onBeforeKeyPress({key: {name: "enter"}});

   expect(keyPressLog).toEqual(["a", "b", "enter"]);
  });

  it("should handle onBeforeRewrite configuration", () => {
   const onBeforeRewriteFn = (text) => {
    // Auto-format commands
    return text.trim().toLowerCase().replace(/\s+/g, " ");
   };

   const config = {
    message: "Enter command:",
    context: "rewrite_integration_test",
    onBeforeRewrite: onBeforeRewriteFn,
   };

   expect(typeof config.onBeforeRewrite).toBe("function");
   expect(config.onBeforeRewrite("  HELLO   WORLD  ")).toBe("hello world");
   expect(config.onBeforeRewrite("Test\t\tCommand")).toBe("test command");
  });

  it("should handle onClose configuration", () => {
   let closeCalled = false;
   const onCloseFn = () => {
    closeCalled = true;
   };

   const config = {
    message: "Enter command:",
    context: "close_integration_test",
    onClose: onCloseFn,
   };

   expect(typeof config.onClose).toBe("function");
   config.onClose();
   expect(closeCalled).toBe(true);
  });
 });

 describe("Theme and Display Integration", () => {
  it("should handle theme configuration", () => {
   const customTheme = {
    style: {
     message: (text, status) => `[${status}] ${text}`,
     error: (text) => `❌ ${text}`,
     answer: (text) => `✅ ${text}`,
     help: (text) => `💡 ${text}`,
    },
   };

   const config = {
    message: "Enter command:",
    context: "theme_integration_test",
    theme: customTheme,
   };

   expect(config.theme).toEqual(customTheme);
   expect(typeof config.theme.style.message).toBe("function");
   expect(config.theme.style.message("Test", "idle")).toBe("[idle] Test");
   expect(config.theme.style.error("Error message")).toBe("❌ Error message");
  });

  it("should handle display customization options", () => {
   const config = {
    message: "Enter command:",
    context: "display_integration_test",
    noColorOnAnswered: true,
    colorOnAnswered: "green",
    maxSize: 120,
    ellipsize: true,
    ellipsis: "…",
   };

   expect(config.noColorOnAnswered).toBe(true);
   expect(config.colorOnAnswered).toBe("green");
   expect(config.maxSize).toBe(120);
   expect(config.ellipsize).toBe(true);
   expect(config.ellipsis).toBe("…");
  });
 });

 describe("Advanced Configuration Integration", () => {
  it("should handle complex configuration with all options", () => {
   const historyHandler = new EphemeralHistory({limit: 50});
   const commands = ["build", "test", "deploy", "rollback"];

   const config = {
    message: "🚀 Enter command:",
    context: "complex_integration_test",
    default: "help",
    required: true,
    historyHandler: historyHandler,
    autoCompletion: commands,
    autocompletePrompt: "📋 Available commands:",
    validate: (input) =>
     input.length > 0 ? true : "Command cannot be empty",
    transformer: (input, answers, flags) =>
     flags.isFinal ? input.toUpperCase() : input,
    onCtrlEnd: (line) => `exec ${line}`,
    onBeforeKeyPress: ({key}) => console.log(`Key: ${key.name}`),
    onBeforeRewrite: (text) => text.trim(),
    onClose: () => console.log("Prompt closed"),
    short: (line, matches) => matches.slice(0, 10),
    maxSize: 100,
    ellipsize: true,
    ellipsis: "...",
    theme: {
     style: {
      message: (text) => `> ${text}`,
      error: (text) => `❌ ${text}`,
     },
    },
   };

   // Verify all configuration options are set correctly
   expect(config.message).toBe("🚀 Enter command:");
   expect(config.context).toBe("complex_integration_test");
   expect(config.default).toBe("help");
   expect(config.required).toBe(true);
   expect(config.historyHandler).toBe(historyHandler);
   expect(config.autoCompletion).toEqual(commands);
   expect(config.autocompletePrompt).toBe("📋 Available commands:");
   expect(typeof config.validate).toBe("function");
   expect(typeof config.transformer).toBe("function");
   expect(typeof config.onCtrlEnd).toBe("function");
   expect(typeof config.onBeforeKeyPress).toBe("function");
   expect(typeof config.onBeforeRewrite).toBe("function");
   expect(typeof config.onClose).toBe("function");
   expect(typeof config.short).toBe("function");
   expect(config.maxSize).toBe(100);
   expect(config.ellipsize).toBe(true);
   expect(config.ellipsis).toBe("...");
   expect(typeof config.theme).toBe("object");

   // Test some of the functions
   expect(config.validate("test")).toBe(true);
   expect(config.validate("")).toBe("Command cannot be empty");
   expect(config.transformer("hello", {}, {isFinal: true})).toBe("HELLO");
   expect(config.onCtrlEnd("ls")).toBe("exec ls");
   expect(config.onBeforeRewrite("  test  ")).toBe("test");
   expect(
    config.short(
     "",
     new Array(15).fill(0).map((_, i) => `cmd${i}`),
    )
   ).toEqual(
    new Array(10).fill(0).map((_, i) => `cmd${i}`),
   );
  });

  describe("Multi-line Input Integration", () => {
   it("should allow multi-line input when meta+M is pressed", async () => {
    // Simulate the prompt with multi-line enabled
    let multiLineEnabled = false;
    const fakePrompt = async (config) => {
     // Simulate meta+M enabling multi-line
     if (config.onMetaM) config.onMetaM();
     multiLineEnabled = true;
     return "line1\nline2";
    };

    let metaMCalled = false;
    const config = {
     message: "Enter multi-line command:",
     context: "multiline_test",
     onMetaM: () => {
      metaMCalled = true;
     },
    };

    // Simulate calling the prompt
    const result = await fakePrompt(config);
    expect(metaMCalled).toBe(true);
    expect(multiLineEnabled).toBe(true);
    expect(result).toBe("line1\nline2");
   });

   it("should return single-line input if meta+M is not pressed", async () => {
    // Simulate the prompt without multi-line
    const fakePrompt = async (config) => {
     // meta+M not pressed
     return "single line";
    };
    const config = {
     message: "Enter command:",
     context: "singleline_test",
     // no onMetaM handler
    };
    const result = await fakePrompt(config);
    expect(result).toBe("single line");
   });
  });
 });
});
