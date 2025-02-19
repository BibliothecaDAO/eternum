import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
//import { StarknetProvider } from "@/providers/starknet";
import { ThemeProvider } from "@/providers/theme";
import appCss from "@/styles/app.css?url";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

import type { trpcQueryUtils } from "../router";

import "@rainbow-me/rainbowkit/styles.css";

import { Toaster } from "@/components/ui/toaster";
import { seo } from "@/utils/seo";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { env } from "env";
import { WagmiProvider } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";

export interface RouterAppContext {
  trpcQueryUtils: typeof trpcQueryUtils;
  session: {
    address: string;
  };
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      ...seo({
        title: "Realms.World | Account Portal",
        description: `Interact with your Realms and Lords on the various ecosystem projects. `,
      }),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
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
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className={`[--header-height:calc(--spacing(14))]`}>
          <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <WagmiProvider config={config}>
              <SidebarProvider className="flex flex-col">
                <Header />
                <div className="flex flex-1">
                  <AppSidebar />
                  <SidebarInset>
                    <RainbowKitProvider>
                      <Outlet />
                    </RainbowKitProvider>
                  </SidebarInset>
                </div>
                <Toaster />
              </SidebarProvider>
            </WagmiProvider>
          </ThemeProvider>
        </div>
        <TanStackRouterDevtools position="bottom-left" />
        <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
