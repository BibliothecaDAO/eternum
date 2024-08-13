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
import { ACCOUNT_CHANGE_EVENT } from "./hooks/helpers/useAccountChange";

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
  console.log("setupResult: ", setupResult);

  const graphic = new GameRenderer(setupResult);

  graphic.initScene();
  graphic.initStats();

  // update dojo in game renderer when address changes
  const updateDojo = () => {
    graphic.updateDojo(setupResult);
  };
  window.addEventListener(ACCOUNT_CHANGE_EVENT, updateDojo);

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
