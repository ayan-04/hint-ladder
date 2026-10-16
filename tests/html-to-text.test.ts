import { describe, expect, it } from "vitest";
import { htmlToText } from "../src/lib/html-to-text";

describe("htmlToText", () => {
  it("keeps examples and constraints and converts superscripts", () => {
    const html = [
      "<p><strong>Example 1:</strong></p>",
      "<pre><code>Input: n = 2<sup>3</sup></code></pre>",
      "<p><strong>Constraints:</strong></p>",
      "<ul><li><code>1 &lt;= n &lt;= 10<sup>9</sup></code></li></ul>",
    ].join("");
    const text = htmlToText(html);
    expect(text).toContain("Example 1:");
    expect(text).toContain("2^3");
    expect(text).toContain("Constraints:");
    expect(text).toContain("10^9");
    expect(text).toContain("1 <= n <= 10^9");
  });
});
