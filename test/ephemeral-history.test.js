import assert from 'node:assert';
import EphemeralHistory from '../EphemeralHistory.js';

describe('EphemeralHistory', function () {
  let history;
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
  });


  describe('Adding Commands', function () {
    
    it('should add commands to history', function () {
      history.add('command1');
      history.add('command2');
      
      assert.deepStrictEqual(history.history, ['command1', 'command2']);
      assert.strictEqual(history.historyIndex, 2);
    });

    it('should not add duplicate consecutive commands', function () {
      history.add('command1');
      history.add('command1'); // Duplicate
      history.add('command2');
      history.add('command1'); // Not consecutive duplicate
      
      assert.deepStrictEqual(history.history, ['command1', 'command2', 'command1']);
    });

    it('should respect history limit', function () {
      history.setConfig({ limit: 3 });
      
      history.add('cmd1');
      history.add('cmd2');
      history.add('cmd3');
      history.add('cmd4'); // Should remove cmd1
      
      assert.deepStrictEqual(history.history, ['cmd2', 'cmd3', 'cmd4']);
      assert.strictEqual(history.historyIndex, 3);
    });

    it('should ignore blacklisted commands', function () {
      history.setConfig({ blacklist: ['clear', 'exit'] });
      
      history.add('command1');
      history.add('clear'); // Should be ignored
      history.add('command2');
      history.add('exit'); // Should be ignored
      
      assert.deepStrictEqual(history.history, ['command1', 'command2']);
    });
  });

  describe('Navigation', function () {
    beforeEach(function () {
      history.add('cmd1');
      history.add('cmd2');
      history.add('cmd3');
      // History: ['cmd1', 'cmd2', 'cmd3'], index: 3
    });

    it('should navigate backwards through history', function () {
      assert.strictEqual(history.getPrevious(), 'cmd3');
      assert.strictEqual(history.historyIndex, 2);
      
      assert.strictEqual(history.getPrevious(), 'cmd2');
      assert.strictEqual(history.historyIndex, 1);
      
      assert.strictEqual(history.getPrevious(), 'cmd1');
      assert.strictEqual(history.historyIndex, 0);
      
      // Try to go beyond beginning
      assert.strictEqual(history.getPrevious(), undefined);
      assert.strictEqual(history.historyIndex, 0);
    });

    it('should navigate forwards through history', function () {
      // First go back to beginning
      history.getPrevious(); // cmd3, index: 2
      history.getPrevious(); // cmd2, index: 1
      history.getPrevious(); // cmd1, index: 0
      
      // Now navigate forward
      assert.strictEqual(history.getNext(), 'cmd2');
      assert.strictEqual(history.historyIndex, 1);
      
      assert.strictEqual(history.getNext(), 'cmd3');
      assert.strictEqual(history.historyIndex, 2);
      
      // Go to new line
      assert.strictEqual(history.getNext(), undefined);
      assert.strictEqual(history.historyIndex, 3);
      
      // Try to go beyond end
      assert.strictEqual(history.getNext(), undefined);
      assert.strictEqual(history.historyIndex, 3);
    });
  });

  describe('Getting All Commands', function () {
    beforeEach(function () {
      history.add('cmd1');
      history.add('cmd2');
      history.add('cmd3');
    });

    it('should return copy of all commands', function () {
      const allCommands = history.getAll();
      
      assert.deepStrictEqual(allCommands, ['cmd1', 'cmd2', 'cmd3']);
      
      // Verify it's a copy (modifying returned array shouldn't affect internal state)
      allCommands.push('cmd4');
      assert.deepStrictEqual(history.history, ['cmd1', 'cmd2', 'cmd3']);
    });

  });

  describe('Clearing History', function () {
    beforeEach(function () {
      history.add('cmd1');
      history.add('cmd2');
    });

    it('should clear specific context', function () {
      history.clear();
      
      assert.deepStrictEqual(history.history, []);
      assert.strictEqual(history.historyIndex, 0);
    });

    it('should handle clearing non-existent context', function () {
      history.clear();
      // Should not throw error
    });
  });

});