import { ResetTimeDetectionService } from "../services/reset-time-detection";

export interface SessionTimerInfo {
  timeRemaining: string;
  resetTime: string;
  isNearReset: boolean;
}

export class SessionTimerService {
  private resetTimeDetection = new ResetTimeDetectionService();

  async getSessionTimer(): Promise<SessionTimerInfo | null> {
    try {
      // Get reset time info from our detection service
      const resetInfo = await this.resetTimeDetection.getResetTime();
      
      // Format time remaining in compact format
      const timeRemaining = this.resetTimeDetection.formatTimeRemaining(resetInfo.timeRemaining);
      
      // Format reset time in compact format
      const resetTimeFormatted = this.resetTimeDetection.formatResetTime(resetInfo.resetTime);
      
      // Check if near reset
      const isNearReset = this.resetTimeDetection.isNearReset(resetInfo.timeRemaining);
      
      return {
        timeRemaining,
        resetTime: resetTimeFormatted,
        isNearReset
      };
    } catch (error) {
      console.debug('Error getting session timer:', error);
      return null;
    }
  }

  // Legacy method for backward compatibility - now delegates to async version
  getSessionTimerSync(activeBlock: any): SessionTimerInfo | null {
    // This method is deprecated but kept for compatibility
    // Call the async version but note that it returns null since we can't await
    console.warn('getSessionTimerSync is deprecated, use getSessionTimer() instead');
    return null;
  }
}