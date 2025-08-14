import fs from "node:fs";

export interface BurnRateInfo {
  tokensPerMinute: number;
  tokensPerMinuteForIndicator: number; // Non-cache tokens only, for thresholds
  costPerHour: number;
  projection: {
    totalTokens: number;
    totalCost: number;
    remainingMinutes: number;
  } | null;
}

interface TranscriptEntry {
  timestamp?: string;
  message?: {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  costUSD?: number;
  isSidechain?: boolean;
}

export class BurnRateService {
  private readonly BURN_RATE_THRESHOLDS = {
    HIGH: 1000,
    MODERATE: 500,
  } as const;
  
  // Claude's 5-hour session duration in milliseconds
  private readonly SESSION_DURATION_MS = 5 * 60 * 60 * 1000;

  async getBurnRateInfo(transcriptPath?: string): Promise<BurnRateInfo | null> {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      return null;
    }

    try {
      const entries = this.parseTranscriptEntries(transcriptPath);
      if (entries.length < 2) {
        return null; // Need at least 2 entries to calculate rate
      }

      return this.calculateBurnRate(entries);
    } catch (error) {
      return null;
    }
  }

  private parseTranscriptEntries(transcriptPath: string): TranscriptEntry[] {
    const content = fs.readFileSync(transcriptPath, 'utf-8');
    if (!content) {
      return [];
    }

    const lines = content.trim().split('\n');
    const entries: TranscriptEntry[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry: TranscriptEntry = JSON.parse(line);
        
        // Skip sidechain entries and entries without usage data
        if (entry.isSidechain === true || !entry.message?.usage || !entry.timestamp) {
          continue;
        }

        // Only include entries with token usage
        const usage = entry.message.usage;
        const hasTokens = (usage.input_tokens || 0) > 0 || 
                         (usage.output_tokens || 0) > 0 || 
                         (usage.cache_creation_input_tokens || 0) > 0 || 
                         (usage.cache_read_input_tokens || 0) > 0;
        
        if (hasTokens) {
          entries.push(entry);
        }
      } catch {
        // Skip malformed JSON lines
        continue;
      }
    }

    // Sort by timestamp
    return entries.sort((a, b) => 
      new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()
    );
  }

  private calculateBurnRate(entries: TranscriptEntry[]): BurnRateInfo | null {
    if (entries.length < 2) {
      return null;
    }

    const firstEntry = entries[0];
    const lastEntry = entries[entries.length - 1];
    
    if (!firstEntry?.timestamp || !lastEntry?.timestamp) {
      return null;
    }

    const firstTime = new Date(firstEntry.timestamp);
    const lastTime = new Date(lastEntry.timestamp);
    const durationMinutes = (lastTime.getTime() - firstTime.getTime()) / (1000 * 60);

    if (durationMinutes <= 0) {
      return null;
    }

    // Aggregate token counts and costs
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheCreationTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCost = 0;

    for (const entry of entries) {
      const usage = entry.message?.usage;
      if (usage) {
        totalInputTokens += usage.input_tokens || 0;
        totalOutputTokens += usage.output_tokens || 0;
        totalCacheCreationTokens += usage.cache_creation_input_tokens || 0;
        totalCacheReadTokens += usage.cache_read_input_tokens || 0;
      }
      totalCost += entry.costUSD || 0;
    }

    // Calculate rates
    const totalTokens = totalInputTokens + totalOutputTokens + totalCacheCreationTokens + totalCacheReadTokens;
    const tokensPerMinute = totalTokens / durationMinutes;
    
    // For thresholds, use only non-cache tokens (like ccusage does)
    const nonCacheTokens = totalInputTokens + totalOutputTokens;
    const tokensPerMinuteForIndicator = nonCacheTokens / durationMinutes;
    
    let costPerHour = (totalCost / durationMinutes) * 60;

    // If no cost data available, estimate using rough Claude pricing
    if (totalCost === 0 && totalTokens > 0) {
      // Rough estimate: $3 per 1M input tokens, $15 per 1M output tokens for Sonnet
      // Cache tokens are much cheaper - roughly $0.30 per 1M
      const estimatedCost = 
        (totalInputTokens * 3 / 1_000_000) +
        (totalOutputTokens * 15 / 1_000_000) +
        (totalCacheCreationTokens * 3.75 / 1_000_000) + // Cache creation = 1.25x input
        (totalCacheReadTokens * 0.30 / 1_000_000); // Cache read is much cheaper
      
      costPerHour = (estimatedCost / durationMinutes) * 60;
    }

    // Calculate projection like ccusage does
    const projection = this.projectUsage(entries, tokensPerMinute, costPerHour);

    return {
      tokensPerMinute,
      tokensPerMinuteForIndicator,
      costPerHour,
      projection,
    };
  }

  private projectUsage(
    entries: TranscriptEntry[], 
    tokensPerMinute: number, 
    costPerHour: number
  ): { totalTokens: number; totalCost: number; remainingMinutes: number } | null {
    if (entries.length === 0) {
      return null;
    }

    // Find session start time (floored to hour like ccusage does)
    const firstEntry = entries[0];
    if (!firstEntry?.timestamp) {
      return null;
    }

    const firstTime = new Date(firstEntry.timestamp);
    const sessionStart = this.floorToHour(firstTime);
    const sessionEnd = new Date(sessionStart.getTime() + this.SESSION_DURATION_MS);
    
    const now = new Date();
    const remainingTime = sessionEnd.getTime() - now.getTime();
    const remainingMinutes = Math.max(0, remainingTime / (1000 * 60));

    // Calculate current total tokens used in this session
    let currentTotalTokens = 0;
    let currentTotalCost = 0;

    for (const entry of entries) {
      const usage = entry.message?.usage;
      if (usage) {
        currentTotalTokens += 
          (usage.input_tokens || 0) +
          (usage.output_tokens || 0) +
          (usage.cache_creation_input_tokens || 0) +
          (usage.cache_read_input_tokens || 0);
      }
      currentTotalCost += entry.costUSD || 0;
    }

    // Project total for full session
    const projectedAdditionalTokens = tokensPerMinute * remainingMinutes;
    const projectedAdditionalCost = (costPerHour / 60) * remainingMinutes;

    return {
      totalTokens: Math.round(currentTotalTokens + projectedAdditionalTokens),
      totalCost: Math.round((currentTotalCost + projectedAdditionalCost) * 100) / 100,
      remainingMinutes: Math.round(remainingMinutes),
    };
  }

  private floorToHour(timestamp: Date): Date {
    const floored = new Date(timestamp);
    floored.setUTCMinutes(0, 0, 0);
    return floored;
  }
}