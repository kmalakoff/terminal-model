import assert from 'assert';
import { ImmediateStrategy, SgrComposer, StatefulTimeoutStrategy, StreamingTerminal, TerminalTransform, TimeoutStrategy } from 'terminal-model';

describe('exports .ts', () => {
  it('SgrComposer', () => {
    assert.equal(typeof SgrComposer, 'function');
  });
  it('StreamingTerminal', () => {
    assert.equal(typeof StreamingTerminal, 'function');
  });
  it('ImmediateStrategy', () => {
    assert.equal(typeof ImmediateStrategy, 'function');
  });
  it('StatefulTimeoutStrategy', () => {
    assert.equal(typeof StatefulTimeoutStrategy, 'function');
  });
  it('TimeoutStrategy', () => {
    assert.equal(typeof TimeoutStrategy, 'function');
  });
  it('TerminalTransform', () => {
    assert.equal(typeof TerminalTransform, 'function');
  });
});
