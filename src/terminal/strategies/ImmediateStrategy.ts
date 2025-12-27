import type StreamingTerminal from '../StreamingTerminal.ts';
import type { TerminalState } from '../StreamingTerminal.ts';
import type { EmitCallback, LineEmissionStrategy } from './LineEmissionStrategy.ts';

/**
 * Immediate emission strategy
 * Emits lines only on newline (\n), no buffering or timeouts
 * Simplest strategy - matches traditional line-buffered behavior
 */
export class ImmediateStrategy implements LineEmissionStrategy {
  setEmitCallback(_callback: EmitCallback): void {
    // No async emissions in immediate strategy
  }

  onWrite(_terminal: StreamingTerminal, _state: TerminalState): boolean {
    // Lines are already emitted via lineReadyCallback during write()
    // No additional emission needed from strategy
    return false;
  }

  flush(): boolean {
    // Always flush remaining content on stream end
    return true;
  }

  dispose(): void {
    // No resources to clean up
  }
}
