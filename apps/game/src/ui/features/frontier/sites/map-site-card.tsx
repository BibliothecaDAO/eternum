import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { HudButton, HudChip, HudCost, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { costLine } from "@/ui/design-system/kit/price-faces";

import { MOVE, SHRINE, STAMINA, TROOPS, USE, USING, WELL, XP } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { configManager } from "@bibliothecadao/eternum";
import { safeInteger } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { RESOURCE_PRECISION, formatAmount, formatExact } from "@bibliothecadao/types";
import { useMemo } from "react";

import { useOrderAt } from "../hud/army-order";
import { armyArt, useDockArmies } from "../hud/dock-armies";
import { useApproachTile } from "./approach";
import { type MapSiteKind, mapSiteKind, readMapSite } from "./map-site-plan";
import { useSelectedOwnArmy } from "./selected-army";
import { inFlightWord, SiteMark } from "./site-card-view";
import { armWellRefill } from "./well-refill";

const MAP_SITE_MODELS = ["ArmyProgress", "ArmyProgressionRules", "ExplorerTroops", "TileOccupancy"] as const;

/** The map tile the player tapped, when a Shrine or Well stands on it. */
export const useSelectedMapSite = (): { kind: MapSiteKind; tile: TileSpatialRenderable } | null => {
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const hexes = useMemo(() => (selectedHex ? [selectedHex] : []), [selectedHex]);
  const [tile] = useWorldSpatialTiles(hexes);
  const kind = mapSiteKind(tile?.occupierType);
  return isMapView && tile && kind ? { kind, tile } : null;
};

/**
 * A Shrine's or Well's card (wireframe 06): the army beside it and what one use gives it (a Well's stamina before and
 * after, never above the army's own maximum; a Shrine's XP), then Use, or Move until the army stands beside it. The
 * site is spent by that use, so the card closes as its tile empties.
 */
export const MapSiteCard = ({
  selected,
  onClose,
}: {
  selected: { kind: MapSiteKind; tile: TileSpatialRenderable };
  onClose: () => void;
}) => {
  const { setup, account } = useGame();
  const user = useSelectedOwnArmy();
  useNativeRevision(MAP_SITE_MODELS);
  const siteTile = selected.tile.hexCoords;
  const progress =
    user &&
    setup.store.get("ArmyProgress", { game_id: configManager.getActiveGameId(), explorer_id: user.army.explorer_id });
  const rules = setup.store.get("ArmyProgressionRules", { game_id: configManager.getActiveGameId() });
  const plan = readMapSite(selected.kind, siteTile, user && { ...user, progress: progress ?? undefined }, rules);
  const approach = useOrderAt(useApproachTile(siteTile, user !== null && !plan.usable));
  const userId = user ? safeInteger(user.army.explorer_id) : null;
  const stamina = useUserStamina(userId ?? undefined);
  const inFlight = useInFlight("army", userId)?.order;

  const use = async () => {
    if (userId === null || !user || !account.account) return;
    const signer = account.account;
    try {
      await sendOnce("army", userId, { order: "use" }, async () => {
        playUnitCommandSound("move");
        const sent = await setup.systemCalls.interact_site({
          signer,
          explorer_id: user.army.explorer_id,
          coord: { alt: siteTile.alt, x: siteTile.col, y: siteTile.row },
        });
        // Armed as the order leaves: the refill plays when the stamina rises, which is the order applying.
        if (plan.kind === "Well") armWellRefill(userId);
        return sent;
      });
    } catch (error) {
      toast.failed(error, "The site could not be used.");
    }
  };

  const word = plan.kind === "Shrine" ? SHRINE : WELL;
  return (
    <HudSheet label={word} onClose={onClose}>
      <SiteMark icon={plan.kind === "Shrine" ? "shrine" : "well"} />
      <div className="flex items-center justify-center gap-2.5">
        {user && (
          <HudChip icons={[armyArt(user.army.troops)]} label={TROOPS}>
            {formatExact(Number(user.army.troops.count / BigInt(RESOURCE_PRECISION)))}
          </HudChip>
        )}
        {plan.kind === "Well" ? (
          <HudChip icons={["stamina"]} label={STAMINA}>
            {wellGain(plan.gain, stamina)}
          </HudChip>
        ) : (
          <HudChip>
            {plan.gain === undefined ? "—" : `+${formatAmount(plan.gain)}`} {XP}
          </HudChip>
        )}
      </div>
      {plan.usable ? (
        <HudButton kind="primary" busy={inFlightWord(inFlight, "use", USING)} onClick={use}>
          {USE}
        </HudButton>
      ) : (
        approach && (
          <>
            <HudButton kind="primary" icon="move" onClick={() => requestOrderAt(approach.target)}>
              {MOVE}
            </HudButton>
            <HudCost
              line={costLine([
                { of: "stamina", amount: approach.stamina.cost },
                { of: "wheat", amount: approach.wheat.cost },
              ])}
            />
          </>
        )
      )}
    </HudSheet>
  );
};

/** The selected army's stamina and its own maximum, from the dock's reading of it. */
const useUserStamina = (explorerId: number | undefined) => {
  const { setup } = useGame();
  const army =
    explorerId === undefined
      ? undefined
      : setup.store.get("ExplorerTroops", {
          game_id: configManager.getActiveGameId(),
          explorer_id: explorerId,
        });
  const home = army && setup.store.get("Structure", { game_id: army.game_id, entity_id: army.owner });
  const armies = useDockArmies(home ?? null);
  return armies.find((candidate) => candidate.explorerId === explorerId)?.stamina;
};

/** A Well's stamina: the army's bar before and after the refill, or what it adds when no army stands at it. */
const wellGain = (gain: number | undefined, stamina: { current: number; max: number } | undefined): string => {
  if (gain === undefined) return "—";
  return stamina
    ? `${formatAmount(stamina.current)} → ${formatAmount(Math.min(stamina.max, stamina.current + gain))}`
    : `+${formatAmount(gain)}`;
};
