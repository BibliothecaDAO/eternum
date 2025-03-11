import { ChatPage } from "@/pages/chat";
import { LoginPage } from "@/pages/login";
import { RealmPage } from "@/pages/realm";
import { SettingsPage } from "@/pages/settings";
import { TradePage } from "@/pages/trade";
import { ROUTES } from "@/shared/consts/routes";
import { useAuth } from "@/shared/hooks/use-auth";
import { Outlet, createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { Layout } from "../ui/layout";

// Create a root route
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Create a layout route for protected routes
const protectedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: async () => {
    const { isAuthenticated } = useAuth.getState();
    if (!isAuthenticated) {
      throw redirect({ to: ROUTES.LOGIN });
    }
  },
  component: () => <Layout />,
});

// Create routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: ROUTES.LOGIN,
  component: LoginPage,
  beforeLoad: async () => {
    const { isAuthenticated } = useAuth.getState();
    if (isAuthenticated) {
      throw redirect({ to: ROUTES.REALM });
    }
  },
});

const realmRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.REALM,
  component: RealmPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.SETTINGS,
  component: SettingsPage,
});

const tradeRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.TRADE,
  component: TradePage,
});

const chatRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.CHAT,
  component: ChatPage,
});

// Create the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  protectedLayoutRoute.addChildren([realmRoute, settingsRoute, tradeRoute, chatRoute]),
]);

// Create the router
export const router = createRouter({ routeTree });

// Register router types
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
