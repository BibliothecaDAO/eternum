import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

export const Route = createRootRoute({
  component: () => (
    <>
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>

      <TanStackRouterDevtools />
    </>
  ),
});
