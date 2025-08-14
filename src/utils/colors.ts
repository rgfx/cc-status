export function hexToAnsi(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

export const RESET = '\x1b[0m';

// Standard ANSI color codes for better PowerShell compatibility
export const ANSI_COLORS = {
  WHITE: '\x1b[37m',
  GREY: '\x1b[90m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  BRIGHT_RED: '\x1b[91m',
  BRIGHT_GREEN: '\x1b[92m',
  BRIGHT_YELLOW: '\x1b[93m'
};

export function colorText(text: string, color: string): string {
  if (color.startsWith('#')) {
    return `${hexToAnsi(color)}${text}${RESET}`;
  }
  return text; // Fallback for invalid colors
}