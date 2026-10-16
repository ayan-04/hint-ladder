import type { HintResponse } from "../lib/schema";

export interface StoredHint extends HintResponse {
  cacheKey: string;
  createdAt: number;
}

export interface LadderRecord {
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  hints: Record<string, StoredHint>;
  shown: Record<string, string>;
  revealedLevels: number[];
  review?: StoredHint;
  firstHintAt?: number;
  lastRevealAt?: number;
  openedAt: number;
  solvedAt?: number;
}

export interface LauncherPosition {
  x: number;
  y: number;
}
