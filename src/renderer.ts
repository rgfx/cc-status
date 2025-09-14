import { GitInfo } from "./segments/git.js";
import { SubscriptionInfo } from "./segments/subscription.js";
import { ContextInfo } from "./segments/context.js";
import { BurnRateInfo } from "./segments/burn-rate.js";
import { SessionTimerInfo } from "./segments/session-timer.js";
import { DailyCostInfo } from "./segments/daily-cost.js";
import { Config } from "./config/config.js";
import { colorText } from "./utils/colors.js";

export interface ClaudeHookData {
  session_id: string;
  transcript_path: string;
  model: {
    id: string;
    display_name: string;
  };
  workspace: {
    current_dir: string;
    project_dir: string;
  };
  cwd: string;
}

export class StatusRenderer {
  constructor(private config: Config) {}

  renderGit(gitInfo: GitInfo | null): string {
    if (!gitInfo) return "";

    const { git: gitConfig } = this.config.segments;
    if (!gitConfig.enabled) return "";

    const { git: gitIcon } = this.config.format.icons;
    
    let statusIcon = "✓"; // clean
    if (gitInfo.status === "conflicts") {
      statusIcon = "⚠";
    } else if (gitInfo.status === "dirty") {
      statusIcon = "●";
    }

    let text = `${gitIcon} ${gitInfo.branch} ${statusIcon}`;

    // Add ahead/behind indicators
    if (gitInfo.ahead > 0 && gitInfo.behind > 0) {
      text += ` ↑${gitInfo.ahead}↓${gitInfo.behind}`;
    } else if (gitInfo.ahead > 0) {
      text += ` ↑${gitInfo.ahead}`;
    } else if (gitInfo.behind > 0) {
      text += ` ↓${gitInfo.behind}`;
    }

    return colorText(text, this.config.colors.neutral);
  }

  renderSubscription(subscriptionInfo: SubscriptionInfo | null): string {
    if (!subscriptionInfo) return "";

    const { subscription: subConfig } = this.config.segments;
    if (!subConfig.enabled) return "";

    const { subscription: subIcon } = this.config.format.icons;
    
    const tokensUsedFormatted = this.formatTokens(subscriptionInfo.tokensUsed);
    const tokensLimitFormatted = this.formatTokens(subscriptionInfo.tokensLimit);
    
    // Color only the percentage value based on thresholds
    let percentageColor = this.config.colors.safe;
    if (subscriptionInfo.percentage >= 80) {
      percentageColor = this.config.colors.critical;
    } else if (subscriptionInfo.percentage >= 60) {
      percentageColor = this.config.colors.warning;
    }
    
    const coloredPercentage = colorText(`${subscriptionInfo.percentage.toFixed(1)}%`, percentageColor);
    
    // Rest of text in neutral grey
    return colorText(`${subIcon} `, this.config.colors.neutral) + 
           coloredPercentage + 
           colorText(` ${tokensUsedFormatted}/${tokensLimitFormatted}`, this.config.colors.neutral);
  }

  renderContext(contextInfo: ContextInfo | null): string {
    const { context: contextConfig } = this.config.segments;
    if (!contextConfig.enabled || !contextInfo) return "";

    const { context: contextIcon } = this.config.format.icons;

    // Color only the percentage: 0-49% normal, 50-69% yellow, 70%+ red
    let percentageColor = this.config.colors.neutral;
    if (contextInfo.percentage >= 70) {
      percentageColor = this.config.colors.critical; // Red
    } else if (contextInfo.percentage >= 50) {
      percentageColor = this.config.colors.warning; // Yellow
    }

    // Format: ◐ 76% (with colored percentage)
    return colorText(`${contextIcon} `, this.config.colors.neutral) +
           colorText(`${contextInfo.percentage}%`, percentageColor);
  }

  renderBurnRate(burnRateInfo: BurnRateInfo | null, subscriptionInfo: SubscriptionInfo | null): string {
    const { burnRate: burnConfig } = this.config.segments;
    if (!burnConfig.enabled) return "";

    const { burnRate: burnIcon } = this.config.format.icons;
    
    // Just show the icon - no cost value
    const text = burnIcon;
    
    // Color based on actual burn rate thresholds (tokens per minute)
    let color = this.config.colors.neutral;
    
    if (burnRateInfo) {
      // Use tokensPerMinuteForIndicator (non-cache tokens) for thresholds
      const burnRate = burnRateInfo.tokensPerMinuteForIndicator;
      
      if (burnRate >= 1000) {
        color = this.config.colors.critical; // Red for high burn rate (>=1000 tokens/min)
      } else if (burnRate >= 500) {
        color = this.config.colors.warning; // Yellow for moderate burn rate (>=500 tokens/min)
      }
      // Green/neutral for low burn rate (<500 tokens/min)
    }
    
    return colorText(text, color);
  }

  renderDummyTimeLeft(): string {
    const { timeLeft: timeConfig } = this.config.segments;
    if (!timeConfig.enabled) return "";

    const { timeLeft: timeIcon } = this.config.format.icons;
    
    // Dummy time left data
    const text = `${timeIcon} 16h left`;
    return colorText(text, this.config.colors.neutral);
  }

  renderSessionTimer(sessionTimerInfo: SessionTimerInfo | null): string {
    const { sessionTimer: timerConfig } = this.config.segments;
    if (!timerConfig.enabled || !sessionTimerInfo) return "";

    const { sessionTimer: timerIcon } = this.config.format.icons;
    
    // Format: ◷ 3h 11:00:00 PM - entire text in neutral grey
    const text = `${timerIcon} ${sessionTimerInfo.timeRemaining} ${sessionTimerInfo.resetTime}`;
    
    return colorText(text, this.config.colors.neutral);
  }

  renderDailyCost(dailyCostInfo: DailyCostInfo | null): string {
    const { dailyCost: costConfig } = this.config.segments;
    if (!costConfig.enabled || !dailyCostInfo) return "";

    const { dailyCost: costIcon } = this.config.format.icons;
    
    // Format: $25.32
    const text = `${costIcon}${dailyCostInfo.formattedCost}`;
    
    return colorText(text, this.config.colors.neutral);
  }

  render(gitInfo: GitInfo | null, subscriptionInfo: SubscriptionInfo | null, contextInfo?: ContextInfo | null, burnRateInfo?: BurnRateInfo | null, sessionTimerInfo?: SessionTimerInfo | null, dailyCostInfo?: DailyCostInfo | null): string {
    const segments = [
      this.renderGit(gitInfo),
      this.renderSubscription(subscriptionInfo),
      this.renderContext(contextInfo),
      this.renderSessionTimer(sessionTimerInfo),
      this.renderDailyCost(dailyCostInfo),
      this.renderBurnRate(burnRateInfo, subscriptionInfo)
    ].filter(segment => segment.length > 0);

    // Add color reset at the beginning to fix PowerShell first-segment issue
    return '\x1b[0m' + segments.join(this.config.format.separator);
  }

  private formatTokens(tokens: number): string {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(1)}M`;
    } else if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}k`;
    }
    return tokens.toString();
  }
}