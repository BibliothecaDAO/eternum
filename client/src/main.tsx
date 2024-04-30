import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { setup } from "./dojo/setup";
import { DojoProvider } from "./hooks/context/DojoContext";
import { LoadingScreen } from "./ui/modules/LoadingScreen";
import { dojoConfig } from "../dojoConfig";
import { inject } from "@vercel/analytics";
import { TourProvider, StepType, components } from "@reactour/tour";

async function init() {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("React root not found");
  const root = ReactDOM.createRoot(rootElement as HTMLElement);

  const setupResult = await setup(dojoConfig);

  inject();
  const steps: StepType[] = [
    {
      selector: ".first-step",
      content: "Your Navigation Bar to Control the Game. Open and move the windows around to suit your needs.",
      position: "right",
    },
    {
      selector: ".second-step",
      content:
        "Eternum Works in Cycles. Every Cycle is 6 minutes Long. You can see the Current Cycle Time Progress here.",
      position: "bottom",
    },
    {
      selector: ".third-step",
      content: "Navigate to the World Map here. You can see the Entire World and the Realms in it.",
      position: "bottom",
    },
    {
      selector: ".forth-step",
      content: "Navigate your Realms here.",
      position: "bottom",
    },
  ];
  root.render(
    <React.StrictMode>
      {!setupResult ? (
        <LoadingScreen />
      ) : (
        <TourProvider
          steps={steps}
          styles={{
            popover: (base) => ({
              ...base,
              "--reactour-accent": "#24130A",
              borderRadius: 4,
            }),
            maskArea: (base) => ({ ...base, rx: 4, color: "#24130A" }),
            maskWrapper: (base) => ({ ...base, color: "#24130A" }),
            badge: (base) => ({ ...base, left: "auto", right: "-0.8125em" }),
            controls: (base) => ({ ...base, marginTop: 100 }),
            close: (base) => ({ ...base, right: "auto", left: 8, top: 8 }),
          }}
        >
          <DojoProvider value={setupResult}>
            <App />
          </DojoProvider>
        </TourProvider>
      )}
    </React.StrictMode>,
  );
}

init();
