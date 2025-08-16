# cc-status: ccusage Removal Implementation Plan

## 🎯 Objective
Remove ccusage dependency completely while maintaining all functionality:
- `↻ 40.7% 18.5M/45.6M` - Daily subscription usage 
- `$18.85` - Daily session cost
- `◷ 10m 9PM` - Session timer with reset countdown
- `✽` - Burn rate indicator

## 🔍 Current ccusage Dependencies

### 1. Subscription Service (`src/segments/subscription.ts`)
**Current**: Uses `npx ccusage@latest blocks --json`
```typescript
// Gets: tokensUsed, tokensLimit, resetTime, projection data
const activeBlock = ccusageData.blocks.find(block => block.isActive === true);
```

### 2. Session Timer (`src/segments/session-timer.ts`) 
**Current**: Uses ccusage block data for reset time
```typescript
const resetTimeStr = activeBlock.usageLimitResetTime || activeBlock.endTime;
```

### 3. Burn Rate Calculation (`src/renderer.ts:118`)
**Current**: Uses ccusage projection data
```typescript
// Uses activeBlock.projection for burn rate calculations
```

## 🚀 Implementation Strategy

### Phase 1: Transcript File Parsing System
**Goal**: Replace ccusage with direct transcript parsing

#### 1.1 Create Transcript Parser (`src/services/transcript-parser.ts`)
```typescript
interface TranscriptEntry {
  timestamp: string;
  message: {
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    model?: { id: string };
  };
  costUSD?: number;
}

class TranscriptParser {
  async findTodaysTranscripts(): Promise<string[]>
  async parseTranscriptFile(path: string): Promise<TranscriptEntry[]>
  async getDailyUsage(): Promise<DailyUsage>
}
```

#### 1.2 Claude Path Discovery (from claude-powerline)
```typescript
// Copy from reference/claude-powerline/src/utils/claude.ts
export function getClaudePaths(): string[]
export async function findProjectPaths(claudePaths: string[]): Promise<string[]>
export async function findTranscriptFiles(date: Date): Promise<string[]>
```

### Phase 2: Pricing System Integration
**Goal**: Calculate costs without ccusage

#### 2.1 Adopt claude-powerline Pricing (`src/services/pricing.ts`)
```typescript
// Copy pricing.ts from reference/claude-powerline/src/segments/pricing.ts
export class PricingService {
  static async getCurrentPricing(): Promise<Record<string, ModelPricing>>
  static async calculateCostForEntry(entry: TranscriptEntry): Promise<number>
  static fuzzyMatchModel(modelId: string): ModelPricing
}
```

#### 2.2 Daily Cost Calculation
```typescript
class DailyCostService {
  async getDailyCost(): Promise<number> {
    const transcripts = await transcriptParser.findTodaysTranscripts();
    let totalCost = 0;
    
    for (const transcript of transcripts) {
      const entries = await transcriptParser.parseTranscriptFile(transcript);
      for (const entry of entries) {
        totalCost += await PricingService.calculateCostForEntry(entry);
      }
    }
    
    return totalCost;
  }
}
```

### Phase 3: Usage Limit Discovery
**Goal**: Determine daily token limits without ccusage

#### 3.1 Historical Analysis Approach
```typescript
class UsageLimitService {
  async estimateDailyLimit(): Promise<number> {
    // Strategy: Analyze last 30 days of transcript files
    // Find the highest daily usage that didn't get throttled
    const last30Days = this.getLast30Days();
    let maxObservedUsage = 0;
    
    for (const date of last30Days) {
      const dayUsage = await this.getDayUsage(date);
      if (dayUsage > maxObservedUsage) {
        maxObservedUsage = dayUsage;
      }
    }
    
    // Add buffer for safety (ccusage shows we've gone higher)
    return Math.max(maxObservedUsage * 1.2, 45_600_000); // Minimum 45.6M observed
  }
}
```

#### 3.2 Configuration Fallback
```typescript
// Add to cc-status.json config
interface Config {
  subscription: {
    dailyTokenLimit?: number; // Manual override
    autoDetectLimit?: boolean; // Default: true
  }
}
```

### Phase 4: Reset Time Detection
**Goal**: Determine when daily usage resets

#### 4.1 Reset Time Discovery
```typescript
class ResetTimeService {
  async detectResetTime(): Promise<Date> {
    // Strategy 1: Look for usage pattern breaks in transcript history
    // Strategy 2: Assume 24hr cycle from first usage today
    // Strategy 3: Configuration override
    
    const firstUsageToday = await this.getFirstUsageToday();
    if (firstUsageToday) {
      // Assume 24hr cycle from first usage
      return new Date(firstUsageToday.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // Fallback: next midnight local time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }
}
```

