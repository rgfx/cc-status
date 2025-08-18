import { TranscriptParser } from "./transcript-parser";
import { findTodaysTranscripts } from "./claude-paths";

export interface ResetTimeInfo {
  resetTime: Date;
  confidence: 'high' | 'medium' | 'low' | 'fallback';
  source: 'usage_pattern' | 'first_usage_extrapolation' | 'configuration' | 'fallback';
  timeRemaining: number; // milliseconds
}

export class ResetTimeDetectionService {
  private transcriptParser = new TranscriptParser();
  private cachedResetTime: ResetTimeInfo | null = null;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Get the estimated reset time for the current usage period
   */
  async getResetTime(): Promise<ResetTimeInfo> {
    // Return cached result if still fresh
    if (this.cachedResetTime && 
        Date.now() - this.cachedResetTime.resetTime.getTime() > -this.CACHE_TTL) {
      return this.cachedResetTime;
    }

    try {
      // Try different detection strategies
      const resetTime = await this.detectResetTime();
      this.cachedResetTime = resetTime;
      return resetTime;
      
    } catch (error) {
      console.debug('Error detecting reset time:', error);
      const fallbackTime = this.getFallbackResetTime();
      this.cachedResetTime = fallbackTime;
      return fallbackTime;
    }
  }

  /**
   * Try multiple strategies to detect when usage resets
   */
  private async detectResetTime(): Promise<ResetTimeInfo> {
    // Strategy 1: Use 5-hour block pattern like ccusage
    const blockBasedTime = await this.detectFromBlockPattern();
    if (blockBasedTime.confidence !== 'fallback') {
      return blockBasedTime;
    }

    // Strategy 2: Extrapolate from first usage today
    const firstUsageTime = await this.detectFromFirstUsageToday();
    if (firstUsageTime.confidence !== 'fallback') {
      return firstUsageTime;
    }

    // Strategy 3: Fallback to next reasonable time
    return this.getFallbackResetTime();
  }

  /**
   * Detect reset time from transcript data (like ccusage usageLimitResetTime)
   */
  private async detectFromBlockPattern(): Promise<ResetTimeInfo> {
    try {
      const todaysTranscripts = await import('./claude-paths').then(m => m.findTodaysTranscripts());
      
      if (todaysTranscripts.length === 0) {
        return this.getFallbackResetTime();
      }

      // Look for usageLimitResetTime in transcript entries (like ccusage does)
      let usageLimitResetTime: Date | null = null;

      for (const transcriptPath of todaysTranscripts) {
        const entries = await this.transcriptParser.parseTranscriptFile(transcriptPath);
        
        for (const entry of entries) {
          // Look for usageLimitResetTime field in the transcript entry
          if (entry.usageLimitResetTime) {
            usageLimitResetTime = new Date(entry.usageLimitResetTime);
            break;
          }
        }
        
        if (usageLimitResetTime) break;
      }

      if (usageLimitResetTime) {
        const now = new Date();
        const timeRemaining = usageLimitResetTime.getTime() - now.getTime();

        return {
          resetTime: usageLimitResetTime,
          confidence: 'high',
          source: 'usage_pattern',
          timeRemaining: Math.max(0, timeRemaining)
        };
      }

      // Use ccusage session block logic: create a 5-hour block from first usage
      const dailyUsage = await this.transcriptParser.getDailyUsage();
      if (dailyUsage.entries.length > 0) {
        // Get the earliest entry to establish block start time
        const sortedEntries = dailyUsage.entries.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const firstEntry = sortedEntries[0];
        const blockStartTime = new Date(firstEntry.timestamp);
        
        // Floor to nearest hour like ccusage does
        blockStartTime.setMinutes(0, 0, 0);
        
        // Reset time is block start + 5 hours (ccusage logic)
        const resetTime = new Date(blockStartTime.getTime() + (5 * 60 * 60 * 1000));
        const now = new Date();
        
        // If the calculated reset time has already passed, add another 5 hours
        if (resetTime.getTime() <= now.getTime()) {
          resetTime.setTime(resetTime.getTime() + (5 * 60 * 60 * 1000));
        }

        const timeRemaining = resetTime.getTime() - now.getTime();

        return {
          resetTime,
          confidence: 'medium',
          source: 'usage_pattern',
          timeRemaining: Math.max(0, timeRemaining)
        };
      }

      return this.getFallbackResetTime();

    } catch (error) {
      console.debug('Error in block pattern detection:', error);
      return this.getFallbackResetTime();
    }
  }

