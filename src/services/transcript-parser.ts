import { readFile } from "node:fs/promises";
import { findTodaysTranscripts, findTranscriptsForDate } from "./claude-paths";

export interface TranscriptEntry {
  timestamp: string;
  message: {
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    model?: { 
      id?: string;
    } | string;
  };
  model?: string;
  model_id?: string;
  costUSD?: number;
  usageLimitResetTime?: string; // Usage limit reset timestamp from Claude API
}

export interface TokenBreakdown {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
  total: number;
}

export interface DailyUsage {
  totalTokens: number;
  totalCost: number;
  tokenBreakdown: TokenBreakdown;
  entries: TranscriptEntry[];
  sessionCount: number;
}

export class TranscriptParser {
  
  /**
   * Parse a single transcript file and extract usage entries
   */
  async parseTranscriptFile(filePath: string): Promise<TranscriptEntry[]> {
    try {
      const content = await readFile(filePath, 'utf-8');
      
      // Handle empty files gracefully
      if (!content || !content.trim()) {
        return [];
      }
      
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        return [];
      }

      const entries: TranscriptEntry[] = [];

      for (const line of lines) {
        try {
          // Skip empty or whitespace-only lines
          if (!line.trim()) continue;
          
          // Additional validation - skip lines that don't look like JSON
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('{') || !trimmedLine.endsWith('}')) {
            continue;
          }
          
          const entry = JSON.parse(trimmedLine) as Record<string, unknown>;
          
          // Look for usage data in the message
          if (entry.message && typeof entry.message === 'object') {
            const message = entry.message as Record<string, unknown>;
            if (message.usage && typeof message.usage === 'object') {
              const transcriptEntry: TranscriptEntry = {
                timestamp: (entry.timestamp as string) || new Date().toISOString(),
                message: {
                  usage: message.usage as TranscriptEntry['message']['usage'],
                  model: message.model as TranscriptEntry['message']['model']
                }
              };

              // Handle different model field locations
              if (entry.model && typeof entry.model === 'string') {
                transcriptEntry.model = entry.model;
              }
              if (entry.model_id && typeof entry.model_id === 'string') {
                transcriptEntry.model_id = entry.model_id;
              }

              // Include existing cost if available
              if (typeof entry.costUSD === 'number') {
                transcriptEntry.costUSD = entry.costUSD;
              }

              // Include usage limit reset time if available (like ccusage)
              if (entry.usageLimitResetTime && typeof entry.usageLimitResetTime === 'string') {
                transcriptEntry.usageLimitResetTime = entry.usageLimitResetTime;
              }

              entries.push(transcriptEntry);
            }
          }
        } catch (parseError) {
          // Silently skip malformed JSON lines - this is common in transcript files
          continue;
        }
      }

