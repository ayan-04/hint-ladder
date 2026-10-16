import { defineManifest } from "@crxjs/vite-plugin";

const manifest = defineManifest({
  manifest_version: 3,
  name: "HintLadder",
  version: "1.0.0",
  description:
    "Progressive hints for LeetCode. One rung at a time, so you keep the thinking.",
  permissions: ["storage"],
  host_permissions: [
    "https://leetcode.com/*",
    "https://generativelanguage.googleapis.com/*",
    "https://api.openai.com/*",
    "https://api.anthropic.com/*",
  ],
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  action: {
    default_title: "HintLadder",
    default_popup: "src/popup/index.html",
    default_icon: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
  },
  icons: {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
  options_ui: {
    page: "src/options/index.html",
    open_in_tab: true,
  },
  commands: {
    "toggle-panel": {
      suggested_key: {
        default: "Alt+H",
      },
      description: "Toggle the HintLadder panel",
    },
  },
  content_scripts: [
    {
      matches: ["https://leetcode.com/*"],
      js: ["src/content/index.tsx"],
      run_at: "document_idle",
    },
    {
      matches: ["https://leetcode.com/*"],
      js: ["src/content/main-world.ts"],
      run_at: "document_start",
      // crxjs' manifest types omit Chrome's MAIN-world field; the built manifest still emits it.
      // @ts-expect-error world is valid in Manifest V3 content scripts
      world: "MAIN",
    },
  ],
});

export default manifest;
