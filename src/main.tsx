import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import boardIconUrl from "./assets/kanban-icon.svg";
import "./index.css";

function ensureFavicon() {
  const link =
    document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
    document.createElement("link");
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.href = boardIconUrl;
  document.head.appendChild(link);
}

ensureFavicon();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
