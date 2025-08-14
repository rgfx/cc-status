export interface SegmentConfig {
  enabled: boolean;
  color?: string;
}

export interface Config {
  segments: {
    git: SegmentConfig;
    subscription: SegmentConfig;
    context: SegmentConfig;
    burnRate: SegmentConfig;
    timeLeft: SegmentConfig;
    sessionTimer: SegmentConfig;
    dailyCost: SegmentConfig;
  };
  format: {
    separator: string;
    icons: {
      git: string;
      subscription: string;
      context: string;
      burnRate: string;
      timeLeft: string;
      sessionTimer: string;
      dailyCost: string;
    };
  };
  colors: {
    safe: string;      // 0-80%
    warning: string;   // 80-100%
    critical: string;  // 100%+
    neutral: string;   // git, rates, time
    lightBlue: string; // session timer
  };
}

export const DEFAULT_CONFIG: Config = {
  segments: {
    git: { enabled: true, color: "neutral" },
    subscription: { enabled: true, color: "auto" },
    context: { enabled: true, color: "neutral" },
    burnRate: { enabled: true, color: "neutral" },
    timeLeft: { enabled: true, color: "neutral" },
    sessionTimer: { enabled: true, color: "neutral" },
    dailyCost: { enabled: true, color: "neutral" }
  },
  format: {
    separator: " ",
    icons: {
      git: "⑂",
      subscription: "↻",
      context: "◐",
      burnRate: "▲",
      timeLeft: "⏱",
      sessionTimer: "◷",
      dailyCost: "$"
    }
  },
  colors: {
    safe: "#00ff00",     // Green
    warning: "#ffff00",  // Yellow  
    critical: "#ff0000", // Red
    neutral: "#8387a1",  // Grey
    lightBlue: "#87ceeb" // Light blue for session timer
  }
};