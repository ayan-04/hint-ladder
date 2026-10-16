import { ZodError } from "zod";
import { backoffDelayMs, parseRetryAfter } from "./backoff";
import { extractJson } from "./extract-json";
import { buildMessages, type PromptInput } from "./prompt";
import { getProvider, type LlmProvider } from "./providers";
import { hintResponseSchema, type HintResponse } from "./schema";
import { checkSpoiler } from "./spoiler-guard";
import type { ProviderId } from "../shared/settings";

export interface GenerateInput extends Omit<PromptInput, "stricter" | "previousFailure"> {
  providerId: ProviderId;
  model: string;
  apiKey: string;
  signal?: AbortSignal;
}

export class HintPipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HintPipelineError";
  }
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function readProviderText(
  provider: LlmProvider,
  input: {
    apiKey: string;
    model: string;
    system: string;
    user: string;
    signal?: AbortSignal;
    onDelta?: (chunk: string) => void;
  },
): Promise<string> {
  const stream = provider.supportsStreaming && Boolean(input.onDelta);
  let attempt = 0;
  while (true) {
    const built = provider.buildRequest({
      apiKey: input.apiKey,
      model: input.model,
      system: input.system,
      user: input.user,
      stream,
    });
    const response = await fetch(built.url, { ...built.init, signal: input.signal });
    if (response.status === 429 && attempt < 3) {
      const wait = backoffDelayMs(attempt, parseRetryAfter(response.headers.get("retry-after")));
      attempt += 1;
      await sleep(wait, input.signal);
      continue;
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new HintPipelineError(httpMessage(response.status, detail));
    }
    if (!stream || !response.body) {
      const payload: unknown = await response.json();
      return provider.parseComplete(payload);
    }
    return readSse(response.body, provider, input.onDelta);
  }
}

function httpMessage(status: number, detail: string): string {
  if (status === 401 || status === 403) return "The API key was rejected. Check it in HintLadder options.";
  if (status === 429) return "The model provider rate-limited this request. Wait a moment and try again.";
  const snippet = detail.replace(/\s+/g, " ").slice(0, 180);
  return `The model provider returned ${status}${snippet ? `: ${snippet}` : ""}`;
}

async function readSse(
  body: ReadableStream<Uint8Array>,
  provider: LlmProvider,
  onDelta?: (chunk: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const delta = provider.parseStreamEvent(data);
        if (delta) {
          full += delta;
          onDelta?.(delta);
        }
      } catch {
        /* Ignore keep-alive or non-JSON SSE lines. */
      }
    }
  }
  return full;
}

export function interpretModelText(text: string, level: number): HintResponse {
  let parsed: unknown;
  try {
    parsed = extractJson(text);
  } catch {
    throw new HintPipelineError("The model did not return valid JSON.");
  }
  const result = hintResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new HintPipelineError(formatZod(result.error));
  }
  if (result.data.level !== level) {
    throw new HintPipelineError("The model answered a different rung than requested.");
  }
  const spoiler = checkSpoiler(level, result.data.body);
  if (!spoiler.ok) throw new HintPipelineError(spoiler.reason);
  return result.data;
}

function formatZod(error: ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ") || "Invalid hint JSON";
}

export async function generateHint(
  input: GenerateInput,
  onDelta?: (chunk: string) => void,
): Promise<HintResponse> {
  const provider = getProvider(input.providerId);
  let stricter = false;
  let previousFailure = "";
  let lastError = "The model could not produce a safe hint.";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const messages = buildMessages({ ...input, stricter, previousFailure });
    const text = await readProviderText(provider, {
      apiKey: input.apiKey,
      model: input.model,
      system: messages.system,
      user: messages.user,
      signal: input.signal,
      onDelta: attempt === 0 ? onDelta : undefined,
    });
    try {
      return interpretModelText(text, input.level);
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      const spoiler = /code fence|code-like|language-tagged/i.test(lastError);
      stricter = spoiler;
      previousFailure = lastError;
    }
  }
  throw new HintPipelineError(lastError);
}
