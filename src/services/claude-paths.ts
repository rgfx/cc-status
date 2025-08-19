import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * Get possible Claude configuration paths
 * Enhanced to support multiple paths via environment variables
 */
export function getClaudePaths(): string[] {
  const paths: string[] = [];

  // Check for environment variable with multiple paths
  const envPath = process.env.CLAUDE_CONFIG_DIR;
  if (envPath) {
    envPath.split(",").forEach((path) => {
      const trimmedPath = path.trim();
      if (existsSync(trimmedPath)) {
        paths.push(trimmedPath);
      }
    });
  }

  // Fallback to default paths if no environment paths found
  if (paths.length === 0) {
    const homeDir = homedir();
    const configPath = join(homeDir, ".config", "claude");
    const claudePath = join(homeDir, ".claude");

    if (existsSync(configPath)) {
      paths.push(configPath);
    } else if (existsSync(claudePath)) {
      paths.push(claudePath);
    }
  }

  return paths;
}

/**
 * Find all project directories within Claude paths
 */
export async function findProjectPaths(claudePaths: string[]): Promise<string[]> {
  const projectPaths: string[] = [];
  
  for (const claudePath of claudePaths) {
    const projectsDir = join(claudePath, "projects");
    
    if (existsSync(projectsDir)) {
      try {
        const entries = await readdir(projectsDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const projectPath = join(projectsDir, entry.name);
            projectPaths.push(projectPath);
          }
        }
      } catch (error) {
        console.debug(`Failed to read projects directory ${projectsDir}:`, error);
      }
    }
  }
  
  return projectPaths;
}

/**
 * Find transcript file for a specific session ID
 */
export async function findTranscriptFile(sessionId: string): Promise<string | null> {
  const claudePaths = getClaudePaths();
  const projectPaths = await findProjectPaths(claudePaths);
  
  for (const projectPath of projectPaths) {
    const transcriptPath = join(projectPath, `${sessionId}.jsonl`);
    if (existsSync(transcriptPath)) {
      return transcriptPath;
    }
  }
  
  return null;
}

/**
 * Find all transcript files modified today
 */
export async function findTodaysTranscripts(): Promise<string[]> {
  const claudePaths = getClaudePaths();
  const projectPaths = await findProjectPaths(claudePaths);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  const todaysTranscripts: string[] = [];
  
  for (const projectPath of projectPaths) {
    try {
      const entries = await readdir(projectPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          const transcriptPath = join(projectPath, entry.name);
          
          try {
            const stats = await import('node:fs/promises').then(fs => fs.stat(transcriptPath));
            const modifiedDate = new Date(stats.mtime);
            modifiedDate.setHours(0, 0, 0, 0);
            
            if (modifiedDate.getTime() >= today.getTime()) {
              todaysTranscripts.push(transcriptPath);
            }
          } catch (statError) {
            console.debug(`Failed to stat transcript file ${transcriptPath}:`, statError);
          }
        }
      }
    } catch (error) {
      console.debug(`Failed to read project directory ${projectPath}:`, error);
    }
  }
  
  return todaysTranscripts;
}

/**
 * Find transcript files for a specific date
 */
export async function findTranscriptsForDate(date: Date): Promise<string[]> {
  const claudePaths = getClaudePaths();
  const projectPaths = await findProjectPaths(claudePaths);
  
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  
  const dayTranscripts: string[] = [];
  
  for (const projectPath of projectPaths) {
    try {
      const entries = await readdir(projectPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          const transcriptPath = join(projectPath, entry.name);
          
          try {
            const stats = await import('node:fs/promises').then(fs => fs.stat(transcriptPath));
            const modifiedTime = stats.mtime.getTime();
            
            if (modifiedTime >= targetDate.getTime() && modifiedTime < nextDay.getTime()) {
              dayTranscripts.push(transcriptPath);
            }
          } catch (statError) {
            console.debug(`Failed to stat transcript file ${transcriptPath}:`, statError);
          }
        }
      }
    } catch (error) {
      console.debug(`Failed to read project directory ${projectPath}:`, error);
    }
  }
  
  return dayTranscripts;
}