import { z } from "zod";
import { htmlToText } from "./html-to-text";

const tagSchema = z.object({
  name: z.string(),
  slug: z.string(),
});

const questionSchema = z.object({
  title: z.string().nullable().optional(),
  titleSlug: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  exampleTestcases: z.string().nullable().optional(),
  topicTags: z.array(tagSchema).nullable().optional(),
});

const payloadSchema = z.object({
  data: z
    .object({
      question: questionSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

export interface TopicTag {
  name: string;
  slug: string;
}

export interface Problem {
  title: string;
  slug: string;
  difficulty: string;
  contentHtml: string;
  contentText: string;
  tags: TopicTag[];
  exampleTestcases: string;
}

export type QuestionParse =
  | { ok: true; problem: Problem }
  | {
      ok: false;
      reason: "premium";
      title: string;
      slug: string;
      difficulty: string;
      tags: TopicTag[];
    }
  | { ok: false; reason: "invalid"; message: string };

export const QUESTION_QUERY = `query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    title
    titleSlug
    difficulty
    content
    topicTags { name slug }
    exampleTestcases
  }
}`;

function tagsOf(value: { name: string; slug: string }[] | null | undefined): TopicTag[] {
  return (value ?? []).map((tag) => ({ name: tag.name, slug: tag.slug }));
}

export function parseQuestionResponse(payload: unknown, fallbackSlug = ""): QuestionParse {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: "Unexpected GraphQL payload" };
  }
  const question = parsed.data.data?.question;
  if (!question) {
    const message = parsed.data.errors?.[0]?.message ?? "Question missing from GraphQL response";
    return { ok: false, reason: "invalid", message };
  }
  const slug = question.titleSlug?.trim() || fallbackSlug;
  const title = question.title?.trim() || slug || "Untitled";
  const difficulty = question.difficulty?.trim() || "Unknown";
  const tags = tagsOf(question.topicTags);
  if (question.content == null || question.content.trim() === "") {
    return { ok: false, reason: "premium", title, slug, difficulty, tags };
  }
  const contentText = htmlToText(question.content);
  const examples = question.exampleTestcases?.trim() ?? "";
  const withExamples =
    examples && !contentText.includes(examples.split("\n")[0] ?? examples)
      ? `${contentText}\n\nExample testcases:\n${examples}`
      : contentText;
  return {
    ok: true,
    problem: {
      title,
      slug,
      difficulty,
      contentHtml: question.content,
      contentText: withExamples,
      tags,
      exampleTestcases: examples,
    },
  };
}
