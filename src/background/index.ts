import { hintCacheKey } from "../lib/cache-key";
import { HintPipelineError, generateHint, readProviderText } from "../lib/generate";
import { canRevealLevel } from "../lib/gating";
import { truncateText } from "../lib/truncate";
import { historyToMarkdown, upsertHistory, type HistoryEntry } from "../lib/stats";
import type { LadderRecord } from "../shared/records";
import { publicSettings, resolveModel, settingsSchema, type Settings } from "../shared/settings";
import {
  clearAllData,
  loadHistory,
  loadLauncher,
  loadLadders,
  loadSettings,
  saveHistory,
  saveLauncher,
  saveSettings,
  updateLadder,
} from "./storage";
import { getProvider } from "../lib/providers";
import { z } from "zod";

const generateSchema = z.object({
  type: z.literal("generate"),
  requestId: z.string().min(4),
  slug: z.string().min(1).max(200),
  title: z.string().max(300),
  difficulty: z.string().max(40),
  tags: z.array(z.string().max(80)).max(40),
  problemText: z.string().max(30000),
  level: z.number().int().min(0).max(5),
  note: z.string().max(4000),
  locale: z.string().max(40),
  regenerate: z.boolean(),
  code: z.string().max(50000).optional(),
  language: z.string().max(60).optional(),
});

type GenerateMessage = z.infer<typeof generateSchema>;

function emptyLadder(message: GenerateMessage): LadderRecord {
  return {
    slug: message.slug,
    title: message.title,
    difficulty: message.difficulty,
    tags: message.tags,
    hints: {},
    shown: {},
    revealedLevels: [],
    openedAt: Date.now(),
  };
}

function extensionPage(sender: chrome.runtime.MessageSender): boolean {
  const url = sender.url ?? "";
  return url.startsWith(chrome.runtime.getURL(""));
}

async function rememberAttempt(ladder: LadderRecord, maxHintLevel: number): Promise<void> {
  const history = await loadHistory();
  const existing = history.find((entry) => entry.slug === ladder.slug);
  const entry: HistoryEntry = {
    slug: ladder.slug,
    title: ladder.title,
    difficulty: ladder.difficulty,
    tags: ladder.tags,
    maxHintLevel: Math.max(existing?.maxHintLevel ?? 0, maxHintLevel),
    solved: existing?.solved ?? false,
    timeSpentMs: existing?.timeSpentMs ?? 0,
    at: existing?.at ?? Date.now(),
  };
  await saveHistory(upsertHistory(history, entry));
}

