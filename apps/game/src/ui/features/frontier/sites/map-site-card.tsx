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
  HudRanked,
  HudSheet,
  HudStamina,
  HudTier,
  HudWindowFoot,
  type StaminaBar,
} from "@/ui/design-system/kit/hud-elements";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { costLine } from "@/ui/design-system/kit/price-faces";

import {
  exploresBought,
  MOVE,
  type Rank,
  shrineArmyAt,
  shrinePointUse,
  skillPointGain,
  STAMINA,
  tierNumeral,
  USE,
  USING,
  wellRefillShare,
} from "@/ui/design-system/kit/words";
import {
  ActionPaths,
  ActionType,
  configManager,
  heldSkillPoints,
  journeyDistance,
  skillPointRefill,
  type SkillPointRank,
} from "@bibliothecadao/eternum";
import { type NativeFactStore, safeInteger } from "@bibliothecadao/eternum/game-client";
import { WELL_REFILL_PERCENT } from "@bibliothecadao/eternum/troop-stamina";
import { gameSyncRegion, type TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { formatExact, formatShort, formatShortChange } from "@bibliothecadao/types";
import { type ReactNode, useMemo } from "react";

import { useFrontierRealm } from "../frontier-home";
import { useOrderAt } from "../hud/army-order";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import { useApproachTile } from "./approach";
import { type MapSiteKind, mapSite, mapSiteKind, siteGain } from "./map-site-plan";
import { useSelectedOwnArmy } from "./selected-army";
import { inFlightWord } from "./site-card-view";
import { sendSiteUse, shrineRewardAt } from "./use-site";

const MAP_SITE_MODELS = ["ShrineReward", "ExplorerTroops", "TileOccupancy", "ArmyProgress"] as const;

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
 * The army a Shrine's card speaks of (owner, 3 November 2026: "ok for D"): its painting and name, how far it stands, and
 * what it holds of the Shrine's rank, which the point raises by one.
 */
type ShrineTaker = {
  art: IconMeaning;
  label: string;
  tiles: number;
  /** It is the player's nearest army, no army being selected. */
  nearest: boolean;
  /** The points of the Shrine's rank it holds; unknown while its progress is. */
  held: number | undefined;
};

/** What one use does, as the card shows it: Use where the selected army is offered it, else its Move with the cost. */
type SiteAction =
  | { kind: "use"; busy: string | undefined; onUse: () => void }
  | { kind: "move"; cost: string; onMove: () => void };

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
  const usable = useArmyOffersUse(siteTile) && user !== null;
  const approach = useOrderAt(useApproachTile(siteTile, user !== null && !usable));
  const userId = user ? safeInteger(user.army.explorer_id) : null;
  const armies = useDockArmies(useFrontierRealm());
  const army = armies.find((candidate) => candidate.explorerId === userId);
  const gain = siteGain(selected.kind, reward, army?.stamina);
  const inFlight = useInFlight("army", userId)?.order;

  const use = async () => {
    if (userId === null || !account.account) return;
    await sendSiteUse({
      systemCalls: setup.systemCalls,
      signer: account.account,
      explorerId: userId,
      site: { kind: selected.kind, tile: siteTile },
    });
  };
  const action: SiteAction | null = usable
    ? { kind: "use", busy: inFlightWord(inFlight, "use", USING), onUse: use }
    : approach
      ? {
          kind: "move",
          cost: costLine([
            { of: "stamina", amount: approach.stamina.cost },
            { of: "wheat", amount: approach.wheat.cost },
          ]),
          onMove: () => requestOrderAt(approach.target),
        }
      : null;
  return (
    <MapSiteCardView
      kind={selected.kind}
      gain={gain}
      army={army}
      taker={
        selected.kind === "Shrine" && gain !== undefined
          ? shrineTaker(setup.store, armies, userId, siteTile, gain)
          : undefined
      }
      action={action}
      onClose={onClose}
    />
  );
};

/**
 * A Shrine or Well's card: for a Shrine, the army that would take its point and what the point does; for a Well, the
 * selected army's bar after its refill; then what one use gives, beside the site's painting, and Use or Move.
 */
export const MapSiteCardView = ({
  kind,
  gain,
  army,
  taker,
  action,
  onClose,
}: {
  kind: MapSiteKind;
  /** A Shrine's point's rank; a Well's refill for the selected army. */
  gain: number | undefined;
  /** The selected army, as the dock reads it. */
  army: DockArmy | undefined;
  taker: ShrineTaker | undefined;
  action: SiteAction | null;
  onClose: () => void;
}) => {
  const { name: word, icon } = mapSite(kind);
  return (
    <HudSheet label={word} onClose={onClose}>
      {kind === "Shrine"
        ? gain !== undefined && <ShrineBody rank={gain as SkillPointRank} taker={taker} />
        : army && <WellUser army={army} gain={gain} />}
      <HudWindowFoot
        note={
          <SiteGain icon={icon}>
            <GainOf kind={kind} gain={gain} />
            {action?.kind === "move" && <HudCost line={action.cost} />}
          </SiteGain>
        }
      >
        {action?.kind === "use" && (
          <HudButton kind="primary" busy={action.busy} onClick={action.onUse}>
            {USE}
          </HudButton>
        )}
        {action?.kind === "move" && (
          <HudButton kind="primary" icon="move" onClick={action.onMove}>
            {MOVE}
          </HudButton>
        )}
      </HudWindowFoot>
    </HudSheet>
  );
};

