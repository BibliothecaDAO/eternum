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

import { useFrontierRealm } from "../frontier-home";
import { useOrderAt } from "../hud/army-order";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import type { XpGoal } from "../hud/army-token";
import { useApproachTile } from "./approach";
import { type MapSiteKind, mapSiteKind, siteGain } from "./map-site-plan";
import { pickArmyFor, useSelectedOwnArmy } from "./selected-army";
import { ArmyChoices, inFlightWord } from "./site-card-view";
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
 * planner's Use, the right-click's order), or Move until the army stands beside it. With no army selected, the realm's
 * armies to pick, as every site's card offers them. The site is spent by that use, so the card closes as its tile
 * empties.
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
  const choices = useUseChoices(siteTile, user === null);

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
      {choices && <ArmyChoices does="use" choices={choices} />}
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

/** With no army selected, the realm's armies to pick for the site; none to offer without a realm (a spectator). */
const useUseChoices = (siteTile: { col: number; row: number }, wanted: boolean) => {
  const realm = useFrontierRealm();
  const armies = useDockArmies(realm);
  if (!wanted || !realm) return undefined;
  return armies.map((army) => ({
    label: army.label,
    art: army.art,
    troops: army.troops,
    fight: undefined,
    onPick: () => pickArmyFor(army.explorerId, siteTile),
  }));
};

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
  <div className="flex items-center gap-3">
    <SemanticIcon name={army.art} size={40} />
    <span className="text-hud-strong text-hud-ink">{army.label}</span>
    {kind === "Well" ? (
      <WellAfter stamina={army.stamina} gain={gain} />
    ) : (
      <ShrineAfter xp={army.xp} goal={army.xpGoal} gain={gain} />
    )}
  </div>
);

/** The army's stamina bar once the Well's refill lands, never past its maximum, and the explores the refill buys. */
const WellAfter = ({ stamina, gain }: { stamina: StaminaBar | undefined; gain: number | undefined }) => {
  const after =
    stamina && gain !== undefined ? { ...stamina, current: Math.min(stamina.max, stamina.current + gain) } : stamina;
  const bought = exploresOf(gain, stamina);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2 tabular-nums text-hud-ink">
      <span className="min-w-8 flex-1">
        <HudStamina stamina={after} />
      </span>
      {wellGain(gain, stamina)}
      {bought && <HudChip icons={["explore"]}>{exploresBought(bought)}</HudChip>}
    </span>
  );
};

/** The army's XP before and after the Shrine, and the attribute tier it then buys, lit when it can. */
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
      {goal && (
        <span
          data-affordable={after !== undefined && after >= goal.price ? "" : undefined}
          className="opacity-40 data-[affordable]:opacity-100"
        >
          <HudTier tier={goal.tier as Tier} />
        </span>
      )}
    </span>
  );
};

/** The whole explores a Well's refill buys the army: what lands under its maximum, a segment per explore. */
const exploresOf = (gain: number | undefined, stamina: StaminaBar | undefined): number | undefined => {
  if (gain === undefined || !stamina || stamina.perExplore <= 0) return undefined;
  const lands = Math.max(0, Math.min(gain, stamina.max - stamina.current));
  return Math.floor(lands / stamina.perExplore) || undefined;
};

/** A Well's stamina: the army's bar before and after the refill, or what it adds when no army stands at it. */
const wellGain = (gain: number | undefined, stamina: { current: number; max: number } | undefined): string => {
  if (gain === undefined) return "—";
  return stamina
    ? formatShortChange(stamina.current, Math.min(stamina.max, stamina.current + gain))
    : formatShort(gain, { signed: true });
};
