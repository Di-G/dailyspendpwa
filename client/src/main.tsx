import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// VitePWA auto-injects registration when injectRegister: 'auto' is enabled in config.

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// In development, ensure no stale service worker keeps an old app shell cached
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) {
      reg.unregister();
    }
  });
}
