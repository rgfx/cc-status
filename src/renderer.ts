import { GitInfo } from "./segments/git.js";
import { SubscriptionInfo } from "./segments/subscription.js";
import { SessionTimerInfo } from "./segments/session-timer.js";
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
    
    const text = `${subIcon} ${subscriptionInfo.percentage.toFixed(1)}% (${tokensUsedFormatted}/${tokensLimitFormatted})`;

    // Color based on percentage
    let color = this.config.colors.safe;
    if (subscriptionInfo.percentage >= 100) {
      color = this.config.colors.critical;
    } else if (subscriptionInfo.percentage >= 80) {
      color = this.config.colors.warning;
    }

    return colorText(text, color);
  }

  renderDummyContext(): string {
    const { context: contextConfig } = this.config.segments;
    if (!contextConfig.enabled) return "";

    const { context: contextIcon } = this.config.format.icons;
    
    // Dummy context data - 76% remaining
    const text = `${contextIcon} 45k (76%)`;
    return colorText(text, this.config.colors.safe);
  }

  renderDummyBurnRate(): string {
    const { burnRate: burnConfig } = this.config.segments;
    if (!burnConfig.enabled) return "";

    const { burnRate: burnIcon } = this.config.format.icons;
    
    // Dummy burn rate data
    const text = `${burnIcon} $1.20/h`;
    return colorText(text, this.config.colors.neutral);
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
    
    // Format: ◷ 3h (11:00:00 PM) - entire text including icon in light blue
    const text = `${timerIcon} ${sessionTimerInfo.timeRemaining} (${sessionTimerInfo.resetTime})`;
    
    return colorText(text, this.config.colors.lightBlue);
  }

  render(gitInfo: GitInfo | null, subscriptionInfo: SubscriptionInfo | null, contextInfo?: any, sessionTimerInfo?: SessionTimerInfo | null): string {
    const segments = [
      this.renderGit(gitInfo),
      this.renderSubscription(subscriptionInfo),
      this.renderDummyContext(),
      this.renderDummyBurnRate(),
      this.renderSessionTimer(sessionTimerInfo)
    ].filter(segment => segment.length > 0);

    return segments.join(this.config.format.separator);
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