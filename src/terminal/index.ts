/**
 * Terminal module - Internal streaming terminal emulator for spawn-streaming
 * Provides ANSI parsing, line buffering, and configurable emission strategies
 */

export type { Cell, SgrAttributes } from './ansi/types.ts';
export { SgrComposer } from './SgrComposer.ts';
export type { TerminalState } from './StreamingTerminal.ts';
export { default as StreamingTerminal } from './StreamingTerminal.ts';
export { ImmediateStrategy } from './strategies/ImmediateStrategy.ts';

export type { EmitCallback, LineEmissionStrategy } from './strategies/LineEmissionStrategy.ts';
export { StatefulTimeoutStrategy } from './strategies/StatefulTimeoutStrategy.ts';
export { TimeoutStrategy } from './strategies/TimeoutStrategy.ts';
export { default as TerminalTransform } from './TerminalTransform.ts';
