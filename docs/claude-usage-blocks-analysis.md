# Claude Usage Blocks: Data Structure & Analysis

## Overview

This document explains how Claude's 5-hour billing blocks work, what data we have access to, and our journey to implement accurate usage tracking in cc-status.

## How Claude's 5-Hour Blocks Work

### Core Concept
Claude uses **rolling 5-hour windows** for rate limiting and billing, NOT fixed time periods.

### Key Rules
1. **Block starts** when you begin using Claude after a gap
2. **Block lasts** for 5 hours from the start time
3. **Continuous usage** keeps you in the same block
4. **5+ hour gap** starts a new block

### Example Timeline
```
Day 1:
09:00-11:30  Block A (2.5 hours of usage)
[gap > 5h]
18:00-19:00  Block B (1 hour of usage)

Day 2:
08:00-12:00  Block C (4 hours continuous)
[gap > 5h]
20:00-21:00  Block D (current active block)
```

### Block Identification Algorithm (claude-powerline style)
```typescript
for (const entry of sortedEntries) {
  if (currentBlockStart == null) {
    // First entry - start new block (floored to hour)
    currentBlockStart = floorToHour(entryTime);
    currentBlockEntries = [entry];
  } else {
    const timeSinceBlockStart = entryTime - currentBlockStart;
    const timeSinceLastEntry = entryTime - lastEntryTime;

    // Two conditions for starting a new block:
    if (timeSinceBlockStart > 5h || timeSinceLastEntry > 5h) {
      blocks.push(currentBlockEntries);  // Close current block
      currentBlockStart = floorToHour(entryTime);
      currentBlockEntries = [entry];     // Start new block
    } else {
      currentBlockEntries.push(entry);   // Add to current block
    }
  }
}
```

## Data We Have Access To

### Transcript Files (.jsonl)
Located in: `~/.claude/projects/*/sessionId.jsonl`

### Sample Entry Structure
```json
{
  "timestamp": "2025-09-14T01:52:17.235Z",
  "message": {
    "usage": {
      "input_tokens": 3,
      "output_tokens": 194,
      "cache_creation_input_tokens": 375,
      "cache_read_input_tokens": 135896
    },
    "model": "claude-3-5-sonnet-20241022"
  },
  "costUSD": 0.12345,
  "isSidechain": false
}
```

### Token Types Explained
- **`input_tokens`**: New user input (small numbers: 3-1000)
- **`output_tokens`**: Claude's response tokens (medium: 50-5000)
- **`cache_creation_input_tokens`**: New context being cached (large: 1000-50000)
- **`cache_read_input_tokens`**: Cached context being reused (huge: 50000-200000)

### Current Session Data (Latest Debug Output)
```
Active block: 631 entries, 2.1h span
Token breakdown:
- input: 1,841 tokens
- output: 101,605 tokens
- cache_creation: 1,556,561 tokens
- cache_read: 53,260,804 tokens (excluded from limits)
```

## Implementation Journey: What We Tried

### Approach 1: Daily Total (FAILED)
**What we tried**: Sum all tokens from today's transcript files
```typescript
const dailyUsage = allEntries.reduce((sum, entry) =>
  sum + entry.usage.input_tokens + entry.usage.output_tokens + ...
);
```
**Result**: 6.9M tokens (too low vs expected 33.5M)
**Why it failed**: Not accounting for cache reads, wrong time period

### Approach 2: Daily Total + Cache Read (FAILED)
**What we tried**: Include cache_read_input_tokens in daily total
```typescript
const dailyUsageWithCache = allEntries.reduce((sum, entry) =>
  sum + entry.usage.input_tokens + entry.usage.output_tokens +
  entry.usage.cache_creation_input_tokens + entry.usage.cache_read_input_tokens
);
```
**Result**: 133M tokens (too high vs expected 33.5M)
**Why it failed**: Cache reads might not count toward limits, inflated by 4x

### Approach 3: Active Block Only (FAILED)
**What we tried**: Use only current 5-hour block, no cache reads
```typescript
const activeBlockUsage = activeBlock.reduce((sum, entry) =>
  sum + entry.usage.input_tokens + entry.usage.output_tokens +
  entry.usage.cache_creation_input_tokens
);
```
**Result**: 1.6M tokens (too low vs expected 33.5M)
**Why it failed**: Active block is only 2.1 hours, need cache reads

