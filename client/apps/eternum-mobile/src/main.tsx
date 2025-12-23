import { BootstrapApp } from "@/app/bootstrap/bootstrap-app";
import { StarknetProvider } from "@/app/dojo/context/starknet-provider";
import "@/app/index.css";
import { ThemeProvider } from "@/app/providers/theme-provider";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <StarknetProvider>
        <BootstrapApp />
      </StarknetProvider>
    </ThemeProvider>
  </StrictMode>,
);
