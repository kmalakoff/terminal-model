/**
 * ANSI sequence types and structures
 */

export interface Cell {
  char: string;
  sgr: SgrAttributes;
}

export interface SgrAttributes {
  fg?: number; // Foreground color (0-255)
  bg?: number; // Background color (0-255)
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  blink?: boolean;
  inverse?: boolean;
  hidden?: boolean;
  strikethrough?: boolean;
}

export type AnsiSequenceType = 'csi' | 'osc' | 'control' | 'printable' | 'escape';

export interface AnsiSequence {
  type: AnsiSequenceType;
  length: number;
  data?: unknown;
}

export interface CsiSequence extends AnsiSequence {
  type: 'csi';
  data: {
    params: string;
    cmd: string;
    raw: string;
  };
}

export interface ControlSequence extends AnsiSequence {
  type: 'control';
  data: string;
}

export interface PrintableSequence extends AnsiSequence {
  type: 'printable';
  data: string;
}

export interface EscapeSequence extends AnsiSequence {
  type: 'escape';
  data: string;
}