### Approach 4: Active Block + Cache Read (CURRENT)
**What we tried**: Current 5-hour block including cache reads
```typescript
const activeBlockWithCache = activeBlock.reduce((sum, entry) =>
  sum + entry.usage.input_tokens + entry.usage.output_tokens +
  entry.usage.cache_creation_input_tokens + entry.usage.cache_read_input_tokens
);
```
**Result**: 54.9M tokens (1.64x higher than expected 33.5M)
**Status**: Closest match, still investigating

## What We've Learned

### 1. Cache Reads Dominate Token Counts
- **Cache reads**: 53.3M tokens (97% of total)
- **New processing**: 1.7M tokens (3% of total)
- **Insight**: Heavy context reuse inflates token counts massively

### 2. Block vs Daily Calculations
| Approach | Tokens | Notes |
|----------|--------|-------|
| Active block (no cache) | 1.7M | Too low - missing cached context |
| Active block (with cache) | 54.9M | **Best match** - realistic for heavy usage |
| Daily total (no cache) | 6.9M | Too low - longer period but no cache |
| Daily total (with cache) | 133M | Too high - inflated by historical cache |

### 3. Limit Detection Issues
- **Current limit**: 45.6M tokens
- **Expected usage**: 33.5M tokens (73% utilization)
- **Actual calculation**: 54.9M tokens (120% utilization)
- **Hypothesis**: Either limit is wrong (~90M?) or calculation method differs

### 4. Block Identification Works Correctly
- **4 blocks found** from 23.7h of data (realistic)
- **Block sizes**: [108, 353, 466, 631] entries
- **Active block**: 631 entries over 2.1h (reasonable rate)

### 5. Data Quality Issues Solved
- **Deduplication**: 141 duplicate entries removed ✅
- **Sidechain filtering**: 0 sidechain entries (not an issue) ✅
- **Missing usage data**: 0 entries without usage (not an issue) ✅

## Current Status: Close But Not Perfect

### What's Working ✅
- Real token counts (not 0 anymore)
- Proper block identification
- Claude-powerline style filtering
- Reasonable usage numbers (54.9M for heavy 2.1h session)

### What's Still Wrong ❌
- **54.9M vs expected 33.5M** (1.64x too high)
- **120% vs expected 73%** utilization
- **Limit detection** might be incorrect (45.6M too low?)

## Next Steps to Investigate

### Option 1: Fix Limit Detection
- Current: 45.6M limit
- Maybe should be: ~75-90M limit
- Would make 54.9M usage reasonable (~65-73%)

### Option 2: Different Token Calculation
- Maybe cache reads count at 50% weight?
- Maybe exclude certain types of cache operations?
- Maybe use different time window?

### Option 3: Compare with ccusage Directly
- Run ccusage on same data
- See exact calculation differences
- Understand their block identification

### Option 4: Weight Cache Reads Differently
```typescript
const weightedUsage = activeBlock.reduce((sum, entry) =>
  sum + entry.usage.input_tokens + entry.usage.output_tokens +
  entry.usage.cache_creation_input_tokens +
  (entry.usage.cache_read_input_tokens * 0.6) // 60% weight
);
```

## Debug Data Reference

### Latest Test Results (2025-09-14 02:05)
- **Raw entries**: 1,699 → 1,558 after filtering
- **Active block**: 631 entries, 2.1h span
- **Token calculation**: 54.9M tokens
- **Percentage**: 120.4% of 45.6M limit
- **Expected**: ~33.5M tokens (~73% utilization)
- **Gap**: 1.64x too high

### Token Breakdown Detail
```
input_tokens:                   1,841 (0.003%)
output_tokens:                101,605 (0.18%)
cache_creation_input_tokens: 1,556,561 (2.8%)
cache_read_input_tokens:    53,260,804 (97%)
Total:                      54,920,811 tokens
```

This massive cache read percentage suggests either:
1. We're in a very context-heavy session (normal)
2. Cache reads shouldn't count at full weight (investigation needed)
3. The limit should account for cache-heavy workloads (~90M limit)