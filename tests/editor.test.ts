import { describe, expect, it } from "vitest";
import { readMonacoModels, readViewLines } from "../src/lib/editor";

describe("editor readers", () => {
  it("prefers the longest Monaco model", () => {
    const snapshot = readMonacoModels([
      { getValue: () => "short", getLanguageId: () => "python" },
      { getValue: () => "x".repeat(40), getLanguageId: () => "cpp", uri: { path: "/solution.cpp" } },
    ]);
    expect(snapshot).toMatchObject({ language: "cpp", via: "monaco" });
    expect(snapshot?.code).toHaveLength(40);
  });

  it("reads Monaco view lines in order", () => {
    document.body.innerHTML = `<div class="view-lines"><div class="view-line">one</div><div class="view-line">two</div></div>`;
    expect(readViewLines(document)).toBe("one\ntwo");
  });
});
