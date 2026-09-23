import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { SessionProvider } from "./lib/session.jsx";
import "./styles.css";

// Demo mode (npm run demo): swap the four services for an in-memory
// backend so the UI can be shown without Docker. Never on in a normal
// dev/prod build - see src/demo/mockApi.js.
if (import.meta.env.VITE_DEMO === "1") {
  const { installMockApi } = await import("./demo/mockApi.js");
  installMockApi();
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </React.StrictMode>
);
