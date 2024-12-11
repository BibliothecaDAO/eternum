import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { dojoConfig } from "../dojoConfig";
import { setup } from "./dojo/setup";
import "./index.css";

// Import the generated route tree
//import { ArkProvider } from '@ark-project/react';

import { NuqsAdapter } from "nuqs/adapters/react";
import { StarknetProvider } from "./components/providers/starknet-provider";
import { ThemeProvider } from "./components/providers/theme-provider";
import { TypeH1 } from "./components/typography/type-h1";
import { DojoProvider } from "./hooks/context/DojoContext";
import { DojoEventListener } from "./hooks/subscriptions.tsx/dojo-event-listener";
import { routeTree } from "./routeTree.gen";
// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <div className="flex-grow flex items-center justify-center text-gold h-screen bg-brown w-screen">
      <div className="flex flex-col items-center animate-pulse">
        <img src="/images/eternumloader.png" className="w-32 sm:w-24 lg:w-24 xl:w-28 2xl:mt-2 mx-auto my-8" />
        <TypeH1 className="text-center mt-4 text-ellipsis">Loading...</TypeH1>
        <div className="relative bottom-1 text-center text-xl">{`We are experiencing high loading times. Please be patient.`}</div>
      </div>
    </div>,
  );

  const setupResult = await setup(dojoConfig);

  root.render(
    <StrictMode>
      <NuqsAdapter>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <StarknetProvider>
            <DojoProvider value={setupResult}>
              <DojoEventListener>
                <RouterProvider router={router} />
              </DojoEventListener>
            </DojoProvider>
          </StarknetProvider>
        </ThemeProvider>
      </NuqsAdapter>
    </StrictMode>,
  );
}
