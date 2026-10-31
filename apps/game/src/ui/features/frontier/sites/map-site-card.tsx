import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import {
  HudButton,
  HudChip,
  HudCost,
  HudSheet,
  HudStamina,
  HudWindowFoot,
  type StaminaBar,
} from "@/ui/design-system/kit/hud-elements";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { costLine } from "@/ui/design-system/kit/price-faces";

import { exploresBought, MOVE, STAMINA, USE, USING } from "@/ui/design-system/kit/words";
import { ActionPaths, ActionType, configManager } from "@bibliothecadao/eternum";
import { safeInteger } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { formatShort, formatShortChange, skillPointName } from "@bibliothecadao/types";
import { type ReactNode, useMemo } from "react";

import { useOrderAt } from "../hud/army-order";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import { useApproachTile } from "./approach";
import { type MapSiteKind, mapSite, mapSiteKind, siteGain } from "./map-site-plan";
import { useSelectedOwnArmy } from "./selected-army";
import { inFlightWord } from "./site-card-view";
import { sendSiteUse, shrineRewardAt } from "./use-site";

const MAP_SITE_MODELS = ["ShrineReward", "ExplorerTroops", "TileOccupancy"] as const;

/** The map tile the player tapped, when a Shrine or Well stands on it. */
export const useSelectedMapSite = (): { kind: MapSiteKind; tile: TileSpatialRenderable } | null => {
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const hexes = useMemo(() => (selectedHex ? [selectedHex] : []), [selectedHex]);
  const [tile] = useWorldSpatialTiles(hexes);
  const kind = mapSiteKind(tile?.occupierType);
  return isMapView && tile && kind ? { kind, tile } : null;
};

/** The discovered reward and the selected army's Use or approach order. */
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
  const reward = shrineRewardAt(setup.store, siteTile);
  const plan = { kind: selected.kind, gain: siteGain(selected.kind, reward) };
  const usable = useArmyOffersUse(siteTile) && user !== null;
  const approach = useOrderAt(useApproachTile(siteTile, user !== null && !usable));
  const userId = user ? safeInteger(user.army.explorer_id) : null;
  const army = useUserArmy(userId ?? undefined);
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

  const { name: word, icon } = mapSite(plan.kind);
  const gain =
    plan.kind === "Well" ? (
      <HudChip icons={["stamina"]} label={STAMINA}>
        {formatShort(plan.gain, { signed: true })}
      </HudChip>
    ) : (
      <HudChip>{plan.gain === undefined ? "—" : skillPointName(plan.gain)}</HudChip>
    );
  return (
    <HudSheet label={word} onClose={onClose}>
      {army && <SiteUser army={army} kind={plan.kind} gain={plan.gain} />}
      <HudWindowFoot
        note={
          <SiteGain icon={icon}>
            {gain}
            {!usable && approach && (
              <HudCost
                line={costLine([
                  { of: "stamina", amount: approach.stamina.cost },
                  { of: "wheat", amount: approach.wheat.cost },
                ])}
              />
            )}
          </SiteGain>
        }
      >
        {usable ? (
          <HudButton kind="primary" busy={inFlightWord(inFlight, "use", USING)} onClick={use}>
            {USE}
          </HudButton>
        ) : (
          approach && (
            <HudButton kind="primary" icon="move" onClick={() => requestOrderAt(approach.target)}>
              {MOVE}
            </HudButton>
          )
        )}
      </HudWindowFoot>
    </HudSheet>
  );
};

/** What one use gives, beside its verb: the site's painting and the gain, and a Move's cost while the army is away. */
const SiteGain = ({ icon, children }: { icon: IconMeaning; children: ReactNode }) => (
  <span className="flex items-center gap-2">
    <SemanticIcon name={icon} size={32} />
    {children}
  </span>
);

/** Whether the selected army's orders offer Use at the site: the action planner's decision, the right-click's order. */
const useArmyOffersUse = (siteTile: { col: number; row: number }): boolean => {
  const path = useUIStore((state) => state.entityActions.actionPaths.get(ActionPaths.posKey(siteTile)));
  return path !== undefined && ActionPaths.getActionType(path) === ActionType.UseSite;
};

/** The selected army as the dock reads it: its art, name, stamina bar and XP. */
const useUserArmy = (explorerId: number | undefined): DockArmy | undefined => {
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
  return armies.find((candidate) => candidate.explorerId === explorerId);
};

/** The selected army, with a Well's resulting stamina. */
const SiteUser = ({ army, kind, gain }: { army: DockArmy; kind: MapSiteKind; gain: number | undefined }) => (
  <div data-site-user className="flex items-center gap-3">
    <SemanticIcon name={army.art} size={40} />
    <span className="text-hud-strong text-hud-ink">{army.label}</span>
    {kind === "Well" && <WellAfter stamina={army.stamina} gain={gain} />}
  </div>
);

/** The army's stamina bar once the Well's refill lands, never past its maximum, before → after, and the explores it buys. */
const WellAfter = ({ stamina, gain }: { stamina: StaminaBar | undefined; gain: number | undefined }) => {
  const after = stamina && gain !== undefined ? Math.min(stamina.max, stamina.current + gain) : undefined;
  const bought = exploresOf(gain, stamina);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2 tabular-nums text-hud-ink">
      <span className="min-w-8 flex-1">
        <HudStamina stamina={stamina && after !== undefined ? { ...stamina, current: after } : stamina} />
      </span>
      {formatShortChange(stamina?.current, after)}
      {bought && <HudChip icons={["explore"]}>{exploresBought(bought)}</HudChip>}
    </span>
  );
};

/** The whole explores a Well's refill buys the army: what lands under its maximum, a segment per explore. */
const exploresOf = (gain: number | undefined, stamina: StaminaBar | undefined): number | undefined => {
  if (gain === undefined || !stamina || stamina.perExplore <= 0) return undefined;
  const lands = Math.max(0, Math.min(gain, stamina.max - stamina.current));
  return Math.floor(lands / stamina.perExplore) || undefined;
};
