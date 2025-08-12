import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import fsExtra from "fs-extra";
import sinon from "sinon";
import FileBackedHistory from "../FileBackedHistory.ts";

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

			expect(history.config.save).toBe(true);
			expect(history.config.folder).toBe(".");
			expect(history.config.limit).toBe(100);
			expect(history.config.blacklist).toEqual([]);
			expect(history.config.fileName).toBe("inquirer-command-prompt-history.json");
		});

		it("should accept custom configuration", () => {
			const history = new FileBackedHistory({
				save: false,
				folder: "/tmp",
				limit: 50,
				blacklist: ["clear", "exit"],
				fileName: "custom-history.json",
			});

			expect(history.config.save).toBe(false);
			expect(history.config.folder).toBe("/tmp");
			expect(history.config.limit).toBe(50);
			expect(history.config.blacklist).toEqual(["clear", "exit"]);
			expect(history.config.fileName).toBe("custom-history.json");
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

			expect(history.config.limit).toBe(25);
			expect(history.config.blacklist).toEqual(["test"]);
			expect(history.config.folder).toBe("/new/path");
			expect(history.config.fileName).toBe("new-file.json");
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

			expect(history.history).toEqual(["command1", "command2"]);
			expect(history.historyIndex).toBe(2);
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

			expect(history.history).toEqual([
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

			expect(history.history).toEqual(["cmd2", "cmd3", "cmd4"]);
			expect(history.historyIndex).toBe(3);
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

			expect(history.history).toEqual(["command1", "command2"]);
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
			expect(history.getPrevious()).toBe("cmd3");
			expect(history.historyIndex).toBe(2);

			expect(history.getPrevious()).toBe("cmd2");
			expect(history.historyIndex).toBe(1);

			expect(history.getPrevious()).toBe("cmd1");
			expect(history.historyIndex).toBe(0);

			// Try to go beyond beginning
			expect(history.getPrevious()).toBeUndefined();
			expect(history.historyIndex).toBe(0);
		});

		it("should navigate forwards through history", () => {
			// First go back to beginning
			history.getPrevious(); // cmd3, index: 2
			history.getPrevious(); // cmd2, index: 1
			history.getPrevious(); // cmd1, index: 0

			// Now navigate forward
			expect(history.getNext()).toBe("cmd2");
			expect(history.historyIndex).toBe(1);

			expect(history.getNext()).toBe("cmd3");
			expect(history.historyIndex).toBe(2);

			// Go to new line
			expect(history.getNext()).toBe("");
			expect(history.historyIndex).toBe(3);

			// Try to go beyond end
			expect(history.getNext()).toBeUndefined();
			expect(history.historyIndex).toBe(3);
		});

		it("should handle navigation on empty history", () => {
			const emptyHistory = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: "empty-history.json",
				save: false,
			});

			expect(emptyHistory.getPrevious()).toBeUndefined();
			expect(emptyHistory.getNext()).toBeUndefined();
			expect(emptyHistory.historyIndex).toBe(0);
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

			expect(allCommands).toEqual(["cmd1", "cmd2", "cmd3"]);

			// Verify it's a copy (modifying returned array shouldn't affect internal state)
			allCommands.push("cmd4");
			expect(history.history).toEqual(["cmd1", "cmd2", "cmd3"]);
		});

		it("should return empty array for empty history", () => {
			const history = new FileBackedHistory({
				folder: TEST_HISTORY_DIR,
				fileName: TEST_HISTORY_FILE,
				save: false,
			});

			const allCommands = history.getAll();
			expect(allCommands).toEqual([]);
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
			expect(await fsExtra.pathExists(FULL_HISTORY_PATH)).toBe(true);

			const fileContent = await fsExtra.readJson(FULL_HISTORY_PATH);
			expect(fileContent.history).toEqual([
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
			expect(await fsExtra.pathExists(FULL_HISTORY_PATH)).toBe(false);
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

			expect(history.history).toEqual([
				"existing_cmd1",
				"existing_cmd2",
			]);
			expect(history.historyIndex).toBe(2);
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
			expect(history.history).toEqual([]);
			expect(history.historyIndex).toBe(0);

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
			expect(fileContent.history).toEqual(["cmd2", "cmd3"]);
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
			expect(limitedHistory).toEqual(["cmd3", "cmd4"]);
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
			expect(limitedHistory).toEqual(["cmd1", "cmd2"]);
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
			expect(history.history).toEqual(["cmd1", "cmd2"]);
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
			expect(await fsExtra.pathExists(FULL_HISTORY_PATH)).toBe(false);

			// Manually save
			history.save();

			// Now file should exist
			expect(await fsExtra.pathExists(FULL_HISTORY_PATH)).toBe(true);

			const fileContent = await fsExtra.readJson(FULL_HISTORY_PATH);
			expect(fileContent.history).toEqual([
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
			expect(history.history).toEqual([]);

			// Manually load
			history.load();

			// Should now have loaded data
			expect(history.history).toEqual(["loaded_cmd1", "loaded_cmd2"]);
			expect(history.historyIndex).toBe(2);
		});
	});
});
