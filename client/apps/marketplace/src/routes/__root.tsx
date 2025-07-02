import { DashboardLayout } from "@/components/dashboard-layout";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsInProd } from "@tanstack/react-router-devtools";
import { Suspense } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export const Route = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <Suspense fallback={<div>Loading...</div>}>
          <DashboardLayout>
            <Outlet />
          </DashboardLayout>
        </Suspense>
      </div>
      <ReactQueryDevtools initialIsOpen={false} />
      <TanStackRouterDevtoolsInProd />
    </QueryClientProvider>
  ),
});
