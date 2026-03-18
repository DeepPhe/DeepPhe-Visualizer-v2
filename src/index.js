import React from "react";
import ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";

// Enable accessibility testing in development
if (process.env.NODE_ENV !== "production") {
  import("@axe-core/react").then((axe) => {
    axe.default(React, ReactDOM, 1000);
  });
}

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
