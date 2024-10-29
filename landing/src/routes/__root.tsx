import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { AppSidebar } from "@/components/modules/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { ToastContainer } from "react-toastify";

export const Route = createRootRoute({
  component: () => (
    <>
      <SidebarProvider>
        <AppSidebar />
        <DashboardLayout>
          <Outlet />
          <ToastContainer style={{ zIndex: 1100, top: 76}} />
        </DashboardLayout>
      </SidebarProvider>
      <TanStackRouterDevtools />
    </>
  ),
});
