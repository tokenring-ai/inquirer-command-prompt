import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import sinon from 'sinon';
import fsExtra from 'fs-extra';
import { render } from '@inquirer/testing'; // Removed Key
import commandPrompt from '../index.js';
import DefaultHistory from '../DefaultHistory.js';

// const __filename = fileURLToPath(import.meta.url); // Unused
const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimalistic helper to get the last line of output
function getLastLine(output) {
  const lines = output.trim().split('\n');
  return lines[lines.length - 1];
}

// Helper to get the input line (part after the prompt message)
function getInputLine(output, message = '>') {
  const lastLine = getLastLine(output);
  // Find the message, then take the substring after it.
  // This is a simplification; robust parsing might be needed if message varies a lot or has ANSI.
  const messageIndex = lastLine.lastIndexOf(message);
  if (messageIndex !== -1) {
    return lastLine.substring(messageIndex + message.length).trim();
  }
  return lastLine.trim(); // Fallback if message not found as expected
}


describe('inquirer-command-prompt', function () {
  // No global prompt or rl needed here anymore, will be managed per test by @inquirer/testing

  describe('auto-complete', function () {
    let availableCommands;

    beforeEach(function () {
      availableCommands = ['foo', 'bar', 'bum'];
      // rl = new ReadlineStub(); // Removed
    });

    it('should return the expected word if that is partially typed', async function () {
      const { answer, events, getScreen } = await render(commandPrompt, {
        message: '>',
        autoCompletion: availableCommands,
        context: 'autocomplete_test_1'
      });

      await events.type('f');
      await events.keypress('tab');
      // Check screen before enter
      assert.ok(getScreen().includes('> foo'), 'Output should show completed "foo" before enter');
      await events.keypress('enter');

      // @inquirer/testing `answer` is a promise for the final submitted value.
      assert.strictEqual(await answer, 'foo');
    });

    it('should return the typed word if tab not pressed', async function () {
      const { answer, events } = await render(commandPrompt, {
        message: '>',
        context: 'autocomplete_test_2'
        // No autoCompletion needed for this test
      });
      await events.type('hello');
      await events.keypress('enter');
      assert.strictEqual(await answer, 'hello');
    });

    it('should return the typed word if tab pressed but no matches', async function () {
      const { answer, events, getScreen } = await render(commandPrompt, {
        message: '>',
        autoCompletion: availableCommands,
        context: 'autocomplete_test_3'
      });
      await events.type('zu');
      await events.keypress('tab');
      // Check the state of the input line *before* pressing enter
       assert.ok(getScreen().includes('> zu'), 'Output should show "zu" after tab with no match');
      await events.keypress('enter');
      assert.strictEqual(await answer, 'zu');
    });
  });

  describe('CommandPrompt History (Integration)', function () {
    const TEST_HISTORY_DIR = pathResolve(__dirname, 'test_history_files');
    const COMMAND_PROMPT_HISTORY_FILE = 'cmd-prompt-test-hist.json';

    beforeEach(async function () {
      // rl = new ReadlineStub(); // Removed
      await fsExtra.ensureDir(TEST_HISTORY_DIR);
      const historyFilePath = pathResolve(TEST_HISTORY_DIR, COMMAND_PROMPT_HISTORY_FILE);
      if (await fsExtra.pathExists(historyFilePath)) {
        await fsExtra.remove(historyFilePath);
      }
    });

    afterEach(async function () {
      sinon.restore(); // Restores stubs/spies
      const historyFilePath = pathResolve(TEST_HISTORY_DIR, COMMAND_PROMPT_HISTORY_FILE);
      if (await fsExtra.pathExists(historyFilePath)) {
        // Optional: clean up specific test file if needed, or rely on beforeEach
        // await fsExtra.remove(historyFilePath);
      }
      // Clean up the entire test history directory if it's specific to these tests
      if (await fsExtra.pathExists(TEST_HISTORY_DIR)) {
        // await fsExtra.remove(TEST_HISTORY_DIR); // Be cautious if other tests might use it
      }
    });

    it('should navigate command history with up and down arrows', async function () {
      const promptConfigBase = {
        message: '>',
        context: 'hist_nav_test',
        history: { folder: TEST_HISTORY_DIR, fileName: COMMAND_PROMPT_HISTORY_FILE, save: true }
      };

      // Prompt 1
      let renderResult = await render(commandPrompt, promptConfigBase);
      await renderResult.events.type('cmd1');
      await renderResult.events.keypress('enter');
      assert.strictEqual(await renderResult.answer, 'cmd1', 'Prompt 1 answer should be cmd1');

      // Prompt 2
      renderResult = await render(commandPrompt, promptConfigBase);
      await renderResult.events.type('cmd2');
      await renderResult.events.keypress('enter');
      assert.strictEqual(await renderResult.answer, 'cmd2', 'Prompt 2 answer should be cmd2');

      // Prompt 3 (for navigation and final submission)
      let { answer: answer3, events: events3, getScreen: getScreen3 } = await render(commandPrompt, promptConfigBase);

      await events3.keypress('up');
      assert.strictEqual(getInputLine(getScreen3(), '>'), 'cmd2', 'Nav up to cmd2');

      await events3.keypress('up');
      console.log('Screen after second UP:\n', getScreen3()); // DEBUG
      assert.strictEqual(getInputLine(getScreen3(), '>'), 'cmd1', 'Nav up to cmd1');

      await events3.keypress('up'); // Try to go beyond the oldest
      assert.strictEqual(getInputLine(getScreen3(), '>'), 'cmd1', 'Stay at cmd1 (top)');

      await events3.keypress('down');
      assert.strictEqual(getInputLine(getScreen3(), '>'), 'cmd2', 'Nav down to cmd2');

      await events3.keypress('down'); // Should go to new empty line
      assert.strictEqual(getInputLine(getScreen3(), '>'), '', 'Nav down to new empty line');

      await events3.keypress('down'); // Try to go beyond the newest (empty line)
      assert.strictEqual(getInputLine(getScreen3(), '>'), '', 'Stay at empty line');

      await events3.type('cmd3');
      await events3.keypress('enter');
      assert.strictEqual(await answer3, 'cmd3', 'Final command submitted should be cmd3');
    });

    it('should add submitted commands to history and save them (respecting limit)', async function () {
      const promptConfig = {
        message: '>',
        context: 'hist_add_save_test',
        history: { folder: TEST_HISTORY_DIR, fileName: COMMAND_PROMPT_HISTORY_FILE, save: true, limit: 2 }
      };
       // let historyHandlerInstance; // Unused after refactor to check file

      // Command 1
      let renderResult = await render(commandPrompt, {
        ...promptConfig,
        // Hacky way to get historyHandler instance for assertions later.
        // In a real scenario, you might not need to inspect DefaultHistory directly this way
        // if you trust its unit tests.
        historyHandler: new DefaultHistory(promptConfig.history),
      });
       // historyHandlerInstance = renderResult.answer.prompt.historyHandler; // Access internal for test - not needed with file check
      await renderResult.events.type('first');
      await renderResult.events.keypress('enter');
      assert.strictEqual(await renderResult.answer, 'first');

      // Command 2
      renderResult = await render(commandPrompt, promptConfig);
      await renderResult.events.type('second');
      await renderResult.events.keypress('enter');
      assert.strictEqual(await renderResult.answer, 'second');

      // Command 3
      renderResult = await render(commandPrompt, promptConfig);
      await renderResult.events.type('third');
      await renderResult.events.keypress('enter');
      assert.strictEqual(await renderResult.answer, 'third');

      // Assertions on historyHandlerInstance (which should be the one used by the last prompt)
      // This relies on DefaultHistory being somewhat singleton per context if not careful,
      // or that each prompt gets its own but they share the same file.
      // For this test, we assume DefaultHistory correctly manages the file based on its config.
      // We'll load a fresh DefaultHistory instance to check file content for simplicity.
      const checkHistory = new DefaultHistory(promptConfig.history);
      checkHistory.load(); // Load from file
      assert.deepStrictEqual(checkHistory.getAll('hist_add_save_test'), ['second', 'third'], 'History should respect limit');

      const historyFilePath = pathResolve(TEST_HISTORY_DIR, COMMAND_PROMPT_HISTORY_FILE);
      const fileContent = await fsExtra.readJson(historyFilePath);
      assert.deepStrictEqual(fileContent.histories['hist_add_save_test'], ['second', 'third'], 'Saved history should respect limit');
    });

    // This test checks the DefaultHistory's config merging, which is more of a unit test for DefaultHistory
    // or how commandPrompt passes options. It's not purely an integration test of user interaction.
    // The original test was not using `setGlobalConfig` but checking constructor options.
    it('DefaultHistory should correctly receive and use history configuration', function() {
      const historyConfig = {
        limit: 3,
        folder: TEST_HISTORY_DIR,
        fileName: 'specific-cfg-test.json', // Use a unique filename to avoid conflicts
        save: false,
        blacklist: ['ignored']
      };
      const historyHandler = new DefaultHistory(historyConfig);

      assert.strictEqual(historyHandler.config.limit, 3, 'Limit should be set from config');
      assert.deepStrictEqual(historyHandler.config.blacklist, ['ignored'], 'Blacklist should be set');
      assert.strictEqual(historyHandler.config.folder, TEST_HISTORY_DIR, 'Folder should be set');
      assert.strictEqual(historyHandler.config.fileName, 'specific-cfg-test.json', 'Filename should be set');
      assert.strictEqual(historyHandler.config.save, false, 'Save should be set to false');
    });

    it('should display history with Shift+Right Arrow', async function() {
      const promptConfig = {
        message: '>',
        context: 'hist_display_test',
        history: { folder: TEST_HISTORY_DIR, fileName: COMMAND_PROMPT_HISTORY_FILE, save: true } // Save must be true for items to be added
      };

      let r = await render(commandPrompt, promptConfig);
      let renderResult1 = await render(commandPrompt, promptConfig);
      await renderResult1.events.type('cmd1'); await renderResult1.events.keypress('enter');
      assert.strictEqual(await renderResult1.answer, 'cmd1');

      let renderResult2 = await render(commandPrompt, promptConfig);
      await renderResult2.events.type('cmd2'); await renderResult2.events.keypress('enter');
      assert.strictEqual(await renderResult2.answer, 'cmd2');

      let { answer: answer3, events: events3, getScreen: getScreen3 } = await render(commandPrompt, promptConfig);
      // Press Shift+Right Arrow
      await events3.keypress('right', { shift: true });

      // Assertions on the output
      const screenOutput = getScreen3();
      console.log('Screen after Shift+Right:\n', screenOutput); // DEBUG
      assert.ok(screenOutput.includes('History:'), 'Should display history title');
      assert.ok(screenOutput.match(/0\s+cmd1/), 'Should display cmd1 in history');
      assert.ok(screenOutput.match(/1\s+cmd2/), 'Should display cmd2 in history');

      await events3.type('final');
      await events3.keypress('enter');
      assert.strictEqual(await answer3, 'final');
    });

    it('allows passing a custom history handler', async function () {
      const mockHistoryHandler = {
        init: sinon.stub(),
        add: sinon.stub(),
        getPrevious: sinon.stub().returns('mock_prev_cmd'),
        getNext: sinon.stub().returns('mock_next_cmd'),
        getAll: sinon.stub().returns(['mock1', 'mock2']),
        // Add setConfig if DefaultHistory's constructor signature implies it might be called
        // or if the prompt logic tries to call it. For DefaultHistory, it's not called by prompt.
      };

      const { answer, events, getScreen } = await render(commandPrompt, {
        message: '>',
        context: 'custom_hist_test',
        historyHandler: mockHistoryHandler,
        // history: { customSetting: true } // This config would be passed to DefaultHistory if historyHandler wasn't provided
      });

      // Asserting behavior resulting from the custom handler:
      sinon.assert.calledWith(mockHistoryHandler.init, 'custom_hist_test');

      await events.keypress('up');
      assert.strictEqual(getInputLine(getScreen(), '>'), 'mock_prev_cmd');
      sinon.assert.calledOnce(mockHistoryHandler.getPrevious);

      await events.keypress('down');
      assert.strictEqual(getInputLine(getScreen(), '>'), 'mock_next_cmd');
      sinon.assert.calledOnce(mockHistoryHandler.getNext);

      await events.type('new_custom_cmd');
      await events.keypress('enter');

      // The value passed to add would be the line content at the time of enter.
      // After pressing DOWN, line became 'mock_next_cmd'. Then typed 'new_custom_cmd'.
      sinon.assert.calledWith(mockHistoryHandler.add, 'custom_hist_test', 'mock_next_cmdnew_custom_cmd');
      assert.strictEqual(await answer, 'mock_next_cmdnew_custom_cmd');
    });
  });

  describe('DefaultHistory (Unit Tests)', function () {
    let defaultHistoryInstance;
    const TEST_CONTEXT = 'default_hist_unit_ctx';
    const HISTORY_DIR_UNIT = pathResolve(__dirname, 'default_history_unit_files');
    const HISTORY_FILE_UNIT = 'unit-test-hist.json';
    const FULL_HISTORY_PATH_UNIT = pathResolve(HISTORY_DIR_UNIT, HISTORY_FILE_UNIT);

    let fsStubs = {}; // To hold stubs for fs-extra methods

    beforeEach(async function () {
      await fsExtra.ensureDir(HISTORY_DIR_UNIT);

      // Stub methods on fsExtra module itself before creating DefaultHistory instance
      fsStubs.existsSync = sinon.stub(fsExtra, 'existsSync');
      fsStubs.readFileSync = sinon.stub(fsExtra, 'readFileSync');
      fsStubs.writeFileSync = sinon.stub(fsExtra, 'writeFileSync');
      fsStubs.ensureDirSync = sinon.stub(fsExtra, 'ensureDirSync');

      defaultHistoryInstance = new DefaultHistory({
        folder: HISTORY_DIR_UNIT,
        fileName: HISTORY_FILE_UNIT,
        save: false
      });
      defaultHistoryInstance.init(TEST_CONTEXT);
    });

    afterEach(async function () {
      sinon.restore();
      if (await fsExtra.pathExists(HISTORY_DIR_UNIT)) {
        await fsExtra.remove(HISTORY_DIR_UNIT);
      }
    });

    it('should add a command and reset index correctly', function () {
      defaultHistoryInstance.add(TEST_CONTEXT, 'cmd1');
      assert.deepStrictEqual(defaultHistoryInstance.getAll(TEST_CONTEXT), ['cmd1']);
      assert.strictEqual(defaultHistoryInstance.historyIndexes[TEST_CONTEXT], 1, 'Index should be at new line pos');
    });

    it('should not add duplicate of the immediate last command', function () {
      defaultHistoryInstance.add(TEST_CONTEXT, 'cmd1');
      defaultHistoryInstance.add(TEST_CONTEXT, 'cmd1'); // Attempt to add duplicate
      assert.deepStrictEqual(defaultHistoryInstance.getAll(TEST_CONTEXT), ['cmd1'], 'Should not add consecutive duplicate');
      assert.strictEqual(defaultHistoryInstance.historyIndexes[TEST_CONTEXT], 1);
    });

    it('should navigate history correctly with getPrevious and getNext', function () {
      defaultHistoryInstance.add(TEST_CONTEXT, 'c1');
      defaultHistoryInstance.add(TEST_CONTEXT, 'c2');
      defaultHistoryInstance.add(TEST_CONTEXT, 'c3'); // History: [c1, c2, c3], index = 3
      assert.strictEqual(defaultHistoryInstance.getPrevious(TEST_CONTEXT), 'c3', 'Prev: c3'); // index = 2
      assert.strictEqual(defaultHistoryInstance.getPrevious(TEST_CONTEXT), 'c2', 'Prev: c2'); // index = 1, returns hist[1]
      assert.strictEqual(defaultHistoryInstance.getPrevious(TEST_CONTEXT), 'c1', 'Prev: c1'); // index = 0, returns hist[0]
      assert.strictEqual(defaultHistoryInstance.getPrevious(TEST_CONTEXT), undefined, 'Prev: undefined (at top)'); // index stays 0

      // Current state: index = 0 (pointing at 'c1')
      assert.strictEqual(defaultHistoryInstance.historyIndexes[TEST_CONTEXT], 0, 'Index should be 0 before getNext sequence');
      assert.strictEqual(defaultHistoryInstance.getNext(TEST_CONTEXT), 'c2', 'Next after c1 should be c2'); // index becomes 1, returns hist[1]
      assert.strictEqual(defaultHistoryInstance.historyIndexes[TEST_CONTEXT], 1, 'Index should be 1 after getNext');
      assert.strictEqual(defaultHistoryInstance.getNext(TEST_CONTEXT), 'c3', 'Next after c2 should be c3'); // index becomes 2, returns hist[2]
      assert.strictEqual(defaultHistoryInstance.historyIndexes[TEST_CONTEXT], 2, 'Index should be 2 after getNext');
      assert.strictEqual(defaultHistoryInstance.getNext(TEST_CONTEXT), undefined, 'Next after c3 should be undefined (new line)');// index becomes 3 (length)
      assert.strictEqual(defaultHistoryInstance.historyIndexes[TEST_CONTEXT], 3, 'Index should be 3 (length) at end');
    });

    it('should respect history limit when adding commands', function () {
      defaultHistoryInstance.setConfig({ limit: 2 });
      defaultHistoryInstance.add(TEST_CONTEXT, 'cmd1');
      defaultHistoryInstance.add(TEST_CONTEXT, 'cmd2');
      defaultHistoryInstance.add(TEST_CONTEXT, 'cmd3'); // cmd1 should be removed
      assert.deepStrictEqual(defaultHistoryInstance.getAll(TEST_CONTEXT), ['cmd2', 'cmd3'], 'Limit should remove oldest');
    });

    it('should not add blacklisted commands to history', function () {
      defaultHistoryInstance.setConfig({ blacklist: ['clear', 'exit'] });
      defaultHistoryInstance.add(TEST_CONTEXT, 'cmd1');
      defaultHistoryInstance.add(TEST_CONTEXT, 'clear'); // This should be ignored
      defaultHistoryInstance.add(TEST_CONTEXT, 'cmd2');
      defaultHistoryInstance.add(TEST_CONTEXT, 'exit'); // This should be ignored
      assert.deepStrictEqual(defaultHistoryInstance.getAll(TEST_CONTEXT), ['cmd1', 'cmd2'], 'Blacklisted commands ignored');
    });

    describe('File Persistence for DefaultHistory Unit Tests', function () {
      it('load() should populate history from file if exists', function () {
        const fakeHistoryData = { histories: { [TEST_CONTEXT]: ['loaded_cmd1', 'loaded_cmd2'] } };
        fsStubs.existsSync.withArgs(FULL_HISTORY_PATH_UNIT).returns(true);
        fsStubs.readFileSync.withArgs(FULL_HISTORY_PATH_UNIT).returns(JSON.stringify(fakeHistoryData));
        fsStubs.ensureDirSync.withArgs(HISTORY_DIR_UNIT).returns(undefined);

        const newHistoryInstance = new DefaultHistory({ folder: HISTORY_DIR_UNIT, fileName: HISTORY_FILE_UNIT, save: true });
        assert.deepStrictEqual(newHistoryInstance.getAll(TEST_CONTEXT), ['loaded_cmd1', 'loaded_cmd2']);
        // ensureDirSync is called by save(), not directly by load().
        // The constructor calls load(). load() does NOT call _ensureHistoryFile() or save().
        // This assertion was incorrect for a load() test.
      });

      it('save() (called via add) should write current history to file', function () {
        fsStubs.ensureDirSync.withArgs(HISTORY_DIR_UNIT).returns(undefined); // For the instance being tested

        const historyToSave = new DefaultHistory({
            folder: HISTORY_DIR_UNIT,
            fileName: HISTORY_FILE_UNIT,
            save: true // Enable saving
        });
        historyToSave.init(TEST_CONTEXT); // init context
        historyToSave.add(TEST_CONTEXT, 'cmd_to_be_saved');

        const expectedData = { histories: { [TEST_CONTEXT]: ['cmd_to_be_saved'] } };
        sinon.assert.calledWith(fsStubs.ensureDirSync, HISTORY_DIR_UNIT);
        sinon.assert.calledWith(fsStubs.writeFileSync, FULL_HISTORY_PATH_UNIT, JSON.stringify(expectedData, null, 2));
      });

      it('load() should handle corrupted JSON file gracefully', function() {
        fsStubs.existsSync.withArgs(FULL_HISTORY_PATH_UNIT).returns(true);
        fsStubs.readFileSync.withArgs(FULL_HISTORY_PATH_UNIT).returns('this is corrupted json');
        const consoleErrorStub = sinon.stub(console, 'error');

        const newHistoryInstance = new DefaultHistory({ folder: HISTORY_DIR_UNIT, fileName: HISTORY_FILE_UNIT, save: true });
        assert.deepStrictEqual(newHistoryInstance.getAll(TEST_CONTEXT), [], 'History should be empty after corrupted load');
        sinon.assert.calledWithMatch(consoleErrorStub, /Invalid or corrupted history file/);
        consoleErrorStub.restore();
      });
    });
  });
});
