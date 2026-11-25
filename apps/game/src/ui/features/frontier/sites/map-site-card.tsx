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
import {
  exploresBought,
  MOVE,
  SITE_OATH,
  SITE_USE_WORDS,
  STAMINA,
  USE,
  USING,
  wellRefillShare,
} from "@/ui/design-system/kit/words";
import { ActionPaths, ActionType, armyOaths, configManager, journeyDistance, oathWellStamina } from "@bibliothecadao/eternum";
import { type NativeFactStore, nativeRuleConstants, safeInteger } from "@bibliothecadao/eternum/game-client";
import { gameSyncRegion, type TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { formatGain, formatShort, formatShortChange } from "@bibliothecadao/types";
import { type ReactNode, useMemo } from "react";

import { useFrontierRealm } from "../frontier-home";
import { useOrderAt } from "../hud/army-order";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import { useApproachTile } from "./approach";
import { type MapSiteKind, mapSite, mapSiteKind } from "./map-site-plan";
import { useSelectedOwnArmy } from "./selected-army";
import { inFlightWord } from "./site-card-view";
import { sendSiteUse } from "./use-site";

const MAP_SITE_MODELS = ["ExplorerTroops", "TileOccupancy", "ArmyProgress"] as const;

export const useSelectedMapSite = (): { kind: MapSiteKind; tile: TileSpatialRenderable } | null => {
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const hexes = useMemo(() => (selectedHex ? [selectedHex] : []), [selectedHex]);
  const [tile] = useWorldSpatialTiles(hexes);
  const kind = mapSiteKind(tile?.occupierType);
  return isMapView && tile && kind ? { kind, tile } : null;
};

type SiteTaker = { art: IconMeaning; label: string; tiles: number; nearest: boolean };

type SiteAction =
  | { kind: "refused"; line: string }
  | { kind: "use"; busy: string | undefined; onUse: () => void }
  | { kind: "move"; cost: string; onMove: () => void };

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
  const usable = useArmyOffersUse(siteTile) && user !== null;
  const approach = useOrderAt(useApproachTile(siteTile, user !== null && !usable));
  const userId = user ? safeInteger(user.army.explorer_id) : null;
  const armies = useDockArmies(useFrontierRealm());
  const army = armies.find((candidate) => candidate.explorerId === userId);
  const gain =
    selected.kind === "Well" && user && army?.stamina
      ? oathWellStamina(armyOaths(setup.store, user.army), army.stamina.max)
      : undefined;
  const inFlight = useInFlight("army", userId)?.order;
  const pickWaiting =
    userId !== null &&
    (setup.store.get("ArmyProgress", { game_id: configManager.getActiveGameId(), explorer_id: userId })?.oath_pick ?? 0) !== 0;

  const use = async () => {
    if (userId === null || !account.account) return;
    await sendSiteUse({
      systemCalls: setup.systemCalls,
      signer: account.account,
      explorerId: userId,
      site: { kind: selected.kind, tile: siteTile },
    });
  };
  const action: SiteAction | null = pickWaiting
    ? { kind: "refused", line: SITE_USE_WORDS.oathPickFirst }
    : usable
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
      taker={selected.kind === "Shrine" ? siteTaker(setup.store, armies, userId, siteTile) : undefined}
      action={action}
      onClose={onClose}
    />
  );
};

export const MapSiteCardView = ({
  kind,
  gain,
  army,
  taker,
  action,
  onClose,
}: {
  kind: MapSiteKind;
  gain: number | undefined;
  army: DockArmy | undefined;
  taker: SiteTaker | undefined;
  action: SiteAction | null;
  onClose: () => void;
}) => {
  const { name: word, icon } = mapSite(kind);
  return (
    <HudSheet label={word} onClose={onClose}>
      {kind === "Shrine" ? <ShrineBody taker={taker} /> : <WellBody army={army} gain={gain} />}
      {action?.kind === "refused" && (
        <p data-site-refused className="text-hud-label text-hud-warn">
          {action.line}
        </p>
      )}
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

const GainOf = ({ kind, gain }: { kind: MapSiteKind; gain: number | undefined }) =>
  kind === "Shrine" ? (
    <HudChip icons={["shrine"]}>{SITE_OATH.label}</HudChip>
  ) : (
    <HudChip icons={["stamina"]} label={STAMINA}>
      {gain === undefined
        ? wellRefillShare(nativeRuleConstants.WELL_REFILL_PERCENT)
        : formatShort(gain, { signed: true })}
    </HudChip>
  );

const SiteGain = ({ icon, children }: { icon: IconMeaning; children: ReactNode }) => (
  <span className="flex items-center gap-2">
    <SemanticIcon name={icon} size={32} />
    {children}
  </span>
);

const ShrineBody = ({ taker }: { taker: SiteTaker | undefined }) => (
  <div className="flex flex-col gap-1.5">
    {taker && (
      <div data-site-user className="flex items-center gap-2">
        <SemanticIcon name={taker.art} size={32} />
        <span className="min-w-0 flex-1 truncate">
          <span className="text-hud-strong text-hud-ink">{taker.label}</span>
          <span className="text-hud-label text-hud-muted"> · {SITE_USE_WORDS.armyAt(taker.tiles, taker.nearest)}</span>
        </span>
      </div>
    )}
    <span data-site-rule className="text-hud-label text-hud-muted">
      {SITE_USE_WORDS.shrineRule}
    </span>
  </div>
);

const siteTaker = (
  store: NativeFactStore,
  armies: readonly DockArmy[],
  selectedId: number | null,
  site: { col: number; row: number },
): SiteTaker | undefined => {
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
  return { art: taker.army.art, label: taker.army.label, tiles: taker.tiles, nearest: chosen === undefined };
};

const useArmyOffersUse = (siteTile: { col: number; row: number }): boolean => {
  const path = useUIStore((state) => state.entityActions.actionPaths.get(ActionPaths.posKey(siteTile)));
  return path !== undefined && ActionPaths.getActionType(path) === ActionType.UseSite;
};

const WellBody = ({ army, gain }: { army: DockArmy | undefined; gain: number | undefined }) => (
  <div className="flex flex-col gap-1.5">
    {army && <WellUser army={army} gain={gain} />}
    <span data-site-rule className="text-hud-label text-hud-muted">
      {wellRule(army?.stamina, gain)}
    </span>
  </div>
);

const wellRule = (stamina: StaminaBar | undefined, gain: number | undefined): string => {
  if (!stamina || gain === undefined)
    return SITE_USE_WORDS.wellShareRule(wellRefillShare(nativeRuleConstants.WELL_REFILL_PERCENT));
  const lands = Math.max(0, Math.min(gain, stamina.max - stamina.current));
  return lands === 0 ? SITE_USE_WORDS.wellFull : SITE_USE_WORDS.wellRule(formatGain(lands));
};

const WellUser = ({ army, gain }: { army: DockArmy; gain: number | undefined }) => (
  <div data-site-user className="flex items-center gap-3">
    <SemanticIcon name={army.art} size={40} />
    <span className="text-hud-strong text-hud-ink">{army.label}</span>
    <WellAfter stamina={army.stamina} gain={gain} />
  </div>
);

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

const exploresOf = (gain: number | undefined, stamina: StaminaBar | undefined): number | undefined => {
  if (gain === undefined || !stamina || stamina.perExplore <= 0) return undefined;
  const lands = Math.max(0, Math.min(gain, stamina.max - stamina.current));
  return Math.floor(lands / stamina.perExplore) || undefined;
};
