import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Side-effect: createAppKit at module scope.
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
  const initial = initialUiSettings(saved, loadUiSettings(), isCoarsePointer(), window.innerWidth);
  if (saved == null && initial.layout === "mobile") saveUiSettings(initial);
  applyUiSettings(initial);
}

// `?demo` keeps the offline renderer (Forest Basin water included). Omit it to enter the live client.
const params = new URLSearchParams(location.search);
const demo = params.has("demo");
createRoot(document.getElementById("root")!).render(<StrictMode>{demo ? <DemoApp /> : <App />}</StrictMode>);
