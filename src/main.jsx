import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

if (import.meta.env.DEV) {
  // React 19 dev builds record every component render, with a diff of the
  // changed props, as a performance.measure entry, and browsers keep those
  // entries until cleared. Telemetry re-renders the dashboard several times
  // a second with large map props, so the buffer grows by gigabytes.
  window.setInterval(() => performance.clearMeasures(), 1000);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
