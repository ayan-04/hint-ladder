import { describe, expect, it } from "vitest";
import { isContestPath, isProblemPath, slugFromPath } from "../src/lib/slug";

describe("slug routing", () => {
  it("reads a problem slug and ignores list routes", () => {
    expect(slugFromPath("/problems/two-sum/")).toBe("two-sum");
    expect(slugFromPath("/problems/two-sum/solutions/")).toBe("two-sum");
    expect(slugFromPath("/problems/")).toBeNull();
    expect(isProblemPath("/problems/two-sum/description/")).toBe(true);
  });

  it("treats contest URLs as contests even if they contain a problem segment", () => {
    expect(isContestPath("/contest/weekly-contest-400/problems/two-sum")).toBe(true);
    expect(isProblemPath("/contest/weekly-contest-400/problems/two-sum")).toBe(false);
  });
});
