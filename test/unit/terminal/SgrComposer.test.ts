import assert from 'assert';
import { SgrComposer } from '../../../src/terminal/SgrComposer.ts';

describe('SgrComposer', () => {
  describe('parse', () => {
    it('should parse bold', () => {
      const attrs = SgrComposer.parse([1]);
      assert.strictEqual(attrs.bold, true);
    });

    it('should parse colors', () => {
      const attrs = SgrComposer.parse([31, 42]);
      assert.strictEqual(attrs.fg, 1); // Red (30 + 1)
      assert.strictEqual(attrs.bg, 2); // Green (40 + 2)
    });

    it('should parse bright colors', () => {
      const attrs = SgrComposer.parse([91, 102]);
      assert.strictEqual(attrs.fg, 9); // Bright red (90 + 1, stored as 8 + 1)
      assert.strictEqual(attrs.bg, 10); // Bright green (100 + 2, stored as 8 + 2)
    });

    it('should parse 256-color', () => {
      const attrs = SgrComposer.parse([38, 5, 123]);
      assert.strictEqual(attrs.fg, 123);
    });

    it('should parse RGB color', () => {
      const attrs = SgrComposer.parse([38, 2, 255, 128, 64]);
      assert.ok(attrs.fg !== undefined);
      assert.ok(attrs.fg && attrs.fg & 0x1000000); // RGB flag
    });

    it('should parse multiple attributes', () => {
      const attrs = SgrComposer.parse([1, 3, 4, 31]);
      assert.strictEqual(attrs.bold, true);
      assert.strictEqual(attrs.italic, true);
      assert.strictEqual(attrs.underline, true);
      assert.strictEqual(attrs.fg, 1);
    });

    it('should handle reset (0)', () => {
      const attrs = SgrComposer.parse([0]);
      assert.strictEqual(Object.keys(attrs).length, 0);
    });

    it('should handle color reset (39, 49)', () => {
      const attrs = SgrComposer.parse([31, 39]); // Red then reset
      // After reset, fg should not be present
      assert.strictEqual('fg' in attrs, false);
    });
  });

  describe('compose', () => {
    it('should merge attributes', () => {
      const base = SgrComposer.parse([31]); // Red
      const overlay = SgrComposer.parse([1]); // Bold
      const result = SgrComposer.compose(base, overlay);

      assert.strictEqual(result.fg, 1);
      assert.strictEqual(result.bold, true);
    });

    it('should override attributes', () => {
      const base = SgrComposer.parse([31]); // Red
      const overlay = SgrComposer.parse([32]); // Green
      const result = SgrComposer.compose(base, overlay);

      assert.strictEqual(result.fg, 2); // Green overrides red
    });
  });

  describe('toSequence', () => {
    it('should generate sequence for bold', () => {
      const attrs = { bold: true };
      const seq = SgrComposer.toSequence(attrs);
      assert.strictEqual(seq, '\x1b[1m');
    });

    it('should generate sequence for colors', () => {
      const attrs = { fg: 1, bg: 2 };
      const seq = SgrComposer.toSequence(attrs);
      assert.ok(seq.indexOf('31') !== -1); // Foreground red
      assert.ok(seq.indexOf('42') !== -1); // Background green
    });

    it('should generate sequence for multiple attributes', () => {
      const attrs = { bold: true, italic: true, fg: 1 };
      const seq = SgrComposer.toSequence(attrs);
      assert.ok(seq.indexOf('1') !== -1); // Bold
      assert.ok(seq.indexOf('3') !== -1); // Italic
      assert.ok(seq.indexOf('31') !== -1); // Red
    });

    it('should return empty string for no attributes', () => {
      const seq = SgrComposer.toSequence({});
      assert.strictEqual(seq, '');
    });

    it('should generate 256-color sequence', () => {
      const attrs = { fg: 123 };
      const seq = SgrComposer.toSequence(attrs);
      assert.ok(seq.indexOf('38;5;123') !== -1);
    });
  });

  describe('equals', () => {
    it('should return true for equal attributes', () => {
      const a = { bold: true, fg: 1 };
      const b = { bold: true, fg: 1 };
      assert.strictEqual(SgrComposer.equals(a, b), true);
    });

    it('should return false for different attributes', () => {
      const a = { bold: true };
      const b = { italic: true };
      assert.strictEqual(SgrComposer.equals(a, b), false);
    });

    it('should return true for empty attributes', () => {
      assert.strictEqual(SgrComposer.equals({}, {}), true);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty object', () => {
      assert.strictEqual(SgrComposer.isEmpty({}), true);
    });

    it('should return false for non-empty object', () => {
      assert.strictEqual(SgrComposer.isEmpty({ bold: true }), false);
    });
  });
});
