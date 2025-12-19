import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { AppSidebar } from "@/components/modules/app-sidebar";
import { RouterHead } from "@/components/providers/router-head";
import { OG_IMAGE_META } from "@/lib/seo";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

export const Route = createRootRoute({
  head: () => ({ meta: OG_IMAGE_META }),
  component: () => (
    <>
      <RouterHead />
      <SidebarProvider>
        <AppSidebar />
        <DashboardLayout>
          <Outlet />
          <Toaster />
        </DashboardLayout>
      </SidebarProvider>
      <TanStackRouterDevtools />
    </>
  ),
});
