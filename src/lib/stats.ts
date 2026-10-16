export interface HistoryEntry {
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  maxHintLevel: number;
  solved: boolean;
  timeSpentMs: number;
  at: number;
}

export interface TagStat {
  tag: string;
  attempts: number;
  averageLevel: number;
  level3PlusShare: number;
  weak: boolean;
}

export interface StatsSummary {
  attempted: number;
  solved: number;
  averageHintLevel: number;
  streak: number;
  byTag: TagStat[];
  recent: HistoryEntry[];
}

export function upsertHistory(history: readonly HistoryEntry[], next: HistoryEntry): HistoryEntry[] {
  return [...history.filter((entry) => entry.slug !== next.slug), next];
}

export function aggregateStats(history: readonly HistoryEntry[]): StatsSummary {
  const attemptedEntries = [...history];
  const attempted = attemptedEntries.length;
  const solvedEntries = history.filter((entry) => entry.solved);
  const averageHintLevel =
    attempted === 0
      ? 0
      : attemptedEntries.reduce((sum, entry) => sum + entry.maxHintLevel, 0) / attempted;

  const tagMap = new Map<string, { attempts: number; levelSum: number; high: number }>();
  for (const entry of attemptedEntries) {
    for (const tag of entry.tags) {
      const current = tagMap.get(tag) ?? { attempts: 0, levelSum: 0, high: 0 };
      current.attempts += 1;
      current.levelSum += entry.maxHintLevel;
      if (entry.maxHintLevel >= 3) current.high += 1;
      tagMap.set(tag, current);
    }
  }
  const byTag = Array.from(tagMap.entries())
    .map(([tag, value]) => {
      const level3PlusShare = value.attempts === 0 ? 0 : value.high / value.attempts;
      return {
        tag,
        attempts: value.attempts,
        averageLevel: value.levelSum / value.attempts,
        level3PlusShare,
        weak: value.attempts >= 2 && level3PlusShare > 0.5,
      };
    })
    .sort((a, b) => b.averageLevel - a.averageLevel || b.attempts - a.attempts);

  const recentSolved = [...solvedEntries].sort((a, b) => b.at - a.at);
  let streak = 0;
  for (const entry of recentSolved) {
    if (entry.maxHintLevel <= 2) streak += 1;
    else break;
  }

  const recent = [...history].sort((a, b) => b.at - a.at).slice(0, 8);
  return {
    attempted,
    solved: solvedEntries.length,
    averageHintLevel,
    streak,
    byTag,
    recent,
  };
}

export function historyToMarkdown(history: readonly HistoryEntry[]): string {
  const lines = ["# HintLadder history", ""];
  const ordered = [...history].sort((a, b) => b.at - a.at);
  if (ordered.length === 0) lines.push("_No problems yet._");
  for (const entry of ordered) {
    const when = new Date(entry.at).toISOString();
    lines.push(
      `- **${entry.title}** (\`${entry.slug}\`) — ${entry.difficulty}, max rung ${entry.maxHintLevel}, ${
        entry.solved ? "solved" : "unsolved"
      }, ${Math.round(entry.timeSpentMs / 1000)}s, ${when}`,
    );
    if (entry.tags.length) lines.push(`  - tags: ${entry.tags.join(", ")}`);
  }
  return lines.join("\n");
}
