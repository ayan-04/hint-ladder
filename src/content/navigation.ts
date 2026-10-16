import { isContestPath, slugFromPath } from "../lib/slug";

export interface RouteState {
  slug: string | null;
  contest: boolean;
}

export function currentRoute(): RouteState {
  return {
    slug: isContestPath(location.pathname) ? null : slugFromPath(location.pathname),
    contest: isContestPath(location.pathname),
  };
}

export function watchRoute(onChange: (route: RouteState) => void): () => void {
  let last = location.pathname;
  const emit = (): void => {
    last = location.pathname;
    onChange(currentRoute());
  };
  const onMessage = (event: MessageEvent<unknown>): void => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;
    const record = data as Record<string, unknown>;
    if (record.source === "hintladder-main" && record.type === "NAV") emit();
  };
  window.addEventListener("message", onMessage);
  window.addEventListener("popstate", emit);
  const poll = window.setInterval(() => {
    if (location.pathname !== last) emit();
  }, 800);
  const root = document.body;
  const observer = new MutationObserver(() => {
    if (location.pathname !== last) emit();
  });
  if (root) observer.observe(root, { childList: true, subtree: true });
  emit();
  return () => {
    window.removeEventListener("message", onMessage);
    window.removeEventListener("popstate", emit);
    window.clearInterval(poll);
    observer.disconnect();
  };
}
