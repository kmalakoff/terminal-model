/**
 * Handler for CSI (Control Sequence Introducer) commands
 * Categorizes and processes CSI sequences
 */

export interface CsiCommand {
  command: string;
  params: number[];
  affects: {
    cursor?: boolean;
    erasure?: boolean;
    style?: boolean;
  };
}

// biome-ignore lint/complexity/noStaticOnlyClass: Utility class for CSI command handling
export class CsiHandler {
  /**
   * Parse CSI parameters and command
   */
  static parse(params: string, cmd: string): CsiCommand {
    const p = params ? params.split(';').map((n) => parseInt(n, 10) || 0) : [0];

    return {
      command: cmd,
      params: p,
      affects: CsiHandler.categorize(cmd),
    };
  }

  /**
   * Categorize what a CSI command affects
   * This helps strategies determine line volatility
   */
  private static categorize(cmd: string): CsiCommand['affects'] {
    switch (cmd) {
      // Style commands
      case 'm':
        return { style: true };

      // Single-line cursor movement
      case 'G': // CHA - Cursor Horizontal Absolute
      case 'C': // CUF - Cursor Forward
      case 'D': // CUB - Cursor Back
      case '`': // HPA - Horizontal Position Absolute
        return { cursor: true };

      // Multi-line cursor movement (not supported in streaming mode)
      case 'A': // CUU - Cursor Up
      case 'B': // CUD - Cursor Down
      case 'H': // CUP - Cursor Position
      case 'f': // HVP - Horizontal Vertical Position
        return {}; // Ignore

      // Erasure commands
      case 'K': // EL - Erase in Line
      case 'X': // ECH - Erase Character
      case 'P': // DCH - Delete Character
      case '@': // ICH - Insert Character
        return { erasure: true };

      // Multi-line erasure (not supported)
      case 'J': // ED - Erase in Display
      case 'S': // SU - Scroll Up
      case 'T': // SD - Scroll Down
      case 'L': // IL - Insert Line
      case 'M': // DL - Delete Line
        return {}; // Ignore

      // Cursor save/restore
      case 's': // Save cursor
      case 'u': // Restore cursor
        return { cursor: true };

      // Other commands - no categorization
      default:
        return {};
    }
  }
}
