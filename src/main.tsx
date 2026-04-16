import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Cache invalidation: runs before createRoot/React, before any localStorage reads ──
const APP_VERSION = "2.0";
const VERSIONED_KEYS = [
  "wix-tokens",
  "wix-member",
  "reid-user-tier",
  "reid-personalisation",
  "reid-app-version",
];

function clearStaleCache(): void {
  const storedVersion = localStorage.getItem("reid-app-version");
  if (storedVersion !== APP_VERSION) {
    console.log(`App version changed (${storedVersion} → ${APP_VERSION}), clearing stale cache`);
    VERSIONED_KEYS.forEach(key => localStorage.removeItem(key));
    localStorage.setItem("reid-app-version", APP_VERSION);
  }
}

clearStaleCache();

// ── App entry point ──
createRoot(document.getElementById("root")!).render(<App />);
