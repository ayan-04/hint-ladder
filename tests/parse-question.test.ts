import { describe, expect, it } from "vitest";
import premiumPayload from "../fixtures/question-premium.json";
import twoSumPayload from "../fixtures/question-two-sum.json";
import { parseQuestionResponse } from "../src/lib/parse-question";

describe("parseQuestionResponse", () => {
  it("turns a GraphQL question into text, tags, and examples", () => {
    const parsed = parseQuestionResponse(twoSumPayload);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.problem.slug).toBe("two-sum");
    expect(parsed.problem.tags.map((tag) => tag.slug)).toEqual(["array", "hash-table"]);
    expect(parsed.problem.contentText).toContain("Example 1:");
    expect(parsed.problem.contentText).toContain("10^4");
    expect(parsed.problem.contentText).toContain("Constraints:");
    expect(parsed.problem.contentText).not.toContain("<code>");
  });

  it("flags a null content field as premium", () => {
    const parsed = parseQuestionResponse(premiumPayload);
    expect(parsed).toMatchObject({ ok: false, reason: "premium", slug: "number-of-visible-people-in-a-queue" });
  });

  it("rejects a malformed payload", () => {
    expect(parseQuestionResponse({ data: { question: "nope" } }).ok).toBe(false);
  });
});
