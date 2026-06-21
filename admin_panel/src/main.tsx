import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/App";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import "@/index.css";

// biome-ignore lint/style/noNonNullAssertion: #root always exists in index.html
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);