import { describe, expect, it } from "vitest";
import { hintCacheKey } from "../src/lib/cache-key";

describe("hint cache keys", () => {
  it("changes when slug, rung, provider, model, or style changes", () => {
    const key = hintCacheKey({
      slug: "two-sum",
      level: 2,
      provider: "gemini",
      model: "gemini-2.0-flash",
      style: "socratic",
    });
    expect(key).toBe("two-sum|2|gemini|gemini-2.0-flash|socratic");
    expect(hintCacheKey({ slug: "two-sum", level: 3, provider: "gemini", model: "gemini-2.0-flash", style: "socratic" })).not.toBe(key);
    expect(hintCacheKey({ slug: "two-sum", level: 2, provider: "openai", model: "gemini-2.0-flash", style: "socratic" })).not.toBe(key);
  });
});
