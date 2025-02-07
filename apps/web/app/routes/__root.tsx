import {
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import type { trpcQueryUtils } from "../router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";

import { Header } from "@/components/layout/header";
import { StarknetProvider } from "@/providers/starknet";
import { ThemeProvider } from "@/providers/theme";
import "@rainbow-me/rainbowkit/styles.css";

import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { env } from "env";
import { Toaster } from "@/components/ui/toaster";
export interface RouterAppContext {
  trpcQueryUtils: typeof trpcQueryUtils;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
});

function RootComponent() {
  //const isFetching = useRouterState({ select: (s) => s.isLoading });
  const config = getDefaultConfig({
    appName: "Realms.World",
    projectId: "c8d27e7d62b1bb4d1ea2e6d4ed1604ee",
    chains: [env.VITE_PUBLIC_CHAIN === "sepolia" ? sepolia : mainnet],
    //ssr: true, // If your dApp uses server side rendering (SSR)
  });
  return (
    <>
      <div className={`[--header-height:calc(--spacing(14))]`}>
        <WagmiProvider config={config}>
          <StarknetProvider>
            <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
              <SidebarProvider className="flex flex-col">
                <Header />
                <div className="flex flex-1">
                  <AppSidebar />

                  <SidebarInset>
                    <RainbowKitProvider>
                      <Outlet />
                    </RainbowKitProvider>

                    {/*<div
            className={`text-3xl duration-300 delay-0 opacity-0 ${
              isFetching ? ` duration-1000 opacity-40` : ''
            }`}
          >
            <Spinner />
          </div>*/}
                  </SidebarInset>
                </div>
                <Toaster />
              </SidebarProvider>
            </ThemeProvider>
          </StarknetProvider>
        </WagmiProvider>
      </div>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </>
  );
}
