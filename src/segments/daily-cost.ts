import { TranscriptParser } from "../services/transcript-parser";

export interface DailyCostInfo {
  cost: number;
  formattedCost: string;
}

export async function getDailyCostInfo(): Promise<DailyCostInfo | null> {
  try {
    const transcriptParser = new TranscriptParser();

    // Get ALL sessions from today, not just the current active session
    // The transcript parser now calculates costs automatically
    const allDailyUsage = await transcriptParser.getAllSessionsForToday();

    return {
      cost: allDailyUsage.totalCost,
      formattedCost: allDailyUsage.totalCost.toFixed(2)
    };
  } catch (error) {
    return null;
  }
}