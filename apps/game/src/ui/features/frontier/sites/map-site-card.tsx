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
  HudTier,
  HudWindowFoot,
  type StaminaBar,
} from "@/ui/design-system/kit/hud-elements";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { costLine } from "@/ui/design-system/kit/price-faces";

import { exploresBought, MOVE, SHRINE, STAMINA, type Tier, USE, USING, WELL, XP } from "@/ui/design-system/kit/words";
import { ActionPaths, ActionType, configManager } from "@bibliothecadao/eternum";
import { safeInteger } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { formatShort, formatShortChange } from "@bibliothecadao/types";
import { type ReactNode, useMemo } from "react";

import { useOrderAt } from "../hud/army-order";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import type { XpGoal } from "../hud/army-token";
import { useApproachTile } from "./approach";
import { type MapSiteKind, mapSiteKind, siteGain } from "./map-site-plan";
import { useSelectedOwnArmy } from "./selected-army";
import { inFlightWord } from "./site-card-view";
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
 * A Shrine's or Well's card (the owner's pick B, 28 October 2026: "ok for B"): a row for the selected army as one use
 * will leave it (a Well's refill on its stamina bar, never past its maximum, with the explores it buys; a Shrine's XP
 * with the attribute tier it then buys), and a foot saying what the site gives, as its hover does, beside Use where the
 * army's orders offer it (the action planner's Use, the right-click's order), or Move and its cost until the army
 * stands beside it. With no army selected, what it gives alone: select an army, then the site (owner, 28 October 2026:
 * "agree with no picker"). The site is spent by that use, so the card closes as its tile empties.
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

  const word = plan.kind === "Shrine" ? SHRINE : WELL;
  const gain =
    plan.kind === "Well" ? (
      <HudChip icons={["stamina"]} label={STAMINA}>
        {formatShort(plan.gain, { signed: true })}
      </HudChip>
    ) : (
      <HudChip>
        {formatShort(plan.gain, { signed: true })} {XP}
      </HudChip>
    );
  return (
    <HudSheet label={word} onClose={onClose}>
      {army && <SiteUser army={army} kind={plan.kind} gain={plan.gain} />}
      <HudWindowFoot
        note={
          <SiteGain icon={plan.kind === "Shrine" ? "shrine" : "well"}>
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
const SiteGain = ({ icon, children }: { icon: "shrine" | "well"; children: ReactNode }) => (
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

/**
 * The army a use acts on, as it will stand after it: a Well's refill on its stamina bar, or a Shrine's XP with the
 * attribute tier it then buys.
 */
const SiteUser = ({ army, kind, gain }: { army: DockArmy; kind: MapSiteKind; gain: number | undefined }) => (
  <div data-site-user className="flex items-center gap-3">
    <SemanticIcon name={army.art} size={40} />
    <span className="text-hud-strong text-hud-ink">{army.label}</span>
    {kind === "Well" ? (
      <WellAfter stamina={army.stamina} gain={gain} />
    ) : (
      <ShrineAfter xp={army.xp} goal={army.xpGoal} gain={gain} />
    )}
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

/** The army's XP before and after the Shrine, and the attribute tier that XP then buys, when it buys one. */
const ShrineAfter = ({
  xp,
  goal,
  gain,
}: {
  xp: number | undefined;
  goal: XpGoal | undefined;
  gain: number | undefined;
}) => {
  const after = xp !== undefined && gain !== undefined ? xp + gain : undefined;
  return (
    <span className="ml-auto flex items-center gap-2 tabular-nums text-hud-ink">
      <HudChip>
        {formatShortChange(xp, after)} {XP}
      </HudChip>
      {goal && after !== undefined && after >= goal.price && <HudTier tier={goal.tier as Tier} />}
    </span>
  );
};

/** The whole explores a Well's refill buys the army: what lands under its maximum, a segment per explore. */
const exploresOf = (gain: number | undefined, stamina: StaminaBar | undefined): number | undefined => {
  if (gain === undefined || !stamina || stamina.perExplore <= 0) return undefined;
  const lands = Math.max(0, Math.min(gain, stamina.max - stamina.current));
  return Math.floor(lands / stamina.perExplore) || undefined;
};
