import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import type { TranscriptEntry } from "./transcript-parser";

export interface ModelPricing {
  name: string;
  input: number;
  cache_write_5m: number;
  cache_write_1h: number;
  cache_read: number;
  output: number;
}

// Offline pricing data as fallback
const OFFLINE_PRICING_DATA: Record<string, ModelPricing> = {
  "claude-3-haiku-20240307": {
    name: "Claude 3 Haiku",
    input: 0.25,
    output: 1.25,
    cache_write_5m: 0.30,
    cache_write_1h: 0.50,
    cache_read: 0.03
  },
  "claude-3-5-haiku-20241022": {
    name: "Claude 3.5 Haiku",
    input: 0.80,
    output: 4.00,
    cache_write_5m: 1.00,
    cache_write_1h: 1.60,
    cache_read: 0.08
  },
  "claude-3-5-haiku-latest": {
    name: "Claude 3.5 Haiku Latest",
    input: 1.00,
    output: 5.00,
    cache_write_5m: 1.25,
    cache_write_1h: 2.00,
    cache_read: 0.10
  },
  "claude-3-opus-latest": {
    name: "Claude 3 Opus Latest",
    input: 15.00,
    output: 75.00,
    cache_write_5m: 18.75,
    cache_write_1h: 30.00,
    cache_read: 1.50
  },
  "claude-3-opus-20240229": {
    name: "Claude 3 Opus",
    input: 15.00,
    output: 75.00,
    cache_write_5m: 18.75,
    cache_write_1h: 30.00,
    cache_read: 1.50
  },
  "claude-3-5-sonnet-latest": {
    name: "Claude 3.5 Sonnet Latest",
    input: 3.00,
    output: 15.00,
    cache_write_5m: 3.75,
    cache_write_1h: 6.00,
    cache_read: 0.30
  },
  "claude-3-5-sonnet-20240620": {
    name: "Claude 3.5 Sonnet",
    input: 3.00,
    output: 15.00,
    cache_write_5m: 3.75,
    cache_write_1h: 6.00,
    cache_read: 0.30
  },
  "claude-3-5-sonnet-20241022": {
    name: "Claude 3.5 Sonnet",
    input: 3.00,
    output: 15.00,
    cache_write_5m: 3.75,
    cache_write_1h: 6.00,
    cache_read: 0.30
  },
  "claude-opus-4-20250514": {
    name: "Claude Opus 4",
    input: 15.00,
    output: 75.00,
    cache_write_5m: 18.75,
    cache_write_1h: 30.00,
    cache_read: 1.50
  },
  "claude-opus-4-1": {
    name: "Claude Opus 4.1",
    input: 15.00,
    output: 75.00,
    cache_write_5m: 18.75,
    cache_write_1h: 30.00,
    cache_read: 1.50
  },
  "claude-opus-4-1-20250805": {
    name: "Claude Opus 4.1",
    input: 15.00,
    output: 75.00,
    cache_write_5m: 18.75,
    cache_write_1h: 30.00,
    cache_read: 1.50
  },
  "claude-sonnet-4-20250514": {
    name: "Claude Sonnet 4",
    input: 3.00,
    output: 15.00,
    cache_write_5m: 3.75,
    cache_write_1h: 6.00,
    cache_read: 0.30
  },
  "claude-4-opus-20250514": {
    name: "Claude 4 Opus",
    input: 15.00,
    output: 75.00,
    cache_write_5m: 18.75,
    cache_write_1h: 30.00,
    cache_read: 1.50
  },
  "claude-4-sonnet-20250514": {
    name: "Claude 4 Sonnet",
    input: 3.00,
    output: 15.00,
    cache_write_5m: 3.75,
    cache_write_1h: 6.00,
    cache_read: 0.30
  },
  "claude-3-7-sonnet-latest": {
    name: "Claude 3.7 Sonnet Latest",
    input: 3.00,
    output: 15.00,
    cache_write_5m: 3.75,
    cache_write_1h: 6.00,
    cache_read: 0.30
  },
  "claude-3-7-sonnet-20250219": {
    name: "Claude 3.7 Sonnet",
    input: 3.00,
    output: 15.00,
    cache_write_5m: 3.75,
    cache_write_1h: 6.00,
    cache_read: 0.30
  }
};

export class PricingService {
  private static memoryCache: Map<string, { data: Record<string, ModelPricing>; timestamp: number }> = new Map();
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly GITHUB_PRICING_URL = "https://raw.githubusercontent.com/Owloops/claude-powerline/main/pricing.json";

  private static getCacheFilePath(): string {
    const cacheDir = join(homedir(), '.claude', 'cache');
    try {
      mkdirSync(cacheDir, { recursive: true });
    } catch {
      // Directory might already exist
    }
    
    return join(cacheDir, 'pricing.json');
  }

  private static loadDiskCache(): { data: Record<string, ModelPricing>; timestamp: number } | null {
    try {
      const cacheFile = this.getCacheFilePath();
      const content = readFileSync(cacheFile, 'utf-8');
      const cached = JSON.parse(content);
      
      if (cached && cached.data && cached.timestamp) {
        return cached;
      }
    } catch {
      // Cache file doesn't exist or is invalid
    }
    return null;
  }

  private static saveDiskCache(data: Record<string, ModelPricing>): void {
    try {
      const cacheFile = this.getCacheFilePath();
      const cacheData = { data, timestamp: Date.now() };
      writeFileSync(cacheFile, JSON.stringify(cacheData));
    } catch (error) {
    }
  }

