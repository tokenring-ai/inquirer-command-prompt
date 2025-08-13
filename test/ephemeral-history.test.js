import {beforeEach, describe, expect, it} from "vitest";
import EphemeralHistory from "../EphemeralHistory.ts";

describe("EphemeralHistory", () => {
	let history;
	beforeEach(() => {
		history = new EphemeralHistory();
	});

	describe("Configuration", () => {
		it("should use default configuration", () => {
			expect(history.config.limit).toBe(100);
			expect(history.config.blacklist).toEqual([]);
		});

		it("should accept custom configuration", () => {
			const customHistory = new EphemeralHistory({
				limit: 50,
				blacklist: ["clear", "exit"],
			});

			expect(customHistory.config.limit).toBe(50);
			expect(customHistory.config.blacklist).toEqual(["clear", "exit"]);
		});
	});

	describe("Adding Commands", () => {
		it("should add commands to history", () => {
			history.add("command1");
			history.add("command2");

			expect(history.history).toEqual(["command1", "command2"]);
			expect(history.historyIndex).toBe(2);
		});

		it("should not add duplicate consecutive commands", () => {
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
			history.setConfig({ limit: 3 });

			history.add("cmd1");
			history.add("cmd2");
			history.add("cmd3");
			history.add("cmd4"); // Should remove cmd1

			expect(history.history).toEqual(["cmd2", "cmd3", "cmd4"]);
			expect(history.historyIndex).toBe(3);
		});

		it("should ignore blacklisted commands", () => {
			history.setConfig({ blacklist: ["clear", "exit"] });

			history.add("command1");
			history.add("clear"); // Should be ignored
			history.add("command2");
			history.add("exit"); // Should be ignored

			expect(history.history).toEqual(["command1", "command2"]);
		});
	});

	describe("Navigation", () => {
		beforeEach(() => {
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
	});

	describe("Getting All Commands", () => {
		beforeEach(() => {
			history.add("cmd1");
			history.add("cmd2");
			history.add("cmd3");
		});

		it("should return copy of all commands", () => {
			const allCommands = history.getAll();

			expect(allCommands).toEqual(["cmd1", "cmd2", "cmd3"]);

			// Verify it's a copy (modifying returned array shouldn't affect internal state)
			allCommands.push("cmd4");
			expect(history.history).toEqual(["cmd1", "cmd2", "cmd3"]);
		});
	});

	describe("Clearing History", () => {
		beforeEach(() => {
			history.add("cmd1");
			history.add("cmd2");
		});

		it("should clear specific context", () => {
			history.clear();

			expect(history.history).toEqual([]);
			expect(history.historyIndex).toBe(0);
		});

		it("should handle clearing non-existent context", () => {
			history.clear();
			// Should not throw error
		});
	});
});
