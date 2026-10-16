import { describe, expect, it } from "vitest";
import { hintResponseSchema } from "../src/lib/schema";

describe("hint schema", () => {
  it("accepts a complete hint and rejects spoilers outside the shape", () => {
    expect(
      hintResponseSchema.parse({
        level: 2,
        title: "Complement",
        body: "What would you store so the next number can finish the pair?",
        conceptsToReview: ["hash map"],
      }).level,
    ).toBe(2);
    expect(hintResponseSchema.safeParse({ level: 9, title: "", body: "", conceptsToReview: [""] }).success).toBe(
      false,
    );
  });
});
