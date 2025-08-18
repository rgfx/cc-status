import { TranscriptParser } from "../services/transcript-parser";

export interface SessionTimerInfo {
  timeRemaining: string;
  resetTime: string;
  isNearReset: boolean;
  startTime?: string; // For debugging
  elapsedTime?: string; // For debugging
}

export class SessionTimerService {
  private transcriptParser = new TranscriptParser();
  private readonly sessionDurationHours = 5;

  private floorToHour(timestamp: Date): Date {
    const floored = new Date(timestamp);
    floored.setUTCMinutes(0, 0, 0); // Use UTC like ccusage does
    return floored;
  }

  async getSessionTimer(): Promise<SessionTimerInfo | null> {
    try {
      // Use ccusage's exact logic: find active block from all session blocks
      const activeBlock = await this.findActiveBlock();
      
      if (!activeBlock) {
        return null; // No active session
      }

      const now = new Date();
      
      // Calculate time remaining in minutes (ccusage's exact formula)
      const timeRemainingMs = Math.max(0, activeBlock.endTime.getTime() - now.getTime());
      const timeRemainingMinutes = Math.round(timeRemainingMs / (1000 * 60));
      
      // Calculate elapsed time for debugging
      const elapsedMs = now.getTime() - activeBlock.startTime.getTime();
      const elapsedMinutes = Math.round(elapsedMs / (1000 * 60));
      
      return {
        timeRemaining: this.formatTimeRemaining(timeRemainingMinutes),
        resetTime: this.formatResetTime(activeBlock.endTime),
        isNearReset: timeRemainingMinutes < 30, // Less than 30 minutes
        startTime: this.formatResetTime(activeBlock.startTime), // For debugging
        elapsedTime: this.formatElapsedTime(elapsedMinutes) // For debugging
      };
    } catch (error) {
      console.debug('Error getting session timer:', error);
      return null;
    }
  }

  /**
   * Find active block using ccusage's exact algorithm
   */
  private async findActiveBlock(): Promise<{startTime: Date, endTime: Date} | null> {
    try {
      // Get all entries from today (like ccusage loadSessionBlockData does)
      const allUsage = await this.transcriptParser.getAllSessionsForToday();
      
      if (!allUsage.entries || allUsage.entries.length === 0) {
        return null;
      }

      // Use ccusage's identifySessionBlocks logic
      const sessionBlocks = this.identifySessionBlocks(allUsage.entries);
      
      // Find active block (ccusage's logic)
      const now = new Date();
      const sessionDurationMs = this.sessionDurationHours * 60 * 60 * 1000;
      
      for (const block of sessionBlocks) {
        const actualEndTime = block.entries.length > 0 
          ? block.entries[block.entries.length - 1].timestamp 
          : block.startTime;
        
        const isActive = 
          now.getTime() - new Date(actualEndTime).getTime() < sessionDurationMs && 
          now < block.endTime;
          
        if (isActive) {
          return block;
        }
      }
      
      return null;
    } catch (error) {
      console.debug('Error finding active block:', error);
      return null;
    }
  }

  /**
   * Implement ccusage's identifySessionBlocks algorithm exactly
   */
  private identifySessionBlocks(entries: any[]): {startTime: Date, endTime: Date, entries: any[]}[] {
    if (entries.length === 0) return [];

    const sessionDurationMs = this.sessionDurationHours * 60 * 60 * 1000;
    const blocks: {startTime: Date, endTime: Date, entries: any[]}[] = [];
    const sortedEntries = [...entries].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let currentBlockStart: Date | null = null;
    let currentBlockEntries: any[] = [];

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
   * Format time remaining like ccusage: "29m" or "4h" or "0m"
   */
  private formatTimeRemaining(minutes: number): string {
    if (minutes <= 0) return "0m";
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ''}`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Format reset time like ccusage: "6PM" (not "6:00 PM")
   */
  private formatResetTime(resetTime: Date): string {
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      hour12: true
      // Use local timezone, not Pacific
    };
    
    return resetTime.toLocaleTimeString('en-US', timeOptions);
  }

  /**
   * Format elapsed time for debugging: "4h"
   */
  private formatElapsedTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ''}`;
    } else {
      return `${minutes}m`;
    }
  }
}