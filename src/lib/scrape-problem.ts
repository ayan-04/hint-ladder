import type { Problem, QuestionParse } from "./parse-question";
import { htmlToText } from "./html-to-text";

function text(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function difficultyFrom(doc: Document): string {
  const labeled = doc.querySelector("[class*='text-difficulty']");
  const fromClass = labeled?.className ?? "";
  if (/easy/i.test(fromClass) || /easy/i.test(text(labeled))) return "Easy";
  if (/medium/i.test(fromClass) || /medium/i.test(text(labeled))) return "Medium";
  if (/hard/i.test(fromClass) || /hard/i.test(text(labeled))) return "Hard";
  return "Unknown";
}

export function scrapeProblem(doc: Document, slug: string): QuestionParse {
  const title =
    text(doc.querySelector("[data-cy='question-title']")) ||
    text(doc.querySelector(".text-title-large")) ||
    text(doc.querySelector("title")).replace(/ - LeetCode.*$/, "") ||
    slug;
  const contentEl =
    doc.querySelector("[data-track-load='description_content']") ??
    doc.querySelector(".elfjS") ??
    doc.querySelector("div.xFUwe");
  const tags = Array.from(doc.querySelectorAll("a[href*='/tag/']")).map((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    const slugMatch = href.match(/\/tag\/([^/]+)/);
    return {
      name: text(anchor),
      slug: slugMatch?.[1] ?? text(anchor).toLowerCase().replace(/\s+/g, "-"),
    };
  });
  const uniqueTags = tags.filter(
    (tag, index) => tag.name && tags.findIndex((other) => other.slug === tag.slug) === index,
  );
  const difficulty = difficultyFrom(doc);
  if (!contentEl) {
    const premiumMarker = doc.body.textContent?.includes("Subscribe") ?? false;
    if (premiumMarker) {
      return { ok: false, reason: "premium", title, slug, difficulty, tags: uniqueTags };
    }
    return { ok: false, reason: "invalid", message: "Problem description was not in the page" };
  }
  const contentHtml = contentEl.innerHTML;
  const problem: Problem = {
    title,
    slug,
    difficulty,
    contentHtml,
    contentText: htmlToText(contentHtml),
    tags: uniqueTags,
    exampleTestcases: "",
  };
  if (!problem.contentText) {
    return { ok: false, reason: "premium", title, slug, difficulty, tags: uniqueTags };
  }
  return { ok: true, problem };
}
