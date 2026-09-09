import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles.css";
import "./workspace.css";

const DemoApp = React.lazy(() => import("./demo/DemoApp"));
const isDemo = window.location.pathname.replace(/\/$/, "") === "/demo";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isDemo ? (
      <React.Suspense fallback={<p role="status">Loading sample league...</p>}>
        <DemoApp />
      </React.Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
