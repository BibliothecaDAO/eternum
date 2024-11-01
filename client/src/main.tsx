import { inject } from "@vercel/analytics";
import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";
import { dojoConfig } from "../dojoConfig";
import App from "./App";
import { setup } from "./dojo/setup";
import { DojoProvider } from "./hooks/context/DojoContext";
import "./index.css";
import GameRenderer from "./three/GameRenderer";
import { LoadingScreen } from "./ui/modules/LoadingScreen";

declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}

window.Buffer = Buffer;

async function init() {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("React root not found");
  const root = ReactDOM.createRoot(rootElement as HTMLElement);

  root.render(<LoadingScreen />);

  const setupResult = await setup(dojoConfig);

  const graphic = new GameRenderer(setupResult);

  graphic.initScene();
  if (import.meta.env.VITE_PUBLIC_SHOW_FPS == "true") {
    graphic.initStats();
  }

  inject();
  root.render(
    <React.StrictMode>
      <DojoProvider value={setupResult}>
        <App />
      </DojoProvider>
    </React.StrictMode>,
  );
}

init();
