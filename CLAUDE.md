# cc-status - Claude Code Statusline

  ## ⚠️ CRITICAL REMINDERS - READ EVERY SESSION ⚠️
  **THESE RULES MUST BE FOLLOWED - NO EXCEPTIONS:**

  1. **🚫 NO ANTHROPIC/CLAUDE ATTRIBUTION IN COMMITS** - Never add Claude/Anthropic attribution to
  commit messages or PRs

## Project Overview

A focused, minimal statusline for Claude Code that shows what matters most in a clean single-line format:

```
⑂ main ✓  ↻ 48.6% (9404.3k/19342.8k)  ◷ 45k (76%)  ⟢ $1.20/h  ⏱ 16h left
```

## Target Format

- **⑂ main ✓** - Git status (branch + clean/dirty)
- **↻ 48.6% (9404.3k/19342.8k)** - Subscription usage (real ccusage data)  
- **◷ 45k (76%)** - Context usage (tokens + percentage remaining)
- **⟢ $1.20/h** - Cost burn rate (from session analysis)
- **⏱ 16h left** - Time until limit (calculated from usage + burn rate)

## Color Coding

- **🟢 Green (0-80%)**: Safe usage levels
- **🟡 Yellow (80-100%)**: Warning - approaching limits  
- **🔴 Red (100%+)**: Critical - over limits
- **⚪ White**: Informational (git, rates, time)

## Inspiration Sources

### 1. Owloops/claude-powerline
- **Repository**: https://github.com/Owloops/claude-powerline
- **Local Reference**: `./reference/claude-powerline/` (gitignored)
- **What we learned**: 
  - Excellent git service implementation
  - Context monitoring from transcript files
  - Metrics/burn rate calculations
  - Multi-line layout system
  - Color theming architecture

### 2. chongdashu/cc-statusline  
- **Repository**: https://github.com/chongdashu/cc-statusline
- **Local Reference**: `./reference/cc-statusline/` (gitignored)
- **What we learned**:
  - Direct ccusage subprocess integration (`npx ccusage blocks --json`)
  - Performance-focused bash implementation  
  - Real-time usage tracking approach
  - Simple configuration patterns
  - Block limit calculation methods

### 3. ryoppippi/ccusage (source of truth)
- **Repository**: https://github.com/ryoppippi/ccusage  
- **Local Reference**: `./reference/ccusage/` (gitignored)
- **What we need**:
  - Block limit calculation logic for `19,342,806 tokens`
  - Live monitor implementation (`--live` flag)
  - JSON output structure and field meanings

### Reference Setup
```bash
# Reference repos are cloned locally for analysis but gitignored
mkdir reference/
cd reference/
git clone https://github.com/Owloops/claude-powerline.git
git clone https://github.com/chongdashu/cc-statusline.git
git clone https://github.com/ryoppippi/ccusage.git
```

## Architecture Decisions

### Cross-Platform Focus
- **TypeScript/Node.js** for Windows PowerShell compatibility
- **Subprocess calls** to ccusage instead of library imports
- **ANSI colors** for terminal compatibility

### Data Sources
- **ccusage subprocess**: `npx ccusage blocks --json` for real subscription data
- **ccusage live monitor**: `npx ccusage@latest blocks --live` for debugging/verification
- **Transcript files**: Direct parsing for context usage
- **Git commands**: `git` subprocess calls for repository status
- **Session analysis**: Calculate burn rates from transcript data

### Configuration
- **Simple JSON config** for segment enable/disable and colors
- **Minimal dependencies** for fast execution
- **Graceful fallbacks** when data unavailable

## Implementation Plan

### Phase 1: Foundation
- [x] Project structure and build system
- [x] Basic CLI interface  
- [ ] Git segment (proven working implementation)
- [ ] Dummy subscription segment (placeholder)

### Phase 2: Real Data Integration
- [ ] Direct ccusage subprocess integration
- [ ] Context monitoring from transcript files
- [ ] Session burn rate calculations
- [ ] Time projection logic

### Phase 3: Polish
- [ ] Color-coded output with thresholds
- [ ] JSON configuration system
- [ ] Error handling and fallbacks
- [ ] Performance optimization

## Technical Requirements

- **Node.js**: >=18.0.0
- **ccusage**: Available via npx (for subscription data)
- **git**: Available in PATH (for git status)
- **Claude Code**: Transcript files access

## Usage

```json
{
  "statusLine": {
    "type": "command",
    "command": "cc-status"
  }
}
```

## Feature Roadmap

### Core Features (MVP)
- [ ] Git branch and status detection
- [ ] Real ccusage subscription usage via subprocess 
- [ ] Context usage from transcript files
- [ ] Basic color coding (green/yellow/red)
- [ ] Clean single-line output format

### Enhanced Features
- [ ] Burn rate calculations (cost/tokens per hour)
- [ ] Time remaining projections
- [ ] Daily vs session usage tracking
- [ ] Configurable segment visibility
- [ ] Custom color themes
- [ ] Multiple output formats
- [ ] Caching for performance

### Future Considerations
- [ ] tmux integration
- [ ] Custom segments via plugins
- [ ] Usage alerts/notifications
- [ ] Historical usage trends
- [ ] Integration with other Claude tools