async function handleGenerate(message: GenerateMessage, port: chrome.runtime.Port, signal: AbortSignal): Promise<void> {
  const settings = await loadSettings();
  if (!settings.apiKey.trim()) {
    throw new HintPipelineError("Add an API key in HintLadder options to request a hint.");
  }
  const model = resolveModel(settings);
  const ladders = await loadLadders();
  const current = ladders[message.slug];
  if (message.level >= 1) {
    const gate = canRevealLevel({
      level: message.level,
      revealedLevels: current?.revealedLevels ?? [],
      level5Enabled: settings.enableLevel5,
      now: Date.now(),
      firstHintAt: current?.firstHintAt ?? null,
      level5DelayMinutes: settings.level5DelayMinutes,
      lastRevealAt: current?.lastRevealAt ?? null,
      cooldown: settings.cooldown,
    });
    const already = current?.revealedLevels.includes(message.level) ?? false;
    if (!already && !gate.ok) {
      throw new HintPipelineError(gateMessage(gate.reason));
    }
  }
  const cacheKey = hintCacheKey({
    slug: message.slug,
    level: message.level,
    provider: settings.provider,
    model,
    style: settings.hintStyle,
  });
  if (message.level >= 1 && !message.regenerate && current?.hints[cacheKey]) {
    const cached = current.hints[cacheKey];
    port.postMessage({
      type: "done",
      requestId: message.requestId,
      hint: cached,
      ladder: current,
      fromCache: true,
    });
    return;
  }

  const problem = truncateText(message.problemText, 12_000);
  const code = message.code ? truncateText(message.code, 8_000).text : undefined;
  const previous = (current?.revealedLevels ?? [])
    .filter((level) => level < message.level)
    .sort((a, b) => a - b)
    .map((level) => {
      const key = current?.shown[String(level)];
      const hint = key ? current?.hints[key] : undefined;
      return hint ? { level: hint.level, title: hint.title, body: hint.body } : null;
    })
    .filter((hint): hint is { level: number; title: string; body: string } => hint !== null);

  const hint = await generateHint(
    {
      level: message.level,
      style: settings.hintStyle,
      locale: message.locale || "en",
      title: message.title,
      difficulty: message.difficulty,
      tags: message.tags.map((name) => ({ name, slug: name })),
      problemText: problem.text,
      truncated: problem.truncated,
      note: message.note,
      previousHints: previous,
      code,
      language: message.language,
      providerId: settings.provider,
      model,
      apiKey: settings.apiKey,
      signal,
    },
    (chunk) => {
      port.postMessage({ type: "chunk", requestId: message.requestId, text: chunk });
    },
  );

  const stored = { ...hint, cacheKey, createdAt: Date.now() };
  const ladder = await updateLadder(message.slug, (existing) => {
    const base = existing ?? emptyLadder(message);
    const revealed =
      message.level >= 1 && !base.revealedLevels.includes(message.level)
        ? [...base.revealedLevels, message.level]
        : base.revealedLevels;
    return {
      ...base,
      title: message.title || base.title,
      difficulty: message.difficulty || base.difficulty,
      tags: message.tags.length ? message.tags : base.tags,
      hints: { ...base.hints, [cacheKey]: stored },
      shown: message.level >= 1 ? { ...base.shown, [String(message.level)]: cacheKey } : base.shown,
      revealedLevels: revealed,
      review: message.level === 0 ? stored : base.review,
      firstHintAt: message.level >= 1 ? (base.firstHintAt ?? Date.now()) : base.firstHintAt,
      lastRevealAt: message.level >= 1 && !(existing?.revealedLevels.includes(message.level)) ? Date.now() : base.lastRevealAt,
    };
  });
  if (message.level >= 1) {
    await rememberAttempt(ladder, message.level);
  } else {
    await rememberAttempt(ladder, ladder.revealedLevels.reduce((max, level) => Math.max(max, level), 0));
  }
  port.postMessage({ type: "done", requestId: message.requestId, hint: stored, ladder, fromCache: false });
}

function gateMessage(reason: string): string {
  if (reason === "cooldown") return "Give this rung a moment. The think-first cooldown is still running.";
  if (reason === "timer") return "The full solution stays locked until the timer finishes.";
  if (reason === "locked") return "Level 5 is turned off in options.";
  if (reason === "skip") return "Reveal the next rung before skipping ahead.";
  return "That rung is not available.";
}

async function testKey(settings: Pick<Settings, "provider" | "model" | "apiKey">): Promise<string> {
  const parsed = settingsSchema.pick({ provider: true, model: true, apiKey: true }).parse(settings);
  if (!parsed.apiKey.trim()) throw new HintPipelineError("Enter an API key first.");
  const provider = getProvider(parsed.provider);
  const text = await readProviderText(provider, {
    apiKey: parsed.apiKey.trim(),
    model: resolveModel(parsed),
    system: "Reply with the single word pong.",
    user: "ping",
  });
  if (!text.trim()) throw new HintPipelineError("The provider returned an empty response.");
  return "Key works.";
}

chrome.runtime.onInstalled.addListener(() => {
  console.info("HintLadder ready");
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-panel") return;
  void chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    const tabId = tabs[0]?.id;
    if (tabId === undefined) return;
    void chrome.tabs.sendMessage(tabId, { type: "TOGGLE_PANEL" }).catch(() => undefined);
  });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "hintladder") return;
  const controllers = new Map<string, AbortController>();
  port.onDisconnect.addListener(() => {
    for (const controller of controllers.values()) controller.abort();
  });
  port.onMessage.addListener((raw: unknown) => {
    const parsed = generateSchema.safeParse(raw);
    if (!parsed.success) {
      const requestId =
        raw && typeof raw === "object" && "requestId" in raw && typeof raw.requestId === "string"
          ? raw.requestId
          : "";
      if (raw && typeof raw === "object" && "type" in raw && raw.type === "cancel" && requestId) {
        controllers.get(requestId)?.abort();
        return;
      }
      port.postMessage({ type: "error", requestId, message: "Hint request was not understood." });
      return;
    }
    const controller = new AbortController();
    controllers.set(parsed.data.requestId, controller);
    void handleGenerate(parsed.data, port, controller.signal)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "The hint request failed.";
        port.postMessage({ type: "error", requestId: parsed.data.requestId, message });
      })
      .finally(() => {
        controllers.delete(parsed.data.requestId);
      });
  });
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  void handleMessage(message, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error: unknown) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Request failed" });
    });
  return true;
});

