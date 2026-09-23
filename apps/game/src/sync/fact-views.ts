import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { getActiveGameStore } from "@/sync/active-game-client";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import type { PlayerRelicsData } from "@/types";
import { readBlitzSettlementPlayerAddresses } from "@/services/blitz/blitz-settlement-players";
import { identityProfiles } from "@/services/identity/player-profiles";
import { resolveFiniteSeasonEndAt, resolveSeasonStartTimestamp } from "@/ui/features/world/utils/season-timing";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import {
  ClientConfigManager,
  configManager,
  formatArmies,
  formatArrivals,
  formatGuilds,
  getAddressName,
  readStructures,
  ResourceManager,
  summarizeIncomingTroopArrivals,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeModelName, NativeRows } from "@bibliothecadao/eternum/game-client";
import { ContractAddress, EntityType, type Player, ResourcesIds, type Structure } from "@bibliothecadao/types";
import { type IdentityProfile, profileOfIdentityUser } from "@realms-world/identity";

/**
 * What the client shows of the native store, derived on read and never copied into another store. Each view names
 * the fact models it reads, so React re-reads it through `useFactView` and scenes through `watchFactView` exactly
 * when one of those facts, or the signed-in account, changes.
 */
export interface FactView<T> {
  models: readonly NativeModelName[];
  read: (store: NativeFactStore, account: string) => T;
}

export const NO_ACCOUNT = "0x0";

const currentAccount = (): string => useAccountStore.getState().account?.address ?? NO_ACCOUNT;

interface ViewReading {
  store: NativeFactStore;
  account: string;
  spectating: boolean;
  revision: number;
  value: unknown;
}

const lastReadings = new WeakMap<FactView<unknown>, ViewReading>();

/**
 * One derivation per store revision and viewer, shared by every surface reading the view. The reading is keyed by the
 * store's own revision, so it can never disagree with the facts it was derived from.
 */
export const readFactView = <T>(store: NativeFactStore, view: FactView<T>, account = currentAccount()): T => {
  const spectating = isExplicitSpectateSession();
  const revision = store.getRevision();
  const last = lastReadings.get(view);
  if (last?.store === store && last.account === account && last.spectating === spectating && last.revision === revision)
    return last.value as T;
  const value = view.read(store, account);
  lastReadings.set(view, { store, account, spectating, revision, value });
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

const readPlayerStructures = (store: NativeFactStore, account: string): Structure[] => {
  if (account === NO_ACCOUNT || isExplicitSpectateSession()) return [];
  const owner = ContractAddress(account);
  return readStructures(store, owner, owner);
};

const readSelectableArmies = (store: NativeFactStore, account: string) =>
  formatArmies(store.inGame("ExplorerTroops", activeGameId()), ContractAddress(account), store)
    .filter((army) => army.isMine)
    .map((army) => ({ entityId: army.entityId }));

const RELIC_RESOURCES = { first: ResourcesIds.StaminaRelic1, last: ResourcesIds.TroopProductionRelic2 };

const readRelicsOf = (store: NativeFactStore, entityId: number) =>
  new ResourceManager(store, entityId)
    .balances()
    .filter(({ resourceId }) => resourceId >= RELIC_RESOURCES.first && resourceId <= RELIC_RESOURCES.last);

const readPlayerRelics = (store: NativeFactStore, account: string): PlayerRelicsData | null => {
  if (account === NO_ACCOUNT) return null;
  const structures = readPlayerStructures(store, account).flatMap((structure) => {
    const relics = readRelicsOf(store, structure.entityId);
    if (relics.length === 0) return [];
    const position = { alt: structure.structure.base.alt, x: structure.position.x, y: structure.position.y };
    return [
      {
        entityId: structure.entityId,
        position,
        relics,
        structureType: structure.structure.base.category,
        type: EntityType.STRUCTURE,
      },
    ];
  });
  const armies = readSelectableArmies(store, account).flatMap(({ entityId }) => {
    const relics = readRelicsOf(store, entityId);
    const army = store.get("ExplorerTroops", { game_id: activeGameId(), explorer_id: entityId });
    if (relics.length === 0 || !army) return [];
    return [
      { entityId, position: { alt: army.coord.alt, x: army.coord.x, y: army.coord.y }, relics, type: EntityType.ARMY },
    ];
  });
  return { structures, armies };
};

const readSeasonClock = () => {
  const config = ClientConfigManager.instance();
  const season = config.getSeasonConfig();
  return {
    devModeOn: Boolean(config.getDevModeConfig().dev_mode_on),
    gameEndAt: resolveFiniteSeasonEndAt(season.endAt || undefined),
    gameStartMainAt: resolveSeasonStartTimestamp(season.startMainAt || undefined),
  };
};

const PLAYER_STRUCTURE_FACTS = ["Structure", "StructureBuildings", "AddressName"] as const;
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
  models: ["ExplorerTroops"],
  read: readSelectableArmies,
};

