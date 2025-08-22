# Block Identification Simplification

## Current Problem

Our token counting is severely inflated compared to ccusage:
- **cc-status**: 159.1% (61.8M/38.8M)  
- **ccusage**: 0.2% (99.7k/45570.9k)
- **Reality**: User can still work with Claude, so not over limit

## Root Cause

Our current block identification algorithm (`identifySessionBlocks` + `getCurrentActiveBlock`) is too complex and appears to be aggregating tokens from multiple blocks or incorrect time periods.

## Claude-Powerline's Simpler Approach

After pulling latest claude-powerline updates, they use a much cleaner approach in `src/segments/block.ts`:

### Key Differences

1. **Day-ago filter**: Only look at entries from last 24 hours
```typescript
const dayAgo = new Date();
dayAgo.setDate(dayAgo.getDate() - 1);
```

2. **Simpler active block detection**: 
```typescript
const isActive =
  now.getTime() - actualEndTime.getTime() < sessionDurationMs &&
  now < endTime;
```

3. **Most recent block logic**: `findActiveBlock()` just finds the most recent active block, not complex cross-session aggregation

### Their Algorithm Flow

1. Load entries from last day only
2. Identify session blocks using same 5-hour logic
3. Find most recent active block (simple iteration)
4. Return tokens from that block only

## Implementation Plan

### Phase 1: Simplify Current Logic
- [ ] Add day-ago filter to `getCurrentBlockUsageAcrossAllSessions()`
- [ ] Simplify active block detection logic
- [ ] Remove complex cross-session aggregation

### Phase 2: Adopt Claude-Powerline Approach
- [ ] Copy their `BlockProvider` class approach
- [ ] Use their simpler `findActiveBlock()` method  
- [ ] Test against known working values

### Phase 3: Validation
- [ ] Compare results with ccusage output
- [ ] Ensure reasonable token counts (should be much lower than 61M)
- [ ] Verify against actual Claude usage limits

## Files to Modify

1. **`src/services/transcript-parser.ts`**:
   - `getCurrentBlockUsageAcrossAllSessions()` method
   - Simplify `identifySessionBlocks()` usage

2. **`src/segments/subscription.ts`**:
   - May need limit calculation adjustments

## Expected Outcome

Token usage should drop from 61.8M to a much more reasonable number (likely under 10M for a 1.5-hour session), bringing the percentage down from 159% to something realistic like 5-25%.

## References

- `reference/claude-powerline/src/segments/block.ts` - Their simplified approach
- ccusage output showing 0.2% - Target accuracy level
- Current implementation showing 159% - What we need to fix