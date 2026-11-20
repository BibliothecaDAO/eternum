import { inFlight, sendOnce } from "@/hooks/store/use-actions-in-flight";
import { requireActiveGameClient } from "@/sync/active-game-client";
import type { BuildingType, HexPosition } from "@bibliothecadao/types";
import { useEffect, useRef } from "react";

/** A realm's plot as the building in flight on it is keyed. */
export const plotKey = (realmId: number, plot: HexPosition): string => `${realmId}:${plot.col},${plot.row}`;

/** Whether a building of ours is on its way to the plot: sent from any surface, its outcome not known yet. */
export const isPlotInFlight = (realmId: number, plot: HexPosition): boolean =>
  inFlight("plot", plotKey(realmId, plot)) !== undefined;

/**
 * The surface a building was sent from, closed once the transaction is sent while it is still the one open: an answer
 * that arrives after the player opened another plot never closes that one.
 */
interface SentFrom {
  isOpen: () => boolean;
  close: () => void;
}

/**
 * Whether a surface still shows the plot it sent a building to: until it shows another plot or closes. Its answer is a
 * surface's `SentFrom.isOpen`.
 */
export const useStillShowing = (plot: HexPosition): (() => boolean) => {
  const shown = useRef<HexPosition | null>(null);
  const { col, row } = plot;
  useEffect(() => {
    shown.current = { col, row };
    return () => {
      shown.current = null;
    };
  }, [col, row]);
  return () => shown.current?.col === col && shown.current?.row === row;
};

/**
 * Sends a building to a realm's plot, the one way every surface does (the build menu, a plot's sheet, the realm view, a
 * quick build from the Build order or Next up). The plot stays in flight until the game has applied the building and it
 * stands in the store, or the game refused it: a second press sends nothing, and a quick build never chooses a plot whose
 * building is still on its way. Resolves with the transaction once applied, null when the plot already had a building in
 * flight; rejects with the game's reason. `from`, the surface that sent it, closes once the transaction is sent.
 */
export const sendBuilding = ({
  realmId,
  type,
  plot,
  useSimpleCost,
  from,
}: {
  realmId: number;
  type: BuildingType;
  plot: HexPosition;
  useSimpleCost: boolean;
  from?: SentFrom;
}): Promise<string | null> =>
  sendOnce("plot", plotKey(realmId, plot), { type, plot: { col: plot.col, row: plot.row } }, async () => {
    const sent = await requireActiveGameClient().actions.placeBuilding({
      structureId: realmId,
      buildingType: type,
      hex: plot,
      useSimpleCost,
    });
    if (from?.isOpen()) from.close();
    return sent;
  });
