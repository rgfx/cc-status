import { TranscriptParser } from "../services/transcript-parser";
import { PricingService } from "../services/pricing";

export interface DailyCostInfo {
  cost: number;
  formattedCost: string;
}

export async function getDailyCostInfo(): Promise<DailyCostInfo | null> {
  try {
    const transcriptParser = new TranscriptParser();
    
    // Get ALL sessions from today, not just the current active session
    const allDailyUsage = await transcriptParser.getAllSessionsForToday();
    
    let totalCost = allDailyUsage.totalCost;
    
    // Calculate costs for entries that don't have costUSD already
    for (const entry of allDailyUsage.entries) {
      if (typeof entry.costUSD !== 'number') {
        const calculatedCost = await PricingService.calculateCostForEntry(entry);
        totalCost += calculatedCost;
      }
    }

    return {
      cost: totalCost,
      formattedCost: totalCost.toFixed(2)
    };
  } catch (error) {
    return null;
  }
}