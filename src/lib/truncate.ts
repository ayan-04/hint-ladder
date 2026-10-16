export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  const slice = text.slice(0, maxChars);
  const lastBreak = slice.lastIndexOf("\n\n");
  const cut = lastBreak > maxChars * 0.6 ? slice.slice(0, lastBreak) : slice;
  return { text: `${cut.trim()}\n\n[truncated]`, truncated: true };
}
