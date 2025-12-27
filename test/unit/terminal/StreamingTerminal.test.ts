import assert from 'assert';
import StreamingTerminal from '../../../src/terminal/StreamingTerminal.ts';

describe('StreamingTerminal', () => {
  describe('basic functionality', () => {
    it('should emit lines on newline', () => {
      const terminal = new StreamingTerminal();
      terminal.write('hello world');
      const line = terminal.renderLine();
      assert.strictEqual(line, 'hello world');

      const state = terminal.write('\n');
      assert.strictEqual(state.hadNewline, true);
    });

    it('should handle carriage return', () => {
      const terminal = new StreamingTerminal();
      terminal.write('hello');
      const state = terminal.write('\r');

      assert.strictEqual(state.hadCarriageReturn, true);
      assert.strictEqual(terminal.getCursor(), 0);
    });

    it('should handle carriage return overwriting (progress bars)', () => {
      const terminal = new StreamingTerminal();
      terminal.write('Progress: 10%\r');
      terminal.write('Progress: 50%\r');
      terminal.write('Progress: 100%\n');

      const line = terminal.renderLine();
      assert.strictEqual(line, 'Progress: 100%');
    });
  });

  describe('SGR composition (Bug #1 fix)', () => {
    it('should compose multiple SGR sequences', () => {
      const terminal = new StreamingTerminal();
      terminal.write('\x1b[31m'); // Red
      terminal.write('\x1b[1m'); // Bold
      terminal.write('text\n');

      const line = terminal.renderLine();
      // Should have both red and bold
      assert.ok(line.indexOf('text') !== -1);
      assert.ok(line.indexOf('\x1b[') !== -1);
    });

    it('should preserve colors with carriage return overwrite', () => {
      const terminal = new StreamingTerminal();
      terminal.write('\x1b[31mRed1234\r');
      terminal.write('\x1b[32mGr\n');

      const line = terminal.renderLine();
      // Green should overwrite first 2 chars, red should remain for rest
      assert.ok(line.indexOf('Gr') !== -1);
    });

    it('should carry colors across lines', () => {
      const terminal = new StreamingTerminal();
      terminal.write('\x1b[31mred line\n');
      const line1 = terminal.renderLine();
      terminal.reset();

      terminal.write('still red\n');
      const line2 = terminal.renderLine();

      assert.ok(line1.indexOf('\x1b[31m') !== -1);
      assert.ok(line2.indexOf('\x1b[31m') !== -1);
    });

    it('should reset colors with SGR 0', () => {
      const terminal = new StreamingTerminal();
      terminal.write('\x1b[31mred\x1b[0mnormal\n');

      const line = terminal.renderLine();
      assert.ok(line.indexOf('\x1b[31m') !== -1);
      assert.ok(line.indexOf('\x1b[0m') !== -1);
    });
  });

  describe('cursor save/restore (Bug #2 fix)', () => {
    it('should save and restore cursor with CSI s/u', () => {
      const terminal = new StreamingTerminal();
      terminal.write('ABC');
      terminal.write('\x1b[s'); // Save at position 3
      terminal.write('DEF');
      terminal.write('\x1b[u'); // Restore to position 3
      terminal.write('XYZ\n');

      const line = terminal.renderLine();
      assert.strictEqual(line, 'ABCXYZ');
    });

    it('should save and restore cursor with ESC 7/8', () => {
      const terminal = new StreamingTerminal();
      terminal.write('ABC');
      terminal.write('\x1b7'); // Save at position 3
      terminal.write('DEF');
      terminal.write('\x1b8'); // Restore to position 3
      terminal.write('XYZ\n');

      const line = terminal.renderLine();
      assert.strictEqual(line, 'ABCXYZ');
    });
  });

  describe('cursor movement', () => {
    it('should handle cursor horizontal absolute (CSI G)', () => {
      const terminal = new StreamingTerminal();
      terminal.write('ABCDEFGH');
      terminal.write('\x1b[4G'); // Move to column 4 (index 3)
      terminal.write('XX\n');

      const line = terminal.renderLine();
      assert.strictEqual(line, 'ABCXXFGH');
    });

    it('should handle horizontal position absolute (CSI `)', () => {
      const terminal = new StreamingTerminal();
      terminal.write('ABCDEFGH');
      terminal.write('\x1b[4`'); // Move to column 4 (index 3)
      terminal.write('YY\n');

      const line = terminal.renderLine();
      assert.strictEqual(line, 'ABCYYFGH');
    });

    it('should handle cursor forward (CSI C)', () => {
      const terminal = new StreamingTerminal();
      terminal.write('AB');
      terminal.write('\x1b[3C'); // Move forward 3
      terminal.write('XX\n');

      const line = terminal.renderLine();
      assert.strictEqual(line, 'AB   XX');
    });

    it('should handle cursor back (CSI D)', () => {
      const terminal = new StreamingTerminal();
      terminal.write('ABCDEF');
      terminal.write('\x1b[3D'); // Move back 3
      terminal.write('XX\n');

      const line = terminal.renderLine();
      assert.strictEqual(line, 'ABCXXF');
    });

    it('should handle backspace', () => {
      const terminal = new StreamingTerminal();
      terminal.write('ABC');
      terminal.write('\x08'); // Backspace
      terminal.write('X\n');

      const line = terminal.renderLine();
      assert.strictEqual(line, 'ABX');
    });

    it('should handle tab', () => {
      const terminal = new StreamingTerminal();
      terminal.write('A');
      terminal.write('\t');
      terminal.write('B\n');

      const line = terminal.renderLine();
      // Tab moves to next 8-column boundary
      assert.strictEqual(line.length, 9); // 1 + 7 spaces + 1
    });
  });

  describe('line erasing', () => {
    it('should erase from cursor to end (CSI 0K)', () => {
      const terminal = new StreamingTerminal();
      terminal.write('ABCDEFGH');
      terminal.write('\x1b[4G'); // Move to column 4
      terminal.write('\x1b[K\n'); // Erase to end

      const line = terminal.renderLine();
      assert.strictEqual(line, 'ABC');
    });

    it('should erase from start to cursor (CSI 1K)', () => {
      const terminal = new StreamingTerminal();
      terminal.write('ABCDEFGH');
      terminal.write('\x1b[5G'); // Move to column 5 (index 4)
      terminal.write('\x1b[1K\n'); // Erase from start to cursor (inclusive)

      const line = terminal.renderLine();
      // Erases positions 0-4 (ABCDE), leaving FGH at positions 5-7
      assert.strictEqual(line, '     FGH');
    });

    it('should erase entire line (CSI 2K)', () => {
      const terminal = new StreamingTerminal();
      terminal.write('ABCDEFGH');
      terminal.write('\x1b[2K'); // Erase entire line
      terminal.write('new\n');

      const line = terminal.renderLine();
      assert.strictEqual(line, 'new');
    });

    it('should erase characters (CSI X)', () => {
      const terminal = new StreamingTerminal();
      terminal.write('ABCDEFGH');
      terminal.write('\x1b[4G'); // Move to column 4
      terminal.write('\x1b[2X\n'); // Erase 2 characters

      const line = terminal.renderLine();
      assert.strictEqual(line, 'ABC  FGH');
    });
  });

  describe('incomplete sequences across chunks', () => {
    it('should handle incomplete CSI sequence', () => {
      const terminal = new StreamingTerminal();
      terminal.write('text\x1b[3'); // Incomplete
      terminal.write('1mred\n'); // Complete

      const line = terminal.renderLine();
      assert.ok(line.indexOf('red') !== -1);
      assert.ok(line.indexOf('\x1b[31m') !== -1);
    });

    it('should handle ESC at end of chunk', () => {
      const terminal = new StreamingTerminal();
      terminal.write('text\x1b'); // Just ESC
      terminal.write('[32mgreen\n'); // Complete

      const line = terminal.renderLine();
      assert.ok(line.indexOf('green') !== -1);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle npm-style progress', () => {
      const terminal = new StreamingTerminal();
      terminal.write('⠋ Installing...\r');
      terminal.write('⠙ Installing...\r');
      terminal.write('⠹ Installing...\r');
      terminal.write('✓ Installed!   \n');

      const line = terminal.renderLine();
      assert.strictEqual(line, '✓ Installed!');
    });

    it('should handle colored output with progress', () => {
      const terminal = new StreamingTerminal();
      terminal.write('\x1b[32m✓\x1b[0m Building... \r');
      terminal.write('\x1b[32m✓\x1b[0m Build complete!\n');

      const line = terminal.renderLine();
      assert.ok(line.indexOf('✓') !== -1);
      assert.ok(line.indexOf('Build complete!') !== -1);
    });
  });
});
