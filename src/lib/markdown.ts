import DOMPurify from "dompurify";
import { marked } from "marked";

export function renderMarkdown(markdown: string): string {
  const parsed = marked.parse(markdown, { async: false });
  const html = typeof parsed === "string" ? parsed : "";
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