async function handleMessage(message: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
  const type = message && typeof message === "object" && "type" in message ? String(message.type) : "";
  if (type === "GET_PUBLIC_SETTINGS") return publicSettings(await loadSettings());
  if (type === "LOAD_LADDER") {
    const slug = message && typeof message === "object" && "slug" in message ? String(message.slug) : "";
    const ladders = await loadLadders();
    return ladders[slug] ?? null;
  }
  if (type === "GET_STATS") return loadHistory();
  if (type === "LOAD_LAUNCHER") return loadLauncher();
  if (type === "SAVE_LAUNCHER") {
    const x = message && typeof message === "object" && "x" in message ? Number(message.x) : 24;
    const y = message && typeof message === "object" && "y" in message ? Number(message.y) : 24;
    await saveLauncher({ x, y });
    return null;
  }
  if (type === "RECORD_SOLVE") return recordSolve(message);
  if (!extensionPage(sender)) throw new Error("That action is only available from HintLadder settings.");
  if (type === "GET_SETTINGS") return loadSettings();
  if (type === "SAVE_SETTINGS") {
    const raw = message && typeof message === "object" && "settings" in message ? message.settings : null;
    const settings = settingsSchema.parse(raw);
    await saveSettings(settings);
    return publicSettings(settings);
  }
  if (type === "TEST_KEY") {
    const raw = message && typeof message === "object" && "settings" in message ? message.settings : null;
    const picked = settingsSchema.pick({ provider: true, model: true, apiKey: true }).parse(raw);
    return testKey(picked);
  }
  if (type === "EXPORT") {
    const format = message && typeof message === "object" && "format" in message ? message.format : "json";
    const history = await loadHistory();
    return format === "markdown" ? historyToMarkdown(history) : JSON.stringify(history, null, 2);
  }
  if (type === "CLEAR_ALL") {
    await clearAllData();
    return null;
  }
  throw new Error("Unknown message");
}

const solveSchema = z.object({
  type: z.literal("RECORD_SOLVE"),
  slug: z.string().min(1),
  title: z.string(),
  difficulty: z.string(),
  tags: z.array(z.string()),
  maxHintLevel: z.number().int().min(0).max(5),
  timeSpentMs: z.number().int().min(0),
});

async function recordSolve(message: unknown): Promise<HistoryEntry> {
  const parsed = solveSchema.parse(message);
  const now = Date.now();
  const ladder = await updateLadder(parsed.slug, (existing) => ({
    slug: parsed.slug,
    title: parsed.title,
    difficulty: parsed.difficulty,
    tags: parsed.tags,
    hints: existing?.hints ?? {},
    shown: existing?.shown ?? {},
    revealedLevels: existing?.revealedLevels ?? [],
    openedAt: existing?.openedAt ?? now,
    firstHintAt: existing?.firstHintAt,
    lastRevealAt: existing?.lastRevealAt,
    review: existing?.review,
    solvedAt: now,
  }));
  const history = await loadHistory();
  const entry: HistoryEntry = {
    slug: parsed.slug,
    title: parsed.title || ladder.title,
    difficulty: parsed.difficulty || ladder.difficulty,
    tags: parsed.tags.length ? parsed.tags : ladder.tags,
    maxHintLevel: parsed.maxHintLevel,
    solved: true,
    timeSpentMs: parsed.timeSpentMs,
    at: now,
  };
  await saveHistory(upsertHistory(history, entry));
  return entry;
}
