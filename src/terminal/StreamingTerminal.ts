import { AnsiParser } from './ansi/AnsiParser.ts';
import { CsiHandler } from './ansi/CsiHandler.ts';
import type { Cell, SgrAttributes } from './ansi/types.ts';
import { SgrComposer } from './SgrComposer.ts';

/**
 * Terminal state information returned after each write
 * Used by emission strategies to determine flushing behavior
 */
export interface TerminalState {
  hadNewline: boolean; // \n was encountered
  hadCarriageReturn: boolean; // \r was encountered
  hadCursorMovement: boolean; // CSI cursor commands
  hadErasure: boolean; // CSI erase commands
  cursorPosition: number;
  cellCount: number;
}

/**
 * Streaming terminal emulator
 * Parses ANSI sequences and maintains terminal state for line-based streaming
 * Replaces LineBuffer.ts with proper SGR composition and additional ANSI support
 */
export default class StreamingTerminal {
  private cells: Array<Cell | null> = [];
  private cursor = 0;
  private activeSgr: SgrAttributes = {};
  private savedCursor = 0; // NEW: for CSI s/u cursor save/restore
  private incompleteSequence = ''; // Buffer for sequences split across chunks
  private lineReadyCallback?: () => void; // Callback for immediate line emission

  /**
   * Set callback to be invoked immediately when a line is ready (newline encountered)
   */
  setLineReadyCallback(callback: (() => void) | undefined): void {
    this.lineReadyCallback = callback;
  }

  /**
   * Write data to the terminal
   * Parses ANSI sequences and updates internal state
   * Returns state information for emission strategies
   */
  write(input: string | Buffer): TerminalState {
    let str = typeof input === 'string' ? input : input.toString('utf8');

    // Prepend any incomplete sequence from previous chunk
    if (this.incompleteSequence) {
      str = this.incompleteSequence + str;
      this.incompleteSequence = '';
    }

    const state: TerminalState = {
      hadNewline: false,
      hadCarriageReturn: false,
      hadCursorMovement: false,
      hadErasure: false,
      cursorPosition: this.cursor,
      cellCount: this.cells.length,
    };

    let i = 0;
    while (i < str.length) {
      const seq = AnsiParser.parseNext(str, i);

      if (!seq) {
        // Ignored control character
        i++;
        continue;
      }

      if (seq.type === 'csi') {
        const csiSeq = seq as import('./ansi/types.ts').CsiSequence;
        const csi = CsiHandler.parse(csiSeq.data.params, csiSeq.data.cmd);
        this.applyCsi(csi, state);
      } else if (seq.type === 'escape') {
        const escSeq = seq as import('./ansi/types.ts').EscapeSequence;
        this.applyEscape(escSeq.data, state);
      } else if (seq.type === 'control') {
        const ctrlSeq = seq as import('./ansi/types.ts').ControlSequence;
        this.applyControl(ctrlSeq.data, state);
      } else if (seq.type === 'printable') {
        const printSeq = seq as import('./ansi/types.ts').PrintableSequence;
        this.cells[this.cursor] = { char: printSeq.data, sgr: { ...this.activeSgr } };
        this.cursor++;
      }

      i += seq.length;
    }

    // Check for incomplete sequence at end
    const incomplete = AnsiParser.getIncompleteSequence(str);
    if (incomplete) {
      this.incompleteSequence = incomplete;
    }

    state.cursorPosition = this.cursor;
    state.cellCount = this.cells.length;
    return state;
  }

  /**
   * Apply CSI command to terminal state
   */
  private applyCsi(csi: ReturnType<typeof CsiHandler.parse>, state: TerminalState): void {
    const { command, params } = csi;

    // Track state changes
    if (csi.affects.cursor) state.hadCursorMovement = true;
    if (csi.affects.erasure) state.hadErasure = true;

    switch (command) {
      case 'm': // SGR - Select Graphic Rendition (colors/styles)
        {
          const parsed = SgrComposer.parse(params);
          this.activeSgr = SgrComposer.compose(this.activeSgr, parsed);
        }
        break;

      case 'G': // CHA - Cursor Horizontal Absolute
        {
          const newPos = Math.max(0, (params[0] || 1) - 1);
          this.cursor = newPos;
        }
        break;

      case '`': // HPA - Horizontal Position Absolute (NEW: fixes Bug #2)
        {
          const newPos = Math.max(0, (params[0] || 1) - 1);
          this.cursor = newPos;
        }
        break;

      case 'C': // CUF - Cursor Forward
        this.cursor += params[0] || 1;
        break;

      case 'D': // CUB - Cursor Back
        this.cursor = Math.max(0, this.cursor - (params[0] || 1));
        break;

      case 'K': // EL - Erase in Line
        {
          const mode = params[0] || 0;
          if (mode === 0) {
            // Erase from cursor to end of line
            this.cells.length = this.cursor;
          } else if (mode === 1) {
            // Erase from start to cursor
            for (let j = 0; j <= this.cursor; j++) {
              this.cells[j] = null;
            }
          } else if (mode === 2) {
            // Erase entire line
            this.cells = [];
            this.cursor = 0;
          }
        }
        break;

      case 'X': // ECH - Erase Character
        {
          const count = params[0] || 1;
          for (let j = 0; j < count; j++) {
            this.cells[this.cursor + j] = null;
          }
        }
        break;

      case 'P': // DCH - Delete Character (shift left)
        this.cells.splice(this.cursor, params[0] || 1);
        break;

      case '@': // ICH - Insert Character (shift right)
        {
          const count = params[0] || 1;
          const blanks = new Array(count).fill(null);
          this.cells.splice(this.cursor, 0, ...blanks);
        }
        break;

      case 's': // Save cursor (NEW: fixes Bug #2)
        this.savedCursor = this.cursor;
        break;

      case 'u': // Restore cursor (NEW: fixes Bug #2)
        this.cursor = this.savedCursor;
        break;

      // Multi-line sequences - ignore (incompatible with streaming)
      case 'A': // CUU - Cursor Up
      case 'B': // CUD - Cursor Down
      case 'H': // CUP - Cursor Position
      case 'f': // HVP - Horizontal Vertical Position
      case 'J': // ED - Erase in Display
      case 'S': // SU - Scroll Up
      case 'T': // SD - Scroll Down
      case 'L': // IL - Insert Line
      case 'M': // DL - Delete Line
        // Ignore - incompatible with line-based streaming
        break;

      // Other sequences - ignore
      default:
        break;
    }
  }

