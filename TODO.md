# cc-status Feature Roadmap

## Phase 1: Foundation ✅
- [x] Project structure and build system
- [x] Basic CLI interface with help
- [x] Working Git segment (branch, status, ahead/behind)
- [x] Dummy Subscription segment (placeholder)
- [x] JSON configuration system
- [x] Color utilities and ANSI support
- [x] Basic renderer with segment separation

## Phase 2: Real Data Integration 🚧
- [ ] **Direct ccusage subprocess integration**
  - [ ] Call `npx ccusage blocks --json` 
  - [ ] Parse JSON output for active session
  - [ ] Extract current usage vs limits
  - [ ] Handle ccusage errors gracefully

- [ ] **Context monitoring from transcript files**
  - [ ] Find transcript file from session_id
  - [ ] Parse for most recent context usage
  - [ ] Calculate percentage remaining (80% usable limit)
  - [ ] Handle auto-compact threshold

- [ ] **Session burn rate calculations**
  - [ ] Parse transcript for session start time
  - [ ] Calculate cost/tokens per hour from session data
  - [ ] Track usage velocity

- [ ] **Time projection logic**
  - [ ] Combine burn rate + remaining limits
  - [ ] Calculate time until daily limit reached
  - [ ] Handle multiple time scenarios (session vs daily)

## Phase 3: Enhanced Features 🔮
- [ ] **Advanced ccusage integration**
  - [ ] Daily total vs current session tracking
  - [ ] Handle 4-hour reset periods correctly
  - [ ] Support both session and cumulative views

- [ ] **Improved configuration**
  - [ ] Load config from multiple locations (./.cc-status.json, ~/.cc-status.json)
  - [ ] CLI argument overrides (--config, --theme)
  - [ ] Environment variable support

- [ ] **Error handling and fallbacks**
  - [ ] Graceful degradation when ccusage unavailable
  - [ ] Timeout handling for git commands
  - [ ] Fallback colors for unsupported terminals

- [ ] **Performance optimization**
  - [ ] Parallel data fetching
  - [ ] Caching for expensive operations
  - [ ] Execution time under 100ms target

## Phase 4: Polish & Extension 🌟
- [ ] **Color themes**
  - [ ] Built-in themes (dark, light, nord, etc.)
  - [ ] Custom hex color support
  - [ ] Terminal capability detection

- [ ] **Output formats**
  - [ ] Single line (default)
  - [ ] Multi-line option
  - [ ] Minimal mode (no icons)
  - [ ] JSON output for scripting

- [ ] **Advanced segments**
  - [ ] tmux integration
  - [ ] Custom segments via plugins
  - [ ] Model information display
  - [ ] Usage alerts/notifications

- [ ] **Developer experience**
  - [ ] Debug mode with verbose logging
  - [ ] Test data generation
  - [ ] Performance benchmarking
  - [ ] Documentation improvements

## Technical Debt & Maintenance 🔧
- [ ] **Testing**
  - [ ] Unit tests for all segments
  - [ ] Integration tests with real data
  - [ ] Cross-platform testing (Windows/macOS/Linux)

- [ ] **Documentation**
  - [ ] README with setup instructions
  - [ ] Configuration examples
  - [ ] Troubleshooting guide
  - [ ] Contributing guidelines

- [ ] **Release & Distribution**
  - [ ] npm package publication
  - [ ] GitHub releases with binaries
  - [ ] Installation scripts
  - [ ] Version management

## Known Issues & Considerations 🐛
- [ ] **ccusage dependencies**
  - Need to handle cases where ccusage is not installed
  - Different ccusage versions may have different JSON output
  - Rate limiting on ccusage calls

- [ ] **Cross-platform compatibility**
  - Windows PowerShell path handling
  - Unix vs Windows command differences
  - Terminal color support variations

- [ ] **Performance constraints**
  - Git commands can be slow in large repos
  - Transcript file parsing for large files
  - Subprocess call overhead

## Future Ideas 💡
- [ ] Integration with other Claude tools
- [ ] Historical usage trend analysis
- [ ] Usage budget alerts
- [ ] Team usage sharing
- [ ] Custom dashboard views
- [ ] API for external integrations