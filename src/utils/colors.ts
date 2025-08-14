export function hexToAnsi(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

export const RESET = '\x1b[0m';

export function colorText(text: string, color: string): string {
  if (color.startsWith('#')) {
    return `${hexToAnsi(color)}${text}${RESET}`;
  }
  return text; // Fallback for invalid colors
}