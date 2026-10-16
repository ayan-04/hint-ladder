import { useEffect, useRef, useState } from "react";
import { requestEditorCode } from "../bridge";
import { loadProblem } from "../problem-loader";
import type { QuestionParse } from "../../lib/parse-question";
import type { StoredHint, LadderRecord } from "../../shared/records";
import { publicSettings, type Settings } from "../../shared/settings";

export type PublicSettings = ReturnType<typeof publicSettings>;

interface RpcOk<T> {
  ok: true;
  data: T;
}

interface RpcErr {
  ok: false;
  error: string;
}

async function rpc<T>(message: object): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as RpcOk<T> | RpcErr | undefined;
  if (!response || !response.ok) {
    throw new Error(response && "error" in response ? response.error : "HintLadder could not reach its background worker.");
  }
  return response.data;
}

interface PortMessage {
  type: string;
  requestId?: string;
  text?: string;
  message?: string;
  hint?: StoredHint;
  ladder?: LadderRecord;
}

export function useLadder(slug: string | null) {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [problem, setProblem] = useState<QuestionParse | null>(null);
  const [problemError, setProblemError] = useState<string | null>(null);
  const [loadingProblem, setLoadingProblem] = useState(false);
  const [ladder, setLadder] = useState<LadderRecord | null>(null);
  const [busyLevel, setBusyLevel] = useState<number | null>(null);
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const requestRef = useRef<{ id: string; slug: string } | null>(null);
  const slugRef = useRef(slug);
  const seenAt = useRef(Date.now());
  slugRef.current = slug;

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "hintladder" });
    portRef.current = port;
    const onMessage = (raw: unknown): void => {
      const message = raw as PortMessage;
      if (!message || !requestRef.current || message.requestId !== requestRef.current.id) return;
      if (requestRef.current.slug !== slugRef.current) return;
      if (message.type === "chunk" && message.text) {
        setStreaming((current) => current + message.text);
        return;
      }
      if (message.type === "done" && message.hint) {
        if (message.ladder) setLadder(message.ladder);
        setBusyLevel(null);
        setStreaming("");
        requestRef.current = null;
        return;
      }
      if (message.type === "error") {
        setError(message.message ?? "The hint request failed.");
        setBusyLevel(null);
        setStreaming("");
        requestRef.current = null;
      }
    };
    port.onMessage.addListener(onMessage);
    return () => {
      port.disconnect();
      portRef.current = null;
    };
  }, []);

  useEffect(() => {
    void rpc<PublicSettings>({ type: "GET_PUBLIC_SETTINGS" })
      .then(setSettings)
      .catch(() => setSettings(null));
  }, [slug]);

  useEffect(() => {
    if (requestRef.current && portRef.current) {
      portRef.current.postMessage({ type: "cancel", requestId: requestRef.current.id });
    }
    requestRef.current = null;
    seenAt.current = Date.now();
    setLadder(null);
    setProblem(null);
    setError(null);
    setStreaming("");
    setBusyLevel(null);
    setAccepted(false);
    if (!slug) return;
    let cancelled = false;
    void rpc<LadderRecord | null>({ type: "LOAD_LADDER", slug })
      .then((record) => {
        if (!cancelled) setLadder(record);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setLoadingProblem(true);
    setProblemError(null);
    void loadProblem(slug, controller.signal)
      .then((parsed) => {
        if (!controller.signal.aborted) setProblem(parsed);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setProblemError(caught instanceof Error ? caught.message : "Could not read this problem.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingProblem(false);
      });
    return () => controller.abort();
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let timer = 0;
    const scan = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const nodes = document.querySelectorAll("[data-e2e-locator='submission-result'], .result__3FE");
        for (const node of nodes) {
          if (/accepted/i.test(node.textContent ?? "")) {
            setAccepted(true);
            return;
          }
        }
      }, 400);
    };
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [slug]);

  function refreshSettings(): void {
    void rpc<PublicSettings>({ type: "GET_PUBLIC_SETTINGS" }).then(setSettings).catch(() => undefined);
  }

  function requestHint(input: {
    level: number;
    note: string;
    regenerate: boolean;
    code?: string;
    language?: string;
  }): void {
    if (!slug || !problem || !problem.ok) return;
    const port = portRef.current;
    if (!port) {
      setError("HintLadder's background worker is not connected. Reload the page.");
      return;
    }
    if (requestRef.current) {
      port.postMessage({ type: "cancel", requestId: requestRef.current.id });
    }
    const requestId = crypto.randomUUID();
    requestRef.current = { id: requestId, slug };
    setError(null);
    setStreaming("");
    setBusyLevel(input.level);
    const locale = document.documentElement.lang || navigator.language || "en";
    port.postMessage({
      type: "generate",
      requestId,
      slug,
      title: problem.problem.title,
      difficulty: problem.problem.difficulty,
      tags: problem.problem.tags.map((tag) => tag.name),
      problemText: problem.problem.contentText,
      level: input.level,
      note: input.note,
      locale,
      regenerate: input.regenerate,
      code: input.code,
      language: input.language,
    });
  }

  async function review(note: string): Promise<void> {
    const slugAtStart = slugRef.current;
    const editor = await requestEditorCode();
    if (slugRef.current !== slugAtStart) return;
    if (!editor.code.trim()) {
      setError(
        editor.via === "empty"
          ? "The editor is empty, or Monaco has not finished loading. Write an attempt, then ask for a review."
          : "Could not read any code from the editor.",
      );
      return;
    }
    requestHint({
      level: 0,
      note,
      regenerate: true,
      code: editor.code,
      language: editor.language,
    });
  }

  async function markSolved(): Promise<void> {
    if (!slug || !problem || !problem.ok) return;
    const slugAtStart = slug;
    const started = ladder?.firstHintAt ?? seenAt.current;
    const maxHintLevel = (ladder?.revealedLevels ?? []).reduce((max, level) => Math.max(max, level), 0);
    await rpc({
      type: "RECORD_SOLVE",
      slug,
      title: problem.problem.title,
      difficulty: problem.problem.difficulty,
      tags: problem.problem.tags.map((tag) => tag.name),
      maxHintLevel,
      timeSpentMs: Math.max(0, Date.now() - started),
    });
    if (slugRef.current !== slugAtStart) return;
    setLadder((current) => (current ? { ...current, solvedAt: Date.now() } : current));
    setAccepted(false);
  }

  return {
    settings,
    problem,
    problemError,
    loadingProblem,
    ladder,
    busyLevel,
    streaming,
    error,
    accepted,
    setError,
    refreshSettings,
    requestHint,
    review,
    markSolved,
    dismissAccepted: () => setAccepted(false),
  };
}

export type { Settings };
