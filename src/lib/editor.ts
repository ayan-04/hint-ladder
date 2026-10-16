export interface EditorSnapshot {
  code: string;
  language: string;
  via: "monaco" | "dom" | "empty";
}

interface MonacoModel {
  getValue: () => string;
  getLanguageId?: () => string;
  uri?: { path?: string };
}

interface MonacoEditorApi {
  editor?: {
    getModels?: () => MonacoModel[];
  };
}

interface WindowWithMonaco {
  monaco?: MonacoEditorApi;
}

export function readMonacoModels(models: readonly MonacoModel[]): EditorSnapshot | null {
  let best: { code: string; language: string; score: number } | null = null;
  for (const model of models) {
    const code = model.getValue();
    const language = model.getLanguageId?.() ?? "plaintext";
    const path = model.uri?.path ?? "";
    const score = code.length + (path.includes("solution") ? 1000 : 0);
    if (!best || score > best.score) {
      best = { code, language, score };
    }
  }
  if (!best) return null;
  return {
    code: best.code,
    language: best.language,
    via: best.code.trim() ? "monaco" : "empty",
  };
}

export function readViewLines(root: ParentNode): string {
  const lines = root.querySelectorAll(".view-lines .view-line");
  if (lines.length === 0) return "";
  return Array.from(lines)
    .map((line) => line.textContent ?? "")
    .join("\n");
}

export function readEditorFromWindow(win: Window): EditorSnapshot {
  const monaco = (win as Window & WindowWithMonaco).monaco;
  const models = monaco?.editor?.getModels?.();
  if (models && models.length > 0) {
    const fromMonaco = readMonacoModels(models);
    if (fromMonaco && fromMonaco.code.trim()) return fromMonaco;
  }
  const domCode = readViewLines(win.document);
  if (domCode.trim()) {
    return { code: domCode, language: "unknown", via: "dom" };
  }
  return { code: "", language: "unknown", via: "empty" };
}
