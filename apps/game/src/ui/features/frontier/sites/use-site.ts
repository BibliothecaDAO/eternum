import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { sendOnce } from "@/hooks/store/use-actions-in-flight";
import { toast } from "@/ui/features/event-feed/notify";
import { getExplorerStaminaSnapshot } from "@/utils/explorer-stamina";
import { configManager, getTileAt, isTileOccupierUsableSite } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import type { GameplayAccount, SystemCalls } from "@bibliothecadao/types";

import { type MapSiteKind, mapSiteKind, siteGain } from "./map-site-plan";

export const shrineRewardAt = (store: NativeFactStore, tile: SiteTile) => {
  const occupied = getTileAt(store, tile.alt, tile.col, tile.row);
  return (
    occupied && store.get("ShrineReward", { game_id: configManager.getActiveGameId(), entity_id: occupied.occupier_id })
  );
};

type SiteTile = { col: number; row: number; alt: boolean };

/** The usable site (a Shrine or a Well) on a contract tile, as an order names it; null where the tile holds none. */
export const usableSiteAt = (store: NativeFactStore, tile: SiteTile): { kind: MapSiteKind; tile: SiteTile } | null => {
  const occupier = getTileAt(store, tile.alt, tile.col, tile.row)?.occupier_type;
  const kind = occupier !== undefined && isTileOccupierUsableSite(occupier) ? mapSiteKind(occupier) : null;
  return kind ? { kind, tile } : null;
};
import { armWellRefill } from "./well-refill";

/**
 * What the hover says of a Use at this site: its kind, what one use gives, and the army's bar now, which a Well fills
 * no higher than its maximum.
 */
export const siteUseFacts = (
  store: NativeFactStore,
  site: { kind: MapSiteKind; tile: SiteTile },
  army: NativeRows["ExplorerTroops"] | undefined,
  timestamp: number,
) => {
  const snapshot = army && getExplorerStaminaSnapshot({ timestamp, liveTroops: resolveExplorerTroops(store, army) });
  return {
    kind: site.kind,
    gain: siteGain(site.kind, shrineRewardAt(store, site.tile)),
    stamina: snapshot ? { current: snapshot.current, max: snapshot.max } : undefined,
  };
};

/**
 * The army uses the site beside it where it stands (InteractSite), the one sender for the site card's Use and the
 * map's right-click: once per army in flight, and a Well arms its refill on the army's bar as the order leaves.
 */
export const sendSiteUse = async ({
  systemCalls,
  signer,
  explorerId,
  site,
}: {
  systemCalls: Pick<SystemCalls, "interact_site">;
  signer: GameplayAccount;
  explorerId: number;
  site: { kind: MapSiteKind; tile: SiteTile };
}): Promise<void> => {
  try {
    await sendOnce("army", explorerId, { order: "use" }, async () => {
      playUnitCommandSound("move");
      const sent = await systemCalls.interact_site({
        signer,
        explorer_id: explorerId,
        coord: { alt: site.tile.alt, x: site.tile.col, y: site.tile.row },
      });
      // Armed as the order leaves: the refill plays when the stamina rises, which is the order applying.
      if (site.kind === "Well") armWellRefill(explorerId);
      return sent;
    });
  } catch (error) {
    toast.failed(error, "The site could not be used.");
  }
};
