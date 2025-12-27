// Export terminal emulation API

// Export types
export type { AnsiSequence, AnsiSequenceType, Cell, ControlSequence, CsiSequence, EscapeSequence, PrintableSequence, SgrAttributes } from './terminal/ansi/types.ts';
export { SgrComposer } from './terminal/SgrComposer.ts';
export type { TerminalState } from './terminal/StreamingTerminal.ts';
export { default as StreamingTerminal } from './terminal/StreamingTerminal.ts';

// Export strategies
export { ImmediateStrategy } from './terminal/strategies/ImmediateStrategy.ts';
export type { EmitCallback, LineEmissionStrategy } from './terminal/strategies/LineEmissionStrategy.ts';
export { StatefulTimeoutStrategy } from './terminal/strategies/StatefulTimeoutStrategy.ts';
export { TimeoutStrategy } from './terminal/strategies/TimeoutStrategy.ts';
export { default as TerminalTransform } from './terminal/TerminalTransform.ts';
