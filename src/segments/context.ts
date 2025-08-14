import fs from "node:fs";

export interface ContextInfo {
  percentage: number;
  isNearLimit: boolean;
}

interface TranscriptEntry {
  message?: {
    usage?: {
      input_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  isSidechain?: boolean;
  timestamp?: string;
}

export class ContextService {
  private readonly MAX_CONTEXT_TOKENS = 200000; // Default Claude context limit

  async getContextInfo(transcriptPath?: string): Promise<ContextInfo | null> {
    console.error('DEBUG: transcript_path =', transcriptPath);
    console.error('DEBUG: file exists =', transcriptPath ? fs.existsSync(transcriptPath) : false);
    
    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      return null; // No fake data - return null when no real data available
    }

    try {
      const contextTokens = this.calculateContextTokens(transcriptPath);
      if (contextTokens === null) {
        return null;
      }

      const percentage = Math.min(100, Math.max(0, Math.round((contextTokens / this.MAX_CONTEXT_TOKENS) * 100)));
      const isNearLimit = percentage > 80;

      return {
        percentage,
        isNearLimit
      };
    } catch (error) {
      return null;
    }
  }

  private calculateContextTokens(transcriptPath: string): number | null {
    try {
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      if (!content) {
        return null;
      }

      const lines = content.trim().split('\n');
      if (lines.length === 0) {
        return null;
      }

      let mostRecentEntry: TranscriptEntry | null = null;
      let mostRecentTime = 0;

      // Find the most recent non-sidechain entry with usage data
      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const entry: TranscriptEntry = JSON.parse(line);

          if (!entry.message?.usage?.input_tokens) continue;
          if (entry.isSidechain === true) continue;
          if (!entry.timestamp) continue;

          const entryTime = new Date(entry.timestamp).getTime();
          if (entryTime > mostRecentTime) {
            mostRecentTime = entryTime;
            mostRecentEntry = entry;
          }
        } catch {
          // Skip malformed JSON lines
          continue;
        }
      }

      if (mostRecentEntry?.message?.usage) {
        const usage = mostRecentEntry.message.usage;
        const contextLength = 
          (usage.input_tokens || 0) +
          (usage.cache_read_input_tokens || 0) +
          (usage.cache_creation_input_tokens || 0);

        return contextLength;
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}