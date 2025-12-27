import type StreamingTerminal from '../StreamingTerminal.ts';
import type { TerminalState } from '../StreamingTerminal.ts';
import type { EmitCallback, LineEmissionStrategy } from './LineEmissionStrategy.ts';

/**
 * Stateful timeout-based emission strategy (Option 3)
 * Adapts flush timeout based on line volatility
 * - Volatile lines (progress bars with \r, cursor movement, erasure): short timeout
 * - Stable lines (normal output): longer timeout
 * - Newlines (\n): immediate emission
 *
 * Fixes Bug #3: Prevents intermediate emissions on carriage returns
 */
export class StatefulTimeoutStrategy implements LineEmissionStrategy {
  private volatileTimeout: number;
  private stableTimeout: number;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private emitCallback: EmitCallback | null = null;

  constructor(options: { volatileTimeout?: number; stableTimeout?: number } = {}) {
    this.volatileTimeout = options.volatileTimeout ?? 50; // Default 50ms for volatile
    this.stableTimeout = options.stableTimeout ?? 200; // Default 200ms for stable
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

    // Determine if line is volatile
    const isVolatile = state.hadCarriageReturn || state.hadCursorMovement || state.hadErasure;

    // Schedule flush with appropriate timeout
    if (terminal.hasContent() && this.emitCallback) {
      const timeout = isVolatile ? this.volatileTimeout : this.stableTimeout;

      this.flushTimer = setTimeout(() => {
        if (this.emitCallback) {
          this.emitCallback();
        }
      }, timeout);
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
