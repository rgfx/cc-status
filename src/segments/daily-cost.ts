import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DailyCostInfo {
  cost: number;
  formattedCost: string;
}

export async function getDailyCostInfo(): Promise<DailyCostInfo | null> {
  try {
    // Get today's date in local timezone, then format for ccusage
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`; // YYYYMMDD format
    
    const { stdout } = await execAsync(`npx ccusage daily --since ${dateStr} --until ${dateStr} --json`);
    const ccusageData = JSON.parse(stdout);
    
    // Get today's cost from filtered daily data
    const todayData = ccusageData.daily?.[0]; // Should be only one day
    const dailyCost = todayData?.totalCost || 0;

    return {
      cost: dailyCost,
      formattedCost: dailyCost.toFixed(2)
    };
  } catch (error) {
    console.error('Error fetching daily cost:', error);
    return null;
  }
}