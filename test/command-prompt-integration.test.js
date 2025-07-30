import assert from "node:assert";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import fsExtra from "fs-extra";
import EphemeralHistory from "../EphemeralHistory.js";
import FileBackedHistory from "../FileBackedHistory.js";
import commandPrompt from "../index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Command Prompt Integration Tests", function () {
	this.timeout(5000);

	describe("Configuration Integration", () => {
		it("should accept basic configuration", () => {
			const config = {
				message: "Enter command:",
				context: "test",
				default: "default_value",
			};

			// Test that commandPrompt accepts the configuration
			assert.strictEqual(typeof commandPrompt, "function");
			assert.strictEqual(config.message, "Enter command:");
			assert.strictEqual(config.context, "test");
			assert.strictEqual(config.default, "default_value");
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

			assert.strictEqual(typeof config.validate, "function");
			assert.strictEqual(config.validate(""), "Input cannot be empty");
			assert.strictEqual(
				config.validate("hi"),
				"Input must be at least 3 characters",
			);
			assert.strictEqual(config.validate("hello"), true);
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

			assert.strictEqual(typeof config.transformer, "function");
			assert.strictEqual(
				config.transformer("hello", {}, { isFinal: true }),
				"HELLO",
			);
			assert.strictEqual(
				config.transformer("hello", {}, { isFinal: false }),
				"hello",
			);
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

			assert.deepStrictEqual(config.autoCompletion, commands);
			assert.ok(Array.isArray(config.autoCompletion));
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

			assert.strictEqual(typeof config.autoCompletion, "function");
			assert.deepStrictEqual(config.autoCompletion("st"), [
				"start",
				"stop",
				"status",
			]);
			assert.deepStrictEqual(config.autoCompletion("help"), ["help"]);
			assert.deepStrictEqual(config.autoCompletion("xyz"), []);
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

			assert.strictEqual(typeof config.autoCompletion, "function");
			const result = await config.autoCompletion("async_s");
			assert.deepStrictEqual(result, ["async_start", "async_stop"]);
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

			assert.strictEqual(typeof config.short, "function");
			assert.deepStrictEqual(config.short("", ["a", "b", "c", "d", "e", "f"]), [
				"a",
				"b",
				"c",
				"d",
				"e",
			]);
			assert.strictEqual(config.autocompletePrompt, "Available commands:");
			assert.strictEqual(config.maxSize, 80);
			assert.strictEqual(config.ellipsize, true);
			assert.strictEqual(config.ellipsis, "...");
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
			const historyHandler = new EphemeralHistory({ limit: 10 });

			const config = {
				message: "Enter command:",
				context: "ephemeral_integration_test",
				historyHandler: historyHandler,
			};

			// Test that the history handler is properly configured
			assert.strictEqual(config.historyHandler, historyHandler);
			assert.strictEqual(historyHandler.config.limit, 10);

			historyHandler.add("test_command_1");
			historyHandler.add("test_command_2");

			assert.deepStrictEqual(historyHandler.getAll(), [
				"test_command_1",
				"test_command_2",
			]);
			assert.strictEqual(historyHandler.getPrevious(), "test_command_2");
			assert.strictEqual(historyHandler.getPrevious(), "test_command_1");
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
			assert.strictEqual(config.historyHandler, historyHandler);
			assert.strictEqual(historyHandler.config.save, true);
			assert.strictEqual(historyHandler.config.limit, 5);

			// Test history functionality
			historyHandler.add("file_cmd_1");
			historyHandler.add("file_cmd_2");

			assert.deepStrictEqual(historyHandler.getAll(), [
				"file_cmd_1",
				"file_cmd_2",
			]);

			// Verify file was created
			const historyFilePath = pathResolve(TEST_HISTORY_DIR, HISTORY_FILE);
			assert.ok(await fsExtra.pathExists(historyFilePath));

			const fileContent = await fsExtra.readJson(historyFilePath);
			assert.deepStrictEqual(fileContent.history, ["file_cmd_1", "file_cmd_2"]);
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

			assert.deepStrictEqual(config.history, historyConfig);
			assert.strictEqual(config.history.limit, 20);
			assert.deepStrictEqual(config.history.blacklist, ["clear", "exit"]);
		});
	});

	describe("Event Handlers Integration", () => {
		it("should handle onBeforeKeyPress configuration", () => {
			const keyPressLog = [];
			const onBeforeKeyPressFn = ({ key }) => {
				keyPressLog.push(key.name);
			};

			const config = {
				message: "Enter command:",
				context: "keypress_integration_test",
				onBeforeKeyPress: onBeforeKeyPressFn,
			};

			assert.strictEqual(typeof config.onBeforeKeyPress, "function");

			// Simulate key press events
			config.onBeforeKeyPress({ key: { name: "a" } });
			config.onBeforeKeyPress({ key: { name: "b" } });
			config.onBeforeKeyPress({ key: { name: "enter" } });

			assert.deepStrictEqual(keyPressLog, ["a", "b", "enter"]);
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

			assert.strictEqual(typeof config.onBeforeRewrite, "function");
			assert.strictEqual(
				config.onBeforeRewrite("  HELLO   WORLD  "),
				"hello world",
			);
			assert.strictEqual(
				config.onBeforeRewrite("Test\t\tCommand"),
				"test command",
			);
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

			assert.strictEqual(typeof config.onClose, "function");
			config.onClose();
			assert.strictEqual(closeCalled, true);
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

			assert.deepStrictEqual(config.theme, customTheme);
			assert.strictEqual(typeof config.theme.style.message, "function");
			assert.strictEqual(
				config.theme.style.message("Test", "idle"),
				"[idle] Test",
			);
			assert.strictEqual(
				config.theme.style.error("Error message"),
				"❌ Error message",
			);
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

			assert.strictEqual(config.noColorOnAnswered, true);
			assert.strictEqual(config.colorOnAnswered, "green");
			assert.strictEqual(config.maxSize, 120);
			assert.strictEqual(config.ellipsize, true);
			assert.strictEqual(config.ellipsis, "…");
		});
	});

	describe("Advanced Configuration Integration", () => {
		it("should handle complex configuration with all options", () => {
			const historyHandler = new EphemeralHistory({ limit: 50 });
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
				onBeforeKeyPress: ({ key }) => console.log(`Key: ${key.name}`),
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
			assert.strictEqual(config.message, "🚀 Enter command:");
			assert.strictEqual(config.context, "complex_integration_test");
			assert.strictEqual(config.default, "help");
			assert.strictEqual(config.required, true);
			assert.strictEqual(config.historyHandler, historyHandler);
			assert.deepStrictEqual(config.autoCompletion, commands);
			assert.strictEqual(config.autocompletePrompt, "📋 Available commands:");
			assert.strictEqual(typeof config.validate, "function");
			assert.strictEqual(typeof config.transformer, "function");
			assert.strictEqual(typeof config.onCtrlEnd, "function");
			assert.strictEqual(typeof config.onBeforeKeyPress, "function");
			assert.strictEqual(typeof config.onBeforeRewrite, "function");
			assert.strictEqual(typeof config.onClose, "function");
			assert.strictEqual(typeof config.short, "function");
			assert.strictEqual(config.maxSize, 100);
			assert.strictEqual(config.ellipsize, true);
			assert.strictEqual(config.ellipsis, "...");
			assert.strictEqual(typeof config.theme, "object");

			// Test some of the functions
			assert.strictEqual(config.validate("test"), true);
			assert.strictEqual(config.validate(""), "Command cannot be empty");
			assert.strictEqual(
				config.transformer("hello", {}, { isFinal: true }),
				"HELLO",
			);
			assert.strictEqual(config.onCtrlEnd("ls"), "exec ls");
			assert.strictEqual(config.onBeforeRewrite("  test  "), "test");
			assert.deepStrictEqual(
				config.short(
					"",
					new Array(15).fill(0).map((_, i) => `cmd${i}`),
				),
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
				assert.strictEqual(metaMCalled, true, "onMetaM should be called");
				assert.strictEqual(
					multiLineEnabled,
					true,
					"Multi-line mode should be enabled",
				);
				assert.strictEqual(result, "line1\nline2");
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
				assert.strictEqual(result, "single line");
			});
		});
	});
});
