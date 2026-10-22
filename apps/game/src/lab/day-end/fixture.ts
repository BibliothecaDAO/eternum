import { BiomeType } from "@bibliothecadao/types";

import type { DayDoneCard } from "@/ui/features/frontier/rollover/day-done-card";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { TerrainPageRequest } from "@/three/terrain/terrain-types";

import { createEndgameFixture, type EndgameLabSettings } from "../endgame-mist/fixture";

/**
 * The day-end lab's world: the endgame lab's land, its two dormant spires and the player's realm in the middle, which
 * the mist spares as the realm is kept. A Frontier day's veil is the game end's own, played from the same spires.
 */
export const DAY_END_VEIL: EndgameLabSettings = { busy: false, spires: "awaken", spared: "realm" };

/** The ended day's card, with the figures of the owner's screenshot of today's card: 12 h left, tomorrow 20 h. */
export const dayEndSummary = (now: number, onContinue: () => void): Parameters<typeof DayDoneCard>[0] => ({
  endedDay: 1,
  clock: { endsAt: now + 12 * 3_600, secondsLeft: 12 * 3_600, tomorrowSeconds: 20 * 3_600, tone: "calm" },
  totals: { reveals: 17, cleared: 2, chests: 0, essence: 969, labor: 2_027, lords: 0 },
  armies: 0,
  troopsLost: 0,
  onContinue,
});

/** The new day's land round the realm before dawn, and the ring the dawn brings out of the shroud. */
const KNOWN_AT_NIGHT = 1.2;
const KNOWN_AT_DAWN = 3.2;

/** A new land every day: the next day's biomes, laid out differently round the same realm. */
const NEW_DAY_BIOMES = [
  BiomeType.Taiga,
  BiomeType.Shrubland,
  BiomeType.Grassland,
  BiomeType.TemperateRainForest,
  BiomeType.Snow,
  BiomeType.TemperateDeciduousForest,
];

export function createDayEndLand() {
  const fixture = createEndgameFixture(DAY_END_VEIL);
  const newDay = (known: number, key: string): TerrainPageRequest => ({
    ...fixture.request,
    pageKey: `day-end-${key}`,
    cells: fixture.request.cells.map((cell) => {
      const near = hexesApart(cell, fixture.realm) <= known;
      const biome =
        cell.col === fixture.realm.col && cell.row === fixture.realm.row
          ? BiomeType.Grassland
          : NEW_DAY_BIOMES[(Math.floor(cell.row / 3) + Math.floor(cell.col / 4) * 5) % NEW_DAY_BIOMES.length];
      // An unexplored hex has no biome yet, only the one the shroud previews.
      return { ...cell, biome: near ? biome : null, previewBiome: biome, explored: near };
    }),
  });
  const dawn = newDay(KNOWN_AT_DAWN, "dawn");
  const night = newDay(KNOWN_AT_NIGHT, "night");
  const revealed = dawn.cells.filter(
    (cell) =>
      cell.explored && !night.cells.some((dark) => dark.col === cell.col && dark.row === cell.row && dark.explored),
  );
  return {
    realm: fixture.realm,
    today: fixture.request,
    night,
    dawn,
    /** Nearest first, so the shroud lifts outward from the realm. */
    revealed: revealed.toSorted((a, b) => hexesApart(a, fixture.realm) - hexesApart(b, fixture.realm)),
  };
}

/** A hex's width in world units, between two neighbours on a row. */
const HEX_ACROSS = terrainHexToWorld(1, 0).x - terrainHexToWorld(0, 0).x;

/** Distance in hexes, measured between the hexes' world positions. */
function hexesApart(a: { col: number; row: number }, b: { col: number; row: number }): number {
  const p = terrainHexToWorld(a.col, a.row);
  const q = terrainHexToWorld(b.col, b.row);
  return Math.hypot(p.x - q.x, p.z - q.z) / HEX_ACROSS;
}
