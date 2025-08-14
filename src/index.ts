import process from "node:process";
import { json } from "node:stream/consumers";
import { GitService } from "./segments/git.js";
import { SubscriptionService } from "./segments/subscription.js";
import { ContextService } from "./segments/context.js";
import { SessionTimerService } from "./segments/session-timer.js";
import { getDailyCostInfo } from "./segments/daily-cost.js";
import { StatusRenderer, ClaudeHookData } from "./renderer.js";
import { ConfigLoader } from "./config/config-loader.js";

async function main(): Promise<void> {
  try {
    const showHelp = process.argv.includes("--help") || process.argv.includes("-h");

    if (showHelp) {
      console.log(`
cc-status - Focused Claude Code statusline

Usage: cc-status [options]

Options:
  -h, --help               Show this help

Output format:
  ⑂ main ✓  ↻ 48.6% (9404.3k/19342.8k)  ◷ 45k (76%)  ⟢ $1.20/h  ⏱ 16h left

Color coding:
  🟢 Green (0-80%): Safe usage levels
  🟡 Yellow (80-100%): Warning - approaching limits  
  🔴 Red (100%+): Critical - over limits

Usage in Claude Code settings.json:
{
  "statusLine": {
    "type": "command",
    "command": "cc-status"
  }
}
`);
      process.exit(0);
    }

    if (process.stdin.isTTY === true) {
      console.error(`Error: This tool requires input from Claude Code

cc-status is designed to be used as a Claude Code statusLine command.
It reads hook data from stdin and outputs a formatted statusline.

Add to ~/.claude/settings.json:
{
  "statusLine": {
    "type": "command",
    "command": "cc-status"
  }
}

Run with --help for more options.

To test output manually:
echo '{"session_id":"test","workspace":{"current_dir":"/path","project_dir":"/path"},"model":{"id":"claude-3-5-sonnet","display_name":"Claude"}}' | cc-status`);
      process.exit(1);
    }

    const hookData = (await json(process.stdin)) as ClaudeHookData;

    if (!hookData) {
      console.error("Error: No input provided");
      process.exit(1);
    }

    const currentDir = hookData.workspace?.current_dir || hookData.cwd || process.cwd();
    
    // Load config with full priority system: CLI > ENV > Config Files > Defaults
    const configLoader = new ConfigLoader();
    const finalConfig = configLoader.loadConfig();
    
    // Initialize services
    const gitService = new GitService();
    const subscriptionService = new SubscriptionService();
    const contextService = new ContextService();
    const sessionTimerService = new SessionTimerService();
    const renderer = new StatusRenderer(finalConfig);

    // Get data based on what's enabled
    const promises: Promise<any>[] = [];
    
    if (finalConfig.segments.git.enabled) {
      promises.push(Promise.resolve(gitService.getGitInfo(currentDir)));
    } else {
      promises.push(Promise.resolve(null));
    }
    
    if (finalConfig.segments.subscription.enabled) {
      promises.push(subscriptionService.getSubscriptionInfo());
    } else {
      promises.push(Promise.resolve(null));
    }
    
    if (finalConfig.segments.context.enabled) {
      promises.push(contextService.getContextInfo(hookData.session_id));
    } else {
      promises.push(Promise.resolve(null));
    }

    const [gitInfo, subscriptionInfo, contextInfo] = await Promise.all(promises);

    // Get session timer info if enabled
    let sessionTimerInfo = null;
    if (finalConfig.segments.sessionTimer.enabled && subscriptionInfo) {
      // Get ccusage data again for session timer (we need the active block)
      try {
        const ccusageData = await subscriptionService.callCcusage();
        const activeBlock = ccusageData?.blocks?.find((block: any) => block.isActive === true);
        sessionTimerInfo = sessionTimerService.getSessionTimer(activeBlock);
      } catch {
        // Fallback gracefully if ccusage fails
        sessionTimerInfo = null;
      }
    }

    // Get daily cost info if enabled
    let dailyCostInfo = null;
    if (finalConfig.segments.dailyCost.enabled) {
      dailyCostInfo = await getDailyCostInfo();
    }

    // Render and output
    const statusline = renderer.render(gitInfo, subscriptionInfo, contextInfo, sessionTimerInfo, dailyCostInfo);
    console.log(statusline);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating statusline:", errorMessage);
    process.exit(1);
  }
}

main();