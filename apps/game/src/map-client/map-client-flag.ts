/**
 * Which renderer draws the world map: today's, or the map client under trial. The trial is asked for by the page's
 * address (`?mapClient=next`) and by nothing else, so a player who never types it never meets it.
 */
const MAP_CLIENTS = ["today", "next"] as const;
export type MapClient = (typeof MAP_CLIENTS)[number];

export const MAP_CLIENT_QUERY_PARAM = "mapClient";

export function resolveMapClientFromSearch(search: string): MapClient {
  const asked = new URLSearchParams(search).get(MAP_CLIENT_QUERY_PARAM);
  return MAP_CLIENTS.find((client) => client === asked) ?? "today";
}

/** Opens the page again without the trial: the same address as today's client draws it. */
export function openWithoutMapClient(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(MAP_CLIENT_QUERY_PARAM);
  window.location.replace(url.toString());
}
