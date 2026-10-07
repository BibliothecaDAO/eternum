import { nativeTilePackingConstants } from "../../../contracts/l3/world-native/schema/client.gen";
import type { GameSyncScope } from "@bibliothecadao/eternum/game-sync-models";
import type { FoldSet } from "./types";

/** One tile of a realm's home ring as the chain's MapLogic.expedition_home_ring answers it. */
export interface HomeRingTile {
  col: number;
  row: number;
  biome: number;
}

/** Reads a realm's home ring for the day at `timestamp` from the chain's own rule. */
export type HomeRingView = (gameId: string, realmId: number, timestamp: number) => Promise<HomeRingTile[]>;

interface HomeRingInput {
  view: HomeRingView;
  /** The TileOpt row the chain writes when it reveals this tile, in the fold's own row shape. */
  rowOf: (gameId: string, tile: HomeRingTile) => FoldSet;
  /** A ring that was not cached has arrived; its rows reach the subscriptions whose scope holds them. */
  onReady: (gameId: string, rows: FoldSet[]) => void;
  log?: Pick<Console, "error">;
}

/**
 * A realm's home ring counts as explored from the day's first second. The chain materializes the whole ring when the
 * realm is raised or the ring is first used. Herald reads the same biome rule once per (game, realm, day) while someone
 * watches that realm. The derived ring stays beside the fold, and a chain-written row for the same key always wins.
 */
export class HomeRing {
  private readonly rings = new Map<string, FoldSet[]>();
  private readonly byKey = new Map<string, FoldSet>();
  private readonly fetching = new Set<string>();
  private readonly failed = new Map<string, { day: RingDay; timestamp: number }>();

  constructor(private readonly input: HomeRingInput) {}

  /** The cached ring rows of the scope's realms for its day; a ring not cached yet is fetched and published later. */
  public rows(gameId: string, scope: GameSyncScope, timestamp: number): FoldSet[] {
    const expedition = scope.expedition;
    if (!expedition || expedition.day < 0) return [];
    return [...expedition.realmTraits].flatMap((realm) => {
      const ring = ringKey(gameId, realm, expedition.day);
      const cached = this.rings.get(ring);
      if (cached) return cached;
      this.fetch(ring, { gameId, realmId: Number(realm), day: expedition.day }, timestamp);
      return [];
    });
  }

  /** The cached ring row at this key, if a ring holds it. */
  public row(key: string): FoldSet | undefined {
    return this.byKey.get(key);
  }

  /** Failed reads recover on the next head while their game still has a stream. */
  public retry(streamedGames: readonly string[]): void {
    const games = new Set(streamedGames);
    for (const [ring, { day, timestamp }] of this.failed) {
      if (games.has(day.gameId)) this.fetch(ring, day, timestamp);
      else this.failed.delete(ring);
    }
  }

  private fetch(ring: string, day: RingDay, timestamp: number): void {
    const { gameId, realmId } = day;
    if (this.fetching.has(ring)) return;
    this.fetching.add(ring);
    this.input
      .view(gameId, realmId, timestamp)
      .then((tiles) => {
        const rows = tiles.map((tile) => this.input.rowOf(gameId, tile));
        this.failed.delete(ring);
        this.forgetEarlierDays(day);
        this.rings.set(ring, rows);
        for (const row of rows) this.byKey.set(row.key, row);
        this.input.onReady(gameId, rows);
      })
      .catch((error: unknown) => {
        this.failed.set(ring, { day, timestamp });
        (this.input.log ?? console).error(
          JSON.stringify({
            event: "herald_home_ring_failed",
            gameId,
            realmId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      })
      .finally(() => this.fetching.delete(ring));
  }

  /** A realm's rings from before yesterday serve nobody: its armies can only act in today's region. */
  private forgetEarlierDays(day: RingDay): void {
    for (const [ring, rows] of this.rings) {
      const [gameId, realm, ringDay] = ring.split(":");
      if (gameId !== day.gameId || Number(realm) !== day.realmId || Number(ringDay) >= day.day - 1) continue;
      this.rings.delete(ring);
      for (const row of rows) this.byKey.delete(row.key);
    }
  }
}

interface RingDay {
  gameId: string;
  realmId: number;
  day: number;
}

const ringKey = (gameId: string, realm: string, day: number) => `${gameId}:${realm}:${day}`;

// Raised home-ring tiles have already consumed their reveal reward; occupancy is independent.
const BIOME_SCALE = BigInt(nativeTilePackingConstants.BIOME_SCALE);

/** The TileOpt terrain and consumed reward marker written when Settlement raises the ring. */
export const homeRingTileData = (tile: HomeRingTile): bigint =>
  BigInt(tile.biome) * BIOME_SCALE + BigInt(nativeTilePackingConstants.REWARD_EXTRACTED_FLAG);

/** Decodes expedition_home_ring's Span<(Coord, u8)>: a length, then (alt, x, y, biome) per tile. */
export const decodeHomeRing = (felts: readonly string[]): HomeRingTile[] => {
  const count = felts[0] === undefined ? undefined : Number(BigInt(felts[0]));
  // An empty or short view response is a failed read, never a ring of no tiles.
  if (count === undefined || felts.length !== 1 + count * 4) {
    throw new Error(`expedition_home_ring returned ${felts.length} felts, not a length and its tiles`);
  }
  return Array.from({ length: count }, (_, index) => {
    const [, x, y, biome] = felts.slice(1 + index * 4, 5 + index * 4).map((felt) => Number(BigInt(felt)));
    return { col: x!, row: y!, biome: biome! };
  });
};
