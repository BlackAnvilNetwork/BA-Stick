import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Side-effect: createAppKit at module scope (same as apps/web).
import "@bellgrave/client-core/appkit-config";
import { UI_SETTINGS_KEY, applyUiSettings, loadUiSettings, saveUiSettings } from "@bellgrave/ui/uiSettings";
import { initialUiSettings, isCoarsePointer } from "./mobile";
import "@bellgrave/ui/styles.css";
import "./stick.css";
import { App } from "./App";
import { DemoApp } from "./DemoApp";

document.documentElement.dataset.renderer = "stick";
{
  const saved = localStorage.getItem(UI_SETTINGS_KEY);
  const initial = initialUiSettings(saved, loadUiSettings(), isCoarsePointer());
  if (saved == null && initial.layout === "mobile") saveUiSettings(initial);
  applyUiSettings(initial);
}

// `?demo` keeps the offline renderer demo (no server) used for M0 screenshots.
const demo = new URLSearchParams(location.search).has("demo");
createRoot(document.getElementById("root")!).render(<StrictMode>{demo ? <DemoApp /> : <App />}</StrictMode>);
