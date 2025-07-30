import assert from "node:assert";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import fsExtra from "fs-extra";
import sinon from "sinon";
import FileBackedHistory from "../FileBackedHistory.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("FileBackedHistory", () => {
	const TEST_HISTORY_DIR = pathResolve(__dirname, "test_file_backed_history");
	const TEST_HISTORY_FILE = "test-history.json";
	const FULL_HISTORY_PATH = pathResolve(TEST_HISTORY_DIR, TEST_HISTORY_FILE);

	beforeEach(async () => {
		// Clean up before each test
		if (await fsExtra.pathExists(TEST_HISTORY_DIR)) {
			await fsExtra.remove(TEST_HISTORY_DIR);
		}
		await fsExtra.ensureDir(TEST_HISTORY_DIR);
	});

	afterEach(async () => {
		sinon.restore();
		// Clean up after each test
		if (await fsExtra.pathExists(TEST_HISTORY_DIR)) {
			await fsExtra.remove(TEST_HISTORY_DIR);
		}
	});

	describe("Configuration", () => {
		it("should use default configuration", () => {
			const history = new FileBackedHistory();

			assert.strictEqual(history.config.save, true);
			assert.strictEqual(history.config.folder, ".");
			assert.strictEqual(history.config.limit, 100);
			assert.deepStrictEqual(history.config.blacklist, []);
			assert.strictEqual(
				history.config.fileName,
				"inquirer-command-prompt-history.json",
			);
		});

		it("should accept custom configuration", () => {
			const history = new FileBackedHistory({
				save: false,
				folder: "/tmp",
				limit: 50,
				blacklist: ["clear", "exit"],
				fileName: "custom-history.json",
			});

			assert.strictEqual(history.config.save, false);
			assert.strictEqual(history.config.folder, "/tmp");
			assert.strictEqual(history.config.limit, 50);
			assert.deepStrictEqual(history.config.blacklist, ["clear", "exit"]);
			assert.strictEqual(history.config.fileName, "custom-history.json");
		});

		it("should update configuration with setConfig", () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false,
			});

			history.setConfig({
				limit: 25,
				blacklist: ["test"],
				folder: "/new/path",
				fileName: "new-file.json",
			});

			assert.strictEqual(history.config.limit, 25);
			assert.deepStrictEqual(history.config.blacklist, ["test"]);
			assert.strictEqual(history.config.folder, "/new/path");
			assert.strictEqual(history.config.fileName, "new-file.json");
		});
	});

	describe("Adding Commands", () => {
		it("should add commands to history", () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false,
			});

			history.add("command1");
			history.add("command2");

			assert.deepStrictEqual(history.history, ["command1", "command2"]);
			assert.strictEqual(history.historyIndex, 2);
		});

		it("should not add duplicate consecutive commands", () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false,
			});

			history.add("command1");
			history.add("command1"); // Duplicate
			history.add("command2");
			history.add("command1"); // Not consecutive duplicate

			assert.deepStrictEqual(history.history, [
				"command1",
				"command2",
				"command1",
			]);
		});

		it("should respect history limit", () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false,
				limit: 3,
			});

			history.add("cmd1");
			history.add("cmd2");
			history.add("cmd3");
			history.add("cmd4"); // Should remove cmd1

			assert.deepStrictEqual(history.history, ["cmd2", "cmd3", "cmd4"]);
			assert.strictEqual(history.historyIndex, 3);
		});

		it("should ignore blacklisted commands", () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false,
				blacklist: ["clear", "exit"],
			});

			history.add("command1");
			history.add("clear"); // Should be ignored
			history.add("command2");
			history.add("exit"); // Should be ignored

			assert.deepStrictEqual(history.history, ["command1", "command2"]);
		});
	});

	describe("Navigation", () => {
		let history;

		beforeEach(() => {
			history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false,
			});

			history.add("cmd1");
			history.add("cmd2");
			history.add("cmd3");
			// History: ['cmd1', 'cmd2', 'cmd3'], index: 3
		});

		it("should navigate backwards through history", () => {
			assert.strictEqual(history.getPrevious(), "cmd3");
			assert.strictEqual(history.historyIndex, 2);

			assert.strictEqual(history.getPrevious(), "cmd2");
			assert.strictEqual(history.historyIndex, 1);

			assert.strictEqual(history.getPrevious(), "cmd1");
			assert.strictEqual(history.historyIndex, 0);

			// Try to go beyond beginning
			assert.strictEqual(history.getPrevious(), undefined);
			assert.strictEqual(history.historyIndex, 0);
		});

		it("should navigate forwards through history", () => {
			// First go back to beginning
			history.getPrevious(); // cmd3, index: 2
			history.getPrevious(); // cmd2, index: 1
			history.getPrevious(); // cmd1, index: 0

			// Now navigate forward
			assert.strictEqual(history.getNext(), "cmd2");
			assert.strictEqual(history.historyIndex, 1);

			assert.strictEqual(history.getNext(), "cmd3");
			assert.strictEqual(history.historyIndex, 2);

			// Go to new line
			assert.strictEqual(history.getNext(), "");
			assert.strictEqual(history.historyIndex, 3);

			// Try to go beyond end
			assert.strictEqual(history.getNext(), undefined);
			assert.strictEqual(history.historyIndex, 3);
		});

		it("should handle navigation on empty history", () => {
			const emptyHistory = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: "empty-history.json",
				save: false,
			});

			assert.strictEqual(emptyHistory.getPrevious(), undefined);
			assert.strictEqual(emptyHistory.getNext(), undefined);
			assert.strictEqual(emptyHistory.historyIndex, 0);
		});
	});

	describe("Getting All Commands", () => {
		it("should return copy of all commands", () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false,
			});

			history.add("cmd1");
			history.add("cmd2");
			history.add("cmd3");

			const allCommands = history.getAll();

			assert.deepStrictEqual(allCommands, ["cmd1", "cmd2", "cmd3"]);

			// Verify it's a copy (modifying returned array shouldn't affect internal state)
			allCommands.push("cmd4");
			assert.deepStrictEqual(history.history, ["cmd1", "cmd2", "cmd3"]);
		});

		it("should return empty array for empty history", () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false,
			});

			const allCommands = history.getAll();
			assert.deepStrictEqual(allCommands, []);
		});
	});

	describe("File Persistence", () => {
		it("should save history to file when save is enabled", async () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: true,
			});

			history.add("saved_command1");
			history.add("saved_command2");

			// Verify file was created and contains correct data
			assert.ok(
				await fsExtra.pathExists(FULL_HISTORY_PATH),
				"History file should exist",
			);

			const fileContent = await fsExtra.readJson(FULL_HISTORY_PATH);
			assert.deepStrictEqual(fileContent.history, [
				"saved_command1",
				"saved_command2",
			]);
		});

		it("should not save history to file when save is disabled", async () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false,
			});

			history.add("not_saved_command");

			// Verify file was not created
			assert.ok(
				!(await fsExtra.pathExists(FULL_HISTORY_PATH)),
				"History file should not exist",
			);
		});

		it("should load existing history from file", async () => {
			// Create a history file first
			const existingHistory = { history: ["existing_cmd1", "existing_cmd2"] };
			await fsExtra.writeJson(FULL_HISTORY_PATH, existingHistory);

			// Create new history instance that should load from file
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: true,
			});

			assert.deepStrictEqual(history.history, [
				"existing_cmd1",
				"existing_cmd2",
			]);
			assert.strictEqual(history.historyIndex, 2);
		});

		it("should handle corrupted history file gracefully", async () => {
			// Create corrupted JSON file
			await fsExtra.writeFile(FULL_HISTORY_PATH, "this is not valid json");

			const consoleErrorStub = sinon.stub(console, "error");
			const consoleLogStub = sinon.stub(console, "log");

			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: true,
			});

			// Should start with empty history
			assert.deepStrictEqual(history.history, []);
			assert.strictEqual(history.historyIndex, 0);

			// Should have logged error
			sinon.assert.calledWithMatch(
				consoleErrorStub,
				/Invalid or corrupted history file/,
			);

			// Should have backed up corrupted file
			sinon.assert.calledWithMatch(
				consoleLogStub,
				/Corrupted history file backed up to/,
			);

			consoleErrorStub.restore();
			consoleLogStub.restore();
		});

		it("should respect limit when saving to file", async () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: true,
				limit: 2,
			});

			history.add("cmd1");
			history.add("cmd2");
			history.add("cmd3"); // Should remove cmd1 from memory and file

			const fileContent = await fsExtra.readJson(FULL_HISTORY_PATH);
			assert.deepStrictEqual(fileContent.history, ["cmd2", "cmd3"]);
		});

		it("should handle directory creation errors gracefully", () => {
			const consoleErrorStub = sinon.stub(console, "error");
			const ensureDirSyncStub = sinon
				.stub(fsExtra, "ensureDirSync")
				.throws(new Error("Permission denied"));

			const history = new FileBackedHistory({
				folder: "/invalid/path/that/cannot/be/created",
				fileName: TEST_HISTORY_FILE,
				save: true,
			});

			// Should not throw, but should log error
			history.add("test_command");

			sinon.assert.calledWithMatch(
				consoleErrorStub,
				/Could not create history directory/,
			);

			consoleErrorStub.restore();
			ensureDirSyncStub.restore();
		});

		it("should handle file write errors gracefully", async () => {
			const consoleErrorStub = sinon.stub(console, "error");
			const writeFileSyncStub = sinon
				.stub(fsExtra, "writeFileSync")
				.throws(new Error("Disk full"));

			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: true,
			});

			// Should not throw, but should log error
			history.add("test_command");

			sinon.assert.calledWithMatch(
				consoleErrorStub,
				/Could not save history file/,
			);

			consoleErrorStub.restore();
			writeFileSyncStub.restore();
		});
	});

	describe("_getLimitedHistory", () => {
		it("should return limited history when over limit", () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false,
				limit: 2,
			});

			// Add more commands than limit
			history.history = ["cmd1", "cmd2", "cmd3", "cmd4"];

			const limitedHistory = history._getLimitedHistory();
			assert.deepStrictEqual(limitedHistory, ["cmd3", "cmd4"]);
		});

		it("should return full history when under limit", () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false,
				limit: 5,
			});

			history.history = ["cmd1", "cmd2"];

			const limitedHistory = history._getLimitedHistory();
			assert.deepStrictEqual(limitedHistory, ["cmd1", "cmd2"]);
		});

		it("should return copy of history", () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false,
			});

			history.history = ["cmd1", "cmd2"];

			const limitedHistory = history._getLimitedHistory();
			limitedHistory.push("cmd3");

			// Original should be unchanged
			assert.deepStrictEqual(history.history, ["cmd1", "cmd2"]);
		});
	});

	describe("Manual save and load", () => {
		it("should allow manual save", async () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false, // Disable auto-save
			});

			history.add("manual_cmd1");
			history.add("manual_cmd2");

			// File should not exist yet
			assert.ok(
				!(await fsExtra.pathExists(FULL_HISTORY_PATH)),
				"File should not exist before manual save",
			);

			// Manually save
			history.save();

			// Now file should exist
			assert.ok(
				await fsExtra.pathExists(FULL_HISTORY_PATH),
				"File should exist after manual save",
			);

			const fileContent = await fsExtra.readJson(FULL_HISTORY_PATH);
			assert.deepStrictEqual(fileContent.history, [
				"manual_cmd1",
				"manual_cmd2",
			]);
		});

		it("should allow manual load", async () => {
			// Create history file
			const existingHistory = { history: ["loaded_cmd1", "loaded_cmd2"] };
			await fsExtra.writeJson(FULL_HISTORY_PATH, existingHistory);

			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false, // This prevents auto-load in constructor
			});

			// Should start empty
			assert.deepStrictEqual(history.history, []);

			// Manually load
			history.load();

			// Should now have loaded data
			assert.deepStrictEqual(history.history, ["loaded_cmd1", "loaded_cmd2"]);
			assert.strictEqual(history.historyIndex, 2);
		});
	});
});
