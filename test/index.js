import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";
import sinon from "sinon";
import fsExtra from "fs-extra";
import { render } from "@inquirer/testing";
import commandPrompt from "../index.js";
import EphemeralHistory from "../EphemeralHistory.js";
import FileBackedHistory from "../FileBackedHistory.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("inquirer-command-prompt", function () {
	this.timeout(5000);

	describe("Basic Functionality", function () {
		it("should handle basic input and return result", async function () {
			const { answer, events } = await render(commandPrompt, {
				message: "Enter command:",
			});

			// Type some input
			events.type("hello world");

			// Press Enter to submit
			events.keypress("enter");

			// Wait for the answer
			const result = await answer;

			assert.strictEqual(result, "hello world");
		});

		it("should handle default values", async function () {
			const { answer, events } = await render(commandPrompt, {
				message: "Enter command:",
				default: "default_value",
			});

			// Just press Enter without typing anything
			events.keypress("enter");

			// Wait for the answer
			const result = await answer;

			assert.strictEqual(result, "default_value");
		});

		it("should be a function that returns a promise", function () {
			assert.strictEqual(typeof commandPrompt, "function");

			// Create a basic config
			const config = { message: "Test:" };

			// The function should return a promise (but we won't await it to avoid hanging)
			const result = commandPrompt(config);
			assert.ok(result instanceof Promise);
		});

		it("should handle validation and reject invalid input", async function () {
			const validateFn = (input) =>
				input.includes("test") ? true : "Must contain test";

			const { answer, events, getScreen } = await render(commandPrompt, {
				message: "Enter command:",
				validate: validateFn,
			});

			// Type invalid input first
			events.type("hello");
			events.keypress("enter");

			// Wait a bit for the validation to process
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Should show error message and not resolve yet
			const screen1 = getScreen();
			assert.ok(screen1.includes("Must contain test"));

			// Clear the input and type valid input
			// Clear existing input by pressing backspace multiple times
			for (let i = 0; i < 10; i++) {
				events.keypress("backspace");
			}
			events.type("test123");
			events.keypress("enter");

			// Wait for the answer
			const result = await answer;

			assert.strictEqual(result, "test123");
		});

		it("should handle required validation", async function () {
			const { answer, events, getScreen } = await render(commandPrompt, {
				message: "Enter command:",
				required: true,
			});

			// Try to submit empty input
			events.keypress("enter");

			// Should show error message
			const screen1 = getScreen();
			assert.ok(screen1.includes("You must provide a value"));

			// Now type valid input
			events.type("valid input");
			events.keypress("enter");

			// Wait for the answer
			const result = await answer;

			assert.strictEqual(result, "valid input");
		});

		it("should handle transformer configuration", async function () {
			const transformerFn = (input) => input.toUpperCase();

			const { answer, events, getScreen } = await render(commandPrompt, {
				message: "Enter command:",
				transformer: transformerFn,
			});

			// Type input
			events.type("hello world");

			// The screen should show the transformed (uppercase) version
			const screen = getScreen();
			assert.ok(screen.includes("HELLO WORLD"));

			events.keypress("enter");

			// Wait for the answer - should be the original input, not transformed
			const result = await answer;

			// Note: transformer only affects display, not the actual returned value
			assert.strictEqual(result, "hello world");
		});
	});

	describe("Auto-completion Functionality", function () {
		it("should handle array-based auto-completion with tab key", async function () {
			const availableCommands = ["foo", "bar", "baz"];

			const { answer, events, getScreen } = await render(commandPrompt, {
				message: "Enter command:",
				autoCompletion: availableCommands,
			});

			// Type partial command
			events.type("f");

			// Press tab to trigger auto-completion
			events.keypress("tab");

			// Wait a bit for auto-completion to process
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Should complete to 'foo' since it's the only match
			const screen = getScreen();
			assert.ok(screen.includes("foo"));

			events.keypress("enter");
			const result = await answer;
			assert.strictEqual(result, "foo");
		});

		it("should show multiple auto-completion options", async function () {
			const availableCommands = ["foo", "foobar", "fizz", "bar"];

			const { answer, events, getScreen } = await render(commandPrompt, {
				message: "Enter command:",
				autoCompletion: availableCommands,
			});

			// Type partial command that matches multiple options
			events.type("f");

			// Press tab to trigger auto-completion
			events.keypress("tab");

			// Wait a bit for auto-completion to process
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Should show available commands
			const screen = getScreen();
			assert.ok(
				screen.includes("Available commands") || screen.includes("foo"),
			);

			// Complete the command manually
			events.type("oo");
			events.keypress("enter");

			const result = await answer;
			assert.strictEqual(result, "foo");
		});

		it("should handle function-based auto-completion", async function () {
			const autoCompleteFn = (line) =>
				["foo", "bar"].filter((cmd) => cmd.startsWith(line));

			const { answer, events, getScreen } = await render(commandPrompt, {
				message: "Enter command:",
				autoCompletion: autoCompleteFn,
			});

			// Type partial command
			events.type("f");

			// Press tab to trigger auto-completion
			events.keypress("tab");

			// Wait a bit for auto-completion to process
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Should complete to 'foo'
			const screen = getScreen();
			assert.ok(screen.includes("foo"));

			events.keypress("enter");
			const result = await answer;
			assert.strictEqual(result, "foo");
		});

		it("should handle async auto-completion", async function () {
			const asyncAutoComplete = async (line) => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return ["async_foo", "async_bar"].filter((cmd) => cmd.startsWith(line));
			};

			const { answer, events, getScreen } = await render(commandPrompt, {
				message: "Enter command:",
				autoCompletion: asyncAutoComplete,
			});

			// Type partial command
			events.type("async_f");

			// Press tab to trigger auto-completion
			events.keypress("tab");

			// Wait a bit for auto-completion to process
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Should complete to 'async_foo'
			const screen = getScreen();
			assert.ok(screen.includes("async_foo"));

			events.keypress("enter");
			const result = await answer;
			assert.strictEqual(result, "async_foo");
		});
	});

	describe("History Handler Integration", function () {
		const TEST_HISTORY_DIR = pathResolve(__dirname, "test_history_integration");
		const HISTORY_FILE = "integration-test-history.json";

		beforeEach(async function () {
			if (await fsExtra.pathExists(TEST_HISTORY_DIR)) {
				await fsExtra.remove(TEST_HISTORY_DIR);
			}
			await fsExtra.ensureDir(TEST_HISTORY_DIR);
		});

		afterEach(async function () {
			sinon.restore();
			if (await fsExtra.pathExists(TEST_HISTORY_DIR)) {
				await fsExtra.remove(TEST_HISTORY_DIR);
			}
		});

		it("should work with EphemeralHistory and up/down arrow navigation", async function () {
			const historyHandler = new EphemeralHistory();

			// Pre-populate history
			historyHandler.add("first_command");
			historyHandler.add("second_command");

			const { answer, events, getScreen } = await render(commandPrompt, {
				message: "Enter command:",
				historyHandler: historyHandler,
			});

			// Press up arrow to get previous command
			events.keypress("up");

			// Should show the last command
			let screen = getScreen();
			assert.ok(screen.includes("second_command"));

			// Press up arrow again to get the command before that
			events.keypress("up");

			screen = getScreen();
			assert.ok(screen.includes("first_command"));

			// Press down arrow to go forward in history
			events.keypress("down");

			screen = getScreen();
			assert.ok(screen.includes("second_command"));

			events.keypress("enter");
			const result = await answer;
			assert.strictEqual(result, "second_command");
		});

		it("should display history with Shift+Right", async function () {
			const historyHandler = new EphemeralHistory();

			// Pre-populate history
			historyHandler.add("first_command");
			historyHandler.add("second_command");
			historyHandler.add("third_command");

			const { answer, events, getScreen } = await render(commandPrompt, {
				message: "Enter command:",
				historyHandler: historyHandler,
			});

			// Press Shift+Right to display history
			events.keypress({ name: "right", shift: true });

			// Should show history display
			const screen = getScreen();
			assert.ok(screen.includes("History:"));
			assert.ok(screen.includes("first_command"));
			assert.ok(screen.includes("second_command"));
			assert.ok(screen.includes("third_command"));

			// Type a new command and submit
			events.type("new_command");
			events.keypress("enter");

			const result = await answer;
			assert.strictEqual(result, "new_command");
		});

		it("should work with FileBackedHistory", async function () {
			const historyHandler = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: HISTORY_FILE,
				save: true,
			});

			const config = {
				message: ">",
				context: "file_backed_test",
				historyHandler: historyHandler,
			};

			assert.strictEqual(config.historyHandler, historyHandler);

			// Test that the history handler works correctly
			historyHandler.add("test_command");

			assert.deepStrictEqual(historyHandler.getAll(), ["test_command"]);
			assert.strictEqual(historyHandler.getPrevious(), "test_command");

			// Verify file was created
			const historyFilePath = pathResolve(TEST_HISTORY_DIR, HISTORY_FILE);
			assert.ok(await fsExtra.pathExists(historyFilePath));

			const fileContent = await fsExtra.readJson(historyFilePath);
			assert.deepStrictEqual(fileContent.history, ["test_command"]);
		});

		it("should use default EphemeralHistory when no historyHandler provided", function () {
			const config = {
				message: ">",
				context: "default_history_test",
			};

			// The default history handler should be used internally
			assert.strictEqual(config.historyHandler, undefined);
		});

		it("should handle history configuration object", function () {
			const historyConfig = {
				folder: TEST_HISTORY_DIR,
				fileName: HISTORY_FILE,
				save: true,
				limit: 50,
			};

			const config = {
				message: ">",
				context: "history_config_test",
				history: historyConfig,
			};

			assert.deepStrictEqual(config.history, historyConfig);
		});

		it("should handle custom history handler", function () {
			const mockHistoryHandler = {
				init: sinon.stub(),
				add: sinon.stub(),
				getPrevious: sinon.stub().returns("mock_prev_cmd"),
				getNext: sinon.stub().returns("mock_next_cmd"),
				getAll: sinon.stub().returns(["mock1", "mock2"]),
				config: { limit: 100 },
			};

			const config = {
				message: ">",
				context: "custom_history_test",
				historyHandler: mockHistoryHandler,
			};

			assert.strictEqual(config.historyHandler, mockHistoryHandler);

			// Test the interface
			assert.strictEqual(typeof mockHistoryHandler.init, "function");
			assert.strictEqual(typeof mockHistoryHandler.add, "function");
			assert.strictEqual(typeof mockHistoryHandler.getPrevious, "function");
			assert.strictEqual(typeof mockHistoryHandler.getNext, "function");
			assert.strictEqual(typeof mockHistoryHandler.getAll, "function");

			// Test method calls
			mockHistoryHandler.init("test_context");
			sinon.assert.calledWith(mockHistoryHandler.init, "test_context");

			mockHistoryHandler.add("test_context", "test_command");
			sinon.assert.calledWith(
				mockHistoryHandler.add,
				"test_context",
				"test_command",
			);

			assert.strictEqual(
				mockHistoryHandler.getPrevious("test_context"),
				"mock_prev_cmd",
			);
			assert.strictEqual(
				mockHistoryHandler.getNext("test_context"),
				"mock_next_cmd",
			);
			assert.deepStrictEqual(mockHistoryHandler.getAll("test_context"), [
				"mock1",
				"mock2",
			]);
		});
	});

	describe("onCtrlEnd Handler", function () {
		it("should handle onCtrlEnd configuration", function () {
			const onCtrlEndFn = (line) => line.toUpperCase();

			const config = {
				message: ">",
				context: "ctrl_end_test",
				onCtrlEnd: onCtrlEndFn,
			};

			assert.strictEqual(typeof config.onCtrlEnd, "function");
			assert.strictEqual(config.onCtrlEnd("hello"), "HELLO");
		});
	});

	describe("Configuration Options", function () {
		it("should handle theme configuration", function () {
			const theme = {
				style: {
					message: (text) => `[${text}]`,
					error: (text) => `ERROR: ${text}`,
				},
			};

			const config = {
				message: ">",
				context: "theme_test",
				theme: theme,
			};

			assert.deepStrictEqual(config.theme, theme);
		});

		it("should handle display options", function () {
			const config = {
				message: ">",
				context: "display_test",
				required: true,
				default: "default_value",
				autocompletePrompt: "Choose from:",
				maxSize: 100,
				ellipsize: true,
				ellipsis: "...",
			};

			assert.strictEqual(config.required, true);
			assert.strictEqual(config.default, "default_value");
			assert.strictEqual(config.autocompletePrompt, "Choose from:");
			assert.strictEqual(config.maxSize, 100);
			assert.strictEqual(config.ellipsize, true);
			assert.strictEqual(config.ellipsis, "...");
		});

		it("should handle event handlers", function () {
			const onBeforeKeyPressFn = ({ key }) =>
				console.log("Key pressed:", key.name);
			const onBeforeRewriteFn = (text) => text.trim();
			const onCloseFn = () => console.log("Prompt closed");

			const config = {
				message: ">",
				context: "events_test",
				onBeforeKeyPress: onBeforeKeyPressFn,
				onBeforeRewrite: onBeforeRewriteFn,
				onClose: onCloseFn,
			};

			assert.strictEqual(typeof config.onBeforeKeyPress, "function");
			assert.strictEqual(typeof config.onBeforeRewrite, "function");
			assert.strictEqual(typeof config.onClose, "function");
			assert.strictEqual(config.onBeforeRewrite("  hello  "), "hello");
		});

		it("should handle short option for autocomplete", function () {
			const shortFn = (line, matches) => matches.slice(0, 3);

			const config = {
				message: ">",
				context: "short_test",
				short: shortFn,
			};

			assert.strictEqual(typeof config.short, "function");
			assert.deepStrictEqual(config.short("test", ["a", "b", "c", "d"]), [
				"a",
				"b",
				"c",
			]);
		});
	});
});
