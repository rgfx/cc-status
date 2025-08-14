# cc-status

A focused, minimal statusline for Claude Code that shows what matters most in a clean single-line format.

```
⑂ main ✓  ↻ 48.6% (9404.3k/19342.8k)  ◷ 45k (76%)  ⟢ $1.20/h  ⏱ 16h left
```

## Features

- **Real ccusage integration** - Live subscription usage with dynamic limits
- **Git status** - Branch, clean/dirty state, ahead/behind counts
- **Context monitoring** - Token usage from Claude Code transcripts  
- **Burn rate tracking** - Cost and token usage per hour
- **Time projections** - Hours remaining until limits
- **Configurable segments** - Enable/disable any component
- **Color coding** - Green (safe), Yellow (warning), Red (critical)

## Installation

```bash
npm install -g cc-status
```

## Usage in Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "cc-status"
  }
}
```

## Configuration

### Command-line flags (highest priority)
```bash
cc-status --git=false --context=true --burnRate=true
```

### Environment variables
```bash
export CC_STATUS_GIT_ENABLED=false
export CC_STATUS_CONTEXT_ENABLED=true
```

### Config files (searched in order)
1. `./cc-status.json` (project-level)
2. `~/.claude/cc-status.json` (user-level)
3. `~/.config/cc-status/config.json` (XDG)

### Example config file
```json
{
  "segments": {
    "git": { "enabled": true, "showSha": false },
    "subscription": { "enabled": true },
    "context": { "enabled": false },
    "burnRate": { "enabled": false },
    "timeLeft": { "enabled": false }
  },
  "colors": {
    "safe": "#00ff00",
    "warning": "#ffff00",
    "critical": "#ff0000"
  }
}
```

## Architecture

- **Cross-platform** TypeScript/Node.js for Windows compatibility
- **Real data sources** via ccusage subprocess calls
- **Graceful fallbacks** when data unavailable
- **Owloops-inspired** configuration system with priority hierarchy

## License

MIT