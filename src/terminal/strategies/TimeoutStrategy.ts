import type StreamingTerminal from '../StreamingTerminal.ts';
import type { TerminalState } from '../StreamingTerminal.ts';
import type { EmitCallback, LineEmissionStrategy } from './LineEmissionStrategy.ts';

/**
 * Timeout-based emission strategy
 * Emits lines immediately on newline, or after a timeout for partial lines
 * Uses a single timeout value for all content
 */
export class TimeoutStrategy implements LineEmissionStrategy {
  private timeout: number;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private emitCallback: EmitCallback | null = null;

  constructor(options: { timeout?: number } = {}) {
    this.timeout = options.timeout ?? 100; // Default 100ms
  }

  setEmitCallback(callback: EmitCallback): void {
    this.emitCallback = callback;
  }

  onWrite(terminal: StreamingTerminal, state: TerminalState): boolean {
    this.cancelTimer();

    // Emit immediately on newline
    if (state.hadNewline) {
      return true;
    }

    // Schedule timeout for partial line
    if (terminal.hasContent() && this.emitCallback) {
      this.flushTimer = setTimeout(() => {
        if (this.emitCallback) {
          this.emitCallback();
        }
      }, this.timeout);
    }

    return false;
  }

  flush(): boolean {
    this.cancelTimer();
    return true;
  }

  dispose(): void {
    this.cancelTimer();
    this.emitCallback = null;
  }

  private cancelTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
