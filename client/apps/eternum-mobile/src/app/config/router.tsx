import { Suspense, lazy } from "react";
import { Outlet, createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { ROUTES } from "@/shared/consts/routes";
import { useAuth } from "@/shared/hooks/use-auth";
import { useGameSelection } from "@bibliothecadao/game-selection";
import { Loading } from "@/shared/ui/loading";
import { Layout } from "../ui/layout";
import { DojoReadyGate } from "../dojo/context/deferred-dojo-context";

// Eager load login (first screen users see)
import { LoginPage } from "@/pages/login";

// Lazy load heavy pages for code splitting
const HomePage = lazy(() => import("@/pages/home").then((m) => ({ default: m.HomePage })));
const TradePage = lazy(() => import("@/pages/trade").then((m) => ({ default: m.TradePage })));
const WorldmapPage = lazy(() => import("@/pages/worldmap").then((m) => ({ default: m.WorldmapPage })));
const RealmPage = lazy(() => import("@/pages/realm").then((m) => ({ default: m.RealmPage })));
const ChatPage = lazy(() => import("@/pages/chat").then((m) => ({ default: m.ChatPage })));
const LordpediaPage = lazy(() => import("@/pages/lordpedia").then((m) => ({ default: m.LordpediaPage })));
const SettingsPage = lazy(() => import("@/pages/settings").then((m) => ({ default: m.SettingsPage })));
const WorldSelectPage = lazy(() => import("@/pages/world-select").then((m) => ({ default: m.WorldSelectPage })));

// Suspense wrapper for lazy-loaded components
function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading className="min-h-screen" text="Loading..." />}>{children}</Suspense>;
}

// Create a root route
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Protected layout component that wraps with DojoReadyGate
function ProtectedLayout() {
  return (
    <DojoReadyGate>
      <Layout />
    </DojoReadyGate>
  );
}

// Create a layout route for protected routes
const protectedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: async () => {
    const { isAuthenticated } = useAuth.getState();
    if (!isAuthenticated) {
      throw redirect({ to: ROUTES.LOGIN });
    }
    // Check if world is selected
    const { selectedWorld } = useGameSelection.getState();
    if (!selectedWorld) {
      throw redirect({ to: ROUTES.WORLD_SELECT });
    }
  },
  component: ProtectedLayout,
});

// Login route (eager loaded)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: ROUTES.LOGIN,
  component: LoginPage,
});

// World selection route (lazy loaded, requires auth but not world selection)
const worldSelectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: ROUTES.WORLD_SELECT,
  beforeLoad: async () => {
    const { isAuthenticated } = useAuth.getState();
    if (!isAuthenticated) {
      throw redirect({ to: ROUTES.LOGIN });
    }
  },
  component: () => (
    <SuspenseWrapper>
      <WorldSelectPage />
    </SuspenseWrapper>
  ),
});

// Protected routes (lazy loaded)
const homeRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.HOME,
  component: () => (
    <SuspenseWrapper>
      <HomePage />
    </SuspenseWrapper>
  ),
});

const lordpediaRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.LORDPEDIA,
  component: () => (
    <SuspenseWrapper>
      <LordpediaPage />
    </SuspenseWrapper>
  ),
});

const realmRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.REALM,
  component: () => (
    <SuspenseWrapper>
      <RealmPage />
    </SuspenseWrapper>
  ),
});

const settingsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.SETTINGS,
  component: () => (
    <SuspenseWrapper>
      <SettingsPage />
    </SuspenseWrapper>
  ),
});

const tradeRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.TRADE,
  component: () => (
    <SuspenseWrapper>
      <TradePage />
    </SuspenseWrapper>
  ),
  validateSearch: (search: Record<string, unknown>) => ({
    buyResourceId: search.buyResourceId as number | undefined,
    sellResourceId: search.sellResourceId as number | undefined,
  }),
});

const chatRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.CHAT,
  component: () => (
    <SuspenseWrapper>
      <ChatPage />
    </SuspenseWrapper>
  ),
});

const worldmapRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.WORLDMAP,
  component: () => (
    <SuspenseWrapper>
      <WorldmapPage />
    </SuspenseWrapper>
  ),
});

// Add catch-all route for 404
const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  beforeLoad: () => {
    throw redirect({ to: ROUTES.LOGIN });
  },
});

// Create the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  worldSelectRoute,
  protectedLayoutRoute.addChildren([
    homeRoute,
    lordpediaRoute,
    realmRoute,
    settingsRoute,
    tradeRoute,
    chatRoute,
    worldmapRoute,
  ]),
  notFoundRoute,
]);

// Create the router
export const router = createRouter({ routeTree });

// Register router types
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
