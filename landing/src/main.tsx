import { ReactComponent as EternumLogo } from "@/assets/icons/eternum_new_logo.svg";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { dojoConfig } from "../dojoConfig";
import { setup } from "./dojo/setup";
import "./index.css";

// Import the generated route tree
//import { ArkProvider } from '@ark-project/react';

import { NuqsAdapter } from "nuqs/adapters/react";
import { StarknetProvider } from "./components/providers/Starknet";
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
  const setupResult = await setup(dojoConfig);
  /*const config = {
    starknetNetwork: networks.mainnet,
    arkchainNetwork: networks.mainnet,
  };*/

  if (!setupResult) {
    root.render(
      <div className="flex-grow flex items-center justify-center text-gold h-screen">
        <div className="flex flex-col items-center animate-pulse">
          <EternumLogo className="w-24 h-24 fill-gold mx-auto pt-8" />
          <TypeH1 className="text-center mt-4 text-ellipsis">Loading...</TypeH1>
        </div>
      </div>,
    );
  } else {
    root.render(
      <StrictMode>
        <NuqsAdapter>
          <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <StarknetProvider>
              <DojoProvider value={setupResult}>
                {/*<ArkProvider config={config}>*/}
                <DojoEventListener>
                  <RouterProvider router={router} />
                </DojoEventListener>
                {/*</ArkProvider>*/}
              </DojoProvider>
            </StarknetProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </StrictMode>,
    );
  }
}
