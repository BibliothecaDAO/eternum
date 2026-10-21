import { getActiveGameStore } from "@/sync/active-game-client";
import { accountAddress, useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { readBlitzSettlementPlayerAddresses } from "@/services/blitz/blitz-settlement-players";
import { getPlayerDisplayName, readPlayerProfile } from "@/services/identity/player-profiles";
import { resolveFiniteSeasonEndAt, resolveSeasonStartTimestamp } from "@/ui/features/world/utils/season-timing";
import {
  ClientConfigManager,
  configManager,
  formatArmies,
  formatArrivals,
  formatGuilds,
  readStructures,
  summarizeIncomingTroopArrivals,
} from "@bibliothecadao/eternum";
import {
  safeInteger,
  type NativeFactStore,
  type NativeModelName,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { ContractAddress, type Player, type Structure } from "@bibliothecadao/types";

/**
 * What the client shows of the native store, derived on read and never copied into another store. Each view names
 * the fact models it reads, so React re-reads it through `useFactView` and scenes through `watchFactView` exactly
 * when one of those facts, or the signed-in account, changes.
 */
export interface FactView<T> {
  models: readonly NativeModelName[];
  /** `viewer` is the signed-in player, null for a spectator (see accountAddress). */
  read: (store: NativeFactStore, viewer: ContractAddress | null) => T;
}

interface ViewReading {
  store: NativeFactStore;
  viewer: ContractAddress | null;
  revision: number;
  value: unknown;
}

const lastReadings = new WeakMap<FactView<unknown>, ViewReading>();

/**
 * One derivation per store revision and viewer, shared by every surface reading the view. The reading is keyed by the
 * store's own revision, so it can never disagree with the facts it was derived from.
 */
export const readFactView = <T>(store: NativeFactStore, view: FactView<T>, viewer = accountAddress()): T => {
  const revision = store.getRevision();
  const last = lastReadings.get(view);
  if (last?.store === store && last.viewer === viewer && last.revision === revision) return last.value as T;
  const value = view.read(store, viewer);
  lastReadings.set(view, { store, viewer, revision, value });
  return value;
};

/** Calls `onChange` with the view's new value after every change to its facts or to the signed-in account. */
export const watchFactView = <T>(
  store: NativeFactStore,
  view: FactView<T>,
  onChange: (value: T) => void,
): (() => void) => {
  const publish = () => onChange(readFactView(store, view));
  const stopFacts = store.subscribe((changes) => {
    if (changes.some((change) => view.models.includes(change.model))) publish();
  });
  const stopAccount = useAccountStore.subscribe((state, previous) => {
    if (state.account?.address !== previous.account?.address) publish();
  });
  return () => {
    stopFacts();
    stopAccount();
  };
};

const activeGameId = () => configManager.getActiveGameId();

/** Herald's scope for this player has applied: every fact of their own (their structures, their entry) is in the store. */
export const playerScopeApplied = (store: NativeFactStore, viewer: bigint): boolean => {
  const scope = store.subscriptionScope().known;
  return scope?.actor !== undefined && BigInt(scope.actor) === viewer;
};

const readPlayerStructures = (store: NativeFactStore, viewer: ContractAddress | null): Structure[] =>
  viewer === null ? [] : readStructures(store, viewer, viewer, getPlayerDisplayName);

const readSelectableArmies = (store: NativeFactStore, viewer: ContractAddress | null) =>
  formatArmies(store.inGame("ExplorerTroops", activeGameId()), viewer, store, getPlayerDisplayName)
    .filter((army) => army.isMine)
    .map((army) => ({ entityId: army.entityId }));

const readSeasonClock = () => {
  const config = ClientConfigManager.instance();
  const season = config.getSeasonConfig();
  return {
    devModeOn: Boolean(config.getDevModeConfig().dev_mode_on),
    gameEndAt: resolveFiniteSeasonEndAt(season.endAt || undefined),
    gameStartMainAt: resolveSeasonStartTimestamp(season.startMainAt || undefined),
  };
};

const PLAYER_STRUCTURE_FACTS = ["Structure", "StructureBuildings", "TileOccupancy"] as const;
export const RESOURCE_FACTS = ["ResourceBalance", "ResourceProduction", "ResourceWeight", "ProductionBonus"] as const;

export const playerStructuresView: FactView<Structure[]> = {
  models: PLAYER_STRUCTURE_FACTS,
  read: readPlayerStructures,
};

/** The signed-in player's structures in the game this client plays; none before a game boots. */
export const readActivePlayerStructures = (): Structure[] => {
  const store = getActiveGameStore();
  return store ? readFactView(store, playerStructuresView) : [];
};

export const selectableArmiesView: FactView<Array<{ entityId: number }>> = {
  models: ["ExplorerTroops", "Structure", "TileOccupancy", "ResourceWeight", "EntityName"],
  read: readSelectableArmies,
};

export const guildsView: FactView<ReturnType<typeof formatGuilds>> = {
  models: ["Guild", "GuildMember"],
  read: (store, viewer) =>
    formatGuilds(store.inGame("Guild", activeGameId()), viewer, store).filter((guild) => guild.memberCount > 0),
};

const inActiveGame =
  <Model extends NativeModelName>(model: Model) =>
  (store: NativeFactStore): NativeRows[Model][] => [...store.inGame(model, activeGameId())];

export const gameStructuresView: FactView<NativeRows["Structure"][]> = {
  models: ["Structure"],
  read: inActiveGame("Structure"),
};

export const buildingTilesView: FactView<Array<{ innerCol: number; innerRow: number; structureId: number }>> = {
  models: ["Building"],
  read: (store) =>
    inActiveGame("Building")(store).map((building) => ({
      innerCol: building.inner_col,
      innerRow: building.inner_row,
      structureId: safeInteger(building.structure_id),
    })),
};

export const resourceArrivalsView: FactView<ReturnType<typeof formatArrivals>> = {
  models: ["ResourceArrival"],
  read: (store) => formatArrivals(inActiveGame("ResourceArrival")(store)),
};

/** Troops on their way to each structure, public to every viewer; the clock is read when the arrivals change. */
export const incomingTroopArrivalsView: FactView<ReturnType<typeof summarizeIncomingTroopArrivals>> = {
  models: ["ResourceArrival"],
  read: (store) =>
    summarizeIncomingTroopArrivals(
      resourceArrivalsView.read(store, null),
      useChainTimeStore.getState().getNowSeconds(),
    ),
};

export const settlementPlayersView: FactView<bigint[]> = {
  models: ["PlayerEntry"],
  read: readBlitzSettlementPlayerAddresses,
};

export const faithFactsView: FactView<{
  structures: NativeRows["Structure"][];
  wonderFaith: NativeRows["WonderFaith"][];
  faithfulStructures: NativeRows["FaithfulStructure"][];
}> = {
  models: ["Structure", "WonderFaith", "FaithfulStructure"],
  read: (store) => ({
    structures: inActiveGame("Structure")(store),
    wonderFaith: inActiveGame("WonderFaith")(store),
    faithfulStructures: inActiveGame("FaithfulStructure")(store),
  }),
};

/** The game's clock and dev-mode gate, as its registry row states them. */
export const seasonClockView: FactView<ReturnType<typeof readSeasonClock>> = {
  models: ["GameRegistry"],
  read: readSeasonClock,
};

/** The game's registered players, one row per registration, each named by the one player resolver. */
export const readPlayers = (store: NativeFactStore): Player[] =>
  [...store.entries("PlayerEntry")]
    .filter(([, row]) => row.game_id === activeGameId())
    .map(([entity, { owner }]) => ({ address: owner, entity, ...readPlayerProfile(owner) }));
