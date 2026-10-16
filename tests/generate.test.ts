import { describe, expect, it } from "vitest";
import { geminiProvider, openaiProvider } from "../src/lib/providers";
import { interpretModelText } from "../src/lib/generate";

describe("provider parsers", () => {
  it("reads Gemini and OpenAI payloads", () => {
    expect(
      geminiProvider.parseComplete({
        candidates: [{ content: { parts: [{ text: "{\"level\":1}" }] } }],
      }),
    ).toContain("level");
    expect(
      openaiProvider.parseStreamEvent(JSON.stringify({ choices: [{ delta: { content: "hi" } }] })),
    ).toBe("hi");
  });

  it("rejects a fenced early rung after JSON parsing", () => {
    expect(() =>
      interpretModelText(
        JSON.stringify({
          level: 1,
          title: "Code",
          body: "```js\nreturn 1\n```",
          conceptsToReview: [],
        }),
        1,
      ),
    ).toThrow(/code fence/i);
  });
});
