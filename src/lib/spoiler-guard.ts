export interface SpoilerVerdict {
  ok: boolean;
  reason: string;
}

const FENCE = /```([^\n`]*)\n?[\s\S]*?```/g;

const CODE_LINE = [
  /^\s*(?:def|function|class|fn)\s+\w+/,
  /^\s*(?:public|private|protected)\s+(?:static\s+)?[\w<>[\]]+\s+\w+\s*\(/,
  /^\s*(?:const|let|var)\s+\w+\s*=/,
  /^\s*(?:for|while)\s*\([^)]*\)\s*\{?/,
  /^\s*if\s*\([^)]*\)\s*\{/,
  /^\s*return\s+.+\s*;\s*$/,
  /^\s*#include\b/,
  /^\s*(?:import|from)\s+[\w.{]/,
  /\b(?:console\.log|System\.out|printf|println)\s*\(/,
  /^\s*[\w.]+\s*=\s*[^;\n]+;\s*$/,
];

export function codeFences(body: string): { lang: string }[] {
  const found: { lang: string }[] = [];
  for (const match of body.matchAll(FENCE)) {
    found.push({ lang: (match[1] ?? "").trim() });
  }
  return found;
}

export function hasCodeLikeStatements(body: string): boolean {
  return body.split("\n").some((line) => CODE_LINE.some((pattern) => pattern.test(line)));
}

export function checkSpoiler(level: number, body: string): SpoilerVerdict {
  const fences = codeFences(body);
  const tagged = fences.some((fence) => fence.lang.length > 0);
  if (level <= 0 || level === 1 || level === 2) {
    if (fences.length > 0) return { ok: false, reason: "Hint included a code fence" };
    if (hasCodeLikeStatements(body)) {
      return { ok: false, reason: "Hint included code-like statements" };
    }
    return { ok: true, reason: "" };
  }
  if (level === 3) {
    if (fences.length > 0) return { ok: false, reason: "Approach included a code fence" };
    return { ok: true, reason: "" };
  }
  if (level === 4) {
    if (tagged) return { ok: false, reason: "Pseudocode used a language-tagged fence" };
    return { ok: true, reason: "" };
  }
  return { ok: true, reason: "" };
}
