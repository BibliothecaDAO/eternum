import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { type AppStore, useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSlicesStore, type WorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import type { NativeFactStore, NativeModelName } from "@bibliothecadao/eternum/game-client";
import type { PlayerRelicsData } from "@/types";
import { readBlitzSettlementPlayerAddresses } from "@/services/blitz/blitz-settlement-players";
import { identityProfiles } from "@/services/identity/player-profiles";
import { resolveFiniteSeasonEndAt, resolveSeasonStartTimestamp } from "@/ui/features/world/utils/season-timing";
import { DEV_MODE_ENABLED } from "@/utils/dev-mode";
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
import type { GameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { ContractAddress, EntityType, type Player, ResourcesIds, type Structure } from "@bibliothecadao/types";
import { type IdentityProfile, profileOfIdentityUser } from "@realms-world/identity";

type Slice =
  | "arrivals"
  | "armies"
  | "buildings"
  | "clock"
  | "faith"
  | "guilds"
  | "hyperstructures"
  | "leaderboard"
  | "mine"
  | "players"
  | "resources"
  | "settlement"
  | "structures";

interface NativeStoreBridgeInput {
  store: NativeFactStore;
  runtime: GameSyncRuntime;
}

const NO_ACCOUNT = "0x0";

/** `?dev` mirror: how often the bridge derived, and which trigger asked for it. */
interface NativeStoreBridgeMetrics {
  derives: number;
  sliceTriggers: number;
  storeTriggers: number;
  accountTriggers: number;
}

interface BridgeMetricsWindow {
  __eternumBridgeMetrics?: NativeStoreBridgeMetrics;
}

const publishBridgeMetrics = (metrics: NativeStoreBridgeMetrics): void => {
  if (!DEV_MODE_ENABLED || typeof window === "undefined") return;
  (window as typeof window & BridgeMetricsWindow).__eternumBridgeMetrics = { ...metrics };
};

/**
 * One row per registered address: identity's profile (the username and portrait) over the chain name, which reads
 * as no name when it is the registration fallback. The signed-in user's own session stands in for their profile
 * until identity answers; every new address is asked for in one batch.
 */
const readPlayers = (store: NativeFactStore): Player[] => {
  const self = readSelfProfile();
  const rows = [...store.entries("AddressName")].map(([entity, addressName]) => {
    const address = addressName.address;
    const profile = identityProfiles.get(address) ?? (self?.address === address ? self.profile : undefined);
    const chainName = getAddressName(address, store) ?? null;
    return { address, entity, name: profile?.name ?? chainName, portrait: profile?.portrait ?? null };
  });
  identityProfiles.request(rows.map((row) => row.address));
  return rows;
};

const readSelfProfile = (): { address: ContractAddress; profile: IdentityProfile } | null => {
  const address = useAccountStore.getState().account?.address;
  const user = useIdentitySessionStore.getState().session?.user;
  if (!address || !user) return null;
  return { address: ContractAddress(address), profile: profileOfIdentityUser(user) };
};

const readGuilds = (store: NativeFactStore, account: string) =>
  formatGuilds(store.inGame("Guild", configManager.getActiveGameId()), ContractAddress(account), store).filter(
    (guild) => guild.memberCount > 0,
  );

const readBuildings = (store: NativeFactStore) =>
  [...store.inGame("Building", configManager.getActiveGameId())].map((building) => ({
    innerCol: building.inner_col,
    innerRow: building.inner_row,
    outerEntityId: building.outer_entity_id,
  }));

const readPlayerStructures = (store: NativeFactStore, account: string): Structure[] => {
  if (account === NO_ACCOUNT || isExplicitSpectateSession()) return [];
  const owner = ContractAddress(account);
  return readStructures(store, owner, owner);
};

const readSelectableArmies = (store: NativeFactStore, account: string) =>
  formatArmies(store.inGame("ExplorerTroops", configManager.getActiveGameId()), ContractAddress(account), store)
    .filter((army) => army.isMine)
    .map((army) => ({ entityId: army.entityId }));

const readRelics = (store: NativeFactStore, playerStructures: Structure[], armyIds: number[]): PlayerRelicsData => {
  const relicsOf = (entityId: number) => {
    return new ResourceManager(store, entityId)
      .balances()
      .filter(
        ({ resourceId }) =>
          resourceId >= ResourcesIds.StaminaRelic1 && resourceId <= ResourcesIds.TroopProductionRelic2,
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
              position: { alt: structure.structure.base.alt, x: structure.position.x, y: structure.position.y },
              relics,
              structureType: structure.structure.base.category,
              type: EntityType.STRUCTURE,
            },
          ];
    }),
    armies: armyIds.flatMap((entityId) => {
      const relics = relicsOf(entityId);
      const army = store.get("ExplorerTroops", { game_id: configManager.getActiveGameId(), explorer_id: entityId });
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

/** Per-game clock and dev-mode gates, read once from the scoped config manager. */
const readSeasonClock = (): Partial<AppStore> => {
  const config = ClientConfigManager.instance();
  const season = config.getSeasonConfig();
  return {
    devModeOn: Boolean(config.getDevModeConfig().dev_mode_on),
    gameEndAt: resolveFiniteSeasonEndAt(season.endAt || undefined),
    gameStartMainAt: resolveSeasonStartTimestamp(season.startMainAt || undefined),
  };
};

/** Derived UI views publish after an atomic native transaction or a completed ambient slice. */
export const installNativeStoreBridge = ({ store, runtime }: NativeStoreBridgeInput): (() => void) => {
  const dirty = new Set<Slice>();
  const metrics: NativeStoreBridgeMetrics = { accountTriggers: 0, derives: 0, sliceTriggers: 0, storeTriggers: 0 };
  const account = () => useAccountStore.getState().account?.address ?? NO_ACCOUNT;

  const sources: Partial<Record<NativeModelName, Slice[]>> = {
    AddressName: ["players", "faith", "mine"],
    Guild: ["guilds"],
    GuildMember: ["guilds"],
    Structure: ["structures", "mine"],
    StructureBuildings: ["mine"],
    Building: ["buildings"],
    Hyperstructure: ["hyperstructures", "leaderboard"],
    HyperstructureShares: ["leaderboard"],
    PlayerRank: ["leaderboard"],
    PlayerPoints: ["leaderboard"],
    RankingTrial: ["leaderboard"],
    GameRegistry: ["clock", "leaderboard"],
    ResourceBalance: ["resources"],
    ResourceProduction: ["resources"],
    ResourceWeight: ["resources"],
    ProductionBonus: ["resources"],
    ExplorerTroops: ["armies"],
    PlayerEntry: ["settlement"],
    ResourceArrival: ["arrivals"],
    WonderFaith: ["faith"],
    FaithfulStructure: ["faith"],
  };

  const flush = (): void => {
    if (dirty.size === 0) return;
    metrics.derives += 1;
    publishBridgeMetrics(metrics);
    const pending = new Set(dirty);
    dirty.clear();
    const address = account();
    const slices: Partial<WorldSlicesStore> = {};
    const ui: Partial<AppStore> = pending.has("clock") ? readSeasonClock() : {};

    if (pending.has("players")) slices.players = readPlayers(store);
    if (pending.has("guilds")) slices.guilds = readGuilds(store, address);
    if (pending.has("structures")) slices.structures = [...store.inGame("Structure", configManager.getActiveGameId())];
    if (pending.has("buildings")) slices.buildings = readBuildings(store);
    if (pending.has("hyperstructures"))
      slices.hyperstructures = [...store.inGame("Hyperstructure", configManager.getActiveGameId())];
    if (pending.has("leaderboard")) slices.leaderboardRevision = useWorldSlicesStore.getState().leaderboardRevision + 1;
    if (pending.has("resources")) slices.resourcesRevision = useWorldSlicesStore.getState().resourcesRevision + 1;
    if (pending.has("armies")) slices.armiesRevision = useWorldSlicesStore.getState().armiesRevision + 1;
    if (pending.has("settlement")) {
      slices.blitzSettlementPlayers = readBlitzSettlementPlayerAddresses(store);
    }
    if (pending.has("arrivals")) {
      slices.resourceArrivals = formatArrivals(store.inGame("ResourceArrival", configManager.getActiveGameId()));
      ui.publicIncomingTroopArrivalsByStructure = summarizeIncomingTroopArrivals(
        slices.resourceArrivals,
        useChainTimeStore.getState().getNowSeconds(),
      );
    }
    if (pending.has("faith")) {
      slices.addressNames = [...store.rows("AddressName")];
      slices.wonderFaith = [...store.inGame("WonderFaith", configManager.getActiveGameId())];
      slices.faithfulStructures = [...store.inGame("FaithfulStructure", configManager.getActiveGameId())];
    }
    if (pending.has("mine") || pending.has("armies") || pending.has("resources")) {
      const playerStructures = readPlayerStructures(store, address);
      const selectableArmies = readSelectableArmies(store, address);
      if (pending.has("mine")) ui.playerStructures = playerStructures;
      if (pending.has("mine") || pending.has("armies")) ui.selectableArmies = selectableArmies;
      ui.playerRelics =
        address === NO_ACCOUNT
          ? null
          : readRelics(
              store,
              playerStructures,
              selectableArmies.map((army) => army.entityId),
            );
      ui.playerRelicsLoading = false;
      const { structureEntityId } = useUIStore.getState();
      ui.disableButtons =
        !playerStructures.some((structure) => structure.entityId === structureEntityId) ||
        address === NO_ACCOUNT ||
        configManager.getSeasonConfig().startMainAt > useChainTimeStore.getState().getNowSeconds();
    }
    if (Object.keys(slices).length > 0) useWorldSlicesStore.setState(slices);
    if (Object.keys(ui).length > 0) useUIStore.setState(ui);
  };

  const markDirty = (...affected: Slice[]) => affected.forEach((slice) => dirty.add(slice));
  const unsubscribeFacts = store.subscribe((changes) => {
    for (const change of changes) markDirty(...(sources[change.model] ?? []));
    flush();
  });
  const unsubscribeSlices = runtime.subscribeSliceApplied(() => {
    metrics.sliceTriggers += 1;
    flush();
  });
  const unsubscribeAccount = useAccountStore.subscribe((state, previous) => {
    if (state.account?.address === previous.account?.address) return;
    metrics.accountTriggers += 1;
    markDirty("mine", "guilds", "armies", "players");
    flush();
  });
  // Identity answers and session changes re-derive the players slice; the profiles module holds the copy.
  const unsubscribeProfiles = identityProfiles.subscribe(() => {
    markDirty("players");
    flush();
  });
  const unsubscribeSession = useIdentitySessionStore.subscribe((state, previous) => {
    if (state.session?.user === previous.session?.user) return;
    markDirty("players");
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

  markDirty(...Object.values(sources).flat());
  flush();

  return () => {
    unsubscribeFacts();
    unsubscribeSlices();
    unsubscribeAccount();
    unsubscribeProfiles();
    unsubscribeSession();
    unsubscribeUi();
  };
};
