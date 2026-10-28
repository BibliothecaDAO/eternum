import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { HudButton, HudChip, HudCost, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { costLine } from "@/ui/design-system/kit/price-faces";

import { MOVE, SHRINE, STAMINA, TROOPS, USE, USING, WELL, XP } from "@/ui/design-system/kit/words";
import { ActionPaths, ActionType, configManager } from "@bibliothecadao/eternum";
import { safeInteger } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { RESOURCE_PRECISION, formatShort, formatShortChange } from "@bibliothecadao/types";
import { useMemo } from "react";

import { useOrderAt } from "../hud/army-order";
import { armyArt, useDockArmies } from "../hud/dock-armies";
import { useApproachTile } from "./approach";
import { type MapSiteKind, mapSiteKind, siteGain } from "./map-site-plan";
import { useSelectedOwnArmy } from "./selected-army";
import { inFlightWord, SiteMark } from "./site-card-view";
import { sendSiteUse } from "./use-site";

const MAP_SITE_MODELS = ["ArmyProgressionRules", "ExplorerTroops", "TileOccupancy"] as const;

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
 * after, never above the army's own maximum; a Shrine's XP), then Use where the army's orders offer it (the action
 * planner's Use, the right-click's order), or Move until the army stands beside it. With no army selected, what it
 * gives alone: select an army, then the site (owner, 28 October 2026: "agree with no picker"). The site is spent by that
 * use, so the card closes as its tile empties.
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
  const rules = setup.store.get("ArmyProgressionRules", { game_id: configManager.getActiveGameId() });
  const plan = { kind: selected.kind, gain: siteGain(selected.kind, rules) };
  const usable = useArmyOffersUse(siteTile) && user !== null;
  const approach = useOrderAt(useApproachTile(siteTile, user !== null && !usable));
  const userId = user ? safeInteger(user.army.explorer_id) : null;
  const stamina = useUserStamina(userId ?? undefined);
  const inFlight = useInFlight("army", userId)?.order;

  const use = async () => {
    if (userId === null || !account.account) return;
    await sendSiteUse({
      systemCalls: setup.systemCalls,
      signer: account.account,
      explorerId: userId,
      site: { kind: plan.kind, tile: siteTile },
    });
  };

  const word = plan.kind === "Shrine" ? SHRINE : WELL;
  return (
    <HudSheet label={word} onClose={onClose}>
      <SiteMark icon={plan.kind === "Shrine" ? "shrine" : "well"} />
      <div className="flex items-center justify-center gap-2.5">
        {user && (
          <HudChip icons={[armyArt(user.army.troops)]} label={TROOPS}>
            {formatShort(Number(user.army.troops.count / BigInt(RESOURCE_PRECISION)))}
          </HudChip>
        )}
        {plan.kind === "Well" ? (
          <HudChip icons={["stamina"]} label={STAMINA}>
            {wellGain(plan.gain, stamina)}
          </HudChip>
        ) : (
          <HudChip>
            {formatShort(plan.gain, { signed: true })} {XP}
          </HudChip>
        )}
      </div>
      {usable ? (
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

/** Whether the selected army's orders offer Use at the site: the action planner's decision, the right-click's order. */
const useArmyOffersUse = (siteTile: { col: number; row: number }): boolean => {
  const path = useUIStore((state) => state.entityActions.actionPaths.get(ActionPaths.posKey(siteTile)));
  return path !== undefined && ActionPaths.getActionType(path) === ActionType.UseSite;
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
    ? formatShortChange(stamina.current, Math.min(stamina.max, stamina.current + gain))
    : formatShort(gain, { signed: true });
};
