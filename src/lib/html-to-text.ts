const BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "article",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "ul",
  "ol",
  "table",
  "tr",
]);

function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "script" || tag === "style") return "";
  if (tag === "sup") return `^${el.textContent ?? ""}`;
  if (tag === "sub") return `_${el.textContent ?? ""}`;
  if (tag === "br") return "\n";

  const inner = Array.from(el.childNodes).map((child) => textOf(child)).join("");
  if (tag === "li") return `- ${inner.trim()}\n`;
  if (tag === "code") {
    const parent = el.parentElement?.tagName.toLowerCase();
    if (parent === "pre") return inner;
    return inner.includes("\n") ? inner : `\`${inner}\``;
  }
  if (BLOCK_TAGS.has(tag)) return `${inner.trim()}\n\n`;
  return inner;
}

export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const raw = textOf(doc.body);
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
