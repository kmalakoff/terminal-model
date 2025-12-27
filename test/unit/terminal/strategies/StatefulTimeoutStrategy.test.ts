import assert from 'assert';
import StreamingTerminal from '../../../../src/terminal/StreamingTerminal.ts';
import { StatefulTimeoutStrategy } from '../../../../src/terminal/strategies/StatefulTimeoutStrategy.ts';

describe('StatefulTimeoutStrategy', () => {
  describe('immediate emission on newline', () => {
    it('should emit immediately on newline', () => {
      const strategy = new StatefulTimeoutStrategy();
      const terminal = new StreamingTerminal();

      const state = terminal.write('hello\n');
      const shouldEmit = strategy.onWrite(terminal, state);

      assert.strictEqual(shouldEmit, true);
    });
  });

  describe('volatile timeout for progress bars', () => {
    it('should use short timeout for carriage return', function (done) {
      this.timeout(200);

      const strategy = new StatefulTimeoutStrategy({ volatileTimeout: 50, stableTimeout: 200 });
      const terminal = new StreamingTerminal();
      let emitted = false;

      strategy.setEmitCallback(() => {
        emitted = true;
      });

      const state = terminal.write('Progress: 10%\r');
      const shouldEmit = strategy.onWrite(terminal, state);

      assert.strictEqual(shouldEmit, false); // Not immediate

      // Should emit after volatile timeout (~50ms)
      setTimeout(() => {
        assert.strictEqual(emitted, true, 'Should emit after volatile timeout');
        strategy.dispose();
        done();
      }, 80);
    });

    it('should use short timeout for cursor movement', function (done) {
      this.timeout(200);

      const strategy = new StatefulTimeoutStrategy({ volatileTimeout: 50, stableTimeout: 200 });
      const terminal = new StreamingTerminal();
      let emitted = false;

      strategy.setEmitCallback(() => {
        emitted = true;
      });

      terminal.write('ABC');
      const state = terminal.write('\x1b[2D'); // Cursor back
      const shouldEmit = strategy.onWrite(terminal, state);

      assert.strictEqual(shouldEmit, false);

      setTimeout(() => {
        assert.strictEqual(emitted, true);
        strategy.dispose();
        done();
      }, 80);
    });

    it('should use short timeout for erasure', function (done) {
      this.timeout(200);

      const strategy = new StatefulTimeoutStrategy({ volatileTimeout: 50, stableTimeout: 200 });
      const terminal = new StreamingTerminal();
      let emitted = false;

      strategy.setEmitCallback(() => {
        emitted = true;
      });

      terminal.write('ABCDEF');
      const state = terminal.write('\x1b[K'); // Erase to end
      const shouldEmit = strategy.onWrite(terminal, state);

      assert.strictEqual(shouldEmit, false);

      setTimeout(() => {
        assert.strictEqual(emitted, true);
        strategy.dispose();
        done();
      }, 80);
    });
  });

  describe('stable timeout for normal output', () => {
    it('should use longer timeout for stable lines', function (done) {
      this.timeout(400);

      const strategy = new StatefulTimeoutStrategy({ volatileTimeout: 50, stableTimeout: 200 });
      const terminal = new StreamingTerminal();
      let emitted = false;

      strategy.setEmitCallback(() => {
        emitted = true;
      });

      const state = terminal.write('normal output');
      const shouldEmit = strategy.onWrite(terminal, state);

      assert.strictEqual(shouldEmit, false);

      // Should NOT emit after volatile timeout
      setTimeout(() => {
        assert.strictEqual(emitted, false, 'Should not emit before stable timeout');
      }, 80);

      // Should emit after stable timeout
      setTimeout(() => {
        assert.strictEqual(emitted, true, 'Should emit after stable timeout');
        strategy.dispose();
        done();
      }, 250);
    });
  });

  describe('timer cancellation', () => {
    it('should cancel timer on newline', function (done) {
      this.timeout(400);

      const strategy = new StatefulTimeoutStrategy({ volatileTimeout: 50, stableTimeout: 200 });
      const terminal = new StreamingTerminal();
      let callbackCount = 0;

      strategy.setEmitCallback(() => {
        callbackCount++;
      });

      // Start a volatile timeout
      terminal.write('Progress\r');
      const state1 = terminal.write('');
      strategy.onWrite(terminal, state1);

      // Then newline before timeout fires
      setTimeout(() => {
        const state2 = terminal.write('\n');
        const shouldEmit = strategy.onWrite(terminal, state2);
        assert.strictEqual(shouldEmit, true);

        // Wait to ensure callback wasn't called twice
        setTimeout(() => {
          assert.strictEqual(callbackCount, 0, 'Callback should not fire after newline');
          strategy.dispose();
          done();
        }, 100);
      }, 20);
    });
  });

  describe('flush', () => {
    it('should flush remaining content', () => {
      const strategy = new StatefulTimeoutStrategy();
      const terminal = new StreamingTerminal();

      terminal.write('partial');
      const shouldFlush = strategy.flush();

      assert.strictEqual(shouldFlush, true);
      strategy.dispose();
    });
  });
});
