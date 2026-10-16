import { readViewLines, type EditorSnapshot } from "../lib/editor";

const SOURCE_MAIN = "hintladder-main";
const SOURCE_ISOLATED = "hintladder-isolated";

interface CodeResult {
  source: typeof SOURCE_MAIN;
  type: "CODE_RESULT";
  nonce: string;
  code: string;
  language: string;
  via: EditorSnapshot["via"];
}

function isCodeResult(data: unknown, nonce: string): data is CodeResult {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  return (
    record.source === SOURCE_MAIN &&
    record.type === "CODE_RESULT" &&
    record.nonce === nonce &&
    typeof record.code === "string" &&
    typeof record.language === "string"
  );
}

export function requestEditorCode(timeoutMs = 700): Promise<EditorSnapshot> {
  const nonce = crypto.randomUUID();
  return new Promise((resolve) => {
    const finish = (snapshot: EditorSnapshot): void => {
      window.removeEventListener("message", onMessage);
      resolve(snapshot);
    };
    const timer = window.setTimeout(() => {
      const dom = readViewLines(document);
      finish({
        code: dom,
        language: "unknown",
        via: dom.trim() ? "dom" : "empty",
      });
    }, timeoutMs);

    function onMessage(event: MessageEvent<unknown>): void {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      if (!isCodeResult(event.data, nonce)) return;
      window.clearTimeout(timer);
      const via = event.data.via ?? (event.data.code.trim() ? "monaco" : "empty");
      if (!event.data.code.trim()) {
        const dom = readViewLines(document);
        finish({
          code: dom,
          language: event.data.language,
          via: dom.trim() ? "dom" : "empty",
        });
        return;
      }
      finish({ code: event.data.code, language: event.data.language, via });
    }

    window.addEventListener("message", onMessage);
    window.postMessage(
      { source: SOURCE_ISOLATED, type: "REQUEST_CODE", nonce },
      window.location.origin,
    );
  });
}

export function editorLooksMissing(snapshot: EditorSnapshot): boolean {
  return snapshot.via === "empty";
}