  /**
   * Apply escape sequence (ESC 7, ESC 8, etc.)
   */
  private applyEscape(data: string, state: TerminalState): void {
    switch (data) {
      case '7': // Save cursor (alternate form)
        this.savedCursor = this.cursor;
        state.hadCursorMovement = true;
        break;

      case '8': // Restore cursor (alternate form)
        this.cursor = this.savedCursor;
        state.hadCursorMovement = true;
        break;

      // Other escape sequences - ignore
      default:
        break;
    }
  }

  /**
   * Apply control character
   */
  private applyControl(char: string, state: TerminalState): void {
    switch (char) {
      case '\r': // Carriage return - move cursor to start
        this.cursor = 0;
        state.hadCarriageReturn = true;
        break;

      case '\n': // Newline - signal to emit line
        state.hadNewline = true;
        // Immediately notify via callback if set (for handling multiple newlines in one chunk)
        if (this.lineReadyCallback) {
          this.lineReadyCallback();
        }
        break;

      case '\x08': // Backspace
        this.cursor = Math.max(0, this.cursor - 1);
        state.hadCursorMovement = true;
        break;

      case '\t': // Tab - move to next 8-column boundary
        {
          const nextTab = (Math.floor(this.cursor / 8) + 1) * 8;
          while (this.cursor < nextTab) {
            this.cells[this.cursor] = { char: ' ', sgr: { ...this.activeSgr } };
            this.cursor++;
          }
        }
        break;
    }
  }

  /**
   * Render current line to ANSI string
   * Optimizes SGR emission (no redundant codes)
   */
  renderLine(): string {
    const ESC = '\x1b';
    const SGR_RESET = `${ESC}[0m`;

    // Find last non-null cell
    let lastContentIndex = -1;
    for (let j = this.cells.length - 1; j >= 0; j--) {
      if (this.cells[j]?.char) {
        lastContentIndex = j;
        break;
      }
    }

    if (lastContentIndex === -1) {
      // Empty line
      return '';
    }

    let result = '';
    let lastSgr: SgrAttributes = {};

    for (let i = 0; i <= lastContentIndex; i++) {
      const cell = this.cells[i];

      if (cell?.char) {
        // Emit SGR only if it changed
        if (!SgrComposer.equals(cell.sgr, lastSgr)) {
          if (SgrComposer.isEmpty(cell.sgr)) {
            result += SGR_RESET;
          } else {
            // If we had styling before, reset first for clean transition
            if (!SgrComposer.isEmpty(lastSgr)) {
              result += SGR_RESET;
            }
            result += SgrComposer.toSequence(cell.sgr);
          }
          lastSgr = cell.sgr;
        }
        result += cell.char;
      } else {
        // Null or undefined cell - emit space (erased position)
        if (!SgrComposer.isEmpty(lastSgr)) {
          result += SGR_RESET;
          lastSgr = {};
        }
        result += ' ';
      }
    }

    // Reset SGR at end of line if we have active styling
    if (!SgrComposer.isEmpty(lastSgr)) {
      result += SGR_RESET;
    }

    // Trim trailing spaces
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally matching ANSI reset sequence
    result = result.replace(/ +\x1b\[0m$/, '\x1b[0m');
    result = result.replace(/ +$/, '');

    return result;
  }

  /**
   * Reset line state (called after emitting a line)
   * Preserves activeSgr (carries to next line)
   */
  reset(): void {
    this.cells = [];
    this.cursor = 0;
    // activeSgr persists across lines
  }

  /**
   * Check if there's unflushed content
   */
  hasContent(): boolean {
    return this.cells.length > 0;
  }

  /**
   * Get current cursor position
   */
  getCursor(): number {
    return this.cursor;
  }

  /**
   * Dispose terminal (cleanup)
   */
  dispose(): void {
    this.cells = [];
    this.activeSgr = {};
    this.incompleteSequence = '';
  }
}
