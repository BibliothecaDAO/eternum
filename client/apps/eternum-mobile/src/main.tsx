import App from "@/app/app.tsx";
import { DojoProvider } from "@/app/dojo/context/dojo-context";
import { StarknetProvider } from "@/app/dojo/context/starknet-provider";
import "@/app/index.css";
import { ThemeProvider } from "@/app/providers/theme-provider";
import { setup } from "@bibliothecadao/dojo";
import { configManager } from "@bibliothecadao/eternum";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { dojoConfig } from "../dojoConfig";
import { env } from "../env";
import { ETERNUM_CONFIG } from "./app/config/config";
import { initialSync } from "./app/dojo/sync";

async function main() {
  const setupResult = await setup(
    { ...dojoConfig },
    {
      vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
      useBurner: env.VITE_PUBLIC_CHAIN === "local",
    },
    {
      onNoAccount: () => {
        console.log("No account");
      },
      onError: (error) => {
        console.error("System call error:", error);
        // Handle other types of errors if needed
      },
    },
  );

  await initialSync(setupResult, (progress) => {
    console.log("progress", progress);
  });

  const eternumConfig = ETERNUM_CONFIG();
  configManager.setDojo(setupResult.components, eternumConfig);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider>
        <StarknetProvider>
          <DojoProvider value={setupResult}>
            <App />
          </DojoProvider>
        </StarknetProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

main();
