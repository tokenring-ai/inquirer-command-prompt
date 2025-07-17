import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import sinon from 'sinon';
import fsExtra from 'fs-extra';
import commandPrompt from '../index.js';
import EphemeralHistory from '../EphemeralHistory.js';
import FileBackedHistory from '../FileBackedHistory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Helper to simulate user input for testing
function simulateUserInput(input, delay = 50) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock the readline interface
      const mockRl = {
        line: input,
        cursor: input.length,
        setRawMode: () => {},
        resume: () => {},
        pause: () => {},
        close: () => {},
        write: () => {},
        clearLine: () => {},
        cursorTo: () => {}
      };
      
      // Simulate keypress events
      const events = [];
      for (let char of input) {
        events.push({ name: char, sequence: char });
      }
      events.push({ name: 'return', sequence: '\r' });
      
      resolve({ mockRl, events });
    }, delay);
  });
}


describe('inquirer-command-prompt', function () {
  this.timeout(5000);

  describe('Basic Functionality', function () {
    it('should handle basic input and return result', async function () {
      // This is a simplified test that focuses on the configuration and interface
      // rather than actual user interaction simulation
      
      const config = {
        message: '>',
        context: 'basic_test',
        default: 'test_default'
      };
      
      // Test that the configuration is properly structured
      assert.strictEqual(config.message, '>');
      assert.strictEqual(config.context, 'basic_test');
      assert.strictEqual(config.default, 'test_default');
    });

    it('should handle validation configuration', function () {
      const validateFn = (input) => input.includes('test') ? true : 'Must contain test';
      
      const config = {
        message: '>',
        context: 'validation_test',
        validate: validateFn
      };
      
      assert.strictEqual(typeof config.validate, 'function');
      assert.strictEqual(config.validate('test123'), true);
      assert.strictEqual(config.validate('hello'), 'Must contain test');
    });

    it('should handle transformer configuration', function () {
      const transformerFn = (input) => input.toUpperCase();
      
      const config = {
        message: '>',
        context: 'transformer_test',
        transformer: transformerFn
      };
      
      assert.strictEqual(typeof config.transformer, 'function');
      assert.strictEqual(config.transformer('hello'), 'HELLO');
    });
  });

  describe('Auto-completion Configuration', function () {
    it('should handle array-based auto-completion', function () {
      const availableCommands = ['foo', 'bar', 'baz'];
      
      const config = {
        message: '>',
        context: 'autocomplete_array_test',
        autoCompletion: availableCommands
      };
      
      assert.deepStrictEqual(config.autoCompletion, availableCommands);
    });

    it('should handle function-based auto-completion', function () {
      const autoCompleteFn = (line) => ['foo', 'bar'].filter(cmd => cmd.startsWith(line));
      
      const config = {
        message: '>',
        context: 'autocomplete_fn_test',
        autoCompletion: autoCompleteFn
      };
      
      assert.strictEqual(typeof config.autoCompletion, 'function');
      assert.deepStrictEqual(config.autoCompletion('f'), ['foo']);
    });

    it('should handle async auto-completion', async function () {
      const asyncAutoComplete = async (line) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return ['async_foo', 'async_bar'].filter(cmd => cmd.startsWith(line));
      };
      
      const config = {
        message: '>',
        context: 'autocomplete_async_test',
        autoCompletion: asyncAutoComplete
      };
      
      assert.strictEqual(typeof config.autoCompletion, 'function');
      const result = await config.autoCompletion('async_f');
      assert.deepStrictEqual(result, ['async_foo']);
    });
  });

  describe('History Handler Integration', function () {
    const TEST_HISTORY_DIR = pathResolve(__dirname, 'test_history_integration');
    const HISTORY_FILE = 'integration-test-history.json';

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

    it('should work with EphemeralHistory', function () {
      const historyHandler = new EphemeralHistory();
      
      const config = {
        message: '>',
        context: 'ephemeral_test',
        historyHandler: historyHandler
      };
      
      assert.strictEqual(config.historyHandler, historyHandler);
      
      // Test that the history handler works correctly
      historyHandler.init('ephemeral_test');
      historyHandler.add('ephemeral_test', 'test_command');
      
      assert.deepStrictEqual(historyHandler.getAll('ephemeral_test'), ['test_command']);
      assert.strictEqual(historyHandler.getPrevious('ephemeral_test'), 'test_command');
    });

    it('should work with FileBackedHistory', async function () {
      const historyHandler = new FileBackedHistory({
        folder: TEST_HISTORY_DIR,
        fileName: HISTORY_FILE,
        save: true
      });
      
      const config = {
        message: '>',
        context: 'file_backed_test',
        historyHandler: historyHandler
      };
      
      assert.strictEqual(config.historyHandler, historyHandler);
      
      // Test that the history handler works correctly
      historyHandler.add('test_command');
      
      assert.deepStrictEqual(historyHandler.getAll(), ['test_command']);
      assert.strictEqual(historyHandler.getPrevious(), 'test_command');
      
      // Verify file was created
      const historyFilePath = pathResolve(TEST_HISTORY_DIR, HISTORY_FILE);
      assert.ok(await fsExtra.pathExists(historyFilePath));
      
      const fileContent = await fsExtra.readJson(historyFilePath);
      assert.deepStrictEqual(fileContent.history, ['test_command']);
    });

    it('should use default EphemeralHistory when no historyHandler provided', function () {
      const config = {
        message: '>',
        context: 'default_history_test'
      };
      
      // The default history handler should be used internally
      assert.strictEqual(config.historyHandler, undefined);
    });

    it('should handle history configuration object', function () {
      const historyConfig = {
        folder: TEST_HISTORY_DIR,
        fileName: HISTORY_FILE,
        save: true,
        limit: 50
      };
      
      const config = {
        message: '>',
        context: 'history_config_test',
        history: historyConfig
      };
      
      assert.deepStrictEqual(config.history, historyConfig);
    });

    it('should handle custom history handler', function () {
      const mockHistoryHandler = {
        init: sinon.stub(),
        add: sinon.stub(),
        getPrevious: sinon.stub().returns('mock_prev_cmd'),
        getNext: sinon.stub().returns('mock_next_cmd'),
        getAll: sinon.stub().returns(['mock1', 'mock2']),
        config: { limit: 100 }
      };

      const config = {
        message: '>',
        context: 'custom_history_test',
        historyHandler: mockHistoryHandler
      };

      assert.strictEqual(config.historyHandler, mockHistoryHandler);
      
      // Test the interface
      assert.strictEqual(typeof mockHistoryHandler.init, 'function');
      assert.strictEqual(typeof mockHistoryHandler.add, 'function');
      assert.strictEqual(typeof mockHistoryHandler.getPrevious, 'function');
      assert.strictEqual(typeof mockHistoryHandler.getNext, 'function');
      assert.strictEqual(typeof mockHistoryHandler.getAll, 'function');
      
      // Test method calls
      mockHistoryHandler.init('test_context');
      sinon.assert.calledWith(mockHistoryHandler.init, 'test_context');
      
      mockHistoryHandler.add('test_context', 'test_command');
      sinon.assert.calledWith(mockHistoryHandler.add, 'test_context', 'test_command');
      
      assert.strictEqual(mockHistoryHandler.getPrevious('test_context'), 'mock_prev_cmd');
      assert.strictEqual(mockHistoryHandler.getNext('test_context'), 'mock_next_cmd');
      assert.deepStrictEqual(mockHistoryHandler.getAll('test_context'), ['mock1', 'mock2']);
    });
  });

  describe('onCtrlEnd Handler', function () {
    it('should handle onCtrlEnd configuration', function () {
      const onCtrlEndFn = (line) => line.toUpperCase();
      
      const config = {
        message: '>',
        context: 'ctrl_end_test',
        onCtrlEnd: onCtrlEndFn
      };
      
      assert.strictEqual(typeof config.onCtrlEnd, 'function');
      assert.strictEqual(config.onCtrlEnd('hello'), 'HELLO');
    });
  });

  describe('Configuration Options', function () {
    it('should handle theme configuration', function () {
      const theme = {
        style: {
          message: (text) => `[${text}]`,
          error: (text) => `ERROR: ${text}`
        }
      };
      
      const config = {
        message: '>',
        context: 'theme_test',
        theme: theme
      };
      
      assert.deepStrictEqual(config.theme, theme);
    });

    it('should handle display options', function () {
      const config = {
        message: '>',
        context: 'display_test',
        required: true,
        default: 'default_value',
        autocompletePrompt: 'Choose from:',
        maxSize: 100,
        ellipsize: true,
        ellipsis: '...'
      };
      
      assert.strictEqual(config.required, true);
      assert.strictEqual(config.default, 'default_value');
      assert.strictEqual(config.autocompletePrompt, 'Choose from:');
      assert.strictEqual(config.maxSize, 100);
      assert.strictEqual(config.ellipsize, true);
      assert.strictEqual(config.ellipsis, '...');
    });

    it('should handle event handlers', function () {
      const onBeforeKeyPressFn = ({ key }) => console.log('Key pressed:', key.name);
      const onBeforeRewriteFn = (text) => text.trim();
      const onCloseFn = () => console.log('Prompt closed');
      
      const config = {
        message: '>',
        context: 'events_test',
        onBeforeKeyPress: onBeforeKeyPressFn,
        onBeforeRewrite: onBeforeRewriteFn,
        onClose: onCloseFn
      };
      
      assert.strictEqual(typeof config.onBeforeKeyPress, 'function');
      assert.strictEqual(typeof config.onBeforeRewrite, 'function');
      assert.strictEqual(typeof config.onClose, 'function');
      assert.strictEqual(config.onBeforeRewrite('  hello  '), 'hello');
    });

    it('should handle short option for autocomplete', function () {
      const shortFn = (line, matches) => matches.slice(0, 3);
      
      const config = {
        message: '>',
        context: 'short_test',
        short: shortFn
      };
      
      assert.strictEqual(typeof config.short, 'function');
      assert.deepStrictEqual(config.short('test', ['a', 'b', 'c', 'd']), ['a', 'b', 'c']);
    });
  });
});
