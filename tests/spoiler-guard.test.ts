import { describe, expect, it } from "vitest";
import { checkSpoiler } from "../src/lib/spoiler-guard";

describe("spoiler guard", () => {
  it("rejects code fences and code-like lines on rungs 1 and 2", () => {
    expect(checkSpoiler(1, "This shape wants a hash map.").ok).toBe(true);
    expect(checkSpoiler(1, "Try this:\n```\nlet x = 1;\n```").ok).toBe(false);
    expect(checkSpoiler(2, "What if you stored the complement as you walk the array?").ok).toBe(true);
    expect(checkSpoiler(2, "const map = new Map();").ok).toBe(false);
  });

  it("rejects fences on rung 3 but allows complexity prose", () => {
    expect(checkSpoiler(3, "Walk once, then the target time is O(n) and space is O(n).").ok).toBe(true);
    expect(checkSpoiler(3, "```\nfor each item\n```").ok).toBe(false);
  });

  it("allows an untagged fence on rung 4 and rejects a language tag", () => {
    expect(checkSpoiler(4, "```\nfor each number\n  store complement\n```").ok).toBe(true);
    expect(checkSpoiler(4, "```python\nfor n in nums:\n    pass\n```").ok).toBe(false);
  });

  it("leaves rung 5 unrestricted and blocks fences in a review", () => {
    expect(checkSpoiler(5, "```python\nprint(1)\n```").ok).toBe(true);
    expect(checkSpoiler(0, "What happens on the second index?").ok).toBe(true);
    expect(checkSpoiler(0, "```js\nreturn [0,1]\n```").ok).toBe(false);
  });
});
