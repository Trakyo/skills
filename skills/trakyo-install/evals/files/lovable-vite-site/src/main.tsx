import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { stripDuplicateUrlParams } from "./lib/url";
import { App } from "./App";

// Keep the address bar clean for SEO before React mounts.
stripDuplicateUrlParams();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
