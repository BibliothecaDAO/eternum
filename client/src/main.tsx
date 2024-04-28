import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { setup } from "./dojo/setup";
import { DojoProvider } from "./hooks/context/DojoContext";
import { LoadingScreen } from "./ui/modules/LoadingScreen";
import { dojoConfig } from "../dojoConfig";
import { inject } from "@vercel/analytics";

async function init() {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("React root not found");
  const root = ReactDOM.createRoot(rootElement as HTMLElement);

  const setupResult = await setup(dojoConfig);

  inject();

  root.render(
    <React.StrictMode>
      {!setupResult ? (
        <LoadingScreen />
      ) : (
        <DojoProvider value={setupResult}>
          <App />
        </DojoProvider>
      )}
    </React.StrictMode>,
  );
}

init();
