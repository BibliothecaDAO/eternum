import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { sendOnce } from "@/hooks/store/use-actions-in-flight";
import { getExplorerStaminaSnapshot } from "@/lib/army-stamina/source-resolution";
import { SITE_USE_WORDS } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { armyOaths, getTileAt, isTileOccupierUsableSite, oathWellStamina } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import type { GameplayAccount, SystemCalls } from "@bibliothecadao/types";

import { type MapSiteKind, mapSiteKind } from "./map-site-plan";
import { armWellRefill } from "./well-refill";

type SiteTile = { col: number; row: number; alt: boolean };

export const usableSiteAt = (store: NativeFactStore, tile: SiteTile): { kind: MapSiteKind; tile: SiteTile } | null => {
  const occupier = getTileAt(store, tile.alt, tile.col, tile.row)?.occupier_type;
  const kind = occupier !== undefined && isTileOccupierUsableSite(occupier) ? mapSiteKind(occupier) : null;
  return kind ? { kind, tile } : null;
};

export const siteUseFacts = (
  store: NativeFactStore,
  site: { kind: MapSiteKind; tile: SiteTile },
  army: NativeRows["ExplorerTroops"] | undefined,
  timestamp: number,
) => {
  const snapshot =
    army && getExplorerStaminaSnapshot({ timestamp, liveTroops: resolveExplorerTroops(store, army, timestamp) });
  return {
    kind: site.kind,
    gain: site.kind === "Well" && army && snapshot ? oathWellStamina(armyOaths(store, army), snapshot.max) : undefined,
    stamina: snapshot ? { current: snapshot.current, max: snapshot.max } : undefined,
  };
};

const siteUseRefusal = (error: unknown): string =>
  String(error instanceof Error ? error.message : error).includes("not a shrine or well")
    ? SITE_USE_WORDS.alreadyUsed
    : SITE_USE_WORDS.failed;

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
      if (site.kind === "Well") armWellRefill(explorerId);
      return sent;
    });
  } catch (error) {
    toast.failed(error, siteUseRefusal(error));
  }
};
