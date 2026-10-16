import { useEffect, useState } from "react";
import { aggregateStats, type HistoryEntry } from "../lib/stats";
import { StatsPanel } from "../pages/StatsPanel";

interface Rpc<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function PopupApp(): JSX.Element {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (): void => {
      document.documentElement.classList.toggle("dark", media.matches);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    void chrome.runtime.sendMessage({ type: "GET_STATS" }).then((response: Rpc<HistoryEntry[]>) => {
      if (!response?.ok || !response.data) {
        setError(response?.error ?? "Stats are unavailable.");
        return;
      }
      setHistory(response.data);
    });
  }, []);

  return (
    <main className="bg-paper text-ink dark:bg-ink dark:text-paper p-4 font-sans w-[320px]">
      <p className="text-[11px] font-bold tracking-widest text-rung uppercase">HintLadder</p>
      <h1 className="text-lg font-semibold mt-1 mb-3">Your ladder</h1>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {history ? <StatsPanel stats={aggregateStats(history)} /> : <p className="text-sm">Loading stats…</p>}
      <button
        type="button"
        className="mt-4 text-sm underline"
        onClick={() => void chrome.runtime.openOptionsPage()}
      >
        Options
      </button>
    </main>
  );
}