  static async getCurrentPricing(): Promise<Record<string, ModelPricing>> {
    const now = Date.now();

    // Check memory cache first
    const memCached = this.memoryCache.get('pricing');
    if (memCached && now - memCached.timestamp < this.CACHE_TTL) {
      return memCached.data;
    }

    // Check disk cache
    const diskCached = this.loadDiskCache();
    if (diskCached && now - diskCached.timestamp < this.CACHE_TTL) {
      this.memoryCache.set('pricing', diskCached);
      return diskCached.data;
    }

    // Try to fetch fresh data
    try {
      const response = await globalThis.fetch(this.GITHUB_PRICING_URL, {
        headers: {
          'User-Agent': 'cc-status',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        const dataObj = data as Record<string, unknown>;
        const pricingData: Record<string, unknown> = {};
        
        // Filter out metadata
        for (const [key, value] of Object.entries(dataObj)) {
          if (key !== '_meta') {
            pricingData[key] = value;
          }
        }
        
        if (this.validatePricingData(pricingData)) {
          this.memoryCache.set('pricing', { data: pricingData, timestamp: now });
          this.saveDiskCache(pricingData);
          return pricingData;
        }
      }
    } catch (error) {
    }

    // Use stale cache if available
    if (diskCached) {
      this.memoryCache.set('pricing', diskCached);
      return diskCached.data;
    }

    // Final fallback to offline data
    return OFFLINE_PRICING_DATA;
  }

  private static validatePricingData(data: unknown): data is Record<string, ModelPricing> {
    if (!data || typeof data !== 'object') return false;
    
    for (const [, value] of Object.entries(data)) {
      if (!value || typeof value !== 'object') return false;
      const pricing = value as Record<string, unknown>;
      
      if (typeof pricing.input !== 'number' || 
          typeof pricing.output !== 'number' ||
          typeof pricing.cache_read !== 'number') {
        return false;
      }
    }
    
    return true;
  }

  static async getModelPricing(modelId: string): Promise<ModelPricing> {
    const allPricing = await this.getCurrentPricing();
    
    if (allPricing[modelId]) {
      return allPricing[modelId];
    }

    return this.fuzzyMatchModel(modelId, allPricing);
  }

  private static fuzzyMatchModel(modelId: string, allPricing: Record<string, ModelPricing>): ModelPricing {
    const lowerModelId = modelId.toLowerCase();
    
    // Try exact case-insensitive match first
    for (const [key, pricing] of Object.entries(allPricing)) {
      if (key.toLowerCase() === lowerModelId) {
        return pricing;
      }
    }

    // Fuzzy matching patterns
    const patterns = [
      { pattern: ['opus-4-1', 'claude-opus-4-1'], fallback: 'claude-opus-4-1-20250805' },
      { pattern: ['opus-4', 'claude-opus-4'], fallback: 'claude-opus-4-20250514' },
      { pattern: ['sonnet-4', 'claude-sonnet-4'], fallback: 'claude-sonnet-4-20250514' },
      { pattern: ['sonnet-3.7', '3-7-sonnet'], fallback: 'claude-3-7-sonnet-20250219' },
      { pattern: ['3-5-sonnet', 'sonnet-3.5'], fallback: 'claude-3-5-sonnet-20241022' },
      { pattern: ['3-5-haiku', 'haiku-3.5'], fallback: 'claude-3-5-haiku-20241022' },
      { pattern: ['haiku', '3-haiku'], fallback: 'claude-3-haiku-20240307' },
      { pattern: ['opus'], fallback: 'claude-opus-4-20250514' },
      { pattern: ['sonnet'], fallback: 'claude-3-5-sonnet-20241022' },
    ];

    for (const { pattern, fallback } of patterns) {
      if (pattern.some(p => lowerModelId.includes(p))) {
        if (allPricing[fallback]) {
          return allPricing[fallback];
        }
      }
    }

    // Ultimate fallback
    return allPricing['claude-3-5-sonnet-20241022'] || {
      name: `${modelId} (Unknown Model)`,
      input: 3.00,
      cache_write_5m: 3.75,
      cache_write_1h: 6.00,
      cache_read: 0.30,
      output: 15.00
    };
  }

  /**
   * Calculate cost for a transcript entry
   */
  static async calculateCostForEntry(entry: TranscriptEntry): Promise<number> {
    const usage = entry.message?.usage;
    if (!usage) return 0;

    // Use existing cost if available
    if (typeof entry.costUSD === 'number') {
      return entry.costUSD;
    }

    const modelId = this.extractModelId(entry);
    const pricing = await this.getModelPricing(modelId);
    
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;
    
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const cacheReadCost = (cacheReadTokens / 1_000_000) * pricing.cache_read;
    const cacheCreationCost = (cacheCreationTokens / 1_000_000) * pricing.cache_write_5m;
    
    return inputCost + outputCost + cacheCreationCost + cacheReadCost;
  }

  private static extractModelId(entry: TranscriptEntry): string {
    // Try different model field locations
    if (entry.model && typeof entry.model === 'string') {
      return entry.model;
    }
    
    if (entry.model_id && typeof entry.model_id === 'string') {
      return entry.model_id;
    }
    
    const message = entry.message;
    if (message?.model) {
      if (typeof message.model === 'string') {
        return message.model;
      }
      if (typeof message.model === 'object' && message.model.id) {
        return message.model.id;
      }
    }
    
    return 'claude-3-5-sonnet-20241022';
  }
}