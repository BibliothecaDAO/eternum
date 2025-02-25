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
  ScriptOnce,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

import "@rainbow-me/rainbowkit/styles.css";

import type { QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { StarknetProvider } from "@/providers/starknet";
import { seo } from "@/utils/seo";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { env } from "env";
import { WagmiProvider } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";

export interface RouterAppContext {
  session: {
    address: string;
  };
  queryClient: QueryClient;
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
        title: "RW | Account Portal",
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
      {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "32x32",
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/icon.svg",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
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
    ssr: true,
  });
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="overflow-hidden">
        <ScriptOnce>
          {`document.documentElement.classList.toggle(
            'dark',
            localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
            )`}
        </ScriptOnce>
        <div
          className={`flex h-screen flex-col [--header-height:calc(--spacing(14))]`}
        >
          <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <StarknetProvider>
              <WagmiProvider config={config}>
                <SidebarProvider className="flex h-full flex-col">
                  <Header />
                  <div className="flex min-h-0 flex-1">
                    <AppSidebar />
                    <SidebarInset className="min-h-auto overflow-auto">
                      <RainbowKitProvider>
                        <Outlet />
                      </RainbowKitProvider>
                    </SidebarInset>
                  </div>
                  <Toaster />
                </SidebarProvider>
              </WagmiProvider>
            </StarknetProvider>
          </ThemeProvider>
        </div>
        <TanStackRouterDevtools position="bottom-left" />
        <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
