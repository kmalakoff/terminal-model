import { stringEndsWith } from '../../compat.ts';
import type { AnsiSequence, ControlSequence, CsiSequence, EscapeSequence, PrintableSequence } from './types.ts';

/**
 * Parser for ANSI escape sequences
 * Detects and extracts ANSI sequences from strings
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Utility class for ANSI sequence parsing
export class AnsiParser {
  private static readonly ESC = '\x1b';
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally parsing ANSI escape sequences
  private static readonly CSI_REGEX = /^\x1b\[([0-9;]*)([A-Za-z`@])/;
  // OSC sequences should not consume newlines - stop at \n, \r, BEL, or ESC
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally parsing ANSI escape sequences
  private static readonly OSC_REGEX = /^\x1b[\]P^_][^\x07\x1b\n\r]*(?:\x07|\x1b\\)?/;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally parsing ANSI escape sequences
  private static readonly ESCAPE_REGEX = /^\x1b([78]|=|>|H|M)/; // Common escape sequences

  /**
   * Parse the next sequence at the given position
   * Returns null if the character should be ignored
   */
  static parseNext(str: string, pos: number): AnsiSequence | null {
    const char = str[pos];

    // Control characters
    if (char === '\n' || char === '\r' || char === '\t' || char === '\x08') {
      return {
        type: 'control',
        length: 1,
        data: char,
      } as ControlSequence;
    }

    // Escape sequences
    if (char === AnsiParser.ESC) {
      // Try CSI (ESC [)
      if (str[pos + 1] === '[') {
        const remaining = str.slice(pos);
        const csiMatch = remaining.match(AnsiParser.CSI_REGEX);
        if (csiMatch) {
          return {
            type: 'csi',
            length: csiMatch[0].length,
            data: {
              params: csiMatch[1],
              cmd: csiMatch[2],
              raw: csiMatch[0],
            },
          } as CsiSequence;
        }
      }

      // Try OSC and other escape sequences
      const remaining = str.slice(pos);
      const oscMatch = remaining.match(AnsiParser.OSC_REGEX);
      if (oscMatch) {
        // OSC sequences - discard them (title, etc.)
        return {
          type: 'escape',
          length: oscMatch[0].length,
          data: oscMatch[0],
        } as EscapeSequence;
      }

      // Try simple escape sequences (ESC 7, ESC 8, etc.)
      const escMatch = remaining.match(AnsiParser.ESCAPE_REGEX);
      if (escMatch) {
        return {
          type: 'escape',
          length: escMatch[0].length,
          data: escMatch[1],
        } as EscapeSequence;
      }

      // Unknown escape - skip ESC
      return {
        type: 'escape',
        length: 1,
        data: AnsiParser.ESC,
      } as EscapeSequence;
    }

    // Printable characters (including unicode)
    if (char >= ' ' || char > '\x7f') {
      return {
        type: 'printable',
        length: 1,
        data: char,
      } as PrintableSequence;
    }

    // Other control characters (0x00-0x1F) - ignore
    return null;
  }

  /**
   * Check if a string ends with an incomplete ANSI sequence
   * Returns the incomplete portion that should be buffered
   */
  static getIncompleteSequence(str: string): string {
    // Check for ESC at end
    if (stringEndsWith(str, AnsiParser.ESC)) {
      return AnsiParser.ESC;
    }

    // Check for incomplete CSI sequence (ESC [ followed by digits/semicolons but no command)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally parsing ANSI escape sequences
    const match = str.match(/(\x1b\[[0-9;]*)$/);
    if (match) {
      return match[1];
    }

    return '';
  }
}
