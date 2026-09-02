import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { type AppStore, useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSlicesStore, type WorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { gameEntityKey } from "@/sync/game-scope";
import { activeGameRows, allRows } from "@/sync/recs-rows";
import type { PlayerRelicsData } from "@/types";
import { readBlitzSettlementPlayerAddresses } from "@/services/blitz/blitz-settlement-players";
import { resolveFiniteSeasonEndAt, resolveSeasonStartTimestamp } from "@/ui/features/world/utils/season-timing";
import { DEV_MODE_ENABLED } from "@/utils/dev-mode";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import {
  ClientConfigManager,
  DEFAULT_COORD_ALT,
  formatArmies,
  formatArrivals,
  formatGuilds,
  getAddressName,
  getGuildFromPlayerAddress,
  getInternalAddressName,
  getStructure,
  ResourceManager,
  summarizeIncomingTroopArrivals,
} from "@bibliothecadao/eternum";
import type { GameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import {
  type ClientComponents,
  ContractAddress,
  EntityType,
  type Player,
  ResourcesIds,
  type Structure,
} from "@bibliothecadao/types";
import { type Component, getComponentEntities, getComponentValue } from "@dojoengine/recs";
import { shortString } from "starknet";
import { env } from "../../env";

type Slice =
  | "arrivals"
  | "armies"
  | "buildings"
  | "faith"
  | "guilds"
  | "hyperstructures"
  | "leaderboard"
  | "mine"
  | "players"
  | "resources"
  | "settlement"
  | "structures";

interface RecsStoreBridgeInput {
  components: ClientComponents;
  runtime: GameSyncRuntime;
}

const NO_ACCOUNT = "0x0";

/** `?dev` mirror: how often the bridge derived, and which trigger asked for it. */
export interface RecsStoreBridgeMetrics {
  derives: number;
  sliceTriggers: number;
  storeTriggers: number;
  accountTriggers: number;
}

interface BridgeMetricsWindow {
  __eternumBridgeMetrics?: RecsStoreBridgeMetrics;
}

const publishBridgeMetrics = (metrics: RecsStoreBridgeMetrics): void => {
  if (!DEV_MODE_ENABLED || typeof window === "undefined") return;
  (window as typeof window & BridgeMetricsWindow).__eternumBridgeMetrics = { ...metrics };
};

const readPlayers = (components: ClientComponents): Player[] =>
  [...getComponentEntities(components.AddressName as Component)].flatMap((entity) => {
    const addressName = getComponentValue(components.AddressName, entity);
    if (!addressName) return [];
    const name =
      getInternalAddressName(addressName.address.toString()) ??
      shortString.decodeShortString(addressName.name.toString());
    return [{ address: addressName.address, entity, name }];
  });

const readGuilds = (components: ClientComponents, account: string) =>
  formatGuilds(
    [...getComponentEntities(components.Guild as Component)].filter((entity) => {
      const guild = getComponentValue(components.Guild, entity);
      return guild !== undefined && Number(guild.member_count) !== 0;
    }),
    ContractAddress(account),
    components,
  );

const readBuildings = (components: ClientComponents) =>
  allRows(components.Building).map((building) => ({
    innerCol: Number(building.inner_col ?? 0),
    innerRow: Number(building.inner_row ?? 0),
    outerEntityId: Number(building.outer_entity_id ?? 0),
  }));

// Explicit spectator sessions are pure observers: no owned structures means no ownership chrome anywhere.
const readPlayerStructures = (components: ClientComponents, account: string): Structure[] => {
  if (account === NO_ACCOUNT || isExplicitSpectateSession()) return [];
  const owner = BigInt(account);
  return [...getComponentEntities(components.Structure as Component)]
    .flatMap((entity) => {
      const structure = getComponentValue(components.Structure, entity);
      if (!structure || structure.owner !== owner) return [];
      const info = getStructure(entity, ContractAddress(account), components);
      return info ? [info] : [];
    })
    .toSorted(
      (left, right) =>
        (left.structure?.base?.category ?? 0) - (right.structure?.base?.category ?? 0) ||
        Number(left.entityId ?? 0) - Number(right.entityId ?? 0),
    );
};

const readSelectableArmies = (components: ClientComponents, account: string) =>
  formatArmies([...getComponentEntities(components.ExplorerTroops as Component)], ContractAddress(account), components)
    .filter((army) => army.isMine)
    .map((army) => ({ entityId: army.entityId }));

const readRelics = (
  components: ClientComponents,
  playerStructures: Structure[],
  armyIds: number[],
): PlayerRelicsData => {
  const relicsOf = (entityId: number) => {
    const resource = getComponentValue(components.Resource, gameEntityKey([BigInt(entityId)]));
    if (!resource) return [];
    return ResourceManager.getResourceBalances(resource).filter(
      ({ resourceId }) => resourceId >= ResourcesIds.StaminaRelic1 && resourceId <= ResourcesIds.TroopProductionRelic2,
    );
  };
  return {
    structures: playerStructures.flatMap((structure) => {
      const relics = relicsOf(structure.entityId);
      return relics.length === 0
        ? []
        : [
            {
              entityId: structure.entityId,
              position: { alt: DEFAULT_COORD_ALT, x: structure.position.x, y: structure.position.y },
              relics,
              structureType: structure.structure.base.category,
              type: EntityType.STRUCTURE,
            },
          ];
    }),
    armies: armyIds.flatMap((entityId) => {
      const relics = relicsOf(entityId);
      const army = getComponentValue(components.ExplorerTroops, gameEntityKey([BigInt(entityId)]));
      return relics.length === 0 || !army
        ? []
        : [
            {
              entityId,
              position: { alt: army.coord.alt, x: army.coord.x, y: army.coord.y },
              relics,
              type: EntityType.ARMY,
            },
          ];
    }),
  };
};

const readSeasonWinner = (components: ClientComponents, seasonEnded: WorldSlicesStore["seasonEnded"]) => {
  if (!seasonEnded) return null;
  const address = ContractAddress(seasonEnded.winnerAddress);
  return {
    address,
    guildName: getGuildFromPlayerAddress(address, components)?.name ?? "Unknown",
    name: getAddressName(address, components) ?? "Unknown",
  };
};

/** Per-game clock and dev-mode gates, read once from the scoped config manager. */
const publishSeasonClock = (): void => {
  const config = ClientConfigManager.instance();
  const season = config.getSeasonConfig();
  useUIStore.setState({
    devModeOn: Boolean(config.getDevModeConfig().dev_mode_on),
    gameEndAt: resolveFiniteSeasonEndAt(season.endAt || undefined),
    gameStartMainAt: resolveSeasonStartTimestamp(season.startMainAt || undefined),
  });
};

/**
 * The one RECS → store bridge. RECS update streams only mark slices dirty; the runtime's slice-applied hook is the
 * chokepoint where dirty slices are derived once and published in one store write each, so the overlay re-renders at
 * most once per ingest slice however many rows the slice carried. Account, selection and relic-refresh changes flush
 * immediately because nothing else would.
 */
export const installRecsStoreBridge = ({ components, runtime }: RecsStoreBridgeInput): (() => void) => {
  const dirty = new Set<Slice>();
  const metrics: RecsStoreBridgeMetrics = { accountTriggers: 0, derives: 0, sliceTriggers: 0, storeTriggers: 0 };
  let seasonEnded: WorldSlicesStore["seasonEnded"] = null;
  const account = () => useAccountStore.getState().account?.address ?? NO_ACCOUNT;

  const sources: Array<[Component, Slice[]]> = [
    [components.AddressName as Component, ["players", "faith", "mine"]],
    [components.Guild as Component, ["guilds"]],
    [components.GuildMember as Component, ["guilds"]],
    [components.Structure as Component, ["structures", "mine"]],
    [components.Building as Component, ["buildings"]],
    [components.Hyperstructure as Component, ["hyperstructures", "leaderboard"]],
    [components.HyperstructureShareholders as Component, ["leaderboard"]],
    [components.PlayerRank as Component, ["leaderboard"]],
    [components.PlayerRegisteredPoints as Component, ["leaderboard"]],
    [components.PlayersRankTrial as Component, ["leaderboard"]],
    [components.GameRegistry as Component, ["leaderboard"]],
    [components.Resource as Component, ["resources"]],
    [components.ExplorerTroops as Component, ["armies"]],
    [components.BlitzSettlement as Component, ["settlement"]],
    [components.ResourceArrival as Component, ["arrivals"]],
    [components.WonderFaith as Component, ["faith"]],
    [components.FaithfulStructure as Component, ["faith"]],
  ];

  const flush = (): void => {
    if (dirty.size === 0) return;
    metrics.derives += 1;
    publishBridgeMetrics(metrics);
    const pending = new Set(dirty);
    dirty.clear();
    const address = account();
    const slices: Partial<WorldSlicesStore> = {};
    const ui: Partial<AppStore> = {};

    if (pending.has("players")) slices.players = readPlayers(components);
    if (pending.has("guilds")) slices.guilds = readGuilds(components, address);
    if (pending.has("structures")) slices.structures = activeGameRows(components.Structure);
    if (pending.has("buildings")) slices.buildings = readBuildings(components);
    if (pending.has("hyperstructures")) slices.hyperstructures = allRows(components.Hyperstructure);
    if (pending.has("leaderboard")) slices.leaderboardRevision = useWorldSlicesStore.getState().leaderboardRevision + 1;
    if (pending.has("resources")) slices.resourcesRevision = useWorldSlicesStore.getState().resourcesRevision + 1;
    if (pending.has("armies")) slices.armiesRevision = useWorldSlicesStore.getState().armiesRevision + 1;
    if (pending.has("settlement")) {
      slices.blitzSettlementPlayers = readBlitzSettlementPlayerAddresses(components, [
        ...getComponentEntities(components.BlitzSettlement as Component),
      ]);
    }
    if (pending.has("arrivals")) {
      slices.resourceArrivals = formatArrivals(allRows(components.ResourceArrival));
      ui.publicIncomingTroopArrivalsByStructure = summarizeIncomingTroopArrivals(
        slices.resourceArrivals,
        useChainTimeStore.getState().getNowSeconds(),
      );
    }
    if (pending.has("faith")) {
      slices.addressNames = allRows(components.AddressName);
      slices.wonderFaith = activeGameRows(components.WonderFaith);
      slices.faithfulStructures = activeGameRows(components.FaithfulStructure);
    }
    if (pending.has("mine") || pending.has("armies") || pending.has("resources")) {
      const playerStructures =
        pending.has("mine") || !useUIStore.getState().playerStructures.length
          ? readPlayerStructures(components, address)
          : useUIStore.getState().playerStructures;
      const selectableArmies =
        pending.has("mine") || pending.has("armies")
          ? readSelectableArmies(components, address)
          : useUIStore.getState().selectableArmies;
      if (pending.has("mine")) ui.playerStructures = playerStructures;
      if (pending.has("mine") || pending.has("armies")) ui.selectableArmies = selectableArmies;
      ui.playerRelics =
        address === NO_ACCOUNT
          ? null
          : readRelics(
              components,
              playerStructures,
              selectableArmies.map((army) => army.entityId),
            );
      ui.playerRelicsLoading = false;
      const { structureEntityId } = useUIStore.getState();
      ui.disableButtons =
        !playerStructures.some((structure) => structure.entityId === structureEntityId) ||
        address === NO_ACCOUNT ||
        env.VITE_PUBLIC_SEASON_START_TIME >= Date.now() / 1000;
    }
    if (seasonEnded && useWorldSlicesStore.getState().seasonEnded !== seasonEnded) {
      slices.seasonEnded = seasonEnded;
      ui.gameWinner = readSeasonWinner(components, seasonEnded);
    }

    if (Object.keys(slices).length > 0) useWorldSlicesStore.setState(slices);
    if (Object.keys(ui).length > 0) useUIStore.setState(ui);
  };

  const markDirty = (...affected: Slice[]) => affected.forEach((slice) => dirty.add(slice));
  const subscriptions = sources.map(([component, affected]) =>
    component.update$.subscribe(() => markDirty(...affected)),
  );
  // Event rows are written then removed in the same step; the set carries the winner.
  subscriptions.push(
    (components.events.SeasonEnded as Component).update$.subscribe(({ value: [current] }) => {
      if (!current) return;
      seasonEnded = { timestamp: Number(current.timestamp), winnerAddress: BigInt(current.winner_address as bigint) };
      markDirty("players");
    }),
  );
  const unsubscribeSlices = runtime.subscribeSliceApplied(() => {
    metrics.sliceTriggers += 1;
    flush();
  });
  const unsubscribeAccount = useAccountStore.subscribe((state, previous) => {
    if (state.account?.address === previous.account?.address) return;
    metrics.accountTriggers += 1;
    markDirty("mine", "guilds", "armies");
    flush();
  });
  // Selection and relic refreshes are the only store writes that change a derived fact; nothing else flushes here.
  const unsubscribeUi = useUIStore.subscribe((state, previous) => {
    const selectionChanged = state.structureEntityId !== previous.structureEntityId;
    const relicsRefreshed = state.relicsRefreshNonce !== previous.relicsRefreshNonce;
    if (!selectionChanged && !relicsRefreshed) return;
    metrics.storeTriggers += 1;
    if (selectionChanged) markDirty("mine");
    if (relicsRefreshed) markDirty("resources");
    flush();
  });

  publishSeasonClock();
  markDirty(...sources.flatMap(([, affected]) => affected));
  flush();

  return () => {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    unsubscribeSlices();
    unsubscribeAccount();
    unsubscribeUi();
  };
};
