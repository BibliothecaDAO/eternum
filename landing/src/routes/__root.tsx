import { Sidebar } from "@/components/modules/sidebar";
import { TopNavigation } from "@/components/modules/top-navigation";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

export const Route = createRootRoute({
  component: () => (
    <>
      <div className="flex gap-4 p-2">
        <Sidebar />

        <div className="flex-1 h-screen">
          <div className="flex-1 pb-4">
            <TopNavigation />
          </div>
          <div className="flex-1 border rounded-lg p-4 ">
            <Outlet />
          </div>
        </div>
      </div>

      <TanStackRouterDevtools />
    </>
  ),
});
