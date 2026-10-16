import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { OptionsApp } from "./App";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <OptionsApp />
    </StrictMode>,
  );
}
