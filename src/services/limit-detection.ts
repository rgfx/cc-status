import { TranscriptParser, type DailyUsage } from "./transcript-parser";

export interface UsageLimit {
  dailyTokenLimit: number;
  confidence: 'high' | 'medium' | 'low' | 'fallback';
  source: 'historical_analysis' | 'configuration' | 'conservative_estimate' | 'fallback';
  lastUpdated: Date;
}

export class LimitDetectionService {
  private transcriptParser = new TranscriptParser();
  private cachedLimit: UsageLimit | null = null;
  private readonly CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

  /**
   * Get the estimated daily token limit (actually per-block limit like ccusage)
   */
  async getDailyTokenLimit(): Promise<UsageLimit> {
    // Return cached result if still fresh
    if (this.cachedLimit && 
        Date.now() - this.cachedLimit.lastUpdated.getTime() < this.CACHE_TTL) {
      return this.cachedLimit;
    }

    try {
      // Use ccusage-style logic: find max historical usage in a single period
      const historicalLimit = await this.detectFromHistoricalUsage();
      if (historicalLimit.confidence !== 'fallback') {
        this.cachedLimit = historicalLimit;
        return historicalLimit;
      }

      // Fallback to conservative estimate
      const fallbackLimit = this.getConservativeFallback();
      this.cachedLimit = fallbackLimit;
      return fallbackLimit;
      
    } catch (error) {
      const fallbackLimit = this.getConservativeFallback();
      this.cachedLimit = fallbackLimit;
      return fallbackLimit;
    }
  }

  /**
   * Analyze historical usage to estimate 5-hour block limits (like ccusage)
   * Uses statistical approach rather than single max values
   */
  private async detectFromHistoricalUsage(): Promise<UsageLimit> {
    try {
      // Get 5-hour block usage patterns from last 30 days
      const historicalBlocks = await this.getHistoricalBlockUsage(30);
      
      if (historicalBlocks.length === 0) {
        return this.getConservativeFallback();
      }

      // Statistical analysis instead of max single value
      const tokenCounts = historicalBlocks.map(block => block.totalTokens).sort((a, b) => b - a);
      
      // Use 95th percentile as likely limit (more robust than max)
      const percentile95Index = Math.floor(tokenCounts.length * 0.05);
      const percentile95 = tokenCounts[percentile95Index] || 0;
      
      // Use 99th percentile to catch potential limits
      const percentile99Index = Math.floor(tokenCounts.length * 0.01);
      const percentile99 = tokenCounts[percentile99Index] || 0;
      
      // Look for clustering around specific values (indicates hitting limits)
      const potentialLimits = this.findLimitClusters(tokenCounts);
      
      let estimatedLimit: number;
      let confidence: 'high' | 'medium' | 'low';

      if (potentialLimits.length > 0 && percentile99 > 30_000_000) {
        // Found clustering around specific values - likely real limits
        estimatedLimit = Math.max(...potentialLimits);
        confidence = 'high';
      } else if (percentile95 > 40_000_000) {
        // High 95th percentile suggests we're near limits
        estimatedLimit = percentile99;
        confidence = 'medium';
      } else if (percentile95 > 20_000_000) {
        // Moderate usage - use 99th percentile but be conservative
        estimatedLimit = Math.max(percentile99, 45_600_000);
        confidence = 'low';
      } else {
        // Low usage - use fallback
        estimatedLimit = 45_600_000;
        confidence = 'low';
      }

      return {
        dailyTokenLimit: Math.round(estimatedLimit),
        confidence,
        source: 'historical_analysis',
        lastUpdated: new Date()
      };

    } catch (error) {
      return this.getConservativeFallback();
    }
  }

