import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { setup } from "./dojo/setup";
import { DojoProvider } from "./hooks/context/DojoContext";
import { LoadingScreen } from "./ui/modules/LoadingScreen";
import { dojoConfig } from "../dojoConfig";
import { inject } from "@vercel/analytics";
import { TourProvider, StepType } from "@reactour/tour";

async function init() {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("React root not found");
  const root = ReactDOM.createRoot(rootElement as HTMLElement);

  root.render(<LoadingScreen />);

  const setupResult = await setup(dojoConfig);

  inject();
  const steps: StepType[] = [
    {
      selector: ".realm-selector",
      content: "Navigate to your Realms here to manage your territories.",
      position: "bottom",
    },
    {
      selector: ".world-selector",
      content: "Explore the World map and discover new areas.",
      position: "bottom",
    },
    {
      selector: ".military-selector",
      content: "Access your Military options to manage troops and defenses.",
      position: "bottom",
    },
    {
      selector: ".construction-selector",
      content: "Navigate to Construction to build and upgrade structures.",
      position: "bottom",
    },
    {
      selector: ".trade-selector",
      content: "Visit the Trade center to engage in commerce and trade resources.",
      position: "bottom",
    },
    {
      selector: ".resources-selector",
      content: "Manage and see the state of your production and resources here.",
      position: "bottom",
    },
    {
      selector: ".banking-selector",
      content: "Manage your finances in the Banking section.",
      position: "bottom",
    },
    {
      selector: ".second-step",
      content: "Eternum Works in 15 minute Cycles.  You can see the Current Cycle Time progress here.",
      position: "bottom",
    },
    {
      selector: ".forth-step",
      content: "Find quests here. Complete these first and earn resources.",
      position: "bottom",
    },
    {
      selector: ".fifth-step",
      content: "Find hints here about the game. If this is your first time playing, this is a good place to start.",
      position: "bottom",
    },
    {
      selector: ".sixth-step",
      content: "Settings and see this walkthrough again.",
      position: "bottom",
    },
  ];
  root.render(
    <React.StrictMode>
      <TourProvider
        steps={steps}
        styles={{
          popover: (base) => ({
            ...base,
            "--reactour-accent": "#24130A",
            borderRadius: 4,
            backgroundColor: "#24130A",
            color: "#F3C99F",
          }),
          maskArea: (base) => ({ ...base, rx: 4, color: "#24130A" }),
          maskWrapper: (base) => ({ ...base, color: "#24130A" }),
          badge: (base) => ({ ...base, left: "auto", right: "-0.8125em" }),
          controls: (base) => ({ ...base, marginTop: 100, color: "#F3C99F" }),
          close: (base) => ({ ...base, right: "auto", left: 8, top: 8 }),
        }}
      >
        <DojoProvider value={setupResult}>
          <App />
        </DojoProvider>
      </TourProvider>
    </React.StrictMode>,
  );
}

init();
