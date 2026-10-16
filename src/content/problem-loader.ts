import { QUESTION_QUERY, parseQuestionResponse, type QuestionParse } from "../lib/parse-question";
import { scrapeProblem } from "../lib/scrape-problem";

export async function loadProblem(slug: string, signal: AbortSignal): Promise<QuestionParse> {
  try {
    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        operationName: "questionData",
        query: QUESTION_QUERY,
        variables: { titleSlug: slug },
      }),
      signal,
    });
    if (!response.ok) throw new Error(`GraphQL HTTP ${response.status}`);
    const payload: unknown = await response.json();
    const parsed = parseQuestionResponse(payload, slug);
    if (parsed.ok || parsed.reason === "premium") return parsed;
    throw new Error(parsed.message);
  } catch (error) {
    if (signal.aborted) throw error;
    return scrapeProblem(document, slug);
  }
}
