import type { ProviderId } from "../shared/settings";

export interface LlmCallInput {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  stream: boolean;
}

export interface BuiltRequest {
  url: string;
  init: RequestInit;
}

export interface LlmProvider {
  readonly id: ProviderId;
  readonly label: string;
  readonly supportsStreaming: boolean;
  buildRequest(input: LlmCallInput): BuiltRequest;
  parseComplete(payload: unknown): string;
  parseStreamEvent(data: string): string;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

function geminiText(payload: unknown): string {
  const body = payload as GeminiResponse;
  if (body.error?.message) throw new Error(body.error.message);
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? "").join("");
}

export const geminiProvider: LlmProvider = {
  id: "gemini",
  label: "Gemini",
  supportsStreaming: true,
  buildRequest(input) {
    const action = input.stream ? "streamGenerateContent" : "generateContent";
    const query = input.stream ? "?alt=sse" : "";
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:${action}${query}`,
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": input.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [{ role: "user", parts: [{ text: input.user }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        }),
      },
    };
  },
  parseComplete(payload) {
    return geminiText(payload);
  },
  parseStreamEvent(data) {
    return geminiText(JSON.parse(data) as unknown);
  },
};

interface OpenAiResponse {
  choices?: { message?: { content?: string }; delta?: { content?: string } }[];
  error?: { message?: string };
}

export const openaiProvider: LlmProvider = {
  id: "openai",
  label: "OpenAI",
  supportsStreaming: true,
  buildRequest(input) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify({
          model: input.model,
          temperature: 0.4,
          stream: input.stream,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
        }),
      },
    };
  },
  parseComplete(payload) {
    const body = payload as OpenAiResponse;
    if (body.error?.message) throw new Error(body.error.message);
    return body.choices?.[0]?.message?.content ?? "";
  },
  parseStreamEvent(data) {
    const body = JSON.parse(data) as OpenAiResponse;
    return body.choices?.[0]?.delta?.content ?? "";
  },
};

interface AnthropicResponse {
  content?: { type?: string; text?: string }[];
  delta?: { type?: string; text?: string };
  error?: { message?: string };
}

export const anthropicProvider: LlmProvider = {
  id: "anthropic",
  label: "Anthropic",
  supportsStreaming: true,
  buildRequest(input) {
    return {
      url: "https://api.anthropic.com/v1/messages",
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": input.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: input.model,
          max_tokens: 4096,
          temperature: 0.4,
          stream: input.stream,
          system: input.system,
          messages: [{ role: "user", content: input.user }],
        }),
      },
    };
  },
  parseComplete(payload) {
    const body = payload as AnthropicResponse;
    if (body.error?.message) throw new Error(body.error.message);
    return (body.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");
  },
  parseStreamEvent(data) {
    const body = JSON.parse(data) as AnthropicResponse;
    if (body.delta?.type === "text_delta") return body.delta.text ?? "";
    return "";
  },
};

const PROVIDERS: Record<ProviderId, LlmProvider> = {
  gemini: geminiProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
};

export function getProvider(id: ProviderId): LlmProvider {
  return PROVIDERS[id];
}
