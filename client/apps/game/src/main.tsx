/// <reference types="vite-plugin-pwa/client" />

import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./app";

declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}

window.Buffer = Buffer;

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("React root not found");
}

const root = ReactDOM.createRoot(rootElement as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