  /**
   * Analyze usage patterns to find reset time
   */
  private async detectFromUsagePatterns(): Promise<ResetTimeInfo> {
    try {
      // Get historical usage for pattern analysis
      const historicalUsage = await this.transcriptParser.getHistoricalUsage(7);
      
      if (historicalUsage.length < 2) {
        return this.getFallbackResetTime();
      }

      // Look for consistent daily usage start times
      const startTimes: Date[] = [];
      
      for (const dayUsage of historicalUsage) {
        if (dayUsage.entries.length > 0) {
          // Find the earliest timestamp for each day
          const dayEntries = dayUsage.entries.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          startTimes.push(new Date(dayEntries[0].timestamp));
        }
      }

      if (startTimes.length < 2) {
        return this.getFallbackResetTime();
      }

      // Analyze time patterns
      const resetTimeEstimate = this.analyzeStartTimePatterns(startTimes);
      
      if (resetTimeEstimate) {
        const now = new Date();
        const timeRemaining = resetTimeEstimate.getTime() - now.getTime();
        
        return {
          resetTime: resetTimeEstimate,
          confidence: 'medium',
          source: 'usage_pattern',
          timeRemaining: Math.max(0, timeRemaining)
        };
      }

      return this.getFallbackResetTime();
      
    } catch (error) {
      console.debug('Error in pattern analysis:', error);
      return this.getFallbackResetTime();
    }
  }

  /**
   * Analyze start time patterns to predict next reset
   */
  private analyzeStartTimePatterns(startTimes: Date[]): Date | null {
    if (startTimes.length < 2) return null;

    // Look for consistent 24-hour intervals
    const intervals: number[] = [];
    for (let i = 1; i < startTimes.length; i++) {
      const interval = startTimes[i].getTime() - startTimes[i - 1].getTime();
      // Only consider intervals close to 24 hours (20-28 hours to account for variation)
      if (interval >= 20 * 60 * 60 * 1000 && interval <= 28 * 60 * 60 * 1000) {
        intervals.push(interval);
      }
    }

    if (intervals.length === 0) return null;

    // Calculate average interval
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Check if intervals are consistent (within 2 hours variance)
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev > 2 * 60 * 60 * 1000) { // More than 2 hours variance
      return null;
    }

    // Predict next reset time based on the most recent start
    const lastStart = startTimes[startTimes.length - 1];
    const nextReset = new Date(lastStart.getTime() + avgInterval);
    
    // Ensure the predicted time is in the future
    if (nextReset.getTime() <= Date.now()) {
      return new Date(nextReset.getTime() + 24 * 60 * 60 * 1000);
    }

