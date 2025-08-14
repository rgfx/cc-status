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

## Credits & Inspiration

This project was inspired by and learned from several excellent statusline implementations:

### [Owloops/claude-powerline](https://github.com/Owloops/claude-powerline)
- **Excellent git service implementation** and multi-line layout system
- **Context monitoring** from transcript files  
- **Color theming architecture** and configuration patterns
- **📝 Note**: If you're on a **token-based plan** (not subscription), Owloops' claude-powerline may be better suited as it reads directly from transcript files rather than requiring ccusage integration

### [chongdashu/cc-statusline](https://github.com/chongdashu/cc-statusline)  
- **Direct ccusage subprocess integration** (`npx ccusage blocks --json`)
- **Performance-focused bash implementation**
- **Real-time usage tracking** approach and configuration patterns

### [ryoppippi/ccusage](https://github.com/ryoppippi/ccusage)
- **Source of truth** for all Claude usage data and billing block logic
- **Block limit calculation methods** that we implemented
- **Live monitoring** implementation (`--live` flag)

Special thanks to these developers for their innovative work on Claude Code tooling!

## License

MIT