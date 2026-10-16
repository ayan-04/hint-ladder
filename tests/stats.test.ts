import { describe, expect, it } from "vitest";
import { aggregateStats, type HistoryEntry } from "../src/lib/stats";

const history: HistoryEntry[] = [
  {
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    tags: ["Array", "Hash Table"],
    maxHintLevel: 1,
    solved: true,
    timeSpentMs: 60_000,
    at: 100,
  },
  {
    slug: "three-sum",
    title: "3Sum",
    difficulty: "Medium",
    tags: ["Array", "Two Pointers"],
    maxHintLevel: 4,
    solved: true,
    timeSpentMs: 120_000,
    at: 200,
  },
  {
    slug: "trapping-rain-water",
    title: "Trapping Rain Water",
    difficulty: "Hard",
    tags: ["Two Pointers", "Stack"],
    maxHintLevel: 3,
    solved: true,
    timeSpentMs: 180_000,
    at: 300,
  },
  {
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    tags: ["Stack"],
    maxHintLevel: 2,
    solved: true,
    timeSpentMs: 40_000,
    at: 400,
  },
];

describe("stats aggregation", () => {
  it("averages hint level, flags weak tags, and counts a low-hint streak", () => {
    const stats = aggregateStats(history);
    expect(stats.attempted).toBe(4);
    expect(stats.solved).toBe(4);
    expect(stats.averageHintLevel).toBe(2.5);
    const twoPointers = stats.byTag.find((tag) => tag.tag === "Two Pointers");
    expect(twoPointers?.weak).toBe(true);
    const stack = stats.byTag.find((tag) => tag.tag === "Stack");
    expect(stack?.weak).toBe(false);
    expect(stats.streak).toBe(1);
    expect(stats.recent[0]?.slug).toBe("valid-parentheses");
  });
});
