export interface SessionTimerInfo {
  timeRemaining: string;
  resetTime: string;
  isNearReset: boolean;
}

export class SessionTimerService {
  getSessionTimer(activeBlock: any): SessionTimerInfo | null {
    if (!activeBlock) {
      return null;
    }

    try {
      // Get reset time from ccusage block (usageLimitResetTime or endTime)
      const resetTimeStr = activeBlock.usageLimitResetTime || activeBlock.endTime;
      
      if (!resetTimeStr) {
        return null;
      }

      const resetTime = new Date(resetTimeStr);
      const now = new Date();
      
      // Calculate remaining time in seconds
      const remainingMs = resetTime.getTime() - now.getTime();
      const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
      
      // Convert to hours and minutes
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      
      // Format time remaining
      let timeRemaining: string;
      if (hours > 0) {
        timeRemaining = `${hours}h`;
        if (minutes > 0) {
          timeRemaining += ` ${minutes}m`;
        }
      } else if (minutes > 0) {
        timeRemaining = `${minutes}m`;
      } else {
        timeRemaining = `${remainingSeconds}s`;
      }
      
      // Format reset time (HH:MM:SSAM/PM) - no space before AM/PM
      let resetTimeFormatted = resetTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      
      // Remove space before AM/PM
      resetTimeFormatted = resetTimeFormatted.replace(' AM', 'AM').replace(' PM', 'PM');
      
      // Check if near reset (less than 30 minutes)
      const isNearReset = remainingSeconds < 30 * 60;
      
      return {
        timeRemaining,
        resetTime: resetTimeFormatted,
        isNearReset
      };
    } catch (error) {
      return null;
    }
  }
}