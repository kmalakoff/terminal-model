import { Transform } from '../compat.ts';
import StreamingTerminal from './StreamingTerminal.ts';
import { ImmediateStrategy } from './strategies/ImmediateStrategy.ts';
import type { LineEmissionStrategy } from './strategies/LineEmissionStrategy.ts';

/**
 * Transform stream that wraps StreamingTerminal with emission strategies
 * Provides dual API: event-based (on('line')) and polling (getPendingLines())
 * Replaces prefixTransform with a more modular architecture
 */
export default class TerminalTransform extends Transform {
  private terminal: StreamingTerminal;
  private strategy: LineEmissionStrategy;
  private pendingLines: string[] = [];
  private lineCallback?: (line: string) => void;
  private static readonly MAX_PENDING = 1000; // Prevent unbounded memory growth

  constructor(options: { strategy?: LineEmissionStrategy } = {}) {
    super();

    this.terminal = new StreamingTerminal();
    this.strategy = options.strategy ?? new ImmediateStrategy();

    // Setup terminal callback for immediate newline emissions (handles multiple newlines per chunk)
    this.terminal.setLineReadyCallback(() => {
      this.emitCurrentLine();
    });

    // Setup strategy callback for async emissions (timeouts)
    this.strategy.setEmitCallback(() => {
      this.emitCurrentLine();
    });
  }

  /**
   * Event-based API: Set callback for line emissions
   * Lines will be passed to this callback instead of being buffered
   */
  onLine(callback: (line: string) => void): void {
    this.lineCallback = callback;
  }

  /**
   * Polling API: Get pending lines without removing them
   */
  getPendingLines(): string[] {
    return [...this.pendingLines];
  }

  /**
   * Polling API: Get and clear pending lines
   */
  consumePendingLines(): string[] {
    const lines = this.pendingLines;
    this.pendingLines = [];
    return lines;
  }

  /**
   * Polling API: Clear pending lines
   */
  clearPendingLines(): void {
    this.pendingLines = [];
  }

  /**
   * Transform implementation
   */
  _transform(chunk: Buffer, _encoding: string, callback: () => void): void {
    try {
      const state = this.terminal.write(chunk);
      const shouldEmit = this.strategy.onWrite(this.terminal, state);

      if (shouldEmit) {
        this.emitCurrentLine();
      }

      // Call callback to signal we're done processing this chunk
      callback();
    } catch (err) {
      // Signal error via emit, then call callback
      this.emit('error', err);
      callback();
    }
  }

  /**
   * Flush implementation - emit any remaining content
   */
  _flush(callback: () => void): void {
    try {
      const shouldFlush = this.strategy.flush();

      if (shouldFlush && this.terminal.hasContent()) {
        this.emitCurrentLine();
      }

      this.strategy.dispose();
      this.terminal.dispose();

      callback();
    } catch (err) {
      callback();
      this.emit('error', err);
    }
  }

  /**
   * Cleanup on destroy
   */
  destroy(error?: Error): this {
    this.strategy.dispose();
    this.terminal.dispose();
    this.pendingLines = [];
    return super.destroy(error);
  }

  /**
   * Emit the current line from terminal
   */
  private emitCurrentLine(): void {
    // Always render and emit, even for blank lines (preserves spacing)
    const line = this.terminal.renderLine();
    this.terminal.reset();

    // Event API - call callback if set
    if (this.lineCallback) {
      this.lineCallback(line);
    } else {
      // No callback set - push to stream with newline (normal Transform behavior)
      this.push(`${line}\n`);

      // Also buffer for polling API
      this.pendingLines.push(line);

      // Prevent unbounded growth
      if (this.pendingLines.length > TerminalTransform.MAX_PENDING) {
        this.emit('error', new Error('Pending lines buffer overflow'));
        this.pendingLines.shift(); // Drop oldest
      }
    }

    // Always emit 'line' event for backward compatibility
    this.emit('line', line);
  }
}
