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
 * A realm's home ring counts as explored from the day's first second by rule, but the chain writes a ring tile only when
 * a command first uses it. Herald shows connected players the ring the chain's own biome rule gives, read lazily through
 * one view call per (game, realm, day) while someone watches that realm, and kept beside the fold: the fold stays
 * chain facts only, and a chain-written row for the same key always wins.
 */
export class HomeRing {
  private readonly rings = new Map<string, FoldSet[]>();
  private readonly byKey = new Map<string, FoldSet>();
  private readonly fetching = new Set<string>();

  constructor(private readonly input: HomeRingInput) {}

  /** The cached ring rows of the scope's realms for its day; a ring not cached yet is fetched and published later. */
  public rows(gameId: string, scope: GameSyncScope, timestamp: number): FoldSet[] {
    const expedition = scope.expedition;
    if (!expedition || expedition.epoch < 0) return [];
    return [...expedition.realmTraits].flatMap((realm) => {
      const ring = ringKey(gameId, realm, expedition.epoch);
      const cached = this.rings.get(ring);
      if (cached) return cached;
      this.fetch(ring, { gameId, realmId: Number(realm), epoch: expedition.epoch }, timestamp);
      return [];
    });
  }

  /** The cached ring row at this key, if a ring holds it. */
  public row(key: string): FoldSet | undefined {
    return this.byKey.get(key);
  }

  private fetch(ring: string, day: RingDay, timestamp: number): void {
    const { gameId, realmId } = day;
    if (this.fetching.has(ring)) return;
    this.fetching.add(ring);
    this.input
      .view(gameId, realmId, timestamp)
      .then((tiles) => {
        const rows = tiles.map((tile) => this.input.rowOf(gameId, tile));
        this.forgetEarlierDays(day);
        this.rings.set(ring, rows);
        for (const row of rows) this.byKey.set(row.key, row);
        this.input.onReady(gameId, rows);
      })
      .catch((error: unknown) =>
        // The next scope build asks again; a missing ring only delays the explored ground, never the stream.
        (this.input.log ?? console).error(
          JSON.stringify({
            event: "herald_home_ring_failed",
            gameId,
            realmId,
            error: error instanceof Error ? error.message : String(error),
          }),
        ),
      )
      .finally(() => this.fetching.delete(ring));
  }

  /** A realm's rings from before yesterday serve nobody: its armies can only act in today's region. */
  private forgetEarlierDays(day: RingDay): void {
    for (const [ring, rows] of this.rings) {
      const [gameId, realm, epoch] = ring.split(":");
      if (gameId !== day.gameId || Number(realm) !== day.realmId || Number(epoch) >= day.epoch - 1) continue;
      this.rings.delete(ring);
      for (const row of rows) this.byKey.delete(row.key);
    }
  }
}

interface RingDay {
  gameId: string;
  realmId: number;
  epoch: number;
}

const ringKey = (gameId: string, realm: string, epoch: number) => `${gameId}:${realm}:${epoch}`;

// MapState::reveal writes only terrain; the row key carries coordinates and occupancy is independent.
const BIOME_SCALE = 0x20000000000n;

/** The terrain-only TileOpt data written when the chain reveals this tile. */
export const revealedTileData = (tile: HomeRingTile): bigint => BigInt(tile.biome) * BIOME_SCALE;

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
