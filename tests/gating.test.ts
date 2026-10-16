import { describe, expect, it } from "vitest";
import { canRevealLevel, cooldownRemaining } from "../src/lib/gating";

const now = 1_000_000;

describe("cooldown and level gating", () => {
  it("waits out the selected cooldown", () => {
    expect(cooldownRemaining(now - 10_000, now, "30s")).toBe(20_000);
    expect(cooldownRemaining(now - 40_000, now, "30s")).toBe(0);
    expect(cooldownRemaining(null, now, "5min")).toBe(0);
    expect(cooldownRemaining(now, now, "off")).toBe(0);
  });

  it("allows only the next rung and blocks a locked solution", () => {
    expect(
      canRevealLevel({
        level: 2,
        revealedLevels: [1],
        level5Enabled: false,
        now,
        firstHintAt: now,
        level5DelayMinutes: 10,
        lastRevealAt: now - 60_000,
        cooldown: "30s",
      }).ok,
    ).toBe(true);
    expect(
      canRevealLevel({
        level: 3,
        revealedLevels: [1],
        level5Enabled: true,
        now,
        firstHintAt: now,
        level5DelayMinutes: 10,
        lastRevealAt: null,
        cooldown: "off",
      }),
    ).toMatchObject({ ok: false, reason: "skip" });
    expect(
      canRevealLevel({
        level: 5,
        revealedLevels: [1, 2, 3, 4],
        level5Enabled: false,
        now,
        firstHintAt: now - 999_999,
        level5DelayMinutes: 10,
        lastRevealAt: now - 999_999,
        cooldown: "off",
      }),
    ).toMatchObject({ ok: false, reason: "locked" });
  });

  it("holds rung 5 until the timer elapses and enforces cooldown", () => {
    const timer = canRevealLevel({
      level: 5,
      revealedLevels: [1, 2, 3, 4],
      level5Enabled: true,
      now,
      firstHintAt: now - 60_000,
      level5DelayMinutes: 10,
      lastRevealAt: now - 999_999,
      cooldown: "off",
    });
    expect(timer).toMatchObject({ ok: false, reason: "timer" });
    const cooled = canRevealLevel({
      level: 2,
      revealedLevels: [1],
      level5Enabled: false,
      now,
      firstHintAt: now,
      level5DelayMinutes: 10,
      lastRevealAt: now - 1_000,
      cooldown: "2min",
    });
    expect(cooled).toMatchObject({ ok: false, reason: "cooldown" });
  });
});
