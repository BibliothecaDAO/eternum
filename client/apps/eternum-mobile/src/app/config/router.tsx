import { BlitzPage } from "@/pages/blitz";
import { ChatPage } from "@/pages/chat";
import { HomePage } from "@/pages/home";
import { LeaderboardPage } from "@/pages/leaderboard";
import { LoginPage } from "@/pages/login";
import { LordpediaPage } from "@/pages/lordpedia";
import { MarketDetailsPage, MarketsPage } from "@/pages/markets";
import { RealmPage } from "@/pages/realm";
import { SettingsPage } from "@/pages/settings";
import { TradePage } from "@/pages/trade";
import { WorldmapPage } from "@/pages/worldmap";
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
    // const { isAuthenticated } = useAuth.getState();
    // if (isAuthenticated) {
    //   throw redirect({ to: ROUTES.HOME });
    // }
  },
});

const homeRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.HOME,
  component: HomePage,
});

const blitzRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.BLITZ,
  component: BlitzPage,
});

const lordpediaRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.LORDPEDIA,
  component: LordpediaPage,
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
  validateSearch: (search: Record<string, unknown>) => ({
    buyResourceId: search.buyResourceId as number | undefined,
    sellResourceId: search.sellResourceId as number | undefined,
  }),
});

const leaderboardRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.LEADERBOARD,
  component: LeaderboardPage,
});

const marketsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.MARKETS,
  component: MarketsPage,
});

const marketDetailsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.MARKET_DETAILS,
  component: MarketDetailsPage,
});

const chatRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.CHAT,
  component: ChatPage,
});

const worldmapRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: ROUTES.WORLDMAP,
  component: WorldmapPage,
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
  protectedLayoutRoute.addChildren([
    homeRoute,
    blitzRoute,
    lordpediaRoute,
    realmRoute,
    settingsRoute,
    tradeRoute,
    leaderboardRoute,
    marketsRoute,
    marketDetailsRoute,
    chatRoute,
    worldmapRoute,
  ]),
  notFoundRoute,
]);

const baseUrl = import.meta.env.BASE_URL ?? "/";
const basepath = baseUrl === "/" ? undefined : baseUrl.replace(/\/$/, "");

// Create the router
export const router = createRouter({ routeTree, basepath });

// Register router types
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
