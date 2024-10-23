import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { AppSidebar } from "@/components/modules/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

export const Route = createRootRoute({
  component: () => (
    <>
      <SidebarProvider>
        <AppSidebar />
        <DashboardLayout>
          <Outlet />
        </DashboardLayout>
      </SidebarProvider>

      <TanStackRouterDevtools />
    </>
  ),
});
