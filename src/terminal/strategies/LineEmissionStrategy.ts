import type StreamingTerminal from '../StreamingTerminal.ts';
import type { TerminalState } from '../StreamingTerminal.ts';

/**
 * Callback for emitting lines asynchronously
 */
export type EmitCallback = () => void;

/**
 * Strategy interface for determining when to emit buffered lines
 * Implementations can use different approaches (immediate, timeout-based, state-based)
 */
export interface LineEmissionStrategy {
  /**
   * Set the callback to be called when a line should be emitted
   * Called by TerminalTransform during setup
   */
  setEmitCallback(callback: EmitCallback): void;

  /**
   * Called after each write to the terminal
   * Strategy should decide whether to emit the line now (return true)
   * or schedule for later (set timer that calls emit callback)
   * @param terminal - The terminal instance (for querying state)
   * @param state - State information from the write operation
   * @returns true if line should be emitted immediately, false otherwise
   */
  onWrite(terminal: StreamingTerminal, state: TerminalState): boolean;

  /**
   * Force flush any pending content
   * Called when stream ends
   * @returns true if content should be flushed
   */
  flush(): boolean;

  /**
   * Cleanup resources (timers, etc.)
   */
  dispose(): void;
}
