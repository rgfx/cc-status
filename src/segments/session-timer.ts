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
      
      // Format reset time like ccusage: use 2-digit hour format then remove leading zeros
      let resetTimeFormatted = resetTime.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      
      // Remove minutes and seconds to get compact format like ccusage (4AM, not 4:00AM)
      resetTimeFormatted = resetTimeFormatted.replace(/:\d{2}(:\d{2})?\s*(AM|PM)/, '$2');
      
      // Remove leading zero from hour (04AM -> 4AM) to match ccusage compact style
      resetTimeFormatted = resetTimeFormatted.replace(/^0/, '');
      
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