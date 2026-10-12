import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initAppKit } from "./appkit";
import { applyUiSettings, loadUiSettings } from "./uiSettings";
import "./styles.css";

applyUiSettings(loadUiSettings());
// Eager AppKit so Connect opens the full Reown picker (not a late raw WC QR).
initAppKit();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
