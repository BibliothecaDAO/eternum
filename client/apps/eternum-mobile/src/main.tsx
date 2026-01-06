import App from "@/app/app.tsx";
import { StarknetProvider } from "@/app/dojo/context/starknet-provider";
import "@/app/index.css";
import { ThemeProvider } from "@/app/providers/theme-provider";
import { DeferredDojoProvider } from "@/app/dojo/context/deferred-dojo-context";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Main entry point - no longer does Dojo setup here
// Dojo initialization is deferred until after world selection
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <StarknetProvider>
        <DeferredDojoProvider>
          <App />
        </DeferredDojoProvider>
      </StarknetProvider>
    </ThemeProvider>
  </StrictMode>,
);