  /**
   * Group transcript entries into 5-hour blocks like ccusage
   */
  private async getHistoricalBlockUsage(days: number): Promise<{totalTokens: number, date: Date}[]> {
    const blocks: {totalTokens: number, date: Date}[] = [];
    const claudePaths = await import('./claude-paths').then(m => m.getClaudePaths());
    const projectPaths = await import('./claude-paths').then(m => m.findProjectPaths(claudePaths));
    
    const today = new Date();
    
    for (const projectPath of projectPaths) {
      try {
        const entries = await import('node:fs/promises').then(fs => fs.readdir(projectPath, { withFileTypes: true }));
        
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith('.jsonl')) {
            const transcriptPath = await import('node:path').then(path => path.join(projectPath, entry.name));
            
            try {
              const stats = await import('node:fs/promises').then(fs => fs.stat(transcriptPath));
              const fileDate = new Date(stats.mtime);
              const daysDiff = (today.getTime() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
              
              if (daysDiff <= days) {
                const sessionUsage = await this.transcriptParser.parseTranscriptFile(transcriptPath);
                
                // Group entries into 5-hour blocks (like ccusage)
                const sessionBlocks = this.groupInto5HourBlocks(sessionUsage);
                
                for (const block of sessionBlocks) {
                  if (block.totalTokens > 0) {
                    blocks.push({
                      totalTokens: block.totalTokens,
                      date: block.startTime
                    });
                  }
                }
              }
            } catch (statError) {
              // Skip files that can't be read
              continue;
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be read
        continue;
      }
    }
    
    return blocks;
  }

  /**
   * Group transcript entries into 5-hour blocks (like ccusage session blocks)
   */
  private groupInto5HourBlocks(entries: any[]): {totalTokens: number, startTime: Date}[] {
    if (entries.length === 0) return [];
    
    // Sort entries by timestamp
    const sortedEntries = entries.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const blocks: {totalTokens: number, startTime: Date}[] = [];
    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
    
    let currentBlockStart = new Date(sortedEntries[0].timestamp);
    let currentBlockTokens = 0;
    
    for (const entry of sortedEntries) {
      const entryTime = new Date(entry.timestamp);
      
      // If entry is more than 5 hours from current block start, create new block
      if (entryTime.getTime() - currentBlockStart.getTime() > FIVE_HOURS_MS) {
        if (currentBlockTokens > 0) {
          blocks.push({
            totalTokens: currentBlockTokens,
            startTime: new Date(currentBlockStart)
          });
        }
        
        // Start new block
        currentBlockStart = new Date(entryTime);
        currentBlockTokens = 0;
      }
      
      // Add entry tokens to current block
      if (entry.message?.usage) {
        const usage = entry.message.usage;
        currentBlockTokens += (usage.input_tokens || 0) + 
                             (usage.output_tokens || 0) + 
                             (usage.cache_creation_input_tokens || 0) + 
                             (usage.cache_read_input_tokens || 0);
      }
    }
    
    // Add final block
    if (currentBlockTokens > 0) {
      blocks.push({
        totalTokens: currentBlockTokens,
        startTime: new Date(currentBlockStart)
      });
    }
    
    return blocks;
  }

  /**
   * Find clusters of similar token values that might indicate limits
   */
  private findLimitClusters(tokenCounts: number[]): number[] {
    if (tokenCounts.length < 5) return [];
    
    const clusters: number[] = [];
    const CLUSTER_THRESHOLD = 0.02; // 2% variation
    
    // Group similar values
    const groups: number[][] = [];
    
    for (const count of tokenCounts) {
      let addedToGroup = false;
      
      for (const group of groups) {
        const groupAvg = group.reduce((sum, val) => sum + val, 0) / group.length;
        const variation = Math.abs(count - groupAvg) / groupAvg;
        
        if (variation <= CLUSTER_THRESHOLD) {
          group.push(count);
          addedToGroup = true;
          break;
        }
      }
      
      if (!addedToGroup) {
        groups.push([count]);
      }
    }
    
    // Find significant clusters (at least 3 similar values)
    for (const group of groups) {
      if (group.length >= 3) {
        const avgValue = group.reduce((sum, val) => sum + val, 0) / group.length;
        if (avgValue > 30_000_000) { // Only consider high values as potential limits
          clusters.push(Math.round(avgValue));
        }
      }
    }
    
    return clusters.sort((a, b) => b - a);
  }

  /**
   * Get all individual session usage data for analysis (legacy method)
   */
  private async getAllHistoricalSessions(days: number): Promise<{totalTokens: number, date: Date}[]> {
    const sessions: {totalTokens: number, date: Date}[] = [];
    const claudePaths = await import('./claude-paths').then(m => m.getClaudePaths());
    const projectPaths = await import('./claude-paths').then(m => m.findProjectPaths(claudePaths));
    
    const today = new Date();
    
    for (const projectPath of projectPaths) {
      try {
        const entries = await import('node:fs/promises').then(fs => fs.readdir(projectPath, { withFileTypes: true }));
        
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith('.jsonl')) {
            const transcriptPath = await import('node:path').then(path => path.join(projectPath, entry.name));
            
            try {
              const stats = await import('node:fs/promises').then(fs => fs.stat(transcriptPath));
              const fileDate = new Date(stats.mtime);
              const daysDiff = (today.getTime() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
              
              if (daysDiff <= days) {
                const sessionUsage = await this.transcriptParser.parseTranscriptFile(transcriptPath);
                const tokenBreakdown = this.transcriptParser.calculateTokenBreakdown(sessionUsage);
                
                if (tokenBreakdown.total > 0) {
                  sessions.push({
                    totalTokens: tokenBreakdown.total,
                    date: fileDate
                  });
                }
              }
            } catch (statError) {
              // Skip files that can't be read
              continue;
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be read
        continue;
      }
    }
    
    return sessions;
  }

  /**
   * Look for usage patterns that suggest hitting daily limits
   */
  private findPotentialLimits(historicalUsage: DailyUsage[]): number[] {
    const potentialLimits: number[] = [];
    
    // Look for days with unusually flat usage curves or round numbers
    for (const dayUsage of historicalUsage) {
      const tokens = dayUsage.totalTokens;
      
      // Check if usage is a round number that might indicate a limit
      if (this.isLikelyLimitValue(tokens)) {
        potentialLimits.push(tokens);
      }
    }

    // Look for consistent usage ceilings
    const sortedUsage = historicalUsage.map(day => day.totalTokens).sort((a, b) => b - a);
    const top10Percent = sortedUsage.slice(0, Math.ceil(sortedUsage.length * 0.1));
    
    if (top10Percent.length >= 2) {
      const avgTop = top10Percent.reduce((sum, val) => sum + val, 0) / top10Percent.length;
      const stdDev = Math.sqrt(
        top10Percent.reduce((sum, val) => sum + Math.pow(val - avgTop, 2), 0) / top10Percent.length
      );
      
      // If top usage values are very similar, likely hitting a limit
      if (stdDev < avgTop * 0.05) { // Less than 5% variance
        potentialLimits.push(Math.round(avgTop));
      }
    }

    return potentialLimits;
  }

  /**
   * Check if a token count looks like it might be a limit value
   */
  private isLikelyLimitValue(tokens: number): boolean {
    // Check for round millions
    if (tokens % 1_000_000 === 0) return true;
    
    // Check for values that round to nice numbers
    const millions = tokens / 1_000_000;
    if (Math.abs(millions - Math.round(millions * 10) / 10) < 0.01) return true;
    
    // Check for specific known limit patterns
    const knownPatterns = [
      45_600_000, // Observed in current cc-status
      50_000_000, // Round 50M
      40_000_000, // Round 40M
      30_000_000, // Round 30M
    ];
    
    return knownPatterns.some(pattern => Math.abs(tokens - pattern) < 100_000);
  }

  /**
   * Get conservative fallback limit when detection fails
   */
  private getConservativeFallback(): UsageLimit {
    return {
      dailyTokenLimit: 45_600_000, // Use the 45.6M observed in ccusage data
      confidence: 'fallback',
      source: 'fallback',
      lastUpdated: new Date()
    };
  }

  /**
   * Force refresh the cached limit on next call
   */
  invalidateCache(): void {
    this.cachedLimit = null;
  }

  /**
   * Manually set a daily limit (for configuration override)
   */
  setManualLimit(tokens: number): UsageLimit {
    const manualLimit: UsageLimit = {
      dailyTokenLimit: tokens,
      confidence: 'high',
      source: 'configuration',
      lastUpdated: new Date()
    };
    
    this.cachedLimit = manualLimit;
    return manualLimit;
  }

  /**
   * Get debug information about limit detection
   */
  async getDebugInfo(): Promise<{
    currentLimit: UsageLimit;
    historicalUsage: DailyUsage[];
    maxObservedUsage: number;
    potentialLimits: number[];
  }> {
    const currentLimit = await this.getDailyTokenLimit();
    const historicalUsage = await this.transcriptParser.getHistoricalUsage(30);
    const maxObservedUsage = historicalUsage.length > 0 
      ? Math.max(...historicalUsage.map(day => day.totalTokens))
      : 0;
    const potentialLimits = this.findPotentialLimits(historicalUsage);

    return {
      currentLimit,
      historicalUsage,
      maxObservedUsage,
      potentialLimits
    };
  }
}