interface HeraldRouteEntry {
  readonly name: string;
  readonly pattern: string | RegExp;
  readonly publicFrontierDoc: boolean;
}

const HERALD_GET_ROUTES = [
  { name: "updates", pattern: "/games/updates", publicFrontierDoc: true },
  { name: "manifest", pattern: "/manifest", publicFrontierDoc: true },
  { name: "schema", pattern: /^\/schemas\/(.*)$/, publicFrontierDoc: false },
  { name: "health", pattern: "/health", publicFrontierDoc: true },
  { name: "directory", pattern: "/games", publicFrontierDoc: true },
  { name: "dayRanks", pattern: /^\/games\/([0-9]+)\/days\/([0-9]+)\/ranks$/, publicFrontierDoc: true },
  { name: "site", pattern: /^\/games\/([0-9]+)\/sites\/([0-9]+)$/, publicFrontierDoc: true },
  { name: "leaderboard", pattern: /^\/games\/([0-9]+)\/leaderboard$/, publicFrontierDoc: false },
  { name: "stats", pattern: /^\/games\/([0-9]+)\/stats$/, publicFrontierDoc: true },
  { name: "roster", pattern: /^\/games\/([0-9]+)\/aspects\/([0-9]+)\/members$/, publicFrontierDoc: true },
  { name: "storyEvents", pattern: "/history/story-events", publicFrontierDoc: false },
  { name: "history", pattern: /^\/games\/([0-9]+)\/history$/, publicFrontierDoc: true },
  { name: "reviewSnapshot", pattern: /^\/games\/([0-9]+)\/review\/snapshot$/, publicFrontierDoc: true },
  { name: "snapshot", pattern: /^\/games\/([0-9]+)\/snapshot$/, publicFrontierDoc: true },
] as const satisfies readonly HeraldRouteEntry[];

type HeraldRouteName = (typeof HERALD_GET_ROUTES)[number]["name"];

export const HERALD_PUBLIC_GET_ROUTES: readonly {
  readonly name: HeraldRouteName;
  readonly pattern: string | RegExp;
}[] = HERALD_GET_ROUTES.filter((route) => route.publicFrontierDoc).map(({ name, pattern }) => ({ name, pattern }));

interface MatchedHeraldRoute {
  readonly name: HeraldRouteName;
  readonly params: readonly string[];
}

export function matchHeraldGetRoute(pathname: string): MatchedHeraldRoute | null {
  for (const route of HERALD_GET_ROUTES) {
    if (typeof route.pattern === "string") {
      if (pathname === route.pattern) return { name: route.name, params: [] };
      continue;
    }
    const match = route.pattern.exec(pathname);
    if (match) return { name: route.name, params: match.slice(1) };
  }
  return null;
}
