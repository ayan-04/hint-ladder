/**
 * Runs in the page's MAIN world. Reads Monaco and reports SPA navigations.
 * Never touches the extension API or the API key.
 */

import { readEditorFromWindow, type EditorSnapshot } from "../lib/editor";

const SOURCE_MAIN = "hintladder-main";
const SOURCE_ISOLATED = "hintladder-isolated";

interface RequestCodeMessage {
  source: typeof SOURCE_ISOLATED;
  type: "REQUEST_CODE";
  nonce: string;
}

interface NavMessage {
  source: typeof SOURCE_MAIN;
  type: "NAV";
  href: string;
}

function isRequestCode(data: unknown): data is RequestCodeMessage {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  return (
    record.source === SOURCE_ISOLATED &&
    record.type === "REQUEST_CODE" &&
    typeof record.nonce === "string" &&
    record.nonce.length >= 8
  );
}

function postCode(nonce: string, snapshot: EditorSnapshot): void {
  window.postMessage(
    {
      source: SOURCE_MAIN,
      type: "CODE_RESULT",
      nonce,
      code: snapshot.code,
      language: snapshot.language,
      via: snapshot.via,
    },
    window.location.origin,
  );
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;
  if (!isRequestCode(event.data)) return;
  postCode(event.data.nonce, readEditorFromWindow(window));
});

function postNav(): void {
  const message: NavMessage = {
    source: SOURCE_MAIN,
    type: "NAV",
    href: window.location.href,
  };
  window.postMessage(message, window.location.origin);
}

const historyWithState = window.history;
const originalPush = historyWithState.pushState.bind(historyWithState);
const originalReplace = historyWithState.replaceState.bind(historyWithState);

historyWithState.pushState = function pushState(
  ...args: Parameters<History["pushState"]>
): void {
  originalPush(...args);
  postNav();
};

historyWithState.replaceState = function replaceState(
  ...args: Parameters<History["replaceState"]>
): void {
  originalReplace(...args);
  postNav();
};

window.addEventListener("popstate", () => {
  postNav();
});
