import { gameEntityKey } from "@/dojo/game-scope";
import { DEFAULT_COORD_ALT, Position, tileOptToTile } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import type { Tile, TileOpt } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import type { Entity } from "@dojoengine/recs";
import { useMemo } from "react";

const NO_TILE_ENTITY = "0x0" as Entity;

/**
 * Live tile read for a hex. A one-shot `getTileAt` inside a `useMemo` goes
 * stale the moment the TileOpt row changes after selection (chest spawns,
 * exploration, repair fetches); subscribing to the RECS row re-renders the
 * consumer when the data lands.
 *
 * Accepts either normalized or contract coordinates (Position auto-detects).
 */
export function useTileAt(col: number | undefined, row: number | undefined): Tile | undefined {
  const {
    setup: { components },
  } = useDojo();

  const tileEntity = useMemo(() => {
    if (col === undefined || row === undefined) return NO_TILE_ENTITY;
    const contract = new Position({ x: col, y: row }).getContract();
    return gameEntityKey([BigInt(DEFAULT_COORD_ALT ? 1 : 0), BigInt(contract.x), BigInt(contract.y)]);
  }, [col, row]);

  const tileOpt = useComponentValue(components.TileOpt, tileEntity);

  return useMemo(() => (tileOpt ? tileOptToTile(tileOpt as unknown as TileOpt) : undefined), [tileOpt]);
}
