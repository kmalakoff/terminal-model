import type { SgrAttributes } from './ansi/types.ts';

/**
 * SGR (Select Graphic Rendition) composer
 * Parses SGR parameters, composes attributes, and generates ANSI sequences
 * Fixes Bug #1: Properly composes attributes instead of saving entire sequence string
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Utility class with related ANSI parsing methods
export class SgrComposer {
  private static readonly ESC = '\x1b';

  /**
   * Parse SGR parameters into attribute object
   */
  static parse(params: number[]): SgrAttributes {
    const attrs: SgrAttributes = {};
    let i = 0;

    while (i < params.length) {
      const p = params[i];

      if (p === 0) {
        // Reset all - return empty attributes
        return {};
      }
      if (p === 1) {
        attrs.bold = true;
      } else if (p === 2) {
        attrs.dim = true;
      } else if (p === 3) {
        attrs.italic = true;
      } else if (p === 4) {
        attrs.underline = true;
      } else if (p === 5) {
        attrs.blink = true;
      } else if (p === 7) {
        attrs.inverse = true;
      } else if (p === 8) {
        attrs.hidden = true;
      } else if (p === 9) {
        attrs.strikethrough = true;
      } else if (p === 22) {
        // Not bold or dim
        attrs.bold = false;
        attrs.dim = false;
      } else if (p === 23) {
        attrs.italic = false;
      } else if (p === 24) {
        attrs.underline = false;
      } else if (p === 25) {
        attrs.blink = false;
      } else if (p === 27) {
        attrs.inverse = false;
      } else if (p === 28) {
        attrs.hidden = false;
      } else if (p === 29) {
        attrs.strikethrough = false;
      } else if (p >= 30 && p <= 37) {
        // Standard foreground colors (0-7)
        attrs.fg = p - 30;
      } else if (p === 38) {
        // 256-color or RGB foreground
        if (params[i + 1] === 5 && params[i + 2] !== undefined) {
          // 256-color
          attrs.fg = params[i + 2];
          i += 2;
        } else if (params[i + 1] === 2 && params[i + 4] !== undefined) {
          // RGB (encode as single number for simplicity)
          const r = params[i + 2];
          const g = params[i + 3];
          const b = params[i + 4];
          attrs.fg = (r << 16) | (g << 8) | b | 0x1000000; // Flag bit to indicate RGB
          i += 4;
        }
      } else if (p === 39) {
        // Default foreground color
        delete attrs.fg;
      } else if (p >= 40 && p <= 47) {
        // Standard background colors (0-7)
        attrs.bg = p - 40;
      } else if (p === 48) {
        // 256-color or RGB background
        if (params[i + 1] === 5 && params[i + 2] !== undefined) {
          // 256-color
          attrs.bg = params[i + 2];
          i += 2;
        } else if (params[i + 1] === 2 && params[i + 4] !== undefined) {
          // RGB
          const r = params[i + 2];
          const g = params[i + 3];
          const b = params[i + 4];
          attrs.bg = (r << 16) | (g << 8) | b | 0x1000000;
          i += 4;
        }
      } else if (p === 49) {
        // Default background color
        delete attrs.bg;
      } else if (p >= 90 && p <= 97) {
        // Bright foreground colors (8-15)
        attrs.fg = p - 90 + 8;
      } else if (p >= 100 && p <= 107) {
        // Bright background colors (8-15)
        attrs.bg = p - 100 + 8;
      }

      i++;
    }

    return attrs;
  }

  /**
   * Compose attributes - new attributes override old ones
   */
  static compose(base: SgrAttributes, overlay: SgrAttributes): SgrAttributes {
    return { ...base, ...overlay };
  }

  /**
   * Generate ANSI SGR sequence from attributes
   * Returns empty string if no attributes
   */
  static toSequence(attrs: SgrAttributes): string {
    const codes: number[] = [];

    // Attributes
    if (attrs.bold) codes.push(1);
    if (attrs.dim) codes.push(2);
    if (attrs.italic) codes.push(3);
    if (attrs.underline) codes.push(4);
    if (attrs.blink) codes.push(5);
    if (attrs.inverse) codes.push(7);
    if (attrs.hidden) codes.push(8);
    if (attrs.strikethrough) codes.push(9);

    // Foreground color
    if (attrs.fg !== undefined) {
      if (attrs.fg & 0x1000000) {
        // RGB
        const r = (attrs.fg >> 16) & 0xff;
        const g = (attrs.fg >> 8) & 0xff;
        const b = attrs.fg & 0xff;
        codes.push(38, 2, r, g, b);
      } else if (attrs.fg < 8) {
        // Standard colors
        codes.push(30 + attrs.fg);
      } else if (attrs.fg < 16) {
        // Bright colors
        codes.push(90 + (attrs.fg - 8));
      } else {
        // 256-color
        codes.push(38, 5, attrs.fg);
      }
    }

    // Background color
    if (attrs.bg !== undefined) {
      if (attrs.bg & 0x1000000) {
        // RGB
        const r = (attrs.bg >> 16) & 0xff;
        const g = (attrs.bg >> 8) & 0xff;
        const b = attrs.bg & 0xff;
        codes.push(48, 2, r, g, b);
      } else if (attrs.bg < 8) {
        // Standard colors
        codes.push(40 + attrs.bg);
      } else if (attrs.bg < 16) {
        // Bright colors
        codes.push(100 + (attrs.bg - 8));
      } else {
        // 256-color
        codes.push(48, 5, attrs.bg);
      }
    }

    if (codes.length === 0) return '';
    return `${SgrComposer.ESC}[${codes.join(';')}m`;
  }

  /**
   * Reset to empty attributes
   */
  static reset(): SgrAttributes {
    return {};
  }

  /**
   * Check if two SGR attributes are equal
   */
  static equals(a: SgrAttributes, b: SgrAttributes): boolean {
    return a.fg === b.fg && a.bg === b.bg && a.bold === b.bold && a.dim === b.dim && a.italic === b.italic && a.underline === b.underline && a.blink === b.blink && a.inverse === b.inverse && a.hidden === b.hidden && a.strikethrough === b.strikethrough;
  }

  /**
   * Check if attributes object is empty (no styling)
   */
  static isEmpty(attrs: SgrAttributes): boolean {
    return Object.keys(attrs).length === 0;
  }
}
