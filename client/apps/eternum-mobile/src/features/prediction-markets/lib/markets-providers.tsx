import { getPredictionMarketConfig } from "@/pm/prediction-market-config";
import { ControllersProvider } from "@/pm/hooks/controllers/use-controllers";
import { UserProvider } from "@/pm/hooks/dojo/user";
import { DojoSdkProviderInitialized } from "@/pm/sdk";
import type { ReactNode } from "react";

interface MarketsProvidersProps {
  children: ReactNode;
}

export const MarketsProviders = ({ children }: MarketsProvidersProps) => {
  const config = getPredictionMarketConfig();
  return (
    <DojoSdkProviderInitialized toriiUrl={config.toriiUrl} worldAddress={config.worldAddress}>
      <UserProvider>
        <ControllersProvider>{children}</ControllersProvider>
      </UserProvider>
    </DojoSdkProviderInitialized>
  );
};
