import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { canRevealLevel, cooldownRemaining, highestRevealed } from "../../lib/gating";
import { formatWait } from "../../lib/format";
import { renderMarkdown } from "../../lib/markdown";
import { LEVEL_TITLES, type LadderLevel } from "../../lib/schema";
import type { StoredHint } from "../../shared/records";
import { watchRoute, type RouteState } from "../navigation";
import { watchDarkClass } from "../theme";
import { useLadder } from "./useLadder";

export function PanelApp(): JSX.Element | null {
  const [route, setRoute] = useState<RouteState>({ slug: null, contest: false });
  const [open, setOpen] = useState(false);
  const [darkClass, setDarkClass] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 80 });
  const posRef = useRef(pos);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [unblurred, setUnblurred] = useState<Record<string, boolean>>({});
  const [confirmLevel5, setConfirmLevel5] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const dragging = useRef(false);

  const ladderApi = useLadder(route.slug);

  useEffect(() => watchRoute(setRoute), []);
  useEffect(() => watchDarkClass(setDarkClass), []);

  useEffect(() => {
    const onMessage = (message: unknown): void => {
      if (message && typeof message === "object" && "type" in message && message.type === "TOGGLE_PANEL") {
        setOpen((value) => !value);
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  useEffect(() => {
    void chrome.runtime.sendMessage({ type: "LOAD_LAUNCHER" }).then((response: { ok?: boolean; data?: { x: number; y: number } | null }) => {
      const next =
        response?.ok && response.data
          ? response.data
          : { x: Math.max(16, window.innerWidth - 76), y: Math.max(16, window.innerHeight - 88) };
      posRef.current = next;
      setPos(next);
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setNote("");
    setShowNote(false);
    setConfirmLevel5(false);
    setUnblurred({});
  }, [route.slug]);

  if (!route.slug && !route.contest) return null;

  const theme = ladderApi.settings?.theme ?? "auto";
  const isDark = theme === "dark" || (theme === "auto" && darkClass);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = posRef.current;
    let moved = false;
    const move = (ev: PointerEvent): void => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.hypot(dx, dy) > 4) moved = true;
      const next = {
        x: clamp(origin.x + dx, 8, window.innerWidth - 60),
        y: clamp(origin.y + dy, 8, window.innerHeight - 60),
      };
      posRef.current = next;
      setPos(next);
    };
    const up = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      dragging.current = false;
      if (!moved) setOpen((value) => !value);
      else void chrome.runtime.sendMessage({ type: "SAVE_LAUNCHER", x: posRef.current.x, y: posRef.current.y });
    };
    dragging.current = true;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const panelLeft = pos.x > 400 ? pos.x - 392 : Math.min(pos.x, window.innerWidth - 400);
  const panelTop = clamp(pos.y - 40, 12, Math.max(12, window.innerHeight - 520));

  return (
    <div className={isDark ? "hl-root dark" : "hl-root"}>
      <button
        type="button"
        className="hl-launcher"
        style={{ left: pos.x, top: pos.y }}
        aria-label={open ? "Close HintLadder" : "Open HintLadder"}
        aria-expanded={open}
        onPointerDown={onPointerDown}
      >
        <LadderMark />
      </button>
      {open ? (
        <section className="hl-panel" style={{ left: panelLeft, top: panelTop }} aria-label="HintLadder">
          {route.contest ? (
            <ContestNotice />
          ) : (
            <ProblemPanel
              note={note}
              setNote={setNote}
              showNote={showNote}
              setShowNote={setShowNote}
              unblurred={unblurred}
              revealBlur={(key) => setUnblurred((current) => ({ ...current, [key]: true }))}
              confirmLevel5={confirmLevel5}
              setConfirmLevel5={setConfirmLevel5}
              now={now}
              api={ladderApi}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}

function ContestNotice(): JSX.Element {
  return (
    <>
      <p className="hl-kicker">HintLadder</p>
      <h1 className="hl-title">Disabled during contests</h1>
      <p className="hl-muted">
        Contest pages stay untouched so the timer stays fair. Open a practice problem when you want a rung.
      </p>
    </>
  );
}

function ProblemPanel(props: {
  note: string;
  setNote: (value: string) => void;
  showNote: boolean;
  setShowNote: (value: boolean) => void;
  unblurred: Record<string, boolean>;
  revealBlur: (key: string) => void;
  confirmLevel5: boolean;
  setConfirmLevel5: (value: boolean) => void;
  now: number;
  api: ReturnType<typeof useLadder>;
}): JSX.Element {
  const { api } = props;
  const problem = api.problem;
  const settings = api.settings;
  const revealed = api.ladder?.revealedLevels ?? [];
  const nextLevel = Math.min(5, highestRevealed(revealed) + 1);
  const gate =
    settings === null
      ? null
      : canRevealLevel({
          level: nextLevel,
          revealedLevels: revealed,
          level5Enabled: settings.enableLevel5,
          now: props.now,
          firstHintAt: api.ladder?.firstHintAt ?? null,
          level5DelayMinutes: settings.level5DelayMinutes,
          lastRevealAt: api.ladder?.lastRevealAt ?? null,
          cooldown: settings.cooldown,
        });
  const cooldownMs = settings
    ? cooldownRemaining(api.ladder?.lastRevealAt ?? null, props.now, settings.cooldown)
    : 0;

  if (!settings) {
    return (
      <>
        <p className="hl-kicker">HintLadder</p>
        <div className="hl-skeleton" />
        <div className="hl-skeleton" />
      </>
    );
  }

  if (!settings.hasApiKey) {
    return (
      <>
        <p className="hl-kicker">HintLadder</p>
        <h1 className="hl-title">Add your model key</h1>
        <p className="hl-muted">
          Hints are generated with your own Gemini, OpenAI, or Anthropic key. The key stays in the extension
          background and never reaches the LeetCode page.
        </p>
        <div className="hl-actions">
          <button type="button" className="hl-btn" onClick={() => void chrome.runtime.openOptionsPage()}>
            Open options
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="hl-row">
        <p className="hl-kicker">HintLadder</p>
        <button type="button" className="hl-btn ghost" onClick={() => api.refreshSettings()}>
          Refresh
        </button>
      </div>
      {api.loadingProblem ? <div className="hl-skeleton" /> : null}
      {problem && !problem.ok && problem.reason === "premium" ? (
        <Premium problemTitle={problem.title} />
      ) : null}
      {problem && !problem.ok && problem.reason === "invalid" ? (
        <p className="hl-error">{problem.message}</p>
      ) : null}
      {api.problemError ? <p className="hl-error">{api.problemError}</p> : null}
      {problem?.ok ? (
        <>
          <h1 className="hl-title">{problem.problem.title}</h1>
          <p className="hl-muted">
            {problem.problem.difficulty}
            {api.ladder?.solvedAt ? " · recorded as solved" : ""}
          </p>
          <div className="hl-tags">
            {problem.problem.tags.map((tag) => (
              <span key={tag.slug} className="hl-tag">
                {tag.name}
              </span>
            ))}
          </div>
          <div className="hl-stepper">
            {([1, 2, 3, 4, 5] as LadderLevel[]).map((level) => {
              const key = api.ladder?.shown[String(level)];
              const hint = key ? api.ladder?.hints[key] : undefined;
              const locked = !revealed.includes(level);
              return (
                <Rung
                  key={level}
                  level={level}
                  hint={hint}
                  locked={locked}
                  blurred={hint ? !props.unblurred[hint.cacheKey] : false}
                  onUnblur={() => hint && props.revealBlur(hint.cacheKey)}
                  busy={api.busyLevel === level}
                  actionsLocked={api.busyLevel !== null}
                  streaming={api.busyLevel === level ? api.streaming : ""}
                  onRegenerate={() => api.requestHint({ level, note: props.note, regenerate: true })}
                />
              );
            })}
          </div>
          {props.showNote ? (
            <textarea
              className="hl-field"
              value={props.note}
              placeholder="What have you tried? Optional, and treated only as notes."
              onChange={(event) => props.setNote(event.target.value)}
            />
          ) : (
            <button type="button" className="hl-btn ghost" onClick={() => props.setShowNote(true)}>
              What have you tried?
            </button>
          )}
          <div className="hl-actions">
            <button
              type="button"
              className="hl-btn"
              disabled={api.busyLevel !== null || !gate?.ok || (nextLevel === 5 && revealed.includes(5))}
              onClick={() => {
                if (nextLevel === 5 && !revealed.includes(5)) {
                  props.setConfirmLevel5(true);
                  return;
                }
                api.requestHint({ level: nextLevel, note: props.note, regenerate: false });
              }}
            >
              {buttonLabel(nextLevel, revealed, gate, cooldownMs, api.ladder?.firstHintAt ?? null, props.now, settings.level5DelayMinutes)}
            </button>
            <button
              type="button"
              className="hl-btn secondary"
              disabled={api.busyLevel !== null}
              onClick={() => void api.review(props.note)}
            >
              Review my attempt
            </button>
          </div>
          <div className="hl-actions">
            <button
              type="button"
              className="hl-btn secondary"
              disabled={Boolean(api.ladder?.solvedAt)}
              onClick={() => void api.markSolved()}
            >
              {api.ladder?.solvedAt ? "Solve recorded" : "I solved it"}
            </button>
          </div>
          {api.accepted && !api.ladder?.solvedAt ? (
            <div className="hl-banner">
              <p>This looks Accepted. Record the rung you needed?</p>
              <div className="hl-actions">
                <button type="button" className="hl-btn" onClick={() => void api.markSolved()}>
                  Record solve
                </button>
                <button type="button" className="hl-btn ghost" onClick={api.dismissAccepted}>
                  Not now
                </button>
              </div>
            </div>
          ) : null}
          {api.ladder?.review ? (
            <ReviewCard
              hint={api.ladder.review}
              blurred={!props.unblurred[api.ladder.review.cacheKey]}
              onUnblur={() => {
                const key = api.ladder?.review?.cacheKey;
                if (key) props.revealBlur(key);
              }}
            />
          ) : null}
          {api.busyLevel === 0 ? (
            <div className="hl-card">
              {api.streaming ? <pre className="hl-prose">{api.streaming}</pre> : <div className="hl-skeleton" />}
            </div>
          ) : null}
          {api.error ? <p className="hl-error">{api.error}</p> : null}
          {props.confirmLevel5 ? (
            <div className="hl-modal-back" role="presentation">
              <div className="hl-modal" role="dialog" aria-modal="true" aria-labelledby="hl-confirm-title">
                <h2 id="hl-confirm-title" className="hl-title">
                  Unlock the full solution?
                </h2>
                <p className="hl-muted">
                  This rung can show runnable code. It stays off unless you turn it on in options, and it waits{" "}
                  {settings.level5DelayMinutes} minutes after your first hint.
                </p>
                <div className="hl-actions">
                  <button
                    type="button"
                    className="hl-btn"
                    onClick={() => {
                      props.setConfirmLevel5(false);
                      api.requestHint({ level: 5, note: props.note, regenerate: false });
                    }}
                  >
                    Show the solution
                  </button>
                  <button type="button" className="hl-btn secondary" onClick={() => props.setConfirmLevel5(false)}>
                    Keep thinking
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function buttonLabel(
  nextLevel: number,
  revealed: number[],
  gate: { ok: boolean; reason?: string; waitMs?: number } | null,
  cooldownMs: number,
  firstHintAt: number | null,
  now: number,
  delayMinutes: number,
): string {
  if (revealed.includes(5) && nextLevel === 5) return "Ladder complete";
  if (gate && !gate.ok && gate.reason === "cooldown") return `Think for ${formatWait(cooldownMs)}`;
  if (gate && !gate.ok && gate.reason === "timer" && firstHintAt !== null) {
    const unlockAt = firstHintAt + delayMinutes * 60_000;
    return `Solution unlocks in ${formatWait(unlockAt - now)}`;
  }
  if (gate && !gate.ok && gate.reason === "locked") return "Solution locked in options";
  return revealed.length === 0 ? "Reveal first hint" : "Reveal next hint";
}

function Premium(props: { problemTitle: string }): JSX.Element {
  return (
    <>
      <h1 className="hl-title">{props.problemTitle}</h1>
      <p className="hl-muted">
        This statement is locked. HintLadder needs the description you can already read, so it can hint without
        inventing the problem. Open a visible problem, or unlock this one on LeetCode.
      </p>
    </>
  );
}

function Rung(props: {
  level: LadderLevel;
  hint?: StoredHint;
  locked: boolean;
  blurred: boolean;
  onUnblur: () => void;
  busy: boolean;
  streaming: string;
  actionsLocked: boolean;
  onRegenerate: () => void;
}): JSX.Element {
  return (
    <article className={props.locked ? "hl-rung locked" : "hl-rung revealed"}>
      <div className="hl-index">{props.level}</div>
      <div>
        <div className="hl-rung-title">{props.hint?.title || LEVEL_TITLES[props.level]}</div>
        {props.locked && !props.busy ? (
          <p className="hl-muted">Still covered.</p>
        ) : null}
        {props.busy ? (
          props.streaming ? (
            <pre className="hl-prose">{props.streaming}</pre>
          ) : (
            <div className="hl-skeleton" />
          )
        ) : null}
        {props.hint && !props.busy ? (
          <>
            <div
              className={props.blurred ? "hl-prose hl-blur" : "hl-prose"}
              onClick={props.onUnblur}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") props.onUnblur();
              }}
              role="button"
              tabIndex={0}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(props.hint.body) }}
            />
            {props.blurred ? <p className="hl-muted">Click the hint to read it.</p> : null}
            {props.hint.conceptsToReview.length > 0 ? (
              <div className="hl-tags">
                {props.hint.conceptsToReview.map((concept) => (
                  <span key={concept} className="hl-tag">
                    {concept}
                  </span>
                ))}
              </div>
            ) : null}
            <button type="button" className="hl-btn ghost" disabled={props.actionsLocked} onClick={props.onRegenerate}>
              Regenerate
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function ReviewCard(props: { hint: StoredHint; blurred: boolean; onUnblur: () => void }): JSX.Element {
  return (
    <article className="hl-card">
      <div className="hl-rung-title">{props.hint.title || "Review"}</div>
      <div
        className={props.blurred ? "hl-prose hl-blur" : "hl-prose"}
        onClick={props.onUnblur}
        role="button"
        tabIndex={0}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(props.hint.body) }}
      />
      {props.blurred ? <p className="hl-muted">Click to read the nudge.</p> : null}
    </article>
  );
}

function LadderMark(): JSX.Element {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <path
        d="M8 4v18M18 4v18M8 8h10M8 13h10M8 18h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
