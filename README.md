# terminal-model

A Node.js library for terminal emulation that handles streaming ANSI output with proper whitespace preservation. Designed to parse and process ANSI escape sequences from subprocess output, making it suitable for building terminal-based user interfaces and streaming command output with correct formatting.

## Features

- **ANSI Sequence Parsing**: Full support for CSI commands including SGR (colors/styles), cursor positioning, and line erasure
- **Cell-based Rendering**: Each character stored with its styling for precise overwriting and correct whitespace handling
- **Streaming Transform**: Node.js transform stream wrapper for easy integration
- **Flexible Line Emission**: Three emission strategies:
  - `ImmediateStrategy`: Emit lines immediately on newline
  - `TimeoutStrategy`: Emit on newline or after a fixed timeout
  - `StatefulTimeoutStrategy`: Adaptive timeout based on line volatility
- **Color Support**: Standard (0-7), bright (8-15), 256-color, and RGB colors
- **Chunk Boundary Handling**: Buffers incomplete ANSI sequences across chunk boundaries
- **Node.js Compatibility**: Supports Node.js 0.8+ with a compatibility layer

## Installation

```bash
npm install terminal-model
```

## Quick Start

```typescript
import { TerminalTransform, StatefulTimeoutStrategy } from 'terminal-model'

const terminal = new TerminalTransform({
  strategy: new StatefulTimeoutStrategy()
})

terminal.onLine((line) => {
  console.log('Received line:', line)
})

terminal.write('Hello, World!\n')
terminal.write('\x1b[31mRed text\x1b[0m\n')
```

## API

### StreamingTerminal

The core terminal emulator class that parses ANSI sequences and maintains terminal state.

```typescript
import { StreamingTerminal } from 'terminal-model'

const terminal = new StreamingTerminal()

// Write data to process
const state = terminal.write('some content\n')

// Check for unflushed content
if (terminal.hasContent()) {
  // Render current line to ANSI string
  const line = terminal.renderLine()
  console.log(line)
}

// Reset line state (preserves SGR attributes)
terminal.reset()

// Set callback for newline events
terminal.setLineReadyCallback((line) => {
  console.log('Line ready:', line)
})

// Cleanup
terminal.dispose()
```

### TerminalTransform

A transform stream wrapper around StreamingTerminal with configurable emission strategies.

```typescript
import { TerminalTransform, TimeoutStrategy } from 'terminal-model'

// Using callback API
const terminal = new TerminalTransform({
  strategy: new TimeoutStrategy({ timeout: 50 })
})

terminal.onLine((line) => {
  console.log('Emitted line:', line)
})

// Using event API
terminal.on('line', (line: string) => {
  console.log('Line event:', line)
})

// Using polling API
terminal.write('some content\n')
const pending = terminal.getPendingLines()
const consumed = terminal.consumePendingLines()
terminal.clearPendingLines()
```

### SgrComposer

Static utility class for parsing SGR parameters, composing attributes, and generating ANSI sequences.

```typescript
import { SgrComposer } from 'terminal-model'

// Parse SGR parameters
const attrs = SgrComposer.parse([31, 1]) // red + bold

// Compose/merge attributes
const base = SgrComposer.parse([31])
const overlay = SgrComposer.parse([1])
const combined = SgrComposer.compose(base, overlay)

// Generate ANSI sequence
const sequence = SgrComposer.toSequence(attrs) // '\x1b[31;1m'

// Compare attributes
SgrComposer.equals(attrs1, attrs2)

// Check if empty
SgrComposer.isEmpty(attrs) // false

// Reset to defaults
const reset = SgrComposer.reset()
```

### AnsiParser

Static class for detecting and extracting ANSI sequences from strings.

```typescript
import { AnsiParser } from 'terminal-model'

// Parse next sequence at position
const result = AnsiParser.parseNext('\x1b[31mHello', 0)
// { type: 'csi', length: 4, data: {...} }

// Check for incomplete sequences at end
const incomplete = AnsiParser.getIncompleteSequence('\x1b[31')
// '\x1b[31'
```

### Line Emission Strategies

```typescript
import {
  ImmediateStrategy,
  TimeoutStrategy,
  StatefulTimeoutStrategy
} from 'terminal-model'

// Emit only on newline
const immediate = new ImmediateStrategy()

// Emit on newline or after 100ms (default)
const timeout = new TimeoutStrategy({ timeout: 100 })

// Adaptive timeout:
// - Short (20ms) for volatile content (CR, cursor moves, erasure)
// - Long (100ms) for stable output
const stateful = new StatefulTimeoutStrategy()
```

## Supported ANSI Features

### CSI Commands

| Command | Description | Support |
|---------|-------------|---------|
| `m` | SGR (colors, bold, dim, italic, underline, blink, inverse, hidden, strikethrough) | Full |
| `G` / `` ` `` | Horizontal absolute positioning | Full |
| `C` / `D` | Cursor forward/backward | Full |
| `K` | Erase in line | Full |
| `X` | Erase characters | Full |
| `P` / `@` | Delete/Insert characters | Full |
| `s` / `u` | Save/Restore cursor position | Full |
| `7` / `8` | Save/Restore cursor position (DEC) | Full |

### Ignored Commands

Multi-line or incompatible with streaming:
- CUP (H), HVP (f), CUU/A, CUD/B (vertical movement)
- ED (J), SU (S), SD (T), IL (L), DL (M)

### Color Support

| Type | Range | Code Examples |
|------|-------|---------------|
| Standard colors | 0-7 | 30-37 (fg), 40-47 (bg) |
| Bright colors | 8-15 | 90-97 (fg), 100-107 (bg) |
| 256-color | 0-255 | 38;5;N (fg), 48;5;N (bg) |
| RGB | 16,777,216 | 38;2;R;G;B (fg), 48;2;R;G;B (bg) |

### Control Characters

- `\n` (newline)
- `\r` (carriage return)
- `\t` (tab)
- `\x08` (backspace)

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 terminal-model                   │
├─────────────────────────────────────────────────┤
│  Entry Point (src/index.ts)                     │
│  Exports: StreamingTerminal, TerminalTransform,  │
│           SgrComposer, Strategies, Types         │
└───────────────┬─────────────────────────────────┘
                │
    ┌-----------+-----------+-----------+
    ▼           ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  ANSI  │ │Terminal│ │ SGR    │ │Strategy│
│ Parser │ │ State  │ │Composer│ │ Pattern│
└────────┘ └────────┘ └────────┘ └────────┘
                │
                ▼
      ┌─────────────────────┐
      │  TerminalTransform  │
      │  (Transform Stream) │
      └─────────────────────┘
```

## License

MIT
