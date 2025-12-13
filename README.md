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
- **Context monitoring** - Uses Claude Code's real-time context data when available, with transcript fallback
- **Git integration** - Branch name, dirty status, ahead/behind indicators
- **Session timer** - Time remaining until usage limit reset (extracted from transcript data)
- **Burn rate tracking** - Visual indicator based on current token consumption rate
- **Color coded** - Green (safe), yellow (warning), red (critical)
- **Fully configurable** - Enable/disable segments, customize colors and icons

## Installation

### Quick Install

```bash
npm install -g cc-status
```

### Platform Support

✅ **Windows** - Fully supported
✅ **Linux** - Fully supported
✅ **macOS** - Should work (untested)

**Requirements:**
- Node.js ≥18.0.0
- git (for git segment)
- Claude Code

### Claude Code Configuration

#### User-Level Settings (Recommended)

For **global usage across all projects**, add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "cc-status",
    "padding": 0
  }
}
```

**Settings file locations:**
- **Linux/macOS**: `~/.claude/settings.json`
- **Windows**: `C:\Users\YourName\.claude\settings.json`

#### Project-Level Settings (Optional)

For **project-specific configuration**, create `.claude/settings.json` in your project:

```json
{
  "statusLine": {
    "type": "command",
    "command": "cc-status",
    "padding": 0
  }
}
```

Project settings override user-level settings.

### Verifying Installation

After configuring, restart Claude Code. You should see the statusline at the top:

```
⑂ main ✓ ↻ 19.6% 8.9M/45.6M ◐ 77% ◷ 3:36 2AM $47.35 ✽
```

### Troubleshooting

**Statusline not showing?**

1. **Check installation:**
   ```bash
   which cc-status  # Linux/macOS
   where cc-status  # Windows
   ```

2. **Test manually:**
   ```bash
   echo '{"workspace":{"current_dir":"."}}' | cc-status
   ```

3. **Check settings file location:**
   - Make sure you're editing the correct file
   - User-level: `~/.claude/settings.json`
   - Project-level: `.claude/settings.json` (in project root)

4. **Restart Claude Code** completely (not just the conversation)

**Command not found after installation?**

- **Linux/macOS**: Check if npm global bin is in your PATH
  ```bash
  npm config get prefix  # Should show global npm directory
  echo $PATH | grep npm  # Should include npm bin directory
  ```

- **Windows**: npm automatically adds to PATH during installation

**On Linux: "cannot execute: required file not found"**

This means the file has Windows line endings. The build process automatically fixes this, but if you encounter it:
```bash
npm run build  # Includes automatic line-ending fix
```

### Manual Testing

```bash
# Test the statusline
echo '{}' | cc-status

# Test with specific directory
echo '{"workspace":{"current_dir":"/path/to/project"}}' | cc-status
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

### Context Usage (◐ segment)
- **Primary source**: Claude Code's `context_window` data (most accurate, when available)
- **Fallback source**: Most recent transcript entry with usage data
- **Calculation**: `(total_input_tokens / context_window_size) * 100`
- **Color thresholds**: Normal (<50%), Yellow (50-69%), Red (70%+)

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

## Development

### Setup

```bash
git clone https://github.com/rgfx/cc-status.git
cd cc-status
npm install
npm run build
```

### Testing Local Changes

**Option 1: Link globally (recommended for testing)**

```bash
npm run build
npm link
```

Your global `cc-status` command will now use the local build. Changes workflow:
1. Edit source files in `src/`
2. Run `npm run build`
3. Statusline updates automatically in Claude Code

**Option 2: Use local build directly**

In your project's `.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/absolute/path/to/cc-status/dist/index.js",
    "padding": 0
  }
}
```

### Build Process

- **Build once**: `npm run build`
- **Watch mode**: `npm run dev` (rebuilds on file changes)
- **Line endings**: Automatically fixed during build (ensures Linux compatibility)

### Project Structure

```
cc-status/
├── src/
│   ├── index.ts              # Entry point
│   ├── renderer.ts           # Output formatting
│   ├── segments/             # Individual statusline segments
│   │   ├── git.ts
│   │   ├── subscription.ts
│   │   ├── context.ts
│   │   ├── session-timer.ts
│   │   └── burn-rate.ts
│   ├── services/             # Core services
│   │   ├── transcript-parser.ts
│   │   ├── claude-paths.ts
│   │   ├── limit-detection.ts
│   │   └── pricing.ts
│   └── config/               # Configuration handling
├── dist/                     # Built files (gitignored)
└── docs/                     # Additional documentation
```

## License

MIT © [rgfx](https://github.com/rgfx)

## Contributing

Issues and pull requests welcome at [rgfx/cc-status](https://github.com/rgfx/cc-status).