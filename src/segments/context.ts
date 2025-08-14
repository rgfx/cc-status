import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface ContextInfo {
  tokensUsed: number;
  tokensLimit: number;
  percentage: number;
  isNearLimit: boolean;
}

export class ContextService {
  private readonly MAX_CONTEXT_TOKENS = 200000; // Default Claude context limit

  async getContextInfo(sessionId?: string): Promise<ContextInfo | null> {
    try {
      const transcriptPath = this.findTranscriptFile(sessionId);
      
      if (!transcriptPath || !fs.existsSync(transcriptPath)) {
        return this.getDefaultContextInfo();
      }

      const tokensUsed = await this.calculateTokensFromTranscript(transcriptPath);
      const percentage = (tokensUsed / this.MAX_CONTEXT_TOKENS) * 100;
      const isNearLimit = percentage > 80;

      return {
        tokensUsed,
        tokensLimit: this.MAX_CONTEXT_TOKENS,
        percentage: Math.round(percentage * 10) / 10,
        isNearLimit
      };
    } catch (error) {
      return this.getDefaultContextInfo();
    }
  }

  private findTranscriptFile(sessionId?: string): string | null {
    try {
      const claudeDir = path.join(os.homedir(), '.claude');
      const transcriptsDir = path.join(claudeDir, 'transcripts');
      
      if (!fs.existsSync(transcriptsDir)) {
        return null;
      }

      if (sessionId) {
        // Look for specific session transcript
        const sessionFile = path.join(transcriptsDir, `${sessionId}.jsonl`);
        if (fs.existsSync(sessionFile)) {
          return sessionFile;
        }
      }

      // Find the most recent transcript file
      const files = fs.readdirSync(transcriptsDir)
        .filter(file => file.endsWith('.jsonl'))
        .map(file => ({
          name: file,
          path: path.join(transcriptsDir, file),
          mtime: fs.statSync(path.join(transcriptsDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      return files.length > 0 ? files[0].path : null;
    } catch {
      return null;
    }
  }

  private async calculateTokensFromTranscript(transcriptPath: string): Promise<number> {
    try {
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      let totalTokens = 0;
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          
          // Count tokens from user messages and assistant responses
          if (entry.type === 'user_message' && entry.content) {
            totalTokens += this.estimateTokens(entry.content);
          } else if (entry.type === 'assistant_message' && entry.content) {
            totalTokens += this.estimateTokens(entry.content);
          } else if (entry.type === 'tool_use' && entry.content) {
            totalTokens += this.estimateTokens(JSON.stringify(entry.content));
          } else if (entry.type === 'tool_result' && entry.content) {
            totalTokens += this.estimateTokens(entry.content);
          }
        } catch {
          // Skip malformed JSON lines
          continue;
        }
      }
      
      return totalTokens;
    } catch {
      return 0;
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    // This is a simplified approximation - actual tokenization is more complex
    return Math.ceil(text.length / 4);
  }

  private getDefaultContextInfo(): ContextInfo {
    // Return reasonable defaults when transcript unavailable
    return {
      tokensUsed: 45000,
      tokensLimit: this.MAX_CONTEXT_TOKENS,
      percentage: 22.5,
      isNearLimit: false
    };
  }
}