# cc-status

A focused, minimal statusline for Claude Code that displays real usage data in a clean single-line format.

> **Note**: This tool is designed for **Claude subscription plans** and analyzes your Claude usage directly from transcript files.

```
⑂ main ✓ ↻ 19.6% 8.9M/45.6M ◐ 77% ◷ 3:36 2AM $47.35 ✽
```

## Features

- **Direct transcript analysis** - Extracts usage data directly from Claude transcript files
- **5-hour block tracking** - Matches Claude's billing cycles with accurate current block usage
- **Statistical limit detection** - Analyzes historical usage patterns to estimate limits
- **Context monitoring** - Shows context percentage from actual transcript files  
- **Git integration** - Branch name, dirty status, ahead/behind indicators
- **Session timer** - Time remaining until usage limit reset (extracted from transcript data)
- **Burn rate tracking** - Visual indicator based on current token consumption rate
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

Create `cc-status.json` in your project root or `~/.claude/cc-status.json`:

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
| `↻ 19.6% 8.9M/45.6M` | Current 5-hour block usage | 19.6% of estimated limit used |
| `◐ 77%` | Context usage | 77% context remaining |
| `◷ 3:36 2AM` | Session timer | 3h 36m until reset at 2AM |
| `$47.35` | Daily total cost | All sessions today |
| `✽` | Burn rate indicator | Color based on tokens/minute rate |

## How Values are Calculated

### Current Usage (↻ segment)
- **Current tokens**: Sum of tokens from current 5-hour block only
- **Block detection**: Groups transcript entries by 5-hour windows based on activity gaps
- **Limit estimation**: Statistical analysis (95th percentile) of historical 5-hour block usage
- **Note**: Total session amounts may not be fully accurate as they represent estimated limits

### Reset Time (◷ segment)  
- **Primary**: Extracted from `usageLimitResetTime` field in transcript entries
- **Fallback**: Next 2AM local time if no reset time found in transcripts

### Daily Cost ($)
- **Calculation**: Sum of all Claude sessions for current day
- **Sources**: Pre-calculated `costUSD` from transcripts + estimated costs for missing entries
- **Pricing**: Integrated pricing data from GitHub API with offline fallbacks

### Burn Rate (✽)
- **Rate calculation**: Tokens per minute from current 5-hour block activity
- **Colors**: Red (≥1000/min), Yellow (≥500/min), Neutral (<500/min)
- **Data**: Based on actual timestamp intervals between transcript entries

## Requirements

- **Node.js** ≥18.0.0
- **git** - Available in PATH (for git status)  
- **Claude Code** - For transcript file access and data analysis

## Color Coding

- 🟢 **Green (0-80%)**: Safe usage levels
- 🟡 **Yellow (80-100%)**: Warning - approaching limits
- 🔴 **Red (100%+)**: Critical - over limits

## License

MIT © [rgfx](https://github.com/rgfx)

## Contributing

Issues and pull requests welcome at [rgfx/cc-status](https://github.com/rgfx/cc-status).