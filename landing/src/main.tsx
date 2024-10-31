import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "react-toastify/dist/ReactToastify.css";
import { dojoConfig } from "../dojoConfig";
import { setup } from "./dojo/setup";
import "./index.css";

// Import the generated route tree
//import { ArkProvider } from '@ark-project/react';
import { NuqsAdapter } from "nuqs/adapters/react";
import { StarknetProvider } from "./components/providers/Starknet";
import { ThemeProvider } from "./components/providers/theme-provider";
import { DojoProvider } from "./hooks/context/DojoContext";
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

  root.render(
    <StrictMode>
      <NuqsAdapter>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <StarknetProvider>
            <DojoProvider value={setupResult}>
              {/*<ArkProvider config={config}>*/}
                <RouterProvider router={router} />
              {/*</ArkProvider>*/}
            </DojoProvider>
          </StarknetProvider>
        </ThemeProvider>
      </NuqsAdapter>
    </StrictMode>,
  );
}
