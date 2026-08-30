import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import { Frame } from "./ui/frame";
import { HomeScreen } from "./routes/home";
import { PlayScreen } from "./routes/play";
import { PlayerScreen } from "./routes/player";
import { ProfileScreen } from "./routes/profile";
import { RanksScreen } from "./routes/ranks";

const rootRoute = createRootRoute({ component: Frame });

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomeScreen });

// TanStack's default search parser already turns ?game=341 into a number; this
// validator just refuses anything that is not a game id.
const validatePlaySearch = (search: Record<string, unknown>): { game?: number } => {
  const raw = search.game;
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isSafeInteger(value) && value >= 0 ? { game: value } : {};
};

const playRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/play",
  component: PlayScreen,
  validateSearch: validatePlaySearch,
});

const ranksRoute = createRoute({ getParentRoute: () => rootRoute, path: "/ranks", component: RanksScreen });
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/profile", component: ProfileScreen });
const playerRoute = createRoute({ getParentRoute: () => rootRoute, path: "/p/$address", component: PlayerScreen });

const routeTree = rootRoute.addChildren([homeRoute, playRoute, ranksRoute, profileRoute, playerRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