    return nextReset;
  }

  /**
   * Estimate reset time from first usage today
   */
  private async detectFromFirstUsageToday(): Promise<ResetTimeInfo> {
    try {
      const todaysTranscripts = await findTodaysTranscripts();
      
      if (todaysTranscripts.length === 0) {
        return this.getFallbackResetTime();
      }

      let earliestTimestamp: Date | null = null;

      for (const transcriptPath of todaysTranscripts) {
        const entries = await this.transcriptParser.parseTranscriptFile(transcriptPath);
        
        for (const entry of entries) {
          const timestamp = new Date(entry.timestamp);
          if (!earliestTimestamp || timestamp < earliestTimestamp) {
            earliestTimestamp = timestamp;
          }
        }
      }

      if (!earliestTimestamp) {
        return this.getFallbackResetTime();
      }

      // Assume 24-hour cycle from first usage
      const resetTime = new Date(earliestTimestamp.getTime() + 24 * 60 * 60 * 1000);
      const now = new Date();
      
      // If the calculated reset time has already passed, add another 24 hours
      if (resetTime.getTime() <= now.getTime()) {
        resetTime.setTime(resetTime.getTime() + 24 * 60 * 60 * 1000);
      }

      const timeRemaining = resetTime.getTime() - now.getTime();

      return {
        resetTime,
        confidence: 'low',
        source: 'first_usage_extrapolation',
        timeRemaining: Math.max(0, timeRemaining)
      };

    } catch (error) {
      console.debug('Error detecting from first usage:', error);
      return this.getFallbackResetTime();
    }
  }

  /**
   * Get fallback reset time (next midnight local time)
   */
  private getFallbackResetTime(): ResetTimeInfo {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);

    const timeRemaining = nextMidnight.getTime() - now.getTime();

    return {
      resetTime: nextMidnight,
      confidence: 'fallback',
      source: 'fallback',
      timeRemaining: Math.max(0, timeRemaining)
    };
  }

  /**
   * Format time remaining in compact format like ccusage
   */
  formatTimeRemaining(timeRemaining: number): string {
    const remainingSeconds = Math.max(0, Math.floor(timeRemaining / 1000));
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    
    if (hours > 0) {
      // Use H:MM format for hours and minutes (e.g., "3:39")
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  /**
   * Format reset time in compact format like ccusage
   */
  formatResetTime(resetTime: Date): string {
    // Format like ccusage: compact format (4AM, not 4:00AM)
    let formatted = resetTime.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    // Remove minutes and seconds to get compact format
    formatted = formatted.replace(/:\d{2}(:\d{2})?\s*(AM|PM)/, '$2');
    
    // Remove leading zero from hour (04AM -> 4AM)
    formatted = formatted.replace(/^0/, '');
    
    return formatted;
  }

  /**
   * Check if we're near the reset time (less than 30 minutes)
   */
  isNearReset(timeRemaining: number): boolean {
    return timeRemaining < 30 * 60 * 1000; // Less than 30 minutes
  }

  /**
   * Force refresh the cached reset time on next call
   */
  invalidateCache(): void {
    this.cachedResetTime = null;
  }

  /**
   * Manually set a reset time (for configuration override)
   */
  setManualResetTime(resetTime: Date): ResetTimeInfo {
    const now = new Date();
    const timeRemaining = resetTime.getTime() - now.getTime();
    
    const manualResetTime: ResetTimeInfo = {
      resetTime,
      confidence: 'high',
      source: 'configuration',
      timeRemaining: Math.max(0, timeRemaining)
    };
    
    this.cachedResetTime = manualResetTime;
    return manualResetTime;
  }

  /**
   * Get debug information about reset time detection
   */
  async getDebugInfo(): Promise<{
    currentResetTime: ResetTimeInfo;
    todaysFirstUsage: Date | null;
    historicalStartTimes: Date[];
  }> {
    const currentResetTime = await this.getResetTime();
    
    // Get today's first usage
    const todaysTranscripts = await findTodaysTranscripts();
    let todaysFirstUsage: Date | null = null;
    
    for (const transcriptPath of todaysTranscripts) {
      const entries = await this.transcriptParser.parseTranscriptFile(transcriptPath);
      for (const entry of entries) {
        const timestamp = new Date(entry.timestamp);
        if (!todaysFirstUsage || timestamp < todaysFirstUsage) {
          todaysFirstUsage = timestamp;
        }
      }
    }

    // Get historical start times
    const historicalUsage = await this.transcriptParser.getHistoricalUsage(7);
    const historicalStartTimes: Date[] = [];
    
    for (const dayUsage of historicalUsage) {
      if (dayUsage.entries.length > 0) {
        const dayEntries = dayUsage.entries.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        historicalStartTimes.push(new Date(dayEntries[0].timestamp));
      }
    }

    return {
      currentResetTime,
      todaysFirstUsage,
      historicalStartTimes
    };
  }
}