### Phase 5: Replace ccusage Calls

#### 5.1 Update SubscriptionService
```typescript
export class SubscriptionService {
  private transcriptParser = new TranscriptParser();
  private pricingService = new PricingService();
  private limitService = new UsageLimitService();
  
  async getSubscriptionInfo(): Promise<SubscriptionInfo | null> {
    try {
      // Replace ccusage call with transcript parsing
      const dailyUsage = await this.transcriptParser.getDailyUsage();
      const tokensUsed = dailyUsage.totalTokens;
      const tokensLimit = await this.limitService.estimateDailyLimit();
      
      const percentage = tokensLimit > 0 ? (tokensUsed / tokensLimit) * 100 : 0;
      
      return {
        percentage: Math.round(percentage * 10) / 10,
        tokensUsed,
        tokensLimit,
        isOverLimit: percentage > 100,
        projection: await this.calculateProjection(dailyUsage)
      };
    } catch (error) {
      return this.getFallbackData();
    }
  }
  
  // Remove callCcusage() method entirely
}
```

#### 5.2 Update SessionTimerService  
```typescript
export class SessionTimerService {
  private resetTimeService = new ResetTimeService();
  
  async getSessionTimer(): Promise<SessionTimerInfo | null> {
    try {
      const resetTime = await this.resetTimeService.detectResetTime();
      const now = new Date();
      
      // Same timing calculation logic, just different data source
      const remainingMs = resetTime.getTime() - now.getTime();
      // ... rest of existing logic unchanged
      
      return {
        timeRemaining,
        resetTime: resetTimeFormatted,
        isNearReset
      };
    } catch (error) {
      return null;
    }
  }
}
```

## 📊 Data Flow Comparison

### Before (with ccusage):
```
ccusage blocks --json → activeBlock → tokens/cost/resetTime
```

### After (transcript-based):
```
~/.claude/projects/*/*.jsonl → transcript parser → daily usage aggregation
                            ↓
pricing.json → cost calculation
historical analysis → limit estimation  
usage patterns → reset time detection
```

## 🔄 Migration Steps

### Step 1: Build Infrastructure
1. ✅ Copy claude-powerline transcript parsing logic
2. ✅ Copy claude-powerline pricing system  
3. ✅ Create limit detection service
4. ✅ Create reset time detection service

### Step 2: Test in Parallel
1. ✅ Run both ccusage and new system side-by-side
2. ✅ Compare outputs for accuracy
3. ✅ Adjust limit detection until matching ccusage

### Step 3: Replace Services
1. ✅ Update SubscriptionService to use new system
2. ✅ Update SessionTimerService to use new system  
3. ✅ Remove ccusage subprocess calls
4. ✅ Update burn rate calculations

### Step 4: Configuration & Fallbacks
1. ✅ Add manual limit override to config
2. ✅ Ensure graceful fallbacks when transcript parsing fails
3. ✅ Update documentation

## ⚠️ Potential Challenges

### 1. **Limit Detection Accuracy**
**Challenge**: Getting exact daily limit without ccusage
**Solution**: Historical analysis + configuration override

### 2. **Reset Time Precision** 
**Challenge**: Determining exact reset time
**Solution**: Pattern analysis + reasonable defaults

### 3. **Performance**
**Challenge**: Parsing multiple transcript files vs single ccusage call
**Solution**: Caching, background processing, date filtering

### 4. **Data Availability**
**Challenge**: New installations without transcript history
**Solution**: Conservative defaults, gradual learning

## 🎯 Success Criteria

1. ✅ **Identical Output**: `↻ 40.7% 18.5M/45.6M` matches ccusage exactly
2. ✅ **Performance**: Response time under 500ms (current: ~200ms with ccusage)
3. ✅ **Reliability**: Works without ccusage installation
4. ✅ **Accuracy**: Cost calculations within 1% of ccusage
5. ✅ **Robustness**: Graceful fallbacks when data unavailable

## 📝 Implementation Timeline

- **Week 1**: Build transcript parsing infrastructure
- **Week 2**: Implement pricing and cost calculation  
- **Week 3**: Add limit detection and reset time logic
- **Week 4**: Replace ccusage calls and testing
- **Week 5**: Configuration, fallbacks, and documentation

This plan completely eliminates ccusage while maintaining feature parity through direct transcript file analysis and historical pattern detection.