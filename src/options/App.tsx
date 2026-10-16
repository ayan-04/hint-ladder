import { useEffect, useState } from "react";
import { aggregateStats, type HistoryEntry } from "../lib/stats";
import { StatsPanel } from "../pages/StatsPanel";
import {
  DEFAULT_SETTINGS,
  PROVIDER_DEFAULT_MODELS,
  type ProviderId,
  type Settings,
} from "../shared/settings";

interface Rpc<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function rpc<T>(message: object): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as Rpc<T>;
  if (!response?.ok) throw new Error(response?.error ?? "Request failed");
  return response.data as T;
}

export function OptionsApp(): JSX.Element {
  const [tab, setTab] = useState<"settings" | "stats">("settings");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    void rpc<Settings>({ type: "GET_SETTINGS" })
      .then(setSettings)
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not load settings"));
    void rpc<HistoryEntry[]>({ type: "GET_STATS" })
      .then(setHistory)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (): void => {
      const next =
        settings.theme === "dark" || (settings.theme === "auto" && media.matches);
      setDark(next);
      document.documentElement.classList.toggle("dark", next);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme]);

  async function save(next: Settings): Promise<void> {
    setSettings(next);
    await rpc({ type: "SAVE_SETTINGS", settings: next });
    setStatus("Saved.");
  }

  async function download(format: "markdown" | "json"): Promise<void> {
    const body = await rpc<string>({ type: "EXPORT", format });
    const blob = new Blob([body], { type: format === "json" ? "application/json" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = format === "json" ? "hintladder-history.json" : "hintladder-history.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-paper text-ink dark:bg-ink dark:text-paper font-sans">
        <div className="max-w-3xl mx-auto p-8">
          <p className="text-[11px] font-bold tracking-widest text-rung uppercase">HintLadder</p>
          <h1 className="text-2xl font-semibold mt-1">Options</h1>
          <p className="text-stone-600 dark:text-stone-300 mt-2 max-w-xl">
            Hints are for practice. The panel stays disabled on contest pages. Your API key is stored locally and
            read only by the extension background.
          </p>
          <div className="flex gap-2 mt-4">
            <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
              Settings
            </TabButton>
            <TabButton active={tab === "stats"} onClick={() => setTab("stats")}>
              Stats
            </TabButton>
          </div>
          {tab === "settings" ? (
            <form
              className="mt-6 space-y-4 max-w-xl"
              onSubmit={(event) => {
                event.preventDefault();
                void save(settings).catch((error: unknown) =>
                  setStatus(error instanceof Error ? error.message : "Could not save"),
                );
              }}
            >
              <label className="block">
                <span className="text-sm font-medium">Provider</span>
                <select
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 dark:bg-stone-900"
                  value={settings.provider}
                  onChange={(event) =>
                    setSettings({ ...settings, provider: event.target.value as ProviderId })
                  }
                >
                  <option value="gemini">Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Model</span>
                <input
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 dark:bg-stone-900"
                  value={settings.model}
                  placeholder={PROVIDER_DEFAULT_MODELS[settings.provider]}
                  onChange={(event) => setSettings({ ...settings, model: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">API key</span>
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 dark:bg-stone-900"
                  value={settings.apiKey}
                  autoComplete="off"
                  onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Hint style</span>
                <select
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 dark:bg-stone-900"
                  value={settings.hintStyle}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      hintStyle: event.target.value === "direct" ? "direct" : "socratic",
                    })
                  }
                >
                  <option value="socratic">Socratic</option>
                  <option value="direct">Direct</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Think-first cooldown</span>
                <select
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 dark:bg-stone-900"
                  value={settings.cooldown}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      cooldown: event.target.value as Settings["cooldown"],
                    })
                  }
                >
                  <option value="off">Off</option>
                  <option value="30s">30 seconds</option>
                  <option value="2min">2 minutes</option>
                  <option value="5min">5 minutes</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.enableLevel5}
                  onChange={(event) => setSettings({ ...settings, enableLevel5: event.target.checked })}
                />
                <span>Enable level 5, the full solution</span>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Minutes before level 5 unlocks</span>
                <input
                  type="number"
                  min={0}
                  max={180}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 dark:bg-stone-900"
                  value={settings.level5DelayMinutes}
                  onChange={(event) =>
                    setSettings({ ...settings, level5DelayMinutes: Number(event.target.value) })
                  }
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Theme</span>
                <select
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 dark:bg-stone-900"
                  value={settings.theme}
                  onChange={(event) =>
                    setSettings({ ...settings, theme: event.target.value as Settings["theme"] })
                  }
                >
                  <option value="auto">Follow LeetCode / system</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="rounded-full bg-rung text-white px-4 py-2">
                  Save
                </button>
                <button
                  type="button"
                  className="rounded-full border border-stone-300 px-4 py-2"
                  onClick={() => {
                    setStatus("Testing key…");
                    void rpc<string>({
                      type: "TEST_KEY",
                      settings: {
                        provider: settings.provider,
                        model: settings.model,
                        apiKey: settings.apiKey,
                      },
                    })
                      .then((message) => setStatus(`${message} Save before using it on a problem.`))
                      .catch((error: unknown) =>
                        setStatus(error instanceof Error ? error.message : "Key test failed"),
                      );
                  }}
                >
                  Test key
                </button>
              </div>
              {status ? <p className="text-sm">{status}</p> : null}
              <div className="flex flex-wrap gap-2 pt-4">
                <button type="button" className="rounded-full border px-4 py-2" onClick={() => void download("markdown")}>
                  Export Markdown
                </button>
                <button type="button" className="rounded-full border px-4 py-2" onClick={() => void download("json")}>
                  Export JSON
                </button>
                <button
                  type="button"
                  className="rounded-full border border-red-300 text-red-800 px-4 py-2 dark:text-red-200"
                  onClick={() => {
                    if (!window.confirm("Delete hints, history, and the saved API key from this browser?")) return;
                    void rpc({ type: "CLEAR_ALL" }).then(() => {
                      setSettings(DEFAULT_SETTINGS);
                      setHistory([]);
                      setStatus("All HintLadder data cleared.");
                    });
                  }}
                >
                  Clear all data
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-6">
              <StatsPanel stats={aggregateStats(history)} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; children: string }): JSX.Element {
  return (
    <button
      type="button"
      className={
        props.active
          ? "rounded-full bg-ink text-paper px-4 py-1 dark:bg-paper dark:text-ink"
          : "rounded-full border px-4 py-1"
      }
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
