# cc-status

A focused, minimal statusline for Claude Code that shows what matters most in a clean single-line format.

```
⑂ main ✓  ↻ 48.6% 9404.3k/19342.8k  ◐ 15%  ◷ 4h 53m 4:00:00AM  $41.07  ✽
```

## Features

- **Real ccusage integration** - Live subscription usage with dynamic limits  
- **Real context tracking** - Shows actual Claude memory usage from transcript data
- **Burn rate projections** - Predictive limit warnings with ✽ indicator
- **Daily cost tracking** - Shows actual spending for today using ccusage data
- **Session timer** - Time until 5-hour block reset with countdown
- **Git status** - Branch, clean/dirty state, ahead/behind counts
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

## Git Status Symbols

The git segment shows branch name and status with the following indicators:

### Status Symbols
- **✓** - Clean (no uncommitted changes)
- **●** - Dirty (uncommitted changes present)
- **⚠** - Conflicts (merge conflicts need resolution)

### Ahead/Behind Indicators
- **↑3** - 3 commits ahead of remote branch
- **↓2** - 2 commits behind remote branch  
- **↑1↓2** - 1 commit ahead and 2 commits behind remote

### Examples
```
⑂ main ✓        # Clean repository on main branch
⑂ main ●        # Uncommitted changes on main branch
⑂ main ● ↓2     # Dirty repository, 2 commits behind remote
⑂ main ✓ ↑1     # Clean repository, 1 commit ahead of remote
⑂ feature ⚠     # Merge conflicts on feature branch
```

### Daily Cost Tracking

The daily cost feature shows your actual spending for today, calculated using ccusage's daily aggregation:

```
$37.48
```

- **Live data** - Uses `ccusage daily` command for accurate daily totals
- **Real costs** - Shows actual calculated costs, not estimates  
- **Timezone aware** - Properly handles local timezone for daily calculations
- **Configurable** - Can be disabled via `"dailyCost": { "enabled": false }`

### Real Context Tracking

The context feature shows actual Claude memory usage from transcript data:

```
◐ 15%
```

- **Real data** - Reads from actual Claude Code transcript files via hook data
- **Accurate calculation** - Uses Claude's own token counting (input + cache tokens)
- **Context-aware** - Shows percentage of 200k context window used
- **Smart filtering** - Ignores sidechain entries, finds most recent usage
- **Visual indicator** - `◐` (half-filled circle) represents partial memory usage
- **Color coding** - Neutral grey normally, yellow when approaching context limit (>80%)

Only displays when running in actual Claude Code sessions with transcript access.

### Burn Rate Projections

The burn rate feature provides predictive limit warnings using ccusage projection logic:

```
✽
```

- **Predictive analysis** - Projects total session usage based on current burn rate
- **Limit warnings** - Red when projected to exceed subscription limits, yellow when approaching
- **Real calculations** - Uses actual transcript data and ccusage session block logic
- **Early warning** - Alerts you before hitting limits, not after
- **Visual indicator** - `✽` (asterisk) shows projection status at a glance

Colors indicate projected session outcome:
- **Grey ✽**: Projected to stay within limits
- **Yellow ✽**: Projected to approach limits (80-100%)  
- **Red ✽**: Projected to exceed limits (>100%)

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