/** What one use gives: a Shrine's point as its gem and +1 (owner: "I like B"), a Well's refill on the stamina chip. */
const GainOf = ({ kind, gain }: { kind: MapSiteKind; gain: number | undefined }) => {
  if (kind === "Shrine")
    return gain === undefined ? <HudChip>—</HudChip> : <HudRanked words={skillPointGain(gain)} gem="lg" />;
  return (
    <HudChip icons={["stamina"]} label={STAMINA}>
      {gain === undefined ? wellRefillShare(WELL_REFILL_PERCENT) : formatShort(gain, { signed: true })}
    </HudChip>
  );
};

/** What one use gives, beside its verb: the site's painting and the gain, and a Move's cost while the army is away. */
const SiteGain = ({ icon, children }: { icon: IconMeaning; children: ReactNode }) => (
  <span className="flex items-center gap-2">
    <SemanticIcon name={icon} size={32} />
    {children}
  </span>
);

/**
 * A Shrine's body, compact: on one line the army that would take the point, where it stands and its points of this rank
 * before → after; under it what the point does once spent.
 */
const ShrineBody = ({ rank, taker }: { rank: SkillPointRank; taker: ShrineTaker | undefined }) => (
  <div className="flex flex-col gap-1.5">
    {taker && (
      <div data-site-user className="flex items-center gap-2">
        <SemanticIcon name={taker.art} size={32} />
        <span className="min-w-0 flex-1 truncate">
          <span className="text-hud-strong text-hud-ink">{taker.label}</span>
          <span className="text-hud-label text-hud-muted"> · {shrineArmyAt(taker.tiles, taker.nearest)}</span>
        </span>
        {taker.held !== undefined && <PointsAfter rank={rank} held={taker.held} />}
      </div>
    )}
    <span data-site-rule className="text-hud-label text-hud-muted">
      <HudRanked words={shrinePointUse(rank, formatExact(skillPointRefill(rank)))} />
    </span>
  </div>
);

/** What the army holds of a rank, before → after it takes the point: "[III] 1 → 2". */
const PointsAfter = ({ rank, held }: { rank: SkillPointRank; held: number }) => (
  <span
    className="flex shrink-0 items-center gap-1 tabular-nums text-hud-ink"
    role="img"
    aria-label={`${tierNumeral(rank as Rank)} points ${formatShortChange(held, held + 1)}`}
  >
    <HudTier tier={rank as Rank} />
    {formatShortChange(held, held + 1)}
  </span>
);

/**
 * The army a Shrine's card speaks of: the selected one, else the player's nearest, among their armies in the Shrine's
 * region, the only ones that can reach it (interact_site asserts the same region), with how far it stands as the chain
 * counts tiles and the points of the Shrine's rank it holds.
 */
const shrineTaker = (
  store: NativeFactStore,
  armies: readonly DockArmy[],
  selectedId: number | null,
  site: { col: number; row: number },
  rank: number,
): ShrineTaker | undefined => {
  const gameId = configManager.getActiveGameId();
  const { spacing } = store.require("SettlementRules", { game_id: gameId });
  const region = gameSyncRegion({ alt: false, x: site.col, y: site.row }, Number(spacing));
  const placed = armies.flatMap((army) => {
    const at = store.entityOccupancy(gameId, army.explorerId);
    if (!at || gameSyncRegion({ alt: at.alt, x: at.col, y: at.row }, Number(spacing)) !== region) return [];
    return [{ army, tiles: journeyDistance({ x: at.col, y: at.row }, { x: site.col, y: site.row }) }];
  });
  const chosen = placed.find(({ army }) => army.explorerId === selectedId);
  const taker = chosen ?? [...placed].sort((a, b) => a.tiles - b.tiles)[0];
  if (!taker) return undefined;
  const progress = store.get("ArmyProgress", { game_id: gameId, explorer_id: taker.army.explorerId });
  return {
    art: taker.army.art,
    label: taker.army.label,
    tiles: taker.tiles,
    nearest: chosen === undefined,
    held: progress ? heldSkillPoints(progress)[rank - 1] : undefined,
  };
};

/** Whether the selected army's orders offer Use at the site: the action planner's decision, the right-click's order. */
const useArmyOffersUse = (siteTile: { col: number; row: number }): boolean => {
  const path = useUIStore((state) => state.entityActions.actionPaths.get(ActionPaths.posKey(siteTile)));
  return path !== undefined && ActionPaths.getActionType(path) === ActionType.UseSite;
};

/** The selected army at a Well: its painting and name, and its bar once the refill lands. */
const WellUser = ({ army, gain }: { army: DockArmy; gain: number | undefined }) => (
  <div data-site-user className="flex items-center gap-3">
    <SemanticIcon name={army.art} size={40} />
    <span className="text-hud-strong text-hud-ink">{army.label}</span>
    <WellAfter stamina={army.stamina} gain={gain} />
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
