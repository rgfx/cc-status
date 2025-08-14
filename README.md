# cc-status

A focused, minimal statusline for Claude Code that displays real usage data in a clean single-line format.

> **Note**: This tool is designed for **Claude subscription plans** that use ccusage for usage tracking. If you're on a token-based plan, consider [claude-powerline](https://github.com/Owloops/claude-powerline) instead.

```
⑂ main ✓ ↻ 35.9% 16.3M/45.6M ◐ 77% ◷ 3:36 1PM $7.28 ✽
```

## Features

- **Real subscription usage** - Direct integration with ccusage for accurate usage data
- **Context monitoring** - Shows context percentage from actual transcript files  
- **Git integration** - Branch name, dirty status, ahead/behind indicators
- **Session timer** - Time remaining until usage limit reset
- **Burn rate tracking** - Visual indicator with color coding based on projections
- **Color coded** - Green (safe), yellow (warning), red (critical)
- **Fully configurable** - Enable/disable segments, customize colors and icons

## Installation

```bash
npm install -g cc-status
```

## Usage

### Claude Code Integration

Add to your Claude Code `settings.json`:

```json
{
  "statusLine": {
    "type": "command", 
    "command": "cc-status"
  }
}
```

### Manual Testing

```bash
# Test the statusline (requires Claude Code context)
echo '{}' | cc-status

# Show help
cc-status --help
```

## Configuration

Create `.cc-status.json` in your project root or `~/.claude/cc-status.json`:

```json
{
  "segments": {
    "git": { "enabled": true },
    "subscription": { "enabled": true },
    "context": { "enabled": true },
    "burnRate": { "enabled": true }
  },
  "format": {
    "separator": " ",
    "icons": {
      "git": "⑂",
      "subscription": "↻", 
      "context": "◐",
      "burnRate": "✽"
    }
  },
  "colors": {
    "safe": "#00ff00",
    "warning": "#ffff00",
    "critical": "#ff0000", 
    "neutral": "#888888"
  }
}
```

## Output Format

| Segment | Description | Example |
|---------|-------------|---------|
| `⑂ main ✓` | Git branch and status | Clean working tree |
| `↻ 35.9% 16.3M/45.6M` | Subscription usage | 35.9% of limit used |
| `◐ 77%` | Context usage | 77% context remaining |
| `◷ 3:36 1PM` | Session timer | 3h 36m until reset at 1PM |
| `$7.28` | Session cost | Current session cost |
| `✽` | Burn rate indicator | Green/yellow/red based on projections |

## Requirements

- **Node.js** ≥18.0.0
- **ccusage** - Available via `npx ccusage` (for subscription data)
- **git** - Available in PATH (for git status)  
- **Claude Code** - For transcript file access

## Color Coding

- 🟢 **Green (0-80%)**: Safe usage levels
- 🟡 **Yellow (80-100%)**: Warning - approaching limits
- 🔴 **Red (100%+)**: Critical - over limits

## License

MIT © [rgfx](https://github.com/rgfx)

## Contributing

Issues and pull requests welcome at [rgfx/cc-status](https://github.com/rgfx/cc-status).