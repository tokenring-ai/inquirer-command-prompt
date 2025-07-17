import assert from 'node:assert';
import EphemeralHistory from '../EphemeralHistory.js';

describe('EphemeralHistory', function () {
  let history;
  const TEST_CONTEXT = 'test_context';

  beforeEach(function () {
    history = new EphemeralHistory();
  });

  describe('Configuration', function () {
    it('should use default configuration', function () {
      assert.strictEqual(history.config.limit, 100);
      assert.deepStrictEqual(history.config.blacklist, []);
    });

    it('should accept custom configuration', function () {
      const customHistory = new EphemeralHistory({
        limit: 50,
        blacklist: ['clear', 'exit']
      });
      
      assert.strictEqual(customHistory.config.limit, 50);
      assert.deepStrictEqual(customHistory.config.blacklist, ['clear', 'exit']);
    });

    it('should update configuration with setConfig', function () {
      history.setConfig({ limit: 25, blacklist: ['test'] });
      
      assert.strictEqual(history.config.limit, 25);
      assert.deepStrictEqual(history.config.blacklist, ['test']);
    });
  });

  describe('Initialization', function () {
    it('should initialize context on first use', function () {
      assert.strictEqual(history.histories[TEST_CONTEXT], undefined);
      assert.strictEqual(history.historyIndexes[TEST_CONTEXT], undefined);
      
      history.init(TEST_CONTEXT);
      
      assert.deepStrictEqual(history.histories[TEST_CONTEXT], []);
      assert.strictEqual(history.historyIndexes[TEST_CONTEXT], 0);
    });

    it('should not reinitialize existing context', function () {
      history.init(TEST_CONTEXT);
      history.add(TEST_CONTEXT, 'test_command');
      
      // Try to init again
      history.init(TEST_CONTEXT);
      
      assert.deepStrictEqual(history.histories[TEST_CONTEXT], ['test_command']);
      assert.strictEqual(history.historyIndexes[TEST_CONTEXT], 1);
    });
  });

  describe('Adding Commands', function () {
    beforeEach(function () {
      history.init(TEST_CONTEXT);
    });

    it('should add commands to history', function () {
      history.add(TEST_CONTEXT, 'command1');
      history.add(TEST_CONTEXT, 'command2');
      
      assert.deepStrictEqual(history.histories[TEST_CONTEXT], ['command1', 'command2']);
      assert.strictEqual(history.historyIndexes[TEST_CONTEXT], 2);
    });

    it('should not add duplicate consecutive commands', function () {
      history.add(TEST_CONTEXT, 'command1');
      history.add(TEST_CONTEXT, 'command1'); // Duplicate
      history.add(TEST_CONTEXT, 'command2');
      history.add(TEST_CONTEXT, 'command1'); // Not consecutive duplicate
      
      assert.deepStrictEqual(history.histories[TEST_CONTEXT], ['command1', 'command2', 'command1']);
    });

    it('should respect history limit', function () {
      history.setConfig({ limit: 3 });
      
      history.add(TEST_CONTEXT, 'cmd1');
      history.add(TEST_CONTEXT, 'cmd2');
      history.add(TEST_CONTEXT, 'cmd3');
      history.add(TEST_CONTEXT, 'cmd4'); // Should remove cmd1
      
      assert.deepStrictEqual(history.histories[TEST_CONTEXT], ['cmd2', 'cmd3', 'cmd4']);
      assert.strictEqual(history.historyIndexes[TEST_CONTEXT], 3);
    });

    it('should ignore blacklisted commands', function () {
      history.setConfig({ blacklist: ['clear', 'exit'] });
      
      history.add(TEST_CONTEXT, 'command1');
      history.add(TEST_CONTEXT, 'clear'); // Should be ignored
      history.add(TEST_CONTEXT, 'command2');
      history.add(TEST_CONTEXT, 'exit'); // Should be ignored
      
      assert.deepStrictEqual(history.histories[TEST_CONTEXT], ['command1', 'command2']);
    });

    it('should auto-initialize context when adding', function () {
      const NEW_CONTEXT = 'new_context';
      
      history.add(NEW_CONTEXT, 'first_command');
      
      assert.deepStrictEqual(history.histories[NEW_CONTEXT], ['first_command']);
      assert.strictEqual(history.historyIndexes[NEW_CONTEXT], 1);
    });
  });

  describe('Navigation', function () {
    beforeEach(function () {
      history.init(TEST_CONTEXT);
      history.add(TEST_CONTEXT, 'cmd1');
      history.add(TEST_CONTEXT, 'cmd2');
      history.add(TEST_CONTEXT, 'cmd3');
      // History: ['cmd1', 'cmd2', 'cmd3'], index: 3
    });

    it('should navigate backwards through history', function () {
      assert.strictEqual(history.getPrevious(TEST_CONTEXT), 'cmd3');
      assert.strictEqual(history.historyIndexes[TEST_CONTEXT], 2);
      
      assert.strictEqual(history.getPrevious(TEST_CONTEXT), 'cmd2');
      assert.strictEqual(history.historyIndexes[TEST_CONTEXT], 1);
      
      assert.strictEqual(history.getPrevious(TEST_CONTEXT), 'cmd1');
      assert.strictEqual(history.historyIndexes[TEST_CONTEXT], 0);
      
      // Try to go beyond beginning
      assert.strictEqual(history.getPrevious(TEST_CONTEXT), undefined);
      assert.strictEqual(history.historyIndexes[TEST_CONTEXT], 0);
    });

    it('should navigate forwards through history', function () {
      // First go back to beginning
      history.getPrevious(TEST_CONTEXT); // cmd3, index: 2
      history.getPrevious(TEST_CONTEXT); // cmd2, index: 1
      history.getPrevious(TEST_CONTEXT); // cmd1, index: 0
      
      // Now navigate forward
      assert.strictEqual(history.getNext(TEST_CONTEXT), 'cmd2');
      assert.strictEqual(history.historyIndexes[TEST_CONTEXT], 1);
      
      assert.strictEqual(history.getNext(TEST_CONTEXT), 'cmd3');
      assert.strictEqual(history.historyIndexes[TEST_CONTEXT], 2);
      
      // Go to new line
      assert.strictEqual(history.getNext(TEST_CONTEXT), undefined);
      assert.strictEqual(history.historyIndexes[TEST_CONTEXT], 3);
      
      // Try to go beyond end
      assert.strictEqual(history.getNext(TEST_CONTEXT), undefined);
      assert.strictEqual(history.historyIndexes[TEST_CONTEXT], 3);
    });

    it('should handle navigation on empty history', function () {
      const EMPTY_CONTEXT = 'empty_context';
      history.init(EMPTY_CONTEXT);
      
      assert.strictEqual(history.getPrevious(EMPTY_CONTEXT), undefined);
      assert.strictEqual(history.getNext(EMPTY_CONTEXT), undefined);
      assert.strictEqual(history.historyIndexes[EMPTY_CONTEXT], 0);
    });

    it('should auto-initialize context when navigating', function () {
      const NEW_CONTEXT = 'nav_context';
      
      assert.strictEqual(history.getPrevious(NEW_CONTEXT), undefined);
      assert.strictEqual(history.getNext(NEW_CONTEXT), undefined);
      
      // Should have been initialized
      assert.deepStrictEqual(history.histories[NEW_CONTEXT], []);
      assert.strictEqual(history.historyIndexes[NEW_CONTEXT], 0);
    });
  });

  describe('Getting All Commands', function () {
    beforeEach(function () {
      history.init(TEST_CONTEXT);
      history.add(TEST_CONTEXT, 'cmd1');
      history.add(TEST_CONTEXT, 'cmd2');
      history.add(TEST_CONTEXT, 'cmd3');
    });

    it('should return copy of all commands', function () {
      const allCommands = history.getAll(TEST_CONTEXT);
      
      assert.deepStrictEqual(allCommands, ['cmd1', 'cmd2', 'cmd3']);
      
      // Verify it's a copy (modifying returned array shouldn't affect internal state)
      allCommands.push('cmd4');
      assert.deepStrictEqual(history.histories[TEST_CONTEXT], ['cmd1', 'cmd2', 'cmd3']);
    });

    it('should return empty array for empty context', function () {
      const EMPTY_CONTEXT = 'empty_context';
      const allCommands = history.getAll(EMPTY_CONTEXT);
      
      assert.deepStrictEqual(allCommands, []);
    });

    it('should auto-initialize context when getting all', function () {
      const NEW_CONTEXT = 'getall_context';
      
      const allCommands = history.getAll(NEW_CONTEXT);
      
      assert.deepStrictEqual(allCommands, []);
      assert.deepStrictEqual(history.histories[NEW_CONTEXT], []);
      assert.strictEqual(history.historyIndexes[NEW_CONTEXT], 0);
    });
  });

  describe('Clearing History', function () {
    beforeEach(function () {
      history.init(TEST_CONTEXT);
      history.add(TEST_CONTEXT, 'cmd1');
      history.add(TEST_CONTEXT, 'cmd2');
    });

    it('should clear specific context', function () {
      const OTHER_CONTEXT = 'other_context';
      history.init(OTHER_CONTEXT);
      history.add(OTHER_CONTEXT, 'other_cmd');
      
      history.clear(TEST_CONTEXT);
      
      assert.deepStrictEqual(history.histories[TEST_CONTEXT], []);
      assert.strictEqual(history.historyIndexes[TEST_CONTEXT], 0);
      
      // Other context should be unaffected
      assert.deepStrictEqual(history.histories[OTHER_CONTEXT], ['other_cmd']);
    });

    it('should handle clearing non-existent context', function () {
      history.clear('non_existent');
      // Should not throw error
    });

    it('should clear all contexts', function () {
      const OTHER_CONTEXT = 'other_context';
      history.init(OTHER_CONTEXT);
      history.add(OTHER_CONTEXT, 'other_cmd');
      
      history.clearAll();
      
      assert.deepStrictEqual(history.histories, {});
      assert.deepStrictEqual(history.historyIndexes, {});
    });
  });

  describe('Multiple Contexts', function () {
    it('should maintain separate histories for different contexts', function () {
      const CONTEXT1 = 'context1';
      const CONTEXT2 = 'context2';
      
      history.add(CONTEXT1, 'cmd1_ctx1');
      history.add(CONTEXT1, 'cmd2_ctx1');
      
      history.add(CONTEXT2, 'cmd1_ctx2');
      history.add(CONTEXT2, 'cmd2_ctx2');
      
      assert.deepStrictEqual(history.getAll(CONTEXT1), ['cmd1_ctx1', 'cmd2_ctx1']);
      assert.deepStrictEqual(history.getAll(CONTEXT2), ['cmd1_ctx2', 'cmd2_ctx2']);
      
      // Navigation should be independent
      assert.strictEqual(history.getPrevious(CONTEXT1), 'cmd2_ctx1');
      assert.strictEqual(history.getPrevious(CONTEXT2), 'cmd2_ctx2');
      
      assert.strictEqual(history.historyIndexes[CONTEXT1], 1);
      assert.strictEqual(history.historyIndexes[CONTEXT2], 1);
    });
  });
});