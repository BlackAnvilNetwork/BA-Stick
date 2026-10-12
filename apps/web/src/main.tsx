import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Side-effect: createAppKit at module scope (Reown docs — outside React components).
import "./appkit-config";
import { applyUiSettings, loadUiSettings } from "./uiSettings";
import "./styles.css";

applyUiSettings(loadUiSettings());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
