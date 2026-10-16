import { DEFAULT_SETTINGS, settingsSchema, type Settings } from "../shared/settings";
import type { LadderRecord, LauncherPosition } from "../shared/records";
import type { HistoryEntry } from "../lib/stats";

const SETTINGS_KEY = "settings";
const LADDERS_KEY = "ladders";
const HISTORY_KEY = "history";
const LAUNCHER_KEY = "launcher";

let writeChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readKey<T>(key: string, fallback: T): Promise<T> {
  const stored = await chrome.storage.local.get(key);
  const value = stored[key];
  return value === undefined ? fallback : (value as T);
}

export async function loadSettings(): Promise<Settings> {
  const raw = await readKey<unknown>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const overlay = raw && typeof raw === "object" ? raw : {};
  const parsed = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...overlay });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export function saveSettings(settings: Settings): Promise<void> {
  return enqueue(async () => {
    const parsed = settingsSchema.parse(settings);
    await chrome.storage.local.set({ [SETTINGS_KEY]: parsed });
  });
}

export async function loadLadders(): Promise<Record<string, LadderRecord>> {
  return readKey<Record<string, LadderRecord>>(LADDERS_KEY, {});
}

export function saveLadders(ladders: Record<string, LadderRecord>): Promise<void> {
  return enqueue(async () => {
    await chrome.storage.local.set({ [LADDERS_KEY]: ladders });
  });
}

export async function updateLadder(
  slug: string,
  recipe: (current: LadderRecord | undefined) => LadderRecord,
): Promise<LadderRecord> {
  return enqueue(async () => {
    const ladders = await loadLadders();
    const next = recipe(ladders[slug]);
    ladders[slug] = next;
    await chrome.storage.local.set({ [LADDERS_KEY]: ladders });
    return next;
  });
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  const history = await readKey<HistoryEntry[]>(HISTORY_KEY, []);
  return Array.isArray(history) ? history : [];
}

export function saveHistory(history: HistoryEntry[]): Promise<void> {
  return enqueue(async () => {
    await chrome.storage.local.set({ [HISTORY_KEY]: history });
  });
}

export async function loadLauncher(): Promise<LauncherPosition | null> {
  return readKey<LauncherPosition | null>(LAUNCHER_KEY, null);
}

export function saveLauncher(position: LauncherPosition): Promise<void> {
  return enqueue(async () => {
    await chrome.storage.local.set({ [LAUNCHER_KEY]: position });
  });
}

export async function clearAllData(): Promise<void> {
  return enqueue(async () => {
    await chrome.storage.local.remove([SETTINGS_KEY, LADDERS_KEY, HISTORY_KEY, LAUNCHER_KEY]);
  });
}
