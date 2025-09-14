# Debug Output in cc-status

## How Debug Output Works

cc-status uses `console.error()` for debug logging, which sends output to **stderr** (standard error) instead of **stdout** (standard output). This keeps debug messages separate from the actual statusline output.

- **stdout**: Clean statusline output (what Claude Code displays)
- **stderr**: Debug messages (usually hidden from statusline)

## When Debug Output Appears in Statusline

If debug messages start appearing in your Claude Code statusline, it means:

1. **stderr is being redirected to stdout** somewhere in the pipeline
2. **Claude Code is capturing both streams**
3. **There's a bug in the debug logging** (using `console.log()` instead of `console.error()`)

## How to View Debug Output

### Method 1: Redirect stderr to file
```bash
cd "C:\projects\cc-status"
echo '{"session_id":"test","workspace":{"current_dir":"C:/projects/cc-status","project_dir":"C:/projects/cc-status"},"model":{"id":"claude-3-5-sonnet","display_name":"Claude"}}' | ./dist/index.js 2> debug.log
cat debug.log
```

### Method 2: Merge stderr with stdout
```bash
cd "C:\projects\cc-status"
echo '{"session_id":"test","workspace":{"current_dir":"C:/projects/cc-status","project_dir":"C:/projects/cc-status"},"model":{"id":"claude-3-5-sonnet","display_name":"Claude"}}' | ./dist/index.js 2>&1
```

### Method 3: Enable debug mode (if implemented)
```bash
set CC_STATUS_DEBUG=1
# Then run normal statusline command
```

## Fixing Debug Pollution in Statusline

If debug messages flood your Claude Code window:

### Quick Fix - Remove All Debug Logging
```bash
# Search for debug output in the codebase
grep -r "console.error.*DEBUG" src/

# Remove or comment out the debug lines
```

### Proper Fix - Use Environment Variable
```typescript
// Only show debug in development
if (process.env.CC_STATUS_DEBUG) {
  console.error(`[DEBUG] Your debug message here`);
}
```

### Nuclear Option - Disable All console.error
```typescript
// At top of src/index.ts
if (!process.env.CC_STATUS_DEBUG) {
  console.error = () => {}; // Disable all stderr output
}
```

## Debug Message Format

Current debug messages follow this format:
```
[SUBSCRIPTION DEBUG] Message content here
[SESSION DEBUG] Message content here
```

## Common Debug Scenarios

### Token Count Investigation
- Shows filtering steps (sidechain, duplicates, no-usage)
- Token breakdown (input, output, cache creation, cache read)
- Block identification results
- Time span analysis

### Session Timer Issues
- Block identification across all sessions
- Reset time calculations
- Active block detection logic

### Context Usage Problems
- File parsing results
- Context percentage calculations
- Maximum context limit detection

## Cleanup After Debugging

Always remove debug output before committing:

1. **Find debug statements**: `grep -r "console.error.*DEBUG" src/`
2. **Remove or wrap in env check**: Use `CC_STATUS_DEBUG` environment variable
3. **Test clean output**: Ensure statusline shows only intended content
4. **Commit clean version**: No debug pollution in production

## Prevention

- Always use `console.error()` for debug (not `console.log()`)
- Wrap debug statements in environment checks
- Test statusline output before committing
- Use descriptive debug prefixes for easy removal