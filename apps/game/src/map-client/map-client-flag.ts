import { IS_DEV_ENVIRONMENT } from "@/shell/frame/environment";

/**
 * Which renderer draws the world map: the game's current one, or the map client. A dev build opens the map with the
 * map client and a production build with the current renderer; an address can ask for either by name
 * (`?mapClient=next`, `?mapClient=current`), whatever the build.
 */
const MAP_CLIENTS = ["current", "next"] as const;
export type MapClient = (typeof MAP_CLIENTS)[number];

export const MAP_CLIENT_QUERY_PARAM = "mapClient";

/** The renderer an address asks for by name; none when it names none, or one that does not exist. */
export function mapClientAsked(search: string): MapClient | null {
  const asked = new URLSearchParams(search).get(MAP_CLIENT_QUERY_PARAM);
  return MAP_CLIENTS.find((client) => client === asked) ?? null;
}

/** The renderer that draws the world map for an address: the one it asks for, else the build's own. */
export function mapClientFor(search: string, devBuild: boolean = IS_DEV_ENVIRONMENT): MapClient {
  return mapClientAsked(search) ?? (devBuild ? "next" : "current");
}