export const playerRelicsView: FactView<PlayerRelicsData | null> = {
  models: [...PLAYER_STRUCTURE_FACTS, "ExplorerTroops", ...RESOURCE_FACTS],
  read: readPlayerRelics,
};

export const guildsView: FactView<ReturnType<typeof formatGuilds>> = {
  models: ["Guild", "GuildMember", "AddressName"],
  read: (store, account) =>
    formatGuilds(store.inGame("Guild", activeGameId()), ContractAddress(account), store).filter(
      (guild) => guild.memberCount > 0,
    ),
};

const inActiveGame =
  <Model extends NativeModelName>(model: Model) =>
  (store: NativeFactStore): NativeRows[Model][] => [...store.inGame(model, activeGameId())];

export const gameStructuresView: FactView<NativeRows["Structure"][]> = {
  models: ["Structure"],
  read: inActiveGame("Structure"),
};

export const buildingTilesView: FactView<Array<{ innerCol: number; innerRow: number; outerEntityId: number }>> = {
  models: ["Building"],
  read: (store) =>
    inActiveGame("Building")(store).map((building) => ({
      innerCol: building.inner_col,
      innerRow: building.inner_row,
      outerEntityId: building.outer_entity_id,
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
      resourceArrivalsView.read(store, NO_ACCOUNT),
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
  addressNames: NativeRows["AddressName"][];
}> = {
  models: ["Structure", "WonderFaith", "FaithfulStructure", "AddressName"],
  read: (store) => ({
    structures: inActiveGame("Structure")(store),
    wonderFaith: inActiveGame("WonderFaith")(store),
    faithfulStructures: inActiveGame("FaithfulStructure")(store),
    addressNames: [...store.rows("AddressName")],
  }),
};

/** The game's clock and dev-mode gate, as its registry row states them. */
export const seasonClockView: FactView<ReturnType<typeof readSeasonClock>> = {
  models: ["GameRegistry"],
  read: readSeasonClock,
};

/** Identity's profile (username and portrait) over the chain name, which reads as no name when it is the fallback. */
export const readPlayerProfile = (
  store: NativeFactStore,
  address: ContractAddress,
): Pick<Player, "name" | "portrait"> => {
  identityProfiles.request([address]);
  const self = readSelfProfile();
  const profile = identityProfiles.get(address) ?? (self?.address === address ? self.profile : undefined);
  return { name: profile?.name ?? getAddressName(address, store) ?? null, portrait: profile?.portrait ?? null };
};

/** One row per registered address. The signed-in user's own session stands in for their profile until identity answers. */
export const readPlayers = (store: NativeFactStore): Player[] =>
  [...store.entries("AddressName")].map(([entity, { address }]) => ({
    address,
    entity,
    ...readPlayerProfile(store, address),
  }));

const readSelfProfile = (): { address: ContractAddress; profile: IdentityProfile } | null => {
  const address = useAccountStore.getState().account?.address;
  const user = useIdentitySessionStore.getState().session?.user;
  if (!address || !user) return null;
  return { address: ContractAddress(address), profile: profileOfIdentityUser(user) };
};
