import { createRoot, type Root } from "react-dom/client";
import panelCss from "./panel.css?inline";
import { PanelApp } from "./ui/PanelApp";

const HOST_ID = "hintladder-host";

export function mountPanel(): void {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement("div");
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = panelCss;
  const mount = document.createElement("div");
  shadow.append(style, mount);
  document.documentElement.append(host);
  const root: Root = createRoot(mount);
  root.render(<PanelApp />);
}
