import type { CooldownSetting } from "../shared/settings";

export const COOLDOWN_MS: Record<CooldownSetting, number> = {
  off: 0,
  "30s": 30_000,
  "2min": 120_000,
  "5min": 300_000,
};

export function cooldownRemaining(
  lastRevealAt: number | null,
  now: number,
  setting: CooldownSetting,
): number {
  if (lastRevealAt === null) return 0;
  const wait = COOLDOWN_MS[setting];
  return Math.max(0, lastRevealAt + wait - now);
}

export interface GateInput {
  level: number;
  revealedLevels: readonly number[];
  level5Enabled: boolean;
  now: number;
  firstHintAt: number | null;
  level5DelayMinutes: number;
  lastRevealAt: number | null;
  cooldown: CooldownSetting;
}

export type GateResult =
  | { ok: true }
  | { ok: false; reason: "skip" | "locked" | "cooldown" | "timer" | "range"; waitMs?: number };

export function highestRevealed(levels: readonly number[]): number {
  return levels.reduce((max, level) => (level > max ? level : max), 0);
}

export function canRevealLevel(input: GateInput): GateResult {
  if (input.level < 1 || input.level > 5) return { ok: false, reason: "range" };
  const highest = highestRevealed(input.revealedLevels);
  if (input.level > highest + 1) return { ok: false, reason: "skip" };
  if (input.level <= highest) return { ok: true };
  if (input.level === 5 && !input.level5Enabled) return { ok: false, reason: "locked" };
  const wait = cooldownRemaining(input.lastRevealAt, input.now, input.cooldown);
  if (input.level === highest + 1 && highest >= 1 && wait > 0) {
    return { ok: false, reason: "cooldown", waitMs: wait };
  }
  if (input.level === 5) {
    const start = input.firstHintAt ?? input.now;
    const unlockAt = start + input.level5DelayMinutes * 60_000;
    if (input.now < unlockAt) {
      return { ok: false, reason: "timer", waitMs: unlockAt - input.now };
    }
  }
  return { ok: true };
}
