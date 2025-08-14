import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DEFAULT_CONFIG } from "./config.js";

export interface ConfigPaths {
  project: string;
  user: string;
  xdg: string;
}

export class ConfigLoader {
  private getConfigPaths(): ConfigPaths {
    const cwd = process.cwd();
    const homeDir = os.homedir();
    const configDir = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
    
    return {
      project: path.join(cwd, '.cc-status.json'),
      user: path.join(homeDir, '.claude', 'cc-status.json'),
      xdg: path.join(configDir, 'cc-status', 'config.json')
    };
  }

  private loadConfigFile(filePath: string): any {
    try {
      if (fs.existsSync(filePath)) {
        const configData = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.warn(`Warning: Failed to load config from ${filePath}:`, error);
    }
    return null;
  }

  private loadConfigFiles(): any {
    const paths = this.getConfigPaths();
    
    // Try config files in priority order: project > user > xdg
    const configLocations = [paths.project, paths.user, paths.xdg];
    
    for (const location of configLocations) {
      const config = this.loadConfigFile(location);
      if (config) {
        return config;
      }
    }
    
    return {};
  }

  private loadEnvironmentVariables(): any {
    const envConfig: any = {
      segments: {},
      format: {},
      colors: {},
      thresholds: {}
    };

    // Parse CC_STATUS_* environment variables
    Object.entries(process.env).forEach(([key, value]) => {
      if (key.startsWith('CC_STATUS_') && value) {
        const configKey = key.replace('CC_STATUS_', '').toLowerCase();
        
        // Handle segment enables/disables
        if (configKey.endsWith('_enabled')) {
          const segment = configKey.replace('_enabled', '');
          if (!envConfig.segments[segment]) envConfig.segments[segment] = {};
          envConfig.segments[segment].enabled = value.toLowerCase() === 'true';
        }
        // Handle colors
        else if (configKey.startsWith('color_')) {
          const colorName = configKey.replace('color_', '');
          envConfig.colors[colorName] = value;
        }
        // Handle thresholds
        else if (configKey.startsWith('threshold_')) {
          const thresholdName = configKey.replace('threshold_', '');
          envConfig.thresholds[thresholdName] = parseInt(value) || 0;
        }
      }
    });

    return envConfig;
  }

  private parseCliFlags(): any {
    const cliConfig: any = {
      segments: {},
      format: {},
      colors: {},
      thresholds: {}
    };

    process.argv.forEach(arg => {
      if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=');
        
        // Handle segment flags: --git=false, --subscription=true
        if (['git', 'subscription', 'context', 'burnRate', 'timeLeft'].includes(key)) {
          if (!cliConfig.segments[key]) cliConfig.segments[key] = {};
          cliConfig.segments[key].enabled = value !== 'false';
        }
        // Handle color flags: --color-safe=#00ff00
        else if (key.startsWith('color-')) {
          const colorName = key.replace('color-', '');
          cliConfig.colors[colorName] = value;
        }
        // Handle threshold flags: --threshold-warning=90
        else if (key.startsWith('threshold-')) {
          const thresholdName = key.replace('threshold-', '');
          cliConfig.thresholds[thresholdName] = parseInt(value) || 0;
        }
        // Handle format flags: --separator=" | "
        else if (key === 'separator') {
          cliConfig.format.separator = value;
        }
      }
    });

    return cliConfig;
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else if (source[key] !== undefined) {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  public loadConfig(): any {
    // Start with defaults
    let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    
    // Apply config files (project > user > xdg)
    const fileConfig = this.loadConfigFiles();
    config = this.deepMerge(config, fileConfig);
    
    // Apply environment variables
    const envConfig = this.loadEnvironmentVariables();
    config = this.deepMerge(config, envConfig);
    
    // Apply CLI flags (highest priority)
    const cliConfig = this.parseCliFlags();
    config = this.deepMerge(config, cliConfig);
    
    return config;
  }
}