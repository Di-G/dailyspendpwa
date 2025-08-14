import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize theme (default to light on first open)
const savedTheme = localStorage.getItem("dailyspend_theme");
const initialTheme = savedTheme || "light";
document.documentElement.classList.add(initialTheme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