      return entries;
    } catch (error) {
      return [];
    }
  }

  /**
   * Calculate token breakdown from transcript entries
   */
  calculateTokenBreakdown(entries: TranscriptEntry[]): TokenBreakdown {
    const breakdown = entries.reduce(
      (acc, entry) => ({
        input: acc.input + (entry.message.usage.input_tokens || 0),
        output: acc.output + (entry.message.usage.output_tokens || 0),
        cacheCreation: acc.cacheCreation + (entry.message.usage.cache_creation_input_tokens || 0),
        cacheRead: acc.cacheRead + (entry.message.usage.cache_read_input_tokens || 0),
      }),
      { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 }
    );

    return {
      ...breakdown,
      total: breakdown.input + breakdown.output + breakdown.cacheCreation + breakdown.cacheRead
    };
  }

  /**
   * Get current active session usage by session ID (like ccusage active block)
   */
  async getDailyUsage(sessionId?: string): Promise<DailyUsage> {
    try {
      let targetTranscriptPath: string | null = null;

      if (sessionId) {
        // Try to find the specific session file first
        targetTranscriptPath = await import('./claude-paths').then(m => m.findTranscriptFile(sessionId));
      }

      if (!targetTranscriptPath) {
        // Fallback: Find the most recently modified transcript file
        const transcriptFiles = await findTodaysTranscripts();
        
        if (transcriptFiles.length === 0) {
          return this.getEmptyUsage();
        }

        // Sort by modification time to get the most recent (active) session
        const transcriptStats = await Promise.all(
          transcriptFiles.map(async (filePath) => {
            try {
              const stats = await import('node:fs/promises').then(fs => fs.stat(filePath));
              return { filePath, mtime: stats.mtime };
            } catch {
              return null;
            }
          })
        );

        const validStats = transcriptStats.filter(stat => stat !== null);
        if (validStats.length === 0) {
          return this.getEmptyUsage();
        }

        // Get the most recently modified file (current active session)
        validStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        targetTranscriptPath = validStats[0].filePath;
      }

      // Parse the target session
      const entries = await this.parseTranscriptFile(targetTranscriptPath);
      
      // Get the current active block since last 2AM reset (like ccusage)
      const currentBlock = this.getCurrentActiveBlock(entries);
      
      if (!currentBlock) {
        return this.getEmptyUsage();
      }
      
      const tokenBreakdown = this.calculateTokenBreakdown(currentBlock.entries);
      
      // Calculate total cost from existing costUSD fields
      const totalCost = currentBlock.entries.reduce((sum, entry) => {
        return sum + (entry.costUSD || 0);
      }, 0);

      return {
        totalTokens: tokenBreakdown.total,
        totalCost,
        tokenBreakdown,
        entries: currentBlock.entries,
        sessionCount: 1 // Current active block
      };
    } catch (error) {
      return this.getEmptyUsage();
    }
  }

  /**
   * Get the current active block from session entries (using ccusage logic with usageLimitResetTime)
   */
  private getCurrentActiveBlock(entries: TranscriptEntry[]): {entries: TranscriptEntry[]} | null {
    if (entries.length === 0) return null;
    
    // Sort entries by timestamp
    const sortedEntries = entries.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const now = new Date();
    
    // First check if we have usageLimitResetTime from any entry (like ccusage does)
    let resetTime: Date | null = null;
    for (const entry of sortedEntries) {
      if (entry.usageLimitResetTime) {
        resetTime = new Date(entry.usageLimitResetTime);
        break;
      }
    }
    
    if (resetTime && now < resetTime) {
      // We have an active reset time - find entries since the block start
      // ccusage considers the block start to be up to 5 hours before the reset
      const blockStartTime = new Date(resetTime.getTime() - (5 * 60 * 60 * 1000));
      
      const currentBlockEntries = sortedEntries.filter(entry => {
        const entryTime = new Date(entry.timestamp);
        return entryTime.getTime() >= blockStartTime.getTime();
      });
      
      return { entries: currentBlockEntries };
    }
    
    // Fallback to 5-hour window logic if no usageLimitResetTime found
    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
    const latestEntry = sortedEntries[sortedEntries.length - 1];
    const latestTime = new Date(latestEntry.timestamp);
    
    // If latest activity was more than 5 hours ago, no current block
    if (now.getTime() - latestTime.getTime() > FIVE_HOURS_MS) {
      return { entries: [] };
    }
    
    // Find the start of the current 5-hour block by looking for gaps
    let currentBlockStart = new Date(latestTime);
    
    for (let i = sortedEntries.length - 2; i >= 0; i--) {
      const entryTime = new Date(sortedEntries[i].timestamp);
      const timeDiff = latestTime.getTime() - entryTime.getTime();
      
      if (timeDiff > FIVE_HOURS_MS) {
        // Found a gap - current block starts after this gap
        break;
      }
      currentBlockStart = entryTime;
    }
    
    // Get all entries in the current block (since the dynamic start time)
    const currentBlockEntries = sortedEntries.filter(entry => {
      const entryTime = new Date(entry.timestamp);
      return entryTime.getTime() >= currentBlockStart.getTime();
    });
    
    return { entries: currentBlockEntries };
  }

  private getEmptyUsage(): DailyUsage {
    return {
      totalTokens: 0,
      totalCost: 0,
      tokenBreakdown: { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, total: 0 },
      entries: [],
      sessionCount: 0
    };
  }

  /**
   * Get current 5-hour block usage across ALL sessions (for subscription tracking)
   * Uses same block identification algorithm as session timer for consistency
   */
  async getCurrentBlockUsageAcrossAllSessions(): Promise<DailyUsage> {
    try {
      const transcriptFiles = await findTodaysTranscripts();
      const allEntries: TranscriptEntry[] = [];
      
      // Parse all transcript files for today
      for (const filePath of transcriptFiles) {
        const entries = await this.parseTranscriptFile(filePath);
        allEntries.push(...entries);
      }

      if (allEntries.length === 0) {
        return this.getEmptyUsage();
      }

      // Use ccusage's identifySessionBlocks logic (same as session timer)
      const sessionBlocks = this.identifySessionBlocks(allEntries);
      
      // Find active block (ccusage's logic)
      const now = new Date();
      const sessionDurationMs = 5 * 60 * 60 * 1000; // 5 hours
      
      let activeBlock: {startTime: Date, endTime: Date, entries: TranscriptEntry[]} | null = null;
      
      for (const block of sessionBlocks) {
        const actualEndTime = block.entries.length > 0 
          ? block.entries[block.entries.length - 1].timestamp 
          : block.startTime;
        
        const isActive = 
          now.getTime() - new Date(actualEndTime).getTime() < sessionDurationMs && 
          now < block.endTime;
          
        if (isActive) {
          activeBlock = block;
          break;
        }
      }
      
      if (!activeBlock || activeBlock.entries.length === 0) {
        return this.getEmptyUsage();
      }
      
      const tokenBreakdown = this.calculateTokenBreakdown(activeBlock.entries);
      
      // Calculate total cost from existing costUSD fields
      const totalCost = activeBlock.entries.reduce((sum, entry) => {
        return sum + (entry.costUSD || 0);
      }, 0);

      return {
        totalTokens: tokenBreakdown.total,
        totalCost,
        tokenBreakdown,
        entries: activeBlock.entries,
        sessionCount: transcriptFiles.length
      };
    } catch (error) {
      return this.getEmptyUsage();
    }
  }

  /**
   * Get usage data for ALL sessions today (for daily cost calculation)
   */
  async getAllSessionsForToday(): Promise<DailyUsage> {
    try {
      const transcriptFiles = await findTodaysTranscripts();
      const allEntries: TranscriptEntry[] = [];
      
      for (const filePath of transcriptFiles) {
        const entries = await this.parseTranscriptFile(filePath);
        allEntries.push(...entries);
      }

      const tokenBreakdown = this.calculateTokenBreakdown(allEntries);
      
      // Calculate total cost from existing costUSD fields
      const totalCost = allEntries.reduce((sum, entry) => {
        return sum + (entry.costUSD || 0);
      }, 0);

      return {
        totalTokens: tokenBreakdown.total,
        totalCost,
        tokenBreakdown,
        entries: allEntries,
        sessionCount: transcriptFiles.length
      };
    } catch (error) {
      return this.getEmptyUsage();
    }
  }

  /**
   * Get usage data for a specific date
   */
  async getUsageForDate(date: Date): Promise<DailyUsage> {
    try {
      const transcriptFiles = await findTranscriptsForDate(date);
      const allEntries: TranscriptEntry[] = [];
      
      for (const filePath of transcriptFiles) {
        const entries = await this.parseTranscriptFile(filePath);
        allEntries.push(...entries);
      }

      const tokenBreakdown = this.calculateTokenBreakdown(allEntries);
      
      const totalCost = allEntries.reduce((sum, entry) => {
        return sum + (entry.costUSD || 0);
      }, 0);

      return {
        totalTokens: tokenBreakdown.total,
        totalCost,
        tokenBreakdown,
        entries: allEntries,
        sessionCount: transcriptFiles.length
      };
    } catch (error) {
      return {
        totalTokens: 0,
        totalCost: 0,
        tokenBreakdown: { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, total: 0 },
        entries: [],
        sessionCount: 0
      };
    }
  }

  /**
   * Get historical usage data for limit estimation
   */
  async getHistoricalUsage(days: number = 30): Promise<DailyUsage[]> {
    const usage: DailyUsage[] = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const dayUsage = await this.getUsageForDate(date);
      if (dayUsage.totalTokens > 0) {
        usage.push(dayUsage);
      }
    }
    
    return usage;
  }

  /**
   * Floor timestamp to hour (used by ccusage block identification)
   */
  private floorToHour(timestamp: Date): Date {
    const floored = new Date(timestamp);
    floored.setUTCMinutes(0, 0, 0); // Use UTC like ccusage does
    return floored;
  }

  /**
   * Implement ccusage's identifySessionBlocks algorithm exactly
   */
  private identifySessionBlocks(entries: TranscriptEntry[]): {startTime: Date, endTime: Date, entries: TranscriptEntry[]}[] {
    if (entries.length === 0) return [];

    const sessionDurationMs = 5 * 60 * 60 * 1000; // 5 hours
    const blocks: {startTime: Date, endTime: Date, entries: TranscriptEntry[]}[] = [];
    const sortedEntries = [...entries].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let currentBlockStart: Date | null = null;
    let currentBlockEntries: TranscriptEntry[] = [];

    for (const entry of sortedEntries) {
      const entryTime = new Date(entry.timestamp);

      if (currentBlockStart == null) {
        // First entry - start a new block (floored to the hour)
        currentBlockStart = this.floorToHour(entryTime);
        currentBlockEntries = [entry];
      } else {
        const timeSinceBlockStart = entryTime.getTime() - currentBlockStart.getTime();
        const lastEntry = currentBlockEntries[currentBlockEntries.length - 1];
        if (lastEntry == null) {
          continue;
        }
        const lastEntryTime = new Date(lastEntry.timestamp);
        const timeSinceLastEntry = entryTime.getTime() - lastEntryTime.getTime();

        if (timeSinceBlockStart > sessionDurationMs || timeSinceLastEntry > sessionDurationMs) {
          // Close current block
          const endTime = new Date(currentBlockStart.getTime() + sessionDurationMs);
          blocks.push({
            startTime: currentBlockStart,
            endTime,
            entries: currentBlockEntries
          });

          // Start new block (floored to the hour)
          currentBlockStart = this.floorToHour(entryTime);
          currentBlockEntries = [entry];
        } else {
          // Add to current block
          currentBlockEntries.push(entry);
        }
      }
    }

    // Close the last block
    if (currentBlockStart != null && currentBlockEntries.length > 0) {
      const endTime = new Date(currentBlockStart.getTime() + sessionDurationMs);
      blocks.push({
        startTime: currentBlockStart,
        endTime,
        entries: currentBlockEntries
      });
    }

    return blocks;
  }

  /**
   * Extract model ID from transcript entry using multiple fallback strategies
   */
  extractModelId(entry: TranscriptEntry): string {
    // Strategy 1: Direct model field
    if (entry.model && typeof entry.model === 'string') {
      return entry.model;
    }
    
    // Strategy 2: model_id field
    if (entry.model_id && typeof entry.model_id === 'string') {
      return entry.model_id;
    }
    
    // Strategy 3: message.model object
    const message = entry.message;
    if (message?.model) {
      if (typeof message.model === 'string') {
        return message.model;
      }
      if (typeof message.model === 'object' && message.model.id) {
        return message.model.id;
      }
    }
    
    // Fallback to current Sonnet model
    return 'claude-3-5-sonnet-20241022';
  }
}