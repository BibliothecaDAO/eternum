import { expect, it } from "vitest";

import { MAP_SITES, type MapSite } from "@/config/map-sites";
import { mapSite } from "@/ui/features/frontier/sites/map-site-plan";
import { messageWords, placeMetadata, placeOf, type SharedPlace } from "./place";

const GAME = { chainId: "0x1ab", gameId: 3, name: "Frontier 3" };
const MOONDEEP = { kind: "structure", entityId: 4242, game: GAME, name: "Moondeep", icon: "ruin", at: 1_000 } as const;
const ARMY = { kind: "army", entityId: 77, game: GAME, name: "Iron Wardens", icon: "knight-t2", at: 1_000 } as const;
const siteAt = (site: MapSite): SharedPlace => ({
  kind: "site",
  site: site.kind,
  tile: { col: 4, row: 9, alt: true },
  game: GAME,
  name: mapSite(site.kind).name,
  icon: mapSite(site.kind).icon,
  at: 1_000,
});

it("reads back each kind of place a message was sent with, its game with it", () => {
  for (const place of [MOONDEEP, ARMY, ...MAP_SITES.map(siteAt)]) expect(placeOf(placeMetadata(place))).toEqual(place);
});

it("reads a game's chain id in one case", () => {
  expect(placeOf({ place: { ...MOONDEEP, game: { ...GAME, chainId: "0x1AB" } } })?.game.chainId).toBe("0x1ab");
});

it("reads no place from a message that carries none, or a place that is not one", () => {
  const well = siteAt(MAP_SITES[0]);
  expect(placeOf(undefined)).toBeNull();
  expect(placeOf({ replyTo: { id: "m1" } })).toBeNull();
  expect(placeOf({ place: { ...MOONDEEP, kind: "tile" } })).toBeNull();
  expect(placeOf({ place: { ...MOONDEEP, icon: "not-an-icon" } })).toBeNull();
  expect(placeOf({ place: { ...MOONDEEP, entityId: "4242" } })).toBeNull();
  // A place names its game, by a chain id and a game id.
  expect(placeOf({ place: { ...MOONDEEP, game: undefined } })).toBeNull();
  expect(placeOf({ place: { ...MOONDEEP, game: { ...GAME, chainId: "frontier" } } })).toBeNull();
  expect(placeOf({ place: { ...MOONDEEP, game: { ...GAME, gameId: "3" } } })).toBeNull();
  // A site is one the map knows, on a tile with its layer.
  expect(placeOf({ place: { ...well, site: "Spring" } })).toBeNull();
  expect(placeOf({ place: { ...well, tile: { col: 4, row: 9 } } })).toBeNull();
});

it("writes a message with its place after its words as the chat names it, and a place sent alone as that name", () => {
  expect(messageWords("meet me at", "Moondeep", "Moondeep")).toBe("meet me at Moondeep");
  expect(messageWords("Moondeep", "Moondeep", "Moondeep")).toBe("Moondeep");
  // Sent as "Isolde's Realm", named by the map as Temtinos: the words stand, the place reads as the map names it.
  expect(messageWords("come home", "Isolde's Realm", "Temtinos")).toBe("come home Temtinos");
  expect(messageWords("Isolde's Realm", "Isolde's Realm", "Temtinos")).toBe("Temtinos");
  expect(messageWords("no place", null, null)).toBe("no place");
});
