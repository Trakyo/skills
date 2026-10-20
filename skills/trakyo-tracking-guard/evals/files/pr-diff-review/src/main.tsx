import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { cleanUrl } from "./lib/seo";
import { AppRouter } from "./router";

cleanUrl();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
