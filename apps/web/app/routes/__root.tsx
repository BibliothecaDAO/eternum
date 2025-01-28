import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { Spinner } from "./-components/spinner";
import type { queryClient, trpcQueryUtils } from "../router";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Header } from "@/components/layout/header";
import { StarknetProvider } from "@/providers/starknet";
import { ArkClient } from "@/lib/ark/client";
import { useAccount, UseAccountResult } from "@starknet-react/core";
import { ThemeProvider } from "@/providers/theme";

export interface RouterAppContext {
  trpcQueryUtils: typeof trpcQueryUtils;
  queryClient: typeof queryClient;
  arkClient: ArkClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
});

function RootComponent() {
  const isFetching = useRouterState({ select: (s) => s.isLoading });

  return (
    <>
      <div
        className={`[--header-height:calc(theme(spacing.14))]`}
      >
        <StarknetProvider>
          <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <SidebarProvider className="flex flex-col">
              <Header />
              <div className="flex flex-1">
                <AppSidebar />

                <SidebarInset>
                  <Outlet />
                  {/*<div
            className={`text-3xl duration-300 delay-0 opacity-0 ${
              isFetching ? ` duration-1000 opacity-40` : ''
            }`}
          >
            <Spinner />
          </div>*/}
                </SidebarInset>
              </div>
            </SidebarProvider>
          </ThemeProvider>
        </StarknetProvider>
      </div>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </>
  );
}
