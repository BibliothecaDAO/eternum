import { inFlight, sendOnce } from "@/hooks/store/use-actions-in-flight";
import { requireActiveGameClient } from "@/sync/active-game-client";
import type { BuildingType, HexPosition } from "@bibliothecadao/types";

/** A realm's plot as the building in flight on it is keyed. */
export const plotKey = (realmId: number, plot: HexPosition): string => `${realmId}:${plot.col},${plot.row}`;

/** Whether a building of ours is on its way to the plot: sent from any surface, its outcome not known yet. */
export const isPlotInFlight = (realmId: number, plot: HexPosition): boolean =>
  inFlight("plot", plotKey(realmId, plot)) !== undefined;

/**
 * Sends a building to a realm's plot, the one way every surface does (the build menu, a plot's sheet, the realm view, a
 * quick build from the Build order or Next up). The plot stays in flight until the game has applied the building and it
 * stands in the store, or the game refused it: a second press sends nothing, and a quick build never chooses a plot whose
 * building is still on its way. Resolves with the transaction once applied, null when the plot already had a building in
 * flight; rejects with the game's reason. `onSent` runs once the transaction is sent (a sheet closes, a sound plays).
 */
export const sendBuilding = ({
  realmId,
  type,
  plot,
  useSimpleCost,
  onSent,
}: {
  realmId: number;
  type: BuildingType;
  plot: HexPosition;
  useSimpleCost: boolean;
  onSent?: () => void;
}): Promise<string | null> =>
  sendOnce("plot", plotKey(realmId, plot), { type, plot: { col: plot.col, row: plot.row } }, async () => {
    const sent = await requireActiveGameClient().actions.placeBuilding({
      structureId: realmId,
      buildingType: type,
      hex: plot,
      useSimpleCost,
    });
    onSent?.();
    return sent;
  });
