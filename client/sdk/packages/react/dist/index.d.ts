import * as _bibliothecadao_eternum from '@bibliothecadao/eternum';
import { QuestType, BuildingType, StructureType, ResourcesIds, ID, HexPosition, Position as Position$1, ContractAddress, ClientConfigManager, EternumProvider, ClientComponents, BattleManager, ArmyInfo, BattleSide, ResourceCost, Resource, EntityType, Player, GuildInfo, GuildMemberInfo, GuildWhitelistInfo, ResourceManager, StaminaManager, Structure, MarketInterface } from '@bibliothecadao/eternum';
import { StepOptions, StepOptionsButton } from 'shepherd.js';
import * as starknet from 'starknet';
import { Account, AccountInterface } from 'starknet';
import * as _dojoengine_create_burner from '@dojoengine/create-burner';
import { BurnerManager } from '@dojoengine/create-burner';
import * as _dojoengine_recs from '@dojoengine/recs';
import { Entity, Component, Schema, Metadata, ComponentValue } from '@dojoengine/recs';
import { DojoConfig } from '@dojoengine/core';
import * as torii from '@dojoengine/torii-client';
import { ToriiClient } from '@dojoengine/torii-client';
import * as zustand from 'zustand';
import * as React$1 from 'react';
import React__default from 'react';
import * as use_sound_dist_types from 'use-sound/dist/types';
import ControllerConnector from '@cartridge/connector/controller';

declare const UNDEFINED_STRUCTURE_ENTITY_ID = 0;
interface Prize {
    id: QuestType;
    title: string;
}
interface StaticQuestInfo {
    name: string;
    prizes: Prize[];
    depth: number;
}
declare const questDetails: Map<QuestType, StaticQuestInfo>;
declare enum StructureProgress {
    STAGE_1 = 0,
    STAGE_2 = 1,
    STAGE_3 = 2
}

declare const buildFoodSteps: StepOptions[];

declare const buildResourceSteps: StepOptions[];

declare const createAttackArmySteps: StepOptions[];

declare const createDefenseArmySteps: StepOptions[];

declare const createTradeSteps: StepOptions[];

declare const pauseProductionSteps: StepOptions[];

declare const settleSteps: StepOptions[];

declare const travelSteps: StepOptions[];

declare const StepButton: Record<string, StepOptionsButton>;
declare const waitForElement: (selector: string, delay?: number) => Promise<void>;

interface BuildModeStore {
    previewBuilding: {
        type: BuildingType | StructureType;
        resource?: ResourcesIds;
    } | null;
    setPreviewBuilding: (previewBuilding: {
        type: BuildingType | StructureType;
        resource?: ResourcesIds;
    } | null) => void;
    existingBuildings: {
        col: number;
        row: number;
        type: BuildingType;
        entity?: Entity;
        resource?: ResourcesIds;
    }[];
    setExistingBuildings: (existingBuildings: {
        col: number;
        row: number;
        type: BuildingType;
        entity?: Entity;
        resource?: ResourcesIds;
    }[]) => void;
}
declare const createBuildModeStoreSlice: (set: any) => {
    previewBuilding: null;
    setPreviewBuilding: (previewBuilding: {
        type: BuildingType | StructureType;
        resource?: ResourcesIds;
    } | null) => void;
    existingBuildings: {
        col: number;
        row: number;
        type: BuildingType;
    }[];
    setExistingBuildings: (existingBuildings: {
        col: number;
        row: number;
        type: BuildingType;
        entity?: Entity;
        resource?: ResourcesIds;
    }[]) => any;
};

interface PopupsStore {
    openedPopups: string[];
    openPopup: (name: string) => void;
    closePopup: (name: string) => void;
    closeAllPopups: () => void;
    isPopupOpen: (name: string) => boolean;
    togglePopup: (name: string) => void;
    openAllPopups: (names: string[]) => void;
}
declare const createPopupsSlice: (set: any, get: any) => {
    openedPopups: never[];
    openPopup: (name: string) => any;
    closePopup: (name: string) => any;
    closeAllPopups: () => any;
    isPopupOpen: (name: string) => any;
    togglePopup: (name: string) => void;
    openAllPopups: (names: string[]) => void;
};

declare class Position {
    private x;
    private y;
    private normalized;
    constructor({ x, y }: {
        x: number;
        y: number;
    });
    getContract(): {
        x: number;
        y: number;
    };
    getNormalized(): {
        x: number;
        y: number;
    };
    toMapLocationUrl(): string;
    toHexLocationUrl(): string;
}

type ArmySystemUpdate = {
    entityId: ID;
    hexCoords: HexPosition;
    battleId: ID;
    defender: boolean;
    currentHealth: bigint;
    order: number;
    owner: {
        address: bigint;
        ownerName: string;
        guildName: string;
    };
};
type StructureSystemUpdate = {
    entityId: ID;
    hexCoords: HexPosition;
    structureType: StructureType;
    stage: StructureProgress;
    level: number;
    owner: {
        address: bigint;
    };
    hasWonder: boolean;
};
type TileSystemUpdate = {
    hexCoords: HexPosition;
    removeExplored: boolean;
};
type BattleSystemUpdate = {
    entityId: ID;
    hexCoords: Position;
    isEmpty: boolean;
    deleted: boolean;
    isSiege: boolean;
    isOngoing: boolean;
};
type BuildingSystemUpdate = {
    buildingType: string;
    innerCol: number;
    innerRow: number;
    paused: boolean;
};
type RealmSystemUpdate = {
    level: number;
    hexCoords: HexPosition;
};
type BattleViewInfo = {
    battleEntityId: ID | undefined;
    engage?: boolean;
    ownArmyEntityId: ID | undefined;
    targetArmy: ID | undefined;
};
interface StructureInfo {
    entityId: ID;
    hexCoords: {
        col: number;
        row: number;
    };
    stage: number;
    level: number;
    isMine: boolean;
    owner: {
        address: bigint;
    };
    structureType: StructureType;
    hasWonder: boolean;
}
declare enum RightView {
    None = 0,
    ResourceTable = 1
}
declare enum LeftView {
    None = 0,
    MilitaryView = 1,
    EntityView = 2,
    ConstructionView = 3,
    WorldStructuresView = 4,
    ResourceArrivals = 5,
    ResourceTable = 6
}

interface ThreeStore {
    navigationTarget: HexPosition | null;
    setNavigationTarget: (hex: HexPosition | null) => void;
    armyActions: ArmyActions;
    setArmyActions: (armyActions: ArmyActions) => void;
    updateHoveredHex: (hoveredHex: HexPosition | null) => void;
    updateTravelPaths: (travelPaths: Map<string, {
        path: HexPosition[];
        isExplored: boolean;
    }>) => void;
    updateSelectedEntityId: (selectedEntityId: ID | null) => void;
    selectedHex: HexPosition | null;
    setSelectedHex: (hex: HexPosition | null) => void;
    hoveredArmyEntityId: ID | null;
    setHoveredArmyEntityId: (id: ID | null) => void;
    hoveredStructure: StructureInfo | null;
    setHoveredStructure: (structure: StructureInfo | null) => void;
    hoveredBattle: Position$1 | null;
    setHoveredBattle: (hex: Position$1 | null) => void;
    selectedBuilding: BuildingType;
    setSelectedBuilding: (building: BuildingType) => void;
    selectedBuildingHex: {
        outerCol: number;
        outerRow: number;
        innerCol: number;
        innerRow: number;
    };
    setSelectedBuildingHex: (hexCoords: {
        outerCol: number;
        outerRow: number;
        innerCol: number;
        innerRow: number;
    }) => void;
}
interface ArmyActions {
    hoveredHex: HexPosition | null;
    travelPaths: Map<string, {
        path: HexPosition[];
        isExplored: boolean;
    }>;
    selectedEntityId: ID | null;
}
declare const createThreeStoreSlice: (set: any, get: any) => {
    navigationTarget: null;
    setNavigationTarget: (hex: HexPosition | null) => any;
    armyActions: {
        hoveredHex: null;
        travelPaths: Map<any, any>;
        selectedEntityId: null;
    };
    setArmyActions: (armyActions: ArmyActions) => any;
    updateHoveredHex: (hoveredHex: HexPosition | null) => any;
    updateTravelPaths: (travelPaths: Map<string, {
        path: HexPosition[];
        isExplored: boolean;
    }>) => any;
    updateSelectedEntityId: (selectedEntityId: ID | null) => any;
    selectedHex: {
        col: number;
        row: number;
    };
    setSelectedHex: (hex: HexPosition | null) => any;
    hoveredArmyEntityId: null;
    setHoveredArmyEntityId: (id: ID | null) => any;
    hoveredStructure: null;
    setHoveredStructure: (structure: StructureInfo | null) => any;
    hoveredBattle: null;
    setHoveredBattle: (hex: Position$1 | null) => any;
    selectedBuilding: BuildingType;
    setSelectedBuilding: (building: BuildingType) => any;
    selectedBuildingEntityId: null;
    setSelectedBuildingEntityId: (selectedBuildingEntityId: ID | null) => any;
    selectedBuildingHex: {
        outerCol: number;
        outerRow: number;
        innerCol: number;
        innerRow: number;
    };
    setSelectedBuildingHex: ({ outerCol, outerRow, innerCol, innerRow, }: {
        outerCol: number;
        outerRow: number;
        innerCol: number;
        innerRow: number;
    }) => any;
};

interface BlockchainStore {
    nextBlockTimestamp: number | undefined;
    setNextBlockTimestamp: (nextBlockTimestamp: number) => void;
    currentArmiesTick: number;
    setCurrentArmiesTick: (currentDefaultTick: number) => void;
    currentDefaultTick: number;
    setCurrentDefaultTick: (currentDefaultTick: number) => void;
}
declare const createBlockchainStore: (set: any) => {
    nextBlockTimestamp: undefined;
    setNextBlockTimestamp: (nextBlockTimestamp: number) => any;
    currentDefaultTick: number;
    setCurrentDefaultTick: (currentDefaultTick: number) => any;
    currentArmiesTick: number;
    setCurrentArmiesTick: (currentArmiesTick: number) => any;
};

interface RealmStore {
    structureEntityId: ID;
    setStructureEntityId: (structureEntityId: ID) => void;
}
declare const createRealmStoreSlice: (set: any) => {
    structureEntityId: number;
    setStructureEntityId: (structureEntityId: ID) => any;
};

/**
 * Represents the loading state of different parts of the application.
 * Each property indicates whether that part is currently loading data from the blockchain.
 */
declare enum LoadingStateKey {
    SelectedStructure = "selectedStructure",
    Market = "market",
    PlayerStructuresOneKey = "playerStructuresOneKey",
    PlayerStructuresTwoKey = "playerStructuresTwoKey",
    DonkeysAndArmies = "donkeysAndArmies",
    Map = "map",
    Bank = "bank",
    World = "world",
    Hyperstructure = "hyperstructure",
    SingleKey = "singleKey",
    Config = "config",
    Events = "events"
}
type LoadingState = {
    [key in LoadingStateKey]: boolean;
};
interface WorldStore {
    loadingStates: LoadingState;
    setLoading: (key: LoadingStateKey, value: boolean) => void;
}
declare const createWorldStoreSlice: (set: any) => {
    loadingStates: {
        selectedStructure: boolean;
        market: boolean;
        playerStructuresOneKey: boolean;
        playerStructuresTwoKey: boolean;
        donkeysAndArmies: boolean;
        map: boolean;
        bank: boolean;
        world: boolean;
        hyperstructure: boolean;
        singleKey: boolean;
        config: boolean;
        events: boolean;
    };
    setLoading: (key: LoadingStateKey, value: boolean) => any;
};

declare const useFetchBlockchainData: () => void;

type TooltipType = {
    content: React__default.ReactNode;
    position?: "top" | "left" | "right" | "bottom";
    fixed?: {
        x: number;
        y: number;
    };
} | null;
interface UIStore {
    theme: string;
    setTheme: (theme: string) => void;
    showBlurOverlay: boolean;
    setShowBlurOverlay: (show: boolean) => void;
    showBlankOverlay: boolean;
    setShowBlankOverlay: (show: boolean) => void;
    isSideMenuOpened: boolean;
    toggleSideMenu: () => void;
    isSoundOn: boolean;
    trackName: string;
    setTrackName: (name: string) => void;
    trackIndex: number;
    setTrackIndex: (index: number) => void;
    toggleSound: () => void;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    musicLevel: number;
    setMusicLevel: (level: number) => void;
    effectsLevel: number;
    setEffectsLevel: (level: number) => void;
    compassDirection: number;
    setCompassDirection: (direction: number) => void;
    tooltip: TooltipType;
    setTooltip: (tooltip: TooltipType) => void;
    showRealmsFlags: boolean;
    setShowRealmsFlags: (show: boolean) => void;
    isLoadingScreenEnabled: boolean;
    setIsLoadingScreenEnabled: (enabled: boolean) => void;
    modalContent: React__default.ReactNode;
    toggleModal: (content: React__default.ReactNode) => void;
    showModal: boolean;
    battleView: BattleViewInfo | null;
    setBattleView: (participants: BattleViewInfo | null) => void;
    leftNavigationView: LeftView;
    setLeftNavigationView: (view: LeftView) => void;
    rightNavigationView: RightView;
    setRightNavigationView: (view: RightView) => void;
    showMinimap: boolean;
    setShowMinimap: (show: boolean) => void;
    selectedPlayer: ContractAddress | null;
    setSelectedPlayer: (player: ContractAddress | null) => void;
    isSpectatorMode: boolean;
    setSpectatorMode: (enabled: boolean) => void;
    hasAcceptedToS: boolean;
    setHasAcceptedToS: (accepted: boolean) => void;
    showToS: boolean;
    setShowToS: (show: boolean) => void;
}
type AppStore = UIStore & PopupsStore & ThreeStore & BuildModeStore & RealmStore & BlockchainStore & WorldStore;
declare const useUIStore: zustand.UseBoundStore<Omit<zustand.StoreApi<AppStore>, "subscribe"> & {
    subscribe: {
        (listener: (selectedState: AppStore, previousSelectedState: AppStore) => void): () => void;
        <U>(selector: (state: AppStore) => U, listener: (selectedState: U, previousSelectedState: U) => void, options?: {
            equalityFn?: ((a: U, b: U) => boolean) | undefined;
            fireImmediately?: boolean;
        } | undefined): () => void;
    };
}>;

interface AccountState {
    account: Account | AccountInterface | null;
    setAccount: (account: Account | AccountInterface | null) => void;
    connector: ControllerConnector | null;
    setConnector: (connector: ControllerConnector) => void;
}
declare const useAccountStore: zustand.UseBoundStore<zustand.StoreApi<AccountState>>;

type AddressStore = {
    loading: boolean;
    addressName: undefined | string;
    setAddressName: (addressName: string | undefined) => void;
    setLoading: (loading: boolean) => void;
};
declare const useAddressStore: zustand.UseBoundStore<zustand.StoreApi<AddressStore>>;

interface LeaderboardStore {
    playersByRank: [ContractAddress, number][];
    setPlayersByRank: (val: [ContractAddress, number][]) => void;
    guildsByRank: [ID, number][];
    setGuildsByRank: (val: [ID, number][]) => void;
}
declare const useLeaderBoardStore: zustand.UseBoundStore<zustand.StoreApi<LeaderboardStore>>;
declare const useHyperstructureData: () => () => void;

interface MarketStore {
    loading: boolean;
    setLoading: (loading: boolean) => void;
    selectedResource: number;
    setSelectedResource: (resource: number) => void;
}
declare const useMarketStore: zustand.UseBoundStore<zustand.StoreApi<MarketStore>>;

declare const useModalStore: () => {
    showModal: boolean;
    modalContent: React$1.ReactNode;
    toggleModal: (content: React.ReactNode) => void;
};

type SetupResult = Awaited<ReturnType<typeof setup>>;
declare const configManager: ClientConfigManager;
declare function setup(config: DojoConfig & {
    state: AppStore;
}, env: {
    viteVrfProviderAddress: string;
    vitePublicDev: boolean;
}): Promise<{
    network: {
        toriiClient: ToriiClient;
        contractComponents: {
            events: {
                AcceptOrder: Component<{
                    taker_id: _dojoengine_recs.Type.Number;
                    maker_id: _dojoengine_recs.Type.Number;
                    id: _dojoengine_recs.Type.Number;
                    trade_id: _dojoengine_recs.Type.Number;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                BattleClaimData: Component<{
                    id: _dojoengine_recs.Type.Number;
                    event_id: _dojoengine_recs.Type.String;
                    structure_entity_id: _dojoengine_recs.Type.Number;
                    claimer: _dojoengine_recs.Type.BigInt;
                    claimer_name: _dojoengine_recs.Type.BigInt;
                    claimer_army_entity_id: _dojoengine_recs.Type.Number;
                    claimee_address: _dojoengine_recs.Type.BigInt;
                    claimee_name: _dojoengine_recs.Type.BigInt;
                    x: _dojoengine_recs.Type.Number;
                    y: _dojoengine_recs.Type.Number;
                    structure_type: _dojoengine_recs.Type.String;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                BattleJoinData: Component<{
                    id: _dojoengine_recs.Type.Number;
                    event_id: _dojoengine_recs.Type.String;
                    battle_entity_id: _dojoengine_recs.Type.Number;
                    joiner: _dojoengine_recs.Type.BigInt;
                    joiner_name: _dojoengine_recs.Type.BigInt;
                    joiner_army_entity_id: _dojoengine_recs.Type.Number;
                    joiner_side: _dojoengine_recs.Type.String;
                    duration_left: _dojoengine_recs.Type.Number;
                    x: _dojoengine_recs.Type.Number;
                    y: _dojoengine_recs.Type.Number;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                BattleLeaveData: Component<{
                    id: _dojoengine_recs.Type.Number;
                    event_id: _dojoengine_recs.Type.String;
                    battle_entity_id: _dojoengine_recs.Type.Number;
                    leaver: _dojoengine_recs.Type.BigInt;
                    leaver_name: _dojoengine_recs.Type.BigInt;
                    leaver_army_entity_id: _dojoengine_recs.Type.Number;
                    leaver_side: _dojoengine_recs.Type.String;
                    duration_left: _dojoengine_recs.Type.Number;
                    x: _dojoengine_recs.Type.Number;
                    y: _dojoengine_recs.Type.Number;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                BattlePillageData: Component<{
                    id: _dojoengine_recs.Type.Number;
                    event_id: _dojoengine_recs.Type.String;
                    pillager: _dojoengine_recs.Type.BigInt;
                    pillager_name: _dojoengine_recs.Type.BigInt;
                    pillager_realm_entity_id: _dojoengine_recs.Type.Number;
                    pillager_army_entity_id: _dojoengine_recs.Type.Number;
                    pillaged_structure_owner: _dojoengine_recs.Type.BigInt;
                    pillaged_structure_entity_id: _dojoengine_recs.Type.Number;
                    attacker_lost_troops: {
                        knight_count: _dojoengine_recs.Type.BigInt;
                        paladin_count: _dojoengine_recs.Type.BigInt;
                        crossbowman_count: _dojoengine_recs.Type.BigInt;
                    };
                    structure_lost_troops: {
                        knight_count: _dojoengine_recs.Type.BigInt;
                        paladin_count: _dojoengine_recs.Type.BigInt;
                        crossbowman_count: _dojoengine_recs.Type.BigInt;
                    };
                    pillaged_structure_owner_name: _dojoengine_recs.Type.BigInt;
                    winner: _dojoengine_recs.Type.String;
                    x: _dojoengine_recs.Type.Number;
                    y: _dojoengine_recs.Type.Number;
                    structure_type: _dojoengine_recs.Type.String;
                    pillaged_resources: _dojoengine_recs.Type.StringArray;
                    destroyed_building_category: _dojoengine_recs.Type.String;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: string[];
                }, unknown>;
                BattleStartData: Component<{
                    id: _dojoengine_recs.Type.Number;
                    event_id: _dojoengine_recs.Type.String;
                    battle_entity_id: _dojoengine_recs.Type.Number;
                    attacker: _dojoengine_recs.Type.BigInt;
                    attacker_name: _dojoengine_recs.Type.BigInt;
                    attacker_army_entity_id: _dojoengine_recs.Type.Number;
                    defender_name: _dojoengine_recs.Type.BigInt;
                    defender: _dojoengine_recs.Type.BigInt;
                    defender_army_entity_id: _dojoengine_recs.Type.Number;
                    duration_left: _dojoengine_recs.Type.Number;
                    x: _dojoengine_recs.Type.Number;
                    y: _dojoengine_recs.Type.Number;
                    structure_type: _dojoengine_recs.Type.String;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                BurnDonkey: Component<{
                    player_address: _dojoengine_recs.Type.BigInt;
                    entity_id: _dojoengine_recs.Type.Number;
                    amount: _dojoengine_recs.Type.BigInt;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                CreateGuild: Component<{
                    guild_entity_id: _dojoengine_recs.Type.Number;
                    guild_name: _dojoengine_recs.Type.BigInt;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                GameEnded: Component<{
                    winner_address: _dojoengine_recs.Type.BigInt;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                HyperstructureContribution: Component<{
                    id: _dojoengine_recs.Type.Number;
                    hyperstructure_entity_id: _dojoengine_recs.Type.Number;
                    contributor_entity_id: _dojoengine_recs.Type.Number;
                    contributions: _dojoengine_recs.Type.StringArray;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                HyperstructureFinished: Component<{
                    id: _dojoengine_recs.Type.Number;
                    hyperstructure_entity_id: _dojoengine_recs.Type.Number;
                    contributor_entity_id: _dojoengine_recs.Type.Number;
                    timestamp: _dojoengine_recs.Type.Number;
                    hyperstructure_owner_name: _dojoengine_recs.Type.BigInt;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                JoinGuild: Component<{
                    guild_entity_id: _dojoengine_recs.Type.Number;
                    address: _dojoengine_recs.Type.BigInt;
                    guild_name: _dojoengine_recs.Type.BigInt;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                LiquidityEvent: Component<{
                    bank_entity_id: _dojoengine_recs.Type.Number;
                    entity_id: _dojoengine_recs.Type.Number;
                    resource_type: _dojoengine_recs.Type.Number;
                    lords_amount: _dojoengine_recs.Type.BigInt;
                    resource_amount: _dojoengine_recs.Type.BigInt;
                    resource_price: _dojoengine_recs.Type.BigInt;
                    add: _dojoengine_recs.Type.Boolean;
                    timestamp: _dojoengine_recs.Type.BigInt;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                MapExplored: Component<{
                    entity_id: _dojoengine_recs.Type.Number;
                    col: _dojoengine_recs.Type.Number;
                    row: _dojoengine_recs.Type.Number;
                    id: _dojoengine_recs.Type.Number;
                    entity_owner_id: _dojoengine_recs.Type.Number;
                    biome: _dojoengine_recs.Type.String;
                    reward: _dojoengine_recs.Type.StringArray;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                SwapEvent: Component<{
                    bank_entity_id: _dojoengine_recs.Type.Number;
                    entity_id: _dojoengine_recs.Type.Number;
                    id: _dojoengine_recs.Type.Number;
                    resource_type: _dojoengine_recs.Type.Number;
                    lords_amount: _dojoengine_recs.Type.BigInt;
                    resource_amount: _dojoengine_recs.Type.BigInt;
                    bank_owner_fees: _dojoengine_recs.Type.BigInt;
                    lp_fees: _dojoengine_recs.Type.BigInt;
                    resource_price: _dojoengine_recs.Type.BigInt;
                    buy: _dojoengine_recs.Type.Boolean;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                SettleRealmData: Component<{
                    id: _dojoengine_recs.Type.Number;
                    event_id: _dojoengine_recs.Type.String;
                    entity_id: _dojoengine_recs.Type.Number;
                    owner_address: _dojoengine_recs.Type.BigInt;
                    owner_name: _dojoengine_recs.Type.BigInt;
                    realm_name: _dojoengine_recs.Type.BigInt;
                    produced_resources: _dojoengine_recs.Type.BigInt;
                    cities: _dojoengine_recs.Type.Number;
                    harbors: _dojoengine_recs.Type.Number;
                    rivers: _dojoengine_recs.Type.Number;
                    regions: _dojoengine_recs.Type.Number;
                    wonder: _dojoengine_recs.Type.Number;
                    order: _dojoengine_recs.Type.Number;
                    x: _dojoengine_recs.Type.Number;
                    y: _dojoengine_recs.Type.Number;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                Transfer: Component<{
                    recipient_entity_id: _dojoengine_recs.Type.Number;
                    sending_realm_id: _dojoengine_recs.Type.Number;
                    sender_entity_id: _dojoengine_recs.Type.Number;
                    resources: _dojoengine_recs.Type.StringArray;
                    timestamp: _dojoengine_recs.Type.BigInt;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: string[];
                }, unknown>;
                Travel: Component<{
                    destination_coord_x: _dojoengine_recs.Type.Number;
                    destination_coord_y: _dojoengine_recs.Type.Number;
                    owner: _dojoengine_recs.Type.BigInt;
                    entity_id: _dojoengine_recs.Type.Number;
                    travel_time: _dojoengine_recs.Type.BigInt;
                    travel_path: _dojoengine_recs.Type.StringArray;
                    timestamp: _dojoengine_recs.Type.BigInt;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: string[];
                }, unknown>;
                TrophyProgression: Component<{
                    player_id: _dojoengine_recs.Type.BigInt;
                    task_id: _dojoengine_recs.Type.BigInt;
                    count: _dojoengine_recs.Type.Number;
                    time: _dojoengine_recs.Type.BigInt;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
                HyperstructureCoOwnersChange: Component<{
                    id: _dojoengine_recs.Type.Number;
                    hyperstructure_entity_id: _dojoengine_recs.Type.Number;
                    co_owners: _dojoengine_recs.Type.StringArray;
                    timestamp: _dojoengine_recs.Type.Number;
                }, {
                    namespace: string;
                    name: string;
                    types: string[];
                    customTypes: never[];
                }, unknown>;
            };
            AddressName: Component<{
                address: _dojoengine_recs.Type.BigInt;
                name: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Army: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                troops: {
                    knight_count: _dojoengine_recs.Type.BigInt;
                    paladin_count: _dojoengine_recs.Type.BigInt;
                    crossbowman_count: _dojoengine_recs.Type.BigInt;
                };
                battle_id: _dojoengine_recs.Type.Number;
                battle_side: _dojoengine_recs.Type.String;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            ArrivalTime: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                arrives_at: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Bank: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                owner_fee_num: _dojoengine_recs.Type.BigInt;
                owner_fee_denom: _dojoengine_recs.Type.BigInt;
                owner_bridge_fee_dpt_percent: _dojoengine_recs.Type.Number;
                owner_bridge_fee_wtdr_percent: _dojoengine_recs.Type.Number;
                exists: _dojoengine_recs.Type.Boolean;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            BankConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                lords_cost: _dojoengine_recs.Type.BigInt;
                lp_fee_num: _dojoengine_recs.Type.BigInt;
                lp_fee_denom: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Battle: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                attack_army: {
                    troops: {
                        knight_count: _dojoengine_recs.Type.BigInt;
                        paladin_count: _dojoengine_recs.Type.BigInt;
                        crossbowman_count: _dojoengine_recs.Type.BigInt;
                    };
                    battle_id: _dojoengine_recs.Type.Number;
                    battle_side: _dojoengine_recs.Type.String;
                };
                attack_army_lifetime: {
                    troops: {
                        knight_count: _dojoengine_recs.Type.BigInt;
                        paladin_count: _dojoengine_recs.Type.BigInt;
                        crossbowman_count: _dojoengine_recs.Type.BigInt;
                    };
                    battle_id: _dojoengine_recs.Type.Number;
                    battle_side: _dojoengine_recs.Type.String;
                };
                defence_army: {
                    troops: {
                        knight_count: _dojoengine_recs.Type.BigInt;
                        paladin_count: _dojoengine_recs.Type.BigInt;
                        crossbowman_count: _dojoengine_recs.Type.BigInt;
                    };
                    battle_id: _dojoengine_recs.Type.Number;
                    battle_side: _dojoengine_recs.Type.String;
                };
                defence_army_lifetime: {
                    troops: {
                        knight_count: _dojoengine_recs.Type.BigInt;
                        paladin_count: _dojoengine_recs.Type.BigInt;
                        crossbowman_count: _dojoengine_recs.Type.BigInt;
                    };
                    battle_id: _dojoengine_recs.Type.Number;
                    battle_side: _dojoengine_recs.Type.String;
                };
                attackers_resources_escrow_id: _dojoengine_recs.Type.Number;
                defenders_resources_escrow_id: _dojoengine_recs.Type.Number;
                attack_army_health: {
                    current: _dojoengine_recs.Type.BigInt;
                    lifetime: _dojoengine_recs.Type.BigInt;
                };
                defence_army_health: {
                    current: _dojoengine_recs.Type.BigInt;
                    lifetime: _dojoengine_recs.Type.BigInt;
                };
                attack_delta: _dojoengine_recs.Type.BigInt;
                defence_delta: _dojoengine_recs.Type.BigInt;
                last_updated: _dojoengine_recs.Type.BigInt;
                duration_left: _dojoengine_recs.Type.BigInt;
                start_at: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            BattleConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                regular_immunity_ticks: _dojoengine_recs.Type.Number;
                hyperstructure_immunity_ticks: _dojoengine_recs.Type.Number;
                battle_delay_seconds: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Building: Component<{
                outer_col: _dojoengine_recs.Type.Number;
                outer_row: _dojoengine_recs.Type.Number;
                inner_col: _dojoengine_recs.Type.Number;
                inner_row: _dojoengine_recs.Type.Number;
                category: _dojoengine_recs.Type.String;
                produced_resource_type: _dojoengine_recs.Type.Number;
                bonus_percent: _dojoengine_recs.Type.Number;
                entity_id: _dojoengine_recs.Type.Number;
                outer_entity_id: _dojoengine_recs.Type.Number;
                paused: _dojoengine_recs.Type.Boolean;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            BuildingCategoryPopConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                building_category: _dojoengine_recs.Type.String;
                population: _dojoengine_recs.Type.Number;
                capacity: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            BuildingConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                category: _dojoengine_recs.Type.String;
                resource_type: _dojoengine_recs.Type.Number;
                resource_cost_id: _dojoengine_recs.Type.Number;
                resource_cost_count: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            BuildingGeneralConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                base_cost_percent_increase: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            BuildingQuantityv2: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                category: _dojoengine_recs.Type.String;
                value: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            CapacityCategory: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                category: _dojoengine_recs.Type.String;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            CapacityConfig: Component<{
                category: _dojoengine_recs.Type.String;
                weight_gram: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            Contribution: Component<{
                hyperstructure_entity_id: _dojoengine_recs.Type.Number;
                player_address: _dojoengine_recs.Type.BigInt;
                resource_type: _dojoengine_recs.Type.Number;
                amount: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            DetachedResource: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                index: _dojoengine_recs.Type.Number;
                resource_type: _dojoengine_recs.Type.Number;
                resource_amount: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            EntityName: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                name: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            EntityOwner: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                entity_owner_id: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Epoch: Component<{
                hyperstructure_entity_id: _dojoengine_recs.Type.Number;
                index: _dojoengine_recs.Type.Number;
                start_timestamp: _dojoengine_recs.Type.BigInt;
                owners: _dojoengine_recs.Type.BigIntArray;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Guild: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                is_public: _dojoengine_recs.Type.Boolean;
                member_count: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            GuildMember: Component<{
                address: _dojoengine_recs.Type.BigInt;
                guild_entity_id: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            GuildWhitelist: Component<{
                address: _dojoengine_recs.Type.BigInt;
                guild_entity_id: _dojoengine_recs.Type.Number;
                is_whitelisted: _dojoengine_recs.Type.Boolean;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Health: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                current: _dojoengine_recs.Type.BigInt;
                lifetime: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Hyperstructure: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                current_epoch: _dojoengine_recs.Type.Number;
                completed: _dojoengine_recs.Type.Boolean;
                last_updated_by: _dojoengine_recs.Type.BigInt;
                last_updated_timestamp: _dojoengine_recs.Type.Number;
                access: _dojoengine_recs.Type.String;
                randomness: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            HyperstructureConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                time_between_shares_change: _dojoengine_recs.Type.Number;
                points_per_cycle: _dojoengine_recs.Type.BigInt;
                points_for_win: _dojoengine_recs.Type.BigInt;
                points_on_completion: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            HyperstructureResourceConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                resource_tier: _dojoengine_recs.Type.Number;
                min_amount: _dojoengine_recs.Type.BigInt;
                max_amount: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Leaderboard: Component<{
                config_id: _dojoengine_recs.Type.Number;
                registration_end_timestamp: _dojoengine_recs.Type.Number;
                total_points: _dojoengine_recs.Type.BigInt;
                total_price_pool: _dojoengine_recs.Type.OptionalBigInt;
                distribution_started: _dojoengine_recs.Type.Boolean;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            LeaderboardEntry: Component<{
                address: _dojoengine_recs.Type.BigInt;
                points: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            LeaderboardRewardClaimed: Component<{
                address: _dojoengine_recs.Type.BigInt;
                claimed: _dojoengine_recs.Type.Boolean;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            LeaderboardRegistered: Component<{
                address: _dojoengine_recs.Type.BigInt;
                registered: _dojoengine_recs.Type.Boolean;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            LeaderboardRegisterContribution: Component<{
                address: _dojoengine_recs.Type.BigInt;
                hyperstructure_entity_id: _dojoengine_recs.Type.Number;
                registered: _dojoengine_recs.Type.Boolean;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            LeaderboardRegisterShare: Component<{
                address: _dojoengine_recs.Type.BigInt;
                hyperstructure_entity_id: _dojoengine_recs.Type.Number;
                epoch: _dojoengine_recs.Type.Number;
                registered: _dojoengine_recs.Type.Boolean;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Liquidity: Component<{
                bank_entity_id: _dojoengine_recs.Type.Number;
                player: _dojoengine_recs.Type.BigInt;
                resource_type: _dojoengine_recs.Type.Number;
                shares: {
                    mag: _dojoengine_recs.Type.BigInt;
                    sign: _dojoengine_recs.Type.Boolean;
                };
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            MapConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                reward_resource_amount: _dojoengine_recs.Type.BigInt;
                shards_mines_fail_probability: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Market: Component<{
                bank_entity_id: _dojoengine_recs.Type.Number;
                resource_type: _dojoengine_recs.Type.Number;
                lords_amount: _dojoengine_recs.Type.BigInt;
                resource_amount: _dojoengine_recs.Type.BigInt;
                total_shares: {
                    mag: _dojoengine_recs.Type.BigInt;
                    sign: _dojoengine_recs.Type.Boolean;
                };
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            MercenariesConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                troops: {
                    knight_count: _dojoengine_recs.Type.BigInt;
                    paladin_count: _dojoengine_recs.Type.BigInt;
                    crossbowman_count: _dojoengine_recs.Type.BigInt;
                };
                rewards: _dojoengine_recs.Type.StringArray;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            Message: Component<{
                identity: _dojoengine_recs.Type.BigInt;
                channel: _dojoengine_recs.Type.BigInt;
                content: _dojoengine_recs.Type.String;
                salt: _dojoengine_recs.Type.BigInt;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Movable: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                sec_per_km: _dojoengine_recs.Type.Number;
                blocked: _dojoengine_recs.Type.Boolean;
                round_trip: _dojoengine_recs.Type.Boolean;
                start_coord_x: _dojoengine_recs.Type.Number;
                start_coord_y: _dojoengine_recs.Type.Number;
                intermediate_coord_x: _dojoengine_recs.Type.Number;
                intermediate_coord_y: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Orders: Component<{
                order_id: _dojoengine_recs.Type.Number;
                hyperstructure_count: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            OwnedResourcesTracker: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                resource_types: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Owner: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                address: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Population: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                population: _dojoengine_recs.Type.Number;
                capacity: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            PopulationConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                base_population: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Position: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Production: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                resource_type: _dojoengine_recs.Type.Number;
                building_count: _dojoengine_recs.Type.Number;
                production_rate: _dojoengine_recs.Type.BigInt;
                consumption_rate: _dojoengine_recs.Type.BigInt;
                last_updated_tick: _dojoengine_recs.Type.BigInt;
                input_finish_tick: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            ProductionConfig: Component<{
                resource_type: _dojoengine_recs.Type.Number;
                amount: _dojoengine_recs.Type.BigInt;
                input_count: _dojoengine_recs.Type.BigInt;
                output_count: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            ProductionDeadline: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                deadline_tick: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            ProductionInput: Component<{
                output_resource_type: _dojoengine_recs.Type.Number;
                index: _dojoengine_recs.Type.Number;
                input_resource_type: _dojoengine_recs.Type.Number;
                input_resource_amount: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            ProductionOutput: Component<{
                input_resource_type: _dojoengine_recs.Type.Number;
                index: _dojoengine_recs.Type.Number;
                output_resource_type: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Progress: Component<{
                hyperstructure_entity_id: _dojoengine_recs.Type.Number;
                resource_type: _dojoengine_recs.Type.Number;
                amount: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Protectee: Component<{
                army_id: _dojoengine_recs.Type.Number;
                protectee_id: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Protector: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                army_id: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Quantity: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                value: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            QuantityTracker: Component<{
                entity_id: _dojoengine_recs.Type.BigInt;
                count: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Quest: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                config_id: _dojoengine_recs.Type.Number;
                completed: _dojoengine_recs.Type.Boolean;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            QuestBonus: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                resource_type: _dojoengine_recs.Type.Number;
                claimed: _dojoengine_recs.Type.Boolean;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            QuestConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                production_material_multiplier: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            QuestRewardConfig: Component<{
                quest_id: _dojoengine_recs.Type.Number;
                detached_resource_id: _dojoengine_recs.Type.Number;
                detached_resource_count: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Realm: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                realm_id: _dojoengine_recs.Type.Number;
                produced_resources: _dojoengine_recs.Type.BigInt;
                order: _dojoengine_recs.Type.Number;
                level: _dojoengine_recs.Type.Number;
                has_wonder: _dojoengine_recs.Type.Boolean;
                settler_address: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            RealmLevelConfig: Component<{
                level: _dojoengine_recs.Type.Number;
                required_resources_id: _dojoengine_recs.Type.Number;
                required_resource_count: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            RealmMaxLevelConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                max_level: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Resource: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                resource_type: _dojoengine_recs.Type.Number;
                balance: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            ResourceAllowance: Component<{
                owner_entity_id: _dojoengine_recs.Type.Number;
                approved_entity_id: _dojoengine_recs.Type.Number;
                resource_type: _dojoengine_recs.Type.Number;
                amount: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            ResourceBridgeFeeSplitConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                velords_fee_on_dpt_percent: _dojoengine_recs.Type.Number;
                velords_fee_on_wtdr_percent: _dojoengine_recs.Type.Number;
                season_pool_fee_on_dpt_percent: _dojoengine_recs.Type.Number;
                season_pool_fee_on_wtdr_percent: _dojoengine_recs.Type.Number;
                client_fee_on_dpt_percent: _dojoengine_recs.Type.Number;
                client_fee_on_wtdr_percent: _dojoengine_recs.Type.Number;
                velords_fee_recipient: _dojoengine_recs.Type.BigInt;
                season_pool_fee_recipient: _dojoengine_recs.Type.BigInt;
                max_bank_fee_dpt_percent: _dojoengine_recs.Type.Number;
                max_bank_fee_wtdr_percent: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            ResourceBridgeWhitelistConfig: Component<{
                token: _dojoengine_recs.Type.BigInt;
                resource_type: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            ResourceCost: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                index: _dojoengine_recs.Type.Number;
                resource_type: _dojoengine_recs.Type.Number;
                amount: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            ResourceTransferLock: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                start_at: _dojoengine_recs.Type.BigInt;
                release_at: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Season: Component<{
                config_id: _dojoengine_recs.Type.Number;
                start_at: _dojoengine_recs.Type.BigInt;
                is_over: _dojoengine_recs.Type.Boolean;
                ended_at: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            SeasonAddressesConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                season_pass_address: _dojoengine_recs.Type.BigInt;
                realms_address: _dojoengine_recs.Type.BigInt;
                lords_address: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            SeasonBridgeConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                close_after_end_seconds: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            SettlementConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                angle_scaled: _dojoengine_recs.Type.BigInt;
                center: _dojoengine_recs.Type.Number;
                min_scaling_factor_scaled: _dojoengine_recs.Type.BigInt;
                radius: _dojoengine_recs.Type.Number;
                min_distance: _dojoengine_recs.Type.Number;
                max_distance: _dojoengine_recs.Type.Number;
                min_angle_increase: _dojoengine_recs.Type.BigInt;
                max_angle_increase: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            SpeedConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                speed_config_id: _dojoengine_recs.Type.Number;
                entity_type: _dojoengine_recs.Type.Number;
                sec_per_km: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Stamina: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                amount: _dojoengine_recs.Type.Number;
                last_refill_tick: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            StaminaConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                unit_type: _dojoengine_recs.Type.Number;
                max_stamina: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            StaminaRefillConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                amount_per_tick: _dojoengine_recs.Type.Number;
                start_boost_tick_count: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Status: Component<{
                trade_id: _dojoengine_recs.Type.Number;
                value: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Structure: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                category: _dojoengine_recs.Type.String;
                created_at: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            StructureCount: Component<{
                coord: {
                    x: _dojoengine_recs.Type.Number;
                    y: _dojoengine_recs.Type.Number;
                };
                count: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            TickConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                tick_id: _dojoengine_recs.Type.Number;
                tick_interval_in_seconds: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Tile: Component<{
                col: _dojoengine_recs.Type.Number;
                row: _dojoengine_recs.Type.Number;
                explored_by_id: _dojoengine_recs.Type.Number;
                explored_at: _dojoengine_recs.Type.BigInt;
                biome: _dojoengine_recs.Type.String;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            Trade: Component<{
                trade_id: _dojoengine_recs.Type.Number;
                maker_id: _dojoengine_recs.Type.Number;
                maker_gives_resources_origin_id: _dojoengine_recs.Type.Number;
                maker_gives_resources_id: _dojoengine_recs.Type.Number;
                maker_gives_resources_hash: _dojoengine_recs.Type.BigInt;
                maker_gives_resources_weight: _dojoengine_recs.Type.BigInt;
                taker_id: _dojoengine_recs.Type.Number;
                taker_gives_resources_origin_id: _dojoengine_recs.Type.Number;
                taker_gives_resources_id: _dojoengine_recs.Type.Number;
                taker_gives_resources_hash: _dojoengine_recs.Type.BigInt;
                taker_gives_resources_weight: _dojoengine_recs.Type.BigInt;
                expires_at: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            TravelFoodCostConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                unit_type: _dojoengine_recs.Type.Number;
                explore_wheat_burn_amount: _dojoengine_recs.Type.BigInt;
                explore_fish_burn_amount: _dojoengine_recs.Type.BigInt;
                travel_wheat_burn_amount: _dojoengine_recs.Type.BigInt;
                travel_fish_burn_amount: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            TravelStaminaCostConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                travel_type: _dojoengine_recs.Type.Number;
                cost: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            TroopConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                health: _dojoengine_recs.Type.Number;
                knight_strength: _dojoengine_recs.Type.Number;
                paladin_strength: _dojoengine_recs.Type.Number;
                crossbowman_strength: _dojoengine_recs.Type.Number;
                advantage_percent: _dojoengine_recs.Type.Number;
                disadvantage_percent: _dojoengine_recs.Type.Number;
                max_troop_count: _dojoengine_recs.Type.Number;
                pillage_health_divisor: _dojoengine_recs.Type.Number;
                army_free_per_structure: _dojoengine_recs.Type.Number;
                army_extra_per_building: _dojoengine_recs.Type.Number;
                army_max_per_structure: _dojoengine_recs.Type.Number;
                battle_leave_slash_num: _dojoengine_recs.Type.Number;
                battle_leave_slash_denom: _dojoengine_recs.Type.Number;
                battle_time_scale: _dojoengine_recs.Type.Number;
                battle_max_time_seconds: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Weight: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                value: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            WeightConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                weight_config_id: _dojoengine_recs.Type.Number;
                entity_type: _dojoengine_recs.Type.Number;
                weight_gram: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            WorldConfig: Component<{
                config_id: _dojoengine_recs.Type.Number;
                admin_address: _dojoengine_recs.Type.BigInt;
                realm_l2_contract: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
        };
        provider: _bibliothecadao_eternum.EternumProvider;
        world: {
            registerEntity: ({ id, idSuffix }?: {
                id?: string | undefined;
                idSuffix?: string | undefined;
            }) => _dojoengine_recs.Entity;
            components: Component<Schema, Metadata, unknown>[];
            registerComponent: (component: Component) => void;
            dispose: (namespace?: string) => void;
            registerDisposer: (disposer: () => void, namespace?: string) => void;
            hasEntity: (entity: _dojoengine_recs.Entity) => boolean;
            getEntities: () => IterableIterator<_dojoengine_recs.Entity>;
            entitySymbols: Set<_dojoengine_recs.EntitySymbol>;
            deleteEntity: (entity: _dojoengine_recs.Entity) => void;
        };
        burnerManager: _dojoengine_create_burner.BurnerManager;
    };
    components: {
        Building: _dojoengine_recs.OverridableComponent<{
            outer_col: _dojoengine_recs.Type.Number;
            outer_row: _dojoengine_recs.Type.Number;
            inner_col: _dojoengine_recs.Type.Number;
            inner_row: _dojoengine_recs.Type.Number;
            category: _dojoengine_recs.Type.String;
            produced_resource_type: _dojoengine_recs.Type.Number;
            bonus_percent: _dojoengine_recs.Type.Number;
            entity_id: _dojoengine_recs.Type.Number;
            outer_entity_id: _dojoengine_recs.Type.Number;
            paused: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        Position: _dojoengine_recs.OverridableComponent<{
            entity_id: _dojoengine_recs.Type.Number;
            x: _dojoengine_recs.Type.Number;
            y: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Stamina: _dojoengine_recs.OverridableComponent<{
            entity_id: _dojoengine_recs.Type.Number;
            amount: _dojoengine_recs.Type.Number;
            last_refill_tick: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Tile: _dojoengine_recs.OverridableComponent<{
            col: _dojoengine_recs.Type.Number;
            row: _dojoengine_recs.Type.Number;
            explored_by_id: _dojoengine_recs.Type.Number;
            explored_at: _dojoengine_recs.Type.BigInt;
            biome: _dojoengine_recs.Type.String;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        Population: _dojoengine_recs.OverridableComponent<{
            entity_id: _dojoengine_recs.Type.Number;
            population: _dojoengine_recs.Type.Number;
            capacity: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Resource: _dojoengine_recs.OverridableComponent<{
            entity_id: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            balance: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Weight: _dojoengine_recs.OverridableComponent<{
            entity_id: _dojoengine_recs.Type.Number;
            value: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        OwnedResourcesTracker: _dojoengine_recs.OverridableComponent<{
            entity_id: _dojoengine_recs.Type.Number;
            resource_types: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Army: _dojoengine_recs.OverridableComponent<{
            entity_id: _dojoengine_recs.Type.Number;
            troops: {
                knight_count: _dojoengine_recs.Type.BigInt;
                paladin_count: _dojoengine_recs.Type.BigInt;
                crossbowman_count: _dojoengine_recs.Type.BigInt;
            };
            battle_id: _dojoengine_recs.Type.Number;
            battle_side: _dojoengine_recs.Type.String;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        BuildingQuantityv2: _dojoengine_recs.OverridableComponent<{
            entity_id: _dojoengine_recs.Type.Number;
            category: _dojoengine_recs.Type.String;
            value: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        Structure: _dojoengine_recs.OverridableComponent<{
            entity_id: _dojoengine_recs.Type.Number;
            category: _dojoengine_recs.Type.String;
            created_at: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        ArrivalTime: _dojoengine_recs.OverridableComponent<{
            entity_id: _dojoengine_recs.Type.Number;
            arrives_at: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        events: {
            AcceptOrder: Component<{
                taker_id: _dojoengine_recs.Type.Number;
                maker_id: _dojoengine_recs.Type.Number;
                id: _dojoengine_recs.Type.Number;
                trade_id: _dojoengine_recs.Type.Number;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            BattleClaimData: Component<{
                id: _dojoengine_recs.Type.Number;
                event_id: _dojoengine_recs.Type.String;
                structure_entity_id: _dojoengine_recs.Type.Number;
                claimer: _dojoengine_recs.Type.BigInt;
                claimer_name: _dojoengine_recs.Type.BigInt;
                claimer_army_entity_id: _dojoengine_recs.Type.Number;
                claimee_address: _dojoengine_recs.Type.BigInt;
                claimee_name: _dojoengine_recs.Type.BigInt;
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
                structure_type: _dojoengine_recs.Type.String;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            BattleJoinData: Component<{
                id: _dojoengine_recs.Type.Number;
                event_id: _dojoengine_recs.Type.String;
                battle_entity_id: _dojoengine_recs.Type.Number;
                joiner: _dojoengine_recs.Type.BigInt;
                joiner_name: _dojoengine_recs.Type.BigInt;
                joiner_army_entity_id: _dojoengine_recs.Type.Number;
                joiner_side: _dojoengine_recs.Type.String;
                duration_left: _dojoengine_recs.Type.Number;
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            BattleLeaveData: Component<{
                id: _dojoengine_recs.Type.Number;
                event_id: _dojoengine_recs.Type.String;
                battle_entity_id: _dojoengine_recs.Type.Number;
                leaver: _dojoengine_recs.Type.BigInt;
                leaver_name: _dojoengine_recs.Type.BigInt;
                leaver_army_entity_id: _dojoengine_recs.Type.Number;
                leaver_side: _dojoengine_recs.Type.String;
                duration_left: _dojoengine_recs.Type.Number;
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            BattlePillageData: Component<{
                id: _dojoengine_recs.Type.Number;
                event_id: _dojoengine_recs.Type.String;
                pillager: _dojoengine_recs.Type.BigInt;
                pillager_name: _dojoengine_recs.Type.BigInt;
                pillager_realm_entity_id: _dojoengine_recs.Type.Number;
                pillager_army_entity_id: _dojoengine_recs.Type.Number;
                pillaged_structure_owner: _dojoengine_recs.Type.BigInt;
                pillaged_structure_entity_id: _dojoengine_recs.Type.Number;
                attacker_lost_troops: {
                    knight_count: _dojoengine_recs.Type.BigInt;
                    paladin_count: _dojoengine_recs.Type.BigInt;
                    crossbowman_count: _dojoengine_recs.Type.BigInt;
                };
                structure_lost_troops: {
                    knight_count: _dojoengine_recs.Type.BigInt;
                    paladin_count: _dojoengine_recs.Type.BigInt;
                    crossbowman_count: _dojoengine_recs.Type.BigInt;
                };
                pillaged_structure_owner_name: _dojoengine_recs.Type.BigInt;
                winner: _dojoengine_recs.Type.String;
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
                structure_type: _dojoengine_recs.Type.String;
                pillaged_resources: _dojoengine_recs.Type.StringArray;
                destroyed_building_category: _dojoengine_recs.Type.String;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            BattleStartData: Component<{
                id: _dojoengine_recs.Type.Number;
                event_id: _dojoengine_recs.Type.String;
                battle_entity_id: _dojoengine_recs.Type.Number;
                attacker: _dojoengine_recs.Type.BigInt;
                attacker_name: _dojoengine_recs.Type.BigInt;
                attacker_army_entity_id: _dojoengine_recs.Type.Number;
                defender_name: _dojoengine_recs.Type.BigInt;
                defender: _dojoengine_recs.Type.BigInt;
                defender_army_entity_id: _dojoengine_recs.Type.Number;
                duration_left: _dojoengine_recs.Type.Number;
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
                structure_type: _dojoengine_recs.Type.String;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            BurnDonkey: Component<{
                player_address: _dojoengine_recs.Type.BigInt;
                entity_id: _dojoengine_recs.Type.Number;
                amount: _dojoengine_recs.Type.BigInt;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            CreateGuild: Component<{
                guild_entity_id: _dojoengine_recs.Type.Number;
                guild_name: _dojoengine_recs.Type.BigInt;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            GameEnded: Component<{
                winner_address: _dojoengine_recs.Type.BigInt;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            HyperstructureContribution: Component<{
                id: _dojoengine_recs.Type.Number;
                hyperstructure_entity_id: _dojoengine_recs.Type.Number;
                contributor_entity_id: _dojoengine_recs.Type.Number;
                contributions: _dojoengine_recs.Type.StringArray;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            HyperstructureFinished: Component<{
                id: _dojoengine_recs.Type.Number;
                hyperstructure_entity_id: _dojoengine_recs.Type.Number;
                contributor_entity_id: _dojoengine_recs.Type.Number;
                timestamp: _dojoengine_recs.Type.Number;
                hyperstructure_owner_name: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            JoinGuild: Component<{
                guild_entity_id: _dojoengine_recs.Type.Number;
                address: _dojoengine_recs.Type.BigInt;
                guild_name: _dojoengine_recs.Type.BigInt;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            LiquidityEvent: Component<{
                bank_entity_id: _dojoengine_recs.Type.Number;
                entity_id: _dojoengine_recs.Type.Number;
                resource_type: _dojoengine_recs.Type.Number;
                lords_amount: _dojoengine_recs.Type.BigInt;
                resource_amount: _dojoengine_recs.Type.BigInt;
                resource_price: _dojoengine_recs.Type.BigInt;
                add: _dojoengine_recs.Type.Boolean;
                timestamp: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            MapExplored: Component<{
                entity_id: _dojoengine_recs.Type.Number;
                col: _dojoengine_recs.Type.Number;
                row: _dojoengine_recs.Type.Number;
                id: _dojoengine_recs.Type.Number;
                entity_owner_id: _dojoengine_recs.Type.Number;
                biome: _dojoengine_recs.Type.String;
                reward: _dojoengine_recs.Type.StringArray;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            SwapEvent: Component<{
                bank_entity_id: _dojoengine_recs.Type.Number;
                entity_id: _dojoengine_recs.Type.Number;
                id: _dojoengine_recs.Type.Number;
                resource_type: _dojoengine_recs.Type.Number;
                lords_amount: _dojoengine_recs.Type.BigInt;
                resource_amount: _dojoengine_recs.Type.BigInt;
                bank_owner_fees: _dojoengine_recs.Type.BigInt;
                lp_fees: _dojoengine_recs.Type.BigInt;
                resource_price: _dojoengine_recs.Type.BigInt;
                buy: _dojoengine_recs.Type.Boolean;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            SettleRealmData: Component<{
                id: _dojoengine_recs.Type.Number;
                event_id: _dojoengine_recs.Type.String;
                entity_id: _dojoengine_recs.Type.Number;
                owner_address: _dojoengine_recs.Type.BigInt;
                owner_name: _dojoengine_recs.Type.BigInt;
                realm_name: _dojoengine_recs.Type.BigInt;
                produced_resources: _dojoengine_recs.Type.BigInt;
                cities: _dojoengine_recs.Type.Number;
                harbors: _dojoengine_recs.Type.Number;
                rivers: _dojoengine_recs.Type.Number;
                regions: _dojoengine_recs.Type.Number;
                wonder: _dojoengine_recs.Type.Number;
                order: _dojoengine_recs.Type.Number;
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Transfer: Component<{
                recipient_entity_id: _dojoengine_recs.Type.Number;
                sending_realm_id: _dojoengine_recs.Type.Number;
                sender_entity_id: _dojoengine_recs.Type.Number;
                resources: _dojoengine_recs.Type.StringArray;
                timestamp: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            Travel: Component<{
                destination_coord_x: _dojoengine_recs.Type.Number;
                destination_coord_y: _dojoengine_recs.Type.Number;
                owner: _dojoengine_recs.Type.BigInt;
                entity_id: _dojoengine_recs.Type.Number;
                travel_time: _dojoengine_recs.Type.BigInt;
                travel_path: _dojoengine_recs.Type.StringArray;
                timestamp: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            TrophyProgression: Component<{
                player_id: _dojoengine_recs.Type.BigInt;
                task_id: _dojoengine_recs.Type.BigInt;
                count: _dojoengine_recs.Type.Number;
                time: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            HyperstructureCoOwnersChange: Component<{
                id: _dojoengine_recs.Type.Number;
                hyperstructure_entity_id: _dojoengine_recs.Type.Number;
                co_owners: _dojoengine_recs.Type.StringArray;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
        };
        AddressName: Component<{
            address: _dojoengine_recs.Type.BigInt;
            name: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Bank: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            owner_fee_num: _dojoengine_recs.Type.BigInt;
            owner_fee_denom: _dojoengine_recs.Type.BigInt;
            owner_bridge_fee_dpt_percent: _dojoengine_recs.Type.Number;
            owner_bridge_fee_wtdr_percent: _dojoengine_recs.Type.Number;
            exists: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        BankConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            lords_cost: _dojoengine_recs.Type.BigInt;
            lp_fee_num: _dojoengine_recs.Type.BigInt;
            lp_fee_denom: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Battle: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            attack_army: {
                troops: {
                    knight_count: _dojoengine_recs.Type.BigInt;
                    paladin_count: _dojoengine_recs.Type.BigInt;
                    crossbowman_count: _dojoengine_recs.Type.BigInt;
                };
                battle_id: _dojoengine_recs.Type.Number;
                battle_side: _dojoengine_recs.Type.String;
            };
            attack_army_lifetime: {
                troops: {
                    knight_count: _dojoengine_recs.Type.BigInt;
                    paladin_count: _dojoengine_recs.Type.BigInt;
                    crossbowman_count: _dojoengine_recs.Type.BigInt;
                };
                battle_id: _dojoengine_recs.Type.Number;
                battle_side: _dojoengine_recs.Type.String;
            };
            defence_army: {
                troops: {
                    knight_count: _dojoengine_recs.Type.BigInt;
                    paladin_count: _dojoengine_recs.Type.BigInt;
                    crossbowman_count: _dojoengine_recs.Type.BigInt;
                };
                battle_id: _dojoengine_recs.Type.Number;
                battle_side: _dojoengine_recs.Type.String;
            };
            defence_army_lifetime: {
                troops: {
                    knight_count: _dojoengine_recs.Type.BigInt;
                    paladin_count: _dojoengine_recs.Type.BigInt;
                    crossbowman_count: _dojoengine_recs.Type.BigInt;
                };
                battle_id: _dojoengine_recs.Type.Number;
                battle_side: _dojoengine_recs.Type.String;
            };
            attackers_resources_escrow_id: _dojoengine_recs.Type.Number;
            defenders_resources_escrow_id: _dojoengine_recs.Type.Number;
            attack_army_health: {
                current: _dojoengine_recs.Type.BigInt;
                lifetime: _dojoengine_recs.Type.BigInt;
            };
            defence_army_health: {
                current: _dojoengine_recs.Type.BigInt;
                lifetime: _dojoengine_recs.Type.BigInt;
            };
            attack_delta: _dojoengine_recs.Type.BigInt;
            defence_delta: _dojoengine_recs.Type.BigInt;
            last_updated: _dojoengine_recs.Type.BigInt;
            duration_left: _dojoengine_recs.Type.BigInt;
            start_at: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        BattleConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            regular_immunity_ticks: _dojoengine_recs.Type.Number;
            hyperstructure_immunity_ticks: _dojoengine_recs.Type.Number;
            battle_delay_seconds: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        BuildingCategoryPopConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            building_category: _dojoengine_recs.Type.String;
            population: _dojoengine_recs.Type.Number;
            capacity: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        BuildingConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            category: _dojoengine_recs.Type.String;
            resource_type: _dojoengine_recs.Type.Number;
            resource_cost_id: _dojoengine_recs.Type.Number;
            resource_cost_count: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        BuildingGeneralConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            base_cost_percent_increase: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        CapacityCategory: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            category: _dojoengine_recs.Type.String;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        CapacityConfig: Component<{
            category: _dojoengine_recs.Type.String;
            weight_gram: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        Contribution: Component<{
            hyperstructure_entity_id: _dojoengine_recs.Type.Number;
            player_address: _dojoengine_recs.Type.BigInt;
            resource_type: _dojoengine_recs.Type.Number;
            amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        DetachedResource: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            index: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            resource_amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        EntityName: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            name: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        EntityOwner: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            entity_owner_id: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Epoch: Component<{
            hyperstructure_entity_id: _dojoengine_recs.Type.Number;
            index: _dojoengine_recs.Type.Number;
            start_timestamp: _dojoengine_recs.Type.BigInt;
            owners: _dojoengine_recs.Type.BigIntArray;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Guild: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            is_public: _dojoengine_recs.Type.Boolean;
            member_count: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        GuildMember: Component<{
            address: _dojoengine_recs.Type.BigInt;
            guild_entity_id: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        GuildWhitelist: Component<{
            address: _dojoengine_recs.Type.BigInt;
            guild_entity_id: _dojoengine_recs.Type.Number;
            is_whitelisted: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Health: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            current: _dojoengine_recs.Type.BigInt;
            lifetime: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Hyperstructure: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            current_epoch: _dojoengine_recs.Type.Number;
            completed: _dojoengine_recs.Type.Boolean;
            last_updated_by: _dojoengine_recs.Type.BigInt;
            last_updated_timestamp: _dojoengine_recs.Type.Number;
            access: _dojoengine_recs.Type.String;
            randomness: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        HyperstructureConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            time_between_shares_change: _dojoengine_recs.Type.Number;
            points_per_cycle: _dojoengine_recs.Type.BigInt;
            points_for_win: _dojoengine_recs.Type.BigInt;
            points_on_completion: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        HyperstructureResourceConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            resource_tier: _dojoengine_recs.Type.Number;
            min_amount: _dojoengine_recs.Type.BigInt;
            max_amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Leaderboard: Component<{
            config_id: _dojoengine_recs.Type.Number;
            registration_end_timestamp: _dojoengine_recs.Type.Number;
            total_points: _dojoengine_recs.Type.BigInt;
            total_price_pool: _dojoengine_recs.Type.OptionalBigInt;
            distribution_started: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        LeaderboardEntry: Component<{
            address: _dojoengine_recs.Type.BigInt;
            points: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        LeaderboardRewardClaimed: Component<{
            address: _dojoengine_recs.Type.BigInt;
            claimed: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        LeaderboardRegistered: Component<{
            address: _dojoengine_recs.Type.BigInt;
            registered: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        LeaderboardRegisterContribution: Component<{
            address: _dojoengine_recs.Type.BigInt;
            hyperstructure_entity_id: _dojoengine_recs.Type.Number;
            registered: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        LeaderboardRegisterShare: Component<{
            address: _dojoengine_recs.Type.BigInt;
            hyperstructure_entity_id: _dojoengine_recs.Type.Number;
            epoch: _dojoengine_recs.Type.Number;
            registered: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Liquidity: Component<{
            bank_entity_id: _dojoengine_recs.Type.Number;
            player: _dojoengine_recs.Type.BigInt;
            resource_type: _dojoengine_recs.Type.Number;
            shares: {
                mag: _dojoengine_recs.Type.BigInt;
                sign: _dojoengine_recs.Type.Boolean;
            };
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        MapConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            reward_resource_amount: _dojoengine_recs.Type.BigInt;
            shards_mines_fail_probability: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Market: Component<{
            bank_entity_id: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            lords_amount: _dojoengine_recs.Type.BigInt;
            resource_amount: _dojoengine_recs.Type.BigInt;
            total_shares: {
                mag: _dojoengine_recs.Type.BigInt;
                sign: _dojoengine_recs.Type.Boolean;
            };
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        MercenariesConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            troops: {
                knight_count: _dojoengine_recs.Type.BigInt;
                paladin_count: _dojoengine_recs.Type.BigInt;
                crossbowman_count: _dojoengine_recs.Type.BigInt;
            };
            rewards: _dojoengine_recs.Type.StringArray;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        Message: Component<{
            identity: _dojoengine_recs.Type.BigInt;
            channel: _dojoengine_recs.Type.BigInt;
            content: _dojoengine_recs.Type.String;
            salt: _dojoengine_recs.Type.BigInt;
            timestamp: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Movable: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            sec_per_km: _dojoengine_recs.Type.Number;
            blocked: _dojoengine_recs.Type.Boolean;
            round_trip: _dojoengine_recs.Type.Boolean;
            start_coord_x: _dojoengine_recs.Type.Number;
            start_coord_y: _dojoengine_recs.Type.Number;
            intermediate_coord_x: _dojoengine_recs.Type.Number;
            intermediate_coord_y: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Orders: Component<{
            order_id: _dojoengine_recs.Type.Number;
            hyperstructure_count: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Owner: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            address: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        PopulationConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            base_population: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Production: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            building_count: _dojoengine_recs.Type.Number;
            production_rate: _dojoengine_recs.Type.BigInt;
            consumption_rate: _dojoengine_recs.Type.BigInt;
            last_updated_tick: _dojoengine_recs.Type.BigInt;
            input_finish_tick: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ProductionConfig: Component<{
            resource_type: _dojoengine_recs.Type.Number;
            amount: _dojoengine_recs.Type.BigInt;
            input_count: _dojoengine_recs.Type.BigInt;
            output_count: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ProductionDeadline: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            deadline_tick: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ProductionInput: Component<{
            output_resource_type: _dojoengine_recs.Type.Number;
            index: _dojoengine_recs.Type.Number;
            input_resource_type: _dojoengine_recs.Type.Number;
            input_resource_amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ProductionOutput: Component<{
            input_resource_type: _dojoengine_recs.Type.Number;
            index: _dojoengine_recs.Type.Number;
            output_resource_type: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Progress: Component<{
            hyperstructure_entity_id: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Protectee: Component<{
            army_id: _dojoengine_recs.Type.Number;
            protectee_id: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Protector: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            army_id: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Quantity: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            value: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        QuantityTracker: Component<{
            entity_id: _dojoengine_recs.Type.BigInt;
            count: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Quest: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            config_id: _dojoengine_recs.Type.Number;
            completed: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        QuestBonus: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            claimed: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        QuestConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            production_material_multiplier: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        QuestRewardConfig: Component<{
            quest_id: _dojoengine_recs.Type.Number;
            detached_resource_id: _dojoengine_recs.Type.Number;
            detached_resource_count: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Realm: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            realm_id: _dojoengine_recs.Type.Number;
            produced_resources: _dojoengine_recs.Type.BigInt;
            order: _dojoengine_recs.Type.Number;
            level: _dojoengine_recs.Type.Number;
            has_wonder: _dojoengine_recs.Type.Boolean;
            settler_address: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        RealmLevelConfig: Component<{
            level: _dojoengine_recs.Type.Number;
            required_resources_id: _dojoengine_recs.Type.Number;
            required_resource_count: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        RealmMaxLevelConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            max_level: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ResourceAllowance: Component<{
            owner_entity_id: _dojoengine_recs.Type.Number;
            approved_entity_id: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ResourceBridgeFeeSplitConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            velords_fee_on_dpt_percent: _dojoengine_recs.Type.Number;
            velords_fee_on_wtdr_percent: _dojoengine_recs.Type.Number;
            season_pool_fee_on_dpt_percent: _dojoengine_recs.Type.Number;
            season_pool_fee_on_wtdr_percent: _dojoengine_recs.Type.Number;
            client_fee_on_dpt_percent: _dojoengine_recs.Type.Number;
            client_fee_on_wtdr_percent: _dojoengine_recs.Type.Number;
            velords_fee_recipient: _dojoengine_recs.Type.BigInt;
            season_pool_fee_recipient: _dojoengine_recs.Type.BigInt;
            max_bank_fee_dpt_percent: _dojoengine_recs.Type.Number;
            max_bank_fee_wtdr_percent: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ResourceBridgeWhitelistConfig: Component<{
            token: _dojoengine_recs.Type.BigInt;
            resource_type: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ResourceCost: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            index: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ResourceTransferLock: Component<{
            entity_id: _dojoengine_recs.Type.Number;
            start_at: _dojoengine_recs.Type.BigInt;
            release_at: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Season: Component<{
            config_id: _dojoengine_recs.Type.Number;
            start_at: _dojoengine_recs.Type.BigInt;
            is_over: _dojoengine_recs.Type.Boolean;
            ended_at: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        SeasonAddressesConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            season_pass_address: _dojoengine_recs.Type.BigInt;
            realms_address: _dojoengine_recs.Type.BigInt;
            lords_address: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        SeasonBridgeConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            close_after_end_seconds: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        SettlementConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            angle_scaled: _dojoengine_recs.Type.BigInt;
            center: _dojoengine_recs.Type.Number;
            min_scaling_factor_scaled: _dojoengine_recs.Type.BigInt;
            radius: _dojoengine_recs.Type.Number;
            min_distance: _dojoengine_recs.Type.Number;
            max_distance: _dojoengine_recs.Type.Number;
            min_angle_increase: _dojoengine_recs.Type.BigInt;
            max_angle_increase: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        SpeedConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            speed_config_id: _dojoengine_recs.Type.Number;
            entity_type: _dojoengine_recs.Type.Number;
            sec_per_km: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        StaminaConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            unit_type: _dojoengine_recs.Type.Number;
            max_stamina: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        StaminaRefillConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            amount_per_tick: _dojoengine_recs.Type.Number;
            start_boost_tick_count: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Status: Component<{
            trade_id: _dojoengine_recs.Type.Number;
            value: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        StructureCount: Component<{
            coord: {
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
            };
            count: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        TickConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            tick_id: _dojoengine_recs.Type.Number;
            tick_interval_in_seconds: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Trade: Component<{
            trade_id: _dojoengine_recs.Type.Number;
            maker_id: _dojoengine_recs.Type.Number;
            maker_gives_resources_origin_id: _dojoengine_recs.Type.Number;
            maker_gives_resources_id: _dojoengine_recs.Type.Number;
            maker_gives_resources_hash: _dojoengine_recs.Type.BigInt;
            maker_gives_resources_weight: _dojoengine_recs.Type.BigInt;
            taker_id: _dojoengine_recs.Type.Number;
            taker_gives_resources_origin_id: _dojoengine_recs.Type.Number;
            taker_gives_resources_id: _dojoengine_recs.Type.Number;
            taker_gives_resources_hash: _dojoengine_recs.Type.BigInt;
            taker_gives_resources_weight: _dojoengine_recs.Type.BigInt;
            expires_at: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        TravelFoodCostConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            unit_type: _dojoengine_recs.Type.Number;
            explore_wheat_burn_amount: _dojoengine_recs.Type.BigInt;
            explore_fish_burn_amount: _dojoengine_recs.Type.BigInt;
            travel_wheat_burn_amount: _dojoengine_recs.Type.BigInt;
            travel_fish_burn_amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        TravelStaminaCostConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            travel_type: _dojoengine_recs.Type.Number;
            cost: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        TroopConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            health: _dojoengine_recs.Type.Number;
            knight_strength: _dojoengine_recs.Type.Number;
            paladin_strength: _dojoengine_recs.Type.Number;
            crossbowman_strength: _dojoengine_recs.Type.Number;
            advantage_percent: _dojoengine_recs.Type.Number;
            disadvantage_percent: _dojoengine_recs.Type.Number;
            max_troop_count: _dojoengine_recs.Type.Number;
            pillage_health_divisor: _dojoengine_recs.Type.Number;
            army_free_per_structure: _dojoengine_recs.Type.Number;
            army_extra_per_building: _dojoengine_recs.Type.Number;
            army_max_per_structure: _dojoengine_recs.Type.Number;
            battle_leave_slash_num: _dojoengine_recs.Type.Number;
            battle_leave_slash_denom: _dojoengine_recs.Type.Number;
            battle_time_scale: _dojoengine_recs.Type.Number;
            battle_max_time_seconds: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        WeightConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            weight_config_id: _dojoengine_recs.Type.Number;
            entity_type: _dojoengine_recs.Type.Number;
            weight_gram: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        WorldConfig: Component<{
            config_id: _dojoengine_recs.Type.Number;
            admin_address: _dojoengine_recs.Type.BigInt;
            realm_l2_contract: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
    };
    systemCalls: {
        send_resources: (props: _bibliothecadao_eternum.SendResourcesProps) => Promise<void>;
        send_resources_multiple: (props: _bibliothecadao_eternum.SendResourcesMultipleProps) => Promise<void>;
        pickup_resources: (props: _bibliothecadao_eternum.PickupResourcesProps) => Promise<void>;
        remove_liquidity: (props: _bibliothecadao_eternum.RemoveLiquidityProps) => Promise<void>;
        add_liquidity: (props: _bibliothecadao_eternum.AddLiquidityProps) => Promise<void>;
        sell_resources: (props: _bibliothecadao_eternum.SellResourcesProps) => Promise<void>;
        buy_resources: (props: _bibliothecadao_eternum.BuyResourcesProps) => Promise<void>;
        change_bank_owner_fee: (props: _bibliothecadao_eternum.ChangeBankOwnerFeeProps) => Promise<void>;
        open_account: (props: _bibliothecadao_eternum.OpenAccountProps) => Promise<void>;
        create_bank: (props: _bibliothecadao_eternum.CreateBankProps) => Promise<void>;
        explore: (props: _bibliothecadao_eternum.ExploreProps) => Promise<void>;
        set_address_name: (props: _bibliothecadao_eternum.SetAddressNameProps) => Promise<void>;
        set_entity_name: (props: _bibliothecadao_eternum.SetEntityNameProps) => Promise<void>;
        isLive: () => Promise<boolean>;
        create_order: (props: _bibliothecadao_eternum.CreateOrderProps) => Promise<void>;
        accept_order: (props: _bibliothecadao_eternum.AcceptOrderProps) => Promise<void>;
        cancel_order: (props: _bibliothecadao_eternum.CancelOrderProps) => Promise<void>;
        accept_partial_order: (props: _bibliothecadao_eternum.AcceptPartialOrderProps) => Promise<void>;
        upgrade_realm: (props: _bibliothecadao_eternum.UpgradeRealmProps) => Promise<void>;
        create_multiple_realms: (props: _bibliothecadao_eternum.CreateMultipleRealmsProps) => Promise<void>;
        create_multiple_realms_dev: (props: _bibliothecadao_eternum.CreateMultipleRealmsDevProps) => Promise<void>;
        transfer_resources: (props: _bibliothecadao_eternum.TransferResourcesProps) => Promise<void>;
        travel_hex: (props: _bibliothecadao_eternum.TravelHexProps) => Promise<void>;
        destroy_building: (props: _bibliothecadao_eternum.DestroyBuildingProps) => Promise<void>;
        pause_production: (props: _bibliothecadao_eternum.PauseProductionProps) => Promise<void>;
        resume_production: (props: _bibliothecadao_eternum.ResumeProductionProps) => Promise<void>;
        create_building: (props: _bibliothecadao_eternum.CreateBuildingProps) => Promise<void>;
        create_army: (props: _bibliothecadao_eternum.ArmyCreateProps) => Promise<void>;
        delete_army: (props: _bibliothecadao_eternum.ArmyDeleteProps) => Promise<void>;
        uuid: () => Promise<number>;
        create_hyperstructure: (props: _bibliothecadao_eternum.CreateHyperstructureProps) => Promise<void>;
        contribute_to_construction: (props: _bibliothecadao_eternum.ContributeToConstructionProps) => Promise<void>;
        set_access: (props: _bibliothecadao_eternum.SetAccessProps) => Promise<void>;
        set_co_owners: (props: _bibliothecadao_eternum.SetCoOwnersProps) => Promise<void>;
        get_points: (props: _bibliothecadao_eternum.GetPointsProps) => Promise<starknet.Result>;
        end_game: (props: _bibliothecadao_eternum.EndGameProps) => Promise<void>;
        register_to_leaderboard: (props: _bibliothecadao_eternum.RegisterToLeaderboardProps) => Promise<void>;
        claim_leaderboard_rewards: (props: _bibliothecadao_eternum.ClaimLeaderboardRewardsProps) => Promise<void>;
        claim_quest: (props: _bibliothecadao_eternum.ClaimQuestProps) => Promise<void>;
        mint_resources: (props: _bibliothecadao_eternum.MintResourcesProps) => Promise<void>;
        army_buy_troops: (props: _bibliothecadao_eternum.ArmyBuyTroopsProps) => Promise<void>;
        army_merge_troops: (props: _bibliothecadao_eternum.ArmyMergeTroopsProps) => Promise<void>;
        create_guild: (props: _bibliothecadao_eternum.CreateGuildProps) => Promise<void>;
        join_guild: (props: _bibliothecadao_eternum.JoinGuildProps) => Promise<void>;
        whitelist_player: (props: _bibliothecadao_eternum.WhitelistPlayerProps) => Promise<void>;
        transfer_guild_ownership: (props: _bibliothecadao_eternum.TransferGuildOwnership) => Promise<void>;
        remove_guild_member: (props: _bibliothecadao_eternum.RemoveGuildMember) => Promise<void>;
        disband_guild: (props: _bibliothecadao_eternum.DisbandGuild) => Promise<void>;
        remove_player_from_whitelist: (props: _bibliothecadao_eternum.RemovePlayerFromWhitelist) => Promise<void>;
        battle_start: (props: _bibliothecadao_eternum.BattleStartProps) => Promise<void>;
        battle_force_start: (props: _bibliothecadao_eternum.BattleForceStartProps) => Promise<void>;
        battle_resolve: (props: _bibliothecadao_eternum.BattleResolveProps) => Promise<void>;
        battle_leave: (props: _bibliothecadao_eternum.BattleLeaveProps) => Promise<void>;
        battle_join: (props: _bibliothecadao_eternum.BattleJoinProps) => Promise<void>;
        battle_claim: (props: _bibliothecadao_eternum.BattleClaimProps) => Promise<void>;
        battle_pillage: (props: _bibliothecadao_eternum.BattlePillageProps) => Promise<void>;
        battle_leave_and_claim: (props: _bibliothecadao_eternum.BattleClaimAndLeaveProps) => Promise<void>;
        battle_leave_and_pillage: (props: _bibliothecadao_eternum.BattleLeaveAndRaidProps) => Promise<void>;
    };
    sync: {
        cancel: () => void;
    };
    eventSync: Promise<void>;
}>;

type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;
declare function setupNetwork(config: DojoConfig, env: {
    viteVrfProviderAddress: string;
    vitePublicDev: boolean;
}): Promise<{
    toriiClient: torii.ToriiClient;
    contractComponents: {
        events: {
            AcceptOrder: _dojoengine_recs.Component<{
                taker_id: _dojoengine_recs.Type.Number;
                maker_id: _dojoengine_recs.Type.Number;
                id: _dojoengine_recs.Type.Number;
                trade_id: _dojoengine_recs.Type.Number;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            BattleClaimData: _dojoengine_recs.Component<{
                id: _dojoengine_recs.Type.Number;
                event_id: _dojoengine_recs.Type.String;
                structure_entity_id: _dojoengine_recs.Type.Number;
                claimer: _dojoengine_recs.Type.BigInt;
                claimer_name: _dojoengine_recs.Type.BigInt;
                claimer_army_entity_id: _dojoengine_recs.Type.Number;
                claimee_address: _dojoengine_recs.Type.BigInt;
                claimee_name: _dojoengine_recs.Type.BigInt;
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
                structure_type: _dojoengine_recs.Type.String;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            BattleJoinData: _dojoengine_recs.Component<{
                id: _dojoengine_recs.Type.Number;
                event_id: _dojoengine_recs.Type.String;
                battle_entity_id: _dojoengine_recs.Type.Number;
                joiner: _dojoengine_recs.Type.BigInt;
                joiner_name: _dojoengine_recs.Type.BigInt;
                joiner_army_entity_id: _dojoengine_recs.Type.Number;
                joiner_side: _dojoengine_recs.Type.String;
                duration_left: _dojoengine_recs.Type.Number;
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            BattleLeaveData: _dojoengine_recs.Component<{
                id: _dojoengine_recs.Type.Number;
                event_id: _dojoengine_recs.Type.String;
                battle_entity_id: _dojoengine_recs.Type.Number;
                leaver: _dojoengine_recs.Type.BigInt;
                leaver_name: _dojoengine_recs.Type.BigInt;
                leaver_army_entity_id: _dojoengine_recs.Type.Number;
                leaver_side: _dojoengine_recs.Type.String;
                duration_left: _dojoengine_recs.Type.Number;
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            BattlePillageData: _dojoengine_recs.Component<{
                id: _dojoengine_recs.Type.Number;
                event_id: _dojoengine_recs.Type.String;
                pillager: _dojoengine_recs.Type.BigInt;
                pillager_name: _dojoengine_recs.Type.BigInt;
                pillager_realm_entity_id: _dojoengine_recs.Type.Number;
                pillager_army_entity_id: _dojoengine_recs.Type.Number;
                pillaged_structure_owner: _dojoengine_recs.Type.BigInt;
                pillaged_structure_entity_id: _dojoengine_recs.Type.Number;
                attacker_lost_troops: {
                    knight_count: _dojoengine_recs.Type.BigInt;
                    paladin_count: _dojoengine_recs.Type.BigInt;
                    crossbowman_count: _dojoengine_recs.Type.BigInt;
                };
                structure_lost_troops: {
                    knight_count: _dojoengine_recs.Type.BigInt;
                    paladin_count: _dojoengine_recs.Type.BigInt;
                    crossbowman_count: _dojoengine_recs.Type.BigInt;
                };
                pillaged_structure_owner_name: _dojoengine_recs.Type.BigInt;
                winner: _dojoengine_recs.Type.String;
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
                structure_type: _dojoengine_recs.Type.String;
                pillaged_resources: _dojoengine_recs.Type.StringArray;
                destroyed_building_category: _dojoengine_recs.Type.String;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            BattleStartData: _dojoengine_recs.Component<{
                id: _dojoengine_recs.Type.Number;
                event_id: _dojoengine_recs.Type.String;
                battle_entity_id: _dojoengine_recs.Type.Number;
                attacker: _dojoengine_recs.Type.BigInt;
                attacker_name: _dojoengine_recs.Type.BigInt;
                attacker_army_entity_id: _dojoengine_recs.Type.Number;
                defender_name: _dojoengine_recs.Type.BigInt;
                defender: _dojoengine_recs.Type.BigInt;
                defender_army_entity_id: _dojoengine_recs.Type.Number;
                duration_left: _dojoengine_recs.Type.Number;
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
                structure_type: _dojoengine_recs.Type.String;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            BurnDonkey: _dojoengine_recs.Component<{
                player_address: _dojoengine_recs.Type.BigInt;
                entity_id: _dojoengine_recs.Type.Number;
                amount: _dojoengine_recs.Type.BigInt;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            CreateGuild: _dojoengine_recs.Component<{
                guild_entity_id: _dojoengine_recs.Type.Number;
                guild_name: _dojoengine_recs.Type.BigInt;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            GameEnded: _dojoengine_recs.Component<{
                winner_address: _dojoengine_recs.Type.BigInt;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            HyperstructureContribution: _dojoengine_recs.Component<{
                id: _dojoengine_recs.Type.Number;
                hyperstructure_entity_id: _dojoengine_recs.Type.Number;
                contributor_entity_id: _dojoengine_recs.Type.Number;
                contributions: _dojoengine_recs.Type.StringArray;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            HyperstructureFinished: _dojoengine_recs.Component<{
                id: _dojoengine_recs.Type.Number;
                hyperstructure_entity_id: _dojoengine_recs.Type.Number;
                contributor_entity_id: _dojoengine_recs.Type.Number;
                timestamp: _dojoengine_recs.Type.Number;
                hyperstructure_owner_name: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            JoinGuild: _dojoengine_recs.Component<{
                guild_entity_id: _dojoengine_recs.Type.Number;
                address: _dojoengine_recs.Type.BigInt;
                guild_name: _dojoengine_recs.Type.BigInt;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            LiquidityEvent: _dojoengine_recs.Component<{
                bank_entity_id: _dojoengine_recs.Type.Number;
                entity_id: _dojoengine_recs.Type.Number;
                resource_type: _dojoengine_recs.Type.Number;
                lords_amount: _dojoengine_recs.Type.BigInt;
                resource_amount: _dojoengine_recs.Type.BigInt;
                resource_price: _dojoengine_recs.Type.BigInt;
                add: _dojoengine_recs.Type.Boolean;
                timestamp: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            MapExplored: _dojoengine_recs.Component<{
                entity_id: _dojoengine_recs.Type.Number;
                col: _dojoengine_recs.Type.Number;
                row: _dojoengine_recs.Type.Number;
                id: _dojoengine_recs.Type.Number;
                entity_owner_id: _dojoengine_recs.Type.Number;
                biome: _dojoengine_recs.Type.String;
                reward: _dojoengine_recs.Type.StringArray;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            SwapEvent: _dojoengine_recs.Component<{
                bank_entity_id: _dojoengine_recs.Type.Number;
                entity_id: _dojoengine_recs.Type.Number;
                id: _dojoengine_recs.Type.Number;
                resource_type: _dojoengine_recs.Type.Number;
                lords_amount: _dojoengine_recs.Type.BigInt;
                resource_amount: _dojoengine_recs.Type.BigInt;
                bank_owner_fees: _dojoengine_recs.Type.BigInt;
                lp_fees: _dojoengine_recs.Type.BigInt;
                resource_price: _dojoengine_recs.Type.BigInt;
                buy: _dojoengine_recs.Type.Boolean;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            SettleRealmData: _dojoengine_recs.Component<{
                id: _dojoengine_recs.Type.Number;
                event_id: _dojoengine_recs.Type.String;
                entity_id: _dojoengine_recs.Type.Number;
                owner_address: _dojoengine_recs.Type.BigInt;
                owner_name: _dojoengine_recs.Type.BigInt;
                realm_name: _dojoengine_recs.Type.BigInt;
                produced_resources: _dojoengine_recs.Type.BigInt;
                cities: _dojoengine_recs.Type.Number;
                harbors: _dojoengine_recs.Type.Number;
                rivers: _dojoengine_recs.Type.Number;
                regions: _dojoengine_recs.Type.Number;
                wonder: _dojoengine_recs.Type.Number;
                order: _dojoengine_recs.Type.Number;
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            Transfer: _dojoengine_recs.Component<{
                recipient_entity_id: _dojoengine_recs.Type.Number;
                sending_realm_id: _dojoengine_recs.Type.Number;
                sender_entity_id: _dojoengine_recs.Type.Number;
                resources: _dojoengine_recs.Type.StringArray;
                timestamp: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            Travel: _dojoengine_recs.Component<{
                destination_coord_x: _dojoengine_recs.Type.Number;
                destination_coord_y: _dojoengine_recs.Type.Number;
                owner: _dojoengine_recs.Type.BigInt;
                entity_id: _dojoengine_recs.Type.Number;
                travel_time: _dojoengine_recs.Type.BigInt;
                travel_path: _dojoengine_recs.Type.StringArray;
                timestamp: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: string[];
            }, unknown>;
            TrophyProgression: _dojoengine_recs.Component<{
                player_id: _dojoengine_recs.Type.BigInt;
                task_id: _dojoengine_recs.Type.BigInt;
                count: _dojoengine_recs.Type.Number;
                time: _dojoengine_recs.Type.BigInt;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
            HyperstructureCoOwnersChange: _dojoengine_recs.Component<{
                id: _dojoengine_recs.Type.Number;
                hyperstructure_entity_id: _dojoengine_recs.Type.Number;
                co_owners: _dojoengine_recs.Type.StringArray;
                timestamp: _dojoengine_recs.Type.Number;
            }, {
                namespace: string;
                name: string;
                types: string[];
                customTypes: never[];
            }, unknown>;
        };
        AddressName: _dojoengine_recs.Component<{
            address: _dojoengine_recs.Type.BigInt;
            name: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Army: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            troops: {
                knight_count: _dojoengine_recs.Type.BigInt;
                paladin_count: _dojoengine_recs.Type.BigInt;
                crossbowman_count: _dojoengine_recs.Type.BigInt;
            };
            battle_id: _dojoengine_recs.Type.Number;
            battle_side: _dojoengine_recs.Type.String;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        ArrivalTime: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            arrives_at: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Bank: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            owner_fee_num: _dojoengine_recs.Type.BigInt;
            owner_fee_denom: _dojoengine_recs.Type.BigInt;
            owner_bridge_fee_dpt_percent: _dojoengine_recs.Type.Number;
            owner_bridge_fee_wtdr_percent: _dojoengine_recs.Type.Number;
            exists: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        BankConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            lords_cost: _dojoengine_recs.Type.BigInt;
            lp_fee_num: _dojoengine_recs.Type.BigInt;
            lp_fee_denom: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Battle: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            attack_army: {
                troops: {
                    knight_count: _dojoengine_recs.Type.BigInt;
                    paladin_count: _dojoengine_recs.Type.BigInt;
                    crossbowman_count: _dojoengine_recs.Type.BigInt;
                };
                battle_id: _dojoengine_recs.Type.Number;
                battle_side: _dojoengine_recs.Type.String;
            };
            attack_army_lifetime: {
                troops: {
                    knight_count: _dojoengine_recs.Type.BigInt;
                    paladin_count: _dojoengine_recs.Type.BigInt;
                    crossbowman_count: _dojoengine_recs.Type.BigInt;
                };
                battle_id: _dojoengine_recs.Type.Number;
                battle_side: _dojoengine_recs.Type.String;
            };
            defence_army: {
                troops: {
                    knight_count: _dojoengine_recs.Type.BigInt;
                    paladin_count: _dojoengine_recs.Type.BigInt;
                    crossbowman_count: _dojoengine_recs.Type.BigInt;
                };
                battle_id: _dojoengine_recs.Type.Number;
                battle_side: _dojoengine_recs.Type.String;
            };
            defence_army_lifetime: {
                troops: {
                    knight_count: _dojoengine_recs.Type.BigInt;
                    paladin_count: _dojoengine_recs.Type.BigInt;
                    crossbowman_count: _dojoengine_recs.Type.BigInt;
                };
                battle_id: _dojoengine_recs.Type.Number;
                battle_side: _dojoengine_recs.Type.String;
            };
            attackers_resources_escrow_id: _dojoengine_recs.Type.Number;
            defenders_resources_escrow_id: _dojoengine_recs.Type.Number;
            attack_army_health: {
                current: _dojoengine_recs.Type.BigInt;
                lifetime: _dojoengine_recs.Type.BigInt;
            };
            defence_army_health: {
                current: _dojoengine_recs.Type.BigInt;
                lifetime: _dojoengine_recs.Type.BigInt;
            };
            attack_delta: _dojoengine_recs.Type.BigInt;
            defence_delta: _dojoengine_recs.Type.BigInt;
            last_updated: _dojoengine_recs.Type.BigInt;
            duration_left: _dojoengine_recs.Type.BigInt;
            start_at: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        BattleConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            regular_immunity_ticks: _dojoengine_recs.Type.Number;
            hyperstructure_immunity_ticks: _dojoengine_recs.Type.Number;
            battle_delay_seconds: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Building: _dojoengine_recs.Component<{
            outer_col: _dojoengine_recs.Type.Number;
            outer_row: _dojoengine_recs.Type.Number;
            inner_col: _dojoengine_recs.Type.Number;
            inner_row: _dojoengine_recs.Type.Number;
            category: _dojoengine_recs.Type.String;
            produced_resource_type: _dojoengine_recs.Type.Number;
            bonus_percent: _dojoengine_recs.Type.Number;
            entity_id: _dojoengine_recs.Type.Number;
            outer_entity_id: _dojoengine_recs.Type.Number;
            paused: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        BuildingCategoryPopConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            building_category: _dojoengine_recs.Type.String;
            population: _dojoengine_recs.Type.Number;
            capacity: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        BuildingConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            category: _dojoengine_recs.Type.String;
            resource_type: _dojoengine_recs.Type.Number;
            resource_cost_id: _dojoengine_recs.Type.Number;
            resource_cost_count: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        BuildingGeneralConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            base_cost_percent_increase: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        BuildingQuantityv2: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            category: _dojoengine_recs.Type.String;
            value: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        CapacityCategory: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            category: _dojoengine_recs.Type.String;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        CapacityConfig: _dojoengine_recs.Component<{
            category: _dojoengine_recs.Type.String;
            weight_gram: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        Contribution: _dojoengine_recs.Component<{
            hyperstructure_entity_id: _dojoengine_recs.Type.Number;
            player_address: _dojoengine_recs.Type.BigInt;
            resource_type: _dojoengine_recs.Type.Number;
            amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        DetachedResource: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            index: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            resource_amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        EntityName: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            name: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        EntityOwner: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            entity_owner_id: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Epoch: _dojoengine_recs.Component<{
            hyperstructure_entity_id: _dojoengine_recs.Type.Number;
            index: _dojoengine_recs.Type.Number;
            start_timestamp: _dojoengine_recs.Type.BigInt;
            owners: _dojoengine_recs.Type.BigIntArray;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Guild: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            is_public: _dojoengine_recs.Type.Boolean;
            member_count: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        GuildMember: _dojoengine_recs.Component<{
            address: _dojoengine_recs.Type.BigInt;
            guild_entity_id: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        GuildWhitelist: _dojoengine_recs.Component<{
            address: _dojoengine_recs.Type.BigInt;
            guild_entity_id: _dojoengine_recs.Type.Number;
            is_whitelisted: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Health: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            current: _dojoengine_recs.Type.BigInt;
            lifetime: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Hyperstructure: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            current_epoch: _dojoengine_recs.Type.Number;
            completed: _dojoengine_recs.Type.Boolean;
            last_updated_by: _dojoengine_recs.Type.BigInt;
            last_updated_timestamp: _dojoengine_recs.Type.Number;
            access: _dojoengine_recs.Type.String;
            randomness: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        HyperstructureConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            time_between_shares_change: _dojoengine_recs.Type.Number;
            points_per_cycle: _dojoengine_recs.Type.BigInt;
            points_for_win: _dojoengine_recs.Type.BigInt;
            points_on_completion: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        HyperstructureResourceConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            resource_tier: _dojoengine_recs.Type.Number;
            min_amount: _dojoengine_recs.Type.BigInt;
            max_amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Leaderboard: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            registration_end_timestamp: _dojoengine_recs.Type.Number;
            total_points: _dojoengine_recs.Type.BigInt;
            total_price_pool: _dojoengine_recs.Type.OptionalBigInt;
            distribution_started: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        LeaderboardEntry: _dojoengine_recs.Component<{
            address: _dojoengine_recs.Type.BigInt;
            points: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        LeaderboardRewardClaimed: _dojoengine_recs.Component<{
            address: _dojoengine_recs.Type.BigInt;
            claimed: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        LeaderboardRegistered: _dojoengine_recs.Component<{
            address: _dojoengine_recs.Type.BigInt;
            registered: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        LeaderboardRegisterContribution: _dojoengine_recs.Component<{
            address: _dojoengine_recs.Type.BigInt;
            hyperstructure_entity_id: _dojoengine_recs.Type.Number;
            registered: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        LeaderboardRegisterShare: _dojoengine_recs.Component<{
            address: _dojoengine_recs.Type.BigInt;
            hyperstructure_entity_id: _dojoengine_recs.Type.Number;
            epoch: _dojoengine_recs.Type.Number;
            registered: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Liquidity: _dojoengine_recs.Component<{
            bank_entity_id: _dojoengine_recs.Type.Number;
            player: _dojoengine_recs.Type.BigInt;
            resource_type: _dojoengine_recs.Type.Number;
            shares: {
                mag: _dojoengine_recs.Type.BigInt;
                sign: _dojoengine_recs.Type.Boolean;
            };
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        MapConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            reward_resource_amount: _dojoengine_recs.Type.BigInt;
            shards_mines_fail_probability: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Market: _dojoengine_recs.Component<{
            bank_entity_id: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            lords_amount: _dojoengine_recs.Type.BigInt;
            resource_amount: _dojoengine_recs.Type.BigInt;
            total_shares: {
                mag: _dojoengine_recs.Type.BigInt;
                sign: _dojoengine_recs.Type.Boolean;
            };
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        MercenariesConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            troops: {
                knight_count: _dojoengine_recs.Type.BigInt;
                paladin_count: _dojoengine_recs.Type.BigInt;
                crossbowman_count: _dojoengine_recs.Type.BigInt;
            };
            rewards: _dojoengine_recs.Type.StringArray;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        Message: _dojoengine_recs.Component<{
            identity: _dojoengine_recs.Type.BigInt;
            channel: _dojoengine_recs.Type.BigInt;
            content: _dojoengine_recs.Type.String;
            salt: _dojoengine_recs.Type.BigInt;
            timestamp: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Movable: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            sec_per_km: _dojoengine_recs.Type.Number;
            blocked: _dojoengine_recs.Type.Boolean;
            round_trip: _dojoengine_recs.Type.Boolean;
            start_coord_x: _dojoengine_recs.Type.Number;
            start_coord_y: _dojoengine_recs.Type.Number;
            intermediate_coord_x: _dojoengine_recs.Type.Number;
            intermediate_coord_y: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Orders: _dojoengine_recs.Component<{
            order_id: _dojoengine_recs.Type.Number;
            hyperstructure_count: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        OwnedResourcesTracker: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            resource_types: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Owner: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            address: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Population: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            population: _dojoengine_recs.Type.Number;
            capacity: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        PopulationConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            base_population: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Position: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            x: _dojoengine_recs.Type.Number;
            y: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Production: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            building_count: _dojoengine_recs.Type.Number;
            production_rate: _dojoengine_recs.Type.BigInt;
            consumption_rate: _dojoengine_recs.Type.BigInt;
            last_updated_tick: _dojoengine_recs.Type.BigInt;
            input_finish_tick: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ProductionConfig: _dojoengine_recs.Component<{
            resource_type: _dojoengine_recs.Type.Number;
            amount: _dojoengine_recs.Type.BigInt;
            input_count: _dojoengine_recs.Type.BigInt;
            output_count: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ProductionDeadline: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            deadline_tick: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ProductionInput: _dojoengine_recs.Component<{
            output_resource_type: _dojoengine_recs.Type.Number;
            index: _dojoengine_recs.Type.Number;
            input_resource_type: _dojoengine_recs.Type.Number;
            input_resource_amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ProductionOutput: _dojoengine_recs.Component<{
            input_resource_type: _dojoengine_recs.Type.Number;
            index: _dojoengine_recs.Type.Number;
            output_resource_type: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Progress: _dojoengine_recs.Component<{
            hyperstructure_entity_id: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Protectee: _dojoengine_recs.Component<{
            army_id: _dojoengine_recs.Type.Number;
            protectee_id: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Protector: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            army_id: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Quantity: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            value: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        QuantityTracker: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.BigInt;
            count: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Quest: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            config_id: _dojoengine_recs.Type.Number;
            completed: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        QuestBonus: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            claimed: _dojoengine_recs.Type.Boolean;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        QuestConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            production_material_multiplier: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        QuestRewardConfig: _dojoengine_recs.Component<{
            quest_id: _dojoengine_recs.Type.Number;
            detached_resource_id: _dojoengine_recs.Type.Number;
            detached_resource_count: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Realm: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            realm_id: _dojoengine_recs.Type.Number;
            produced_resources: _dojoengine_recs.Type.BigInt;
            order: _dojoengine_recs.Type.Number;
            level: _dojoengine_recs.Type.Number;
            has_wonder: _dojoengine_recs.Type.Boolean;
            settler_address: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        RealmLevelConfig: _dojoengine_recs.Component<{
            level: _dojoengine_recs.Type.Number;
            required_resources_id: _dojoengine_recs.Type.Number;
            required_resource_count: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        RealmMaxLevelConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            max_level: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Resource: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            balance: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ResourceAllowance: _dojoengine_recs.Component<{
            owner_entity_id: _dojoengine_recs.Type.Number;
            approved_entity_id: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ResourceBridgeFeeSplitConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            velords_fee_on_dpt_percent: _dojoengine_recs.Type.Number;
            velords_fee_on_wtdr_percent: _dojoengine_recs.Type.Number;
            season_pool_fee_on_dpt_percent: _dojoengine_recs.Type.Number;
            season_pool_fee_on_wtdr_percent: _dojoengine_recs.Type.Number;
            client_fee_on_dpt_percent: _dojoengine_recs.Type.Number;
            client_fee_on_wtdr_percent: _dojoengine_recs.Type.Number;
            velords_fee_recipient: _dojoengine_recs.Type.BigInt;
            season_pool_fee_recipient: _dojoengine_recs.Type.BigInt;
            max_bank_fee_dpt_percent: _dojoengine_recs.Type.Number;
            max_bank_fee_wtdr_percent: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ResourceBridgeWhitelistConfig: _dojoengine_recs.Component<{
            token: _dojoengine_recs.Type.BigInt;
            resource_type: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ResourceCost: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            index: _dojoengine_recs.Type.Number;
            resource_type: _dojoengine_recs.Type.Number;
            amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        ResourceTransferLock: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            start_at: _dojoengine_recs.Type.BigInt;
            release_at: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Season: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            start_at: _dojoengine_recs.Type.BigInt;
            is_over: _dojoengine_recs.Type.Boolean;
            ended_at: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        SeasonAddressesConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            season_pass_address: _dojoengine_recs.Type.BigInt;
            realms_address: _dojoengine_recs.Type.BigInt;
            lords_address: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        SeasonBridgeConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            close_after_end_seconds: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        SettlementConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            angle_scaled: _dojoengine_recs.Type.BigInt;
            center: _dojoengine_recs.Type.Number;
            min_scaling_factor_scaled: _dojoengine_recs.Type.BigInt;
            radius: _dojoengine_recs.Type.Number;
            min_distance: _dojoengine_recs.Type.Number;
            max_distance: _dojoengine_recs.Type.Number;
            min_angle_increase: _dojoengine_recs.Type.BigInt;
            max_angle_increase: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        SpeedConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            speed_config_id: _dojoengine_recs.Type.Number;
            entity_type: _dojoengine_recs.Type.Number;
            sec_per_km: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Stamina: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            amount: _dojoengine_recs.Type.Number;
            last_refill_tick: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        StaminaConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            unit_type: _dojoengine_recs.Type.Number;
            max_stamina: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        StaminaRefillConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            amount_per_tick: _dojoengine_recs.Type.Number;
            start_boost_tick_count: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Status: _dojoengine_recs.Component<{
            trade_id: _dojoengine_recs.Type.Number;
            value: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Structure: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            category: _dojoengine_recs.Type.String;
            created_at: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        StructureCount: _dojoengine_recs.Component<{
            coord: {
                x: _dojoengine_recs.Type.Number;
                y: _dojoengine_recs.Type.Number;
            };
            count: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        TickConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            tick_id: _dojoengine_recs.Type.Number;
            tick_interval_in_seconds: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Tile: _dojoengine_recs.Component<{
            col: _dojoengine_recs.Type.Number;
            row: _dojoengine_recs.Type.Number;
            explored_by_id: _dojoengine_recs.Type.Number;
            explored_at: _dojoengine_recs.Type.BigInt;
            biome: _dojoengine_recs.Type.String;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: string[];
        }, unknown>;
        Trade: _dojoengine_recs.Component<{
            trade_id: _dojoengine_recs.Type.Number;
            maker_id: _dojoengine_recs.Type.Number;
            maker_gives_resources_origin_id: _dojoengine_recs.Type.Number;
            maker_gives_resources_id: _dojoengine_recs.Type.Number;
            maker_gives_resources_hash: _dojoengine_recs.Type.BigInt;
            maker_gives_resources_weight: _dojoengine_recs.Type.BigInt;
            taker_id: _dojoengine_recs.Type.Number;
            taker_gives_resources_origin_id: _dojoengine_recs.Type.Number;
            taker_gives_resources_id: _dojoengine_recs.Type.Number;
            taker_gives_resources_hash: _dojoengine_recs.Type.BigInt;
            taker_gives_resources_weight: _dojoengine_recs.Type.BigInt;
            expires_at: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        TravelFoodCostConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            unit_type: _dojoengine_recs.Type.Number;
            explore_wheat_burn_amount: _dojoengine_recs.Type.BigInt;
            explore_fish_burn_amount: _dojoengine_recs.Type.BigInt;
            travel_wheat_burn_amount: _dojoengine_recs.Type.BigInt;
            travel_fish_burn_amount: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        TravelStaminaCostConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            travel_type: _dojoengine_recs.Type.Number;
            cost: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        TroopConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            health: _dojoengine_recs.Type.Number;
            knight_strength: _dojoengine_recs.Type.Number;
            paladin_strength: _dojoengine_recs.Type.Number;
            crossbowman_strength: _dojoengine_recs.Type.Number;
            advantage_percent: _dojoengine_recs.Type.Number;
            disadvantage_percent: _dojoengine_recs.Type.Number;
            max_troop_count: _dojoengine_recs.Type.Number;
            pillage_health_divisor: _dojoengine_recs.Type.Number;
            army_free_per_structure: _dojoengine_recs.Type.Number;
            army_extra_per_building: _dojoengine_recs.Type.Number;
            army_max_per_structure: _dojoengine_recs.Type.Number;
            battle_leave_slash_num: _dojoengine_recs.Type.Number;
            battle_leave_slash_denom: _dojoengine_recs.Type.Number;
            battle_time_scale: _dojoengine_recs.Type.Number;
            battle_max_time_seconds: _dojoengine_recs.Type.Number;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        Weight: _dojoengine_recs.Component<{
            entity_id: _dojoengine_recs.Type.Number;
            value: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        WeightConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            weight_config_id: _dojoengine_recs.Type.Number;
            entity_type: _dojoengine_recs.Type.Number;
            weight_gram: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
        WorldConfig: _dojoengine_recs.Component<{
            config_id: _dojoengine_recs.Type.Number;
            admin_address: _dojoengine_recs.Type.BigInt;
            realm_l2_contract: _dojoengine_recs.Type.BigInt;
        }, {
            namespace: string;
            name: string;
            types: string[];
            customTypes: never[];
        }, unknown>;
    };
    provider: EternumProvider;
    world: {
        registerEntity: ({ id, idSuffix }?: {
            id?: string | undefined;
            idSuffix?: string | undefined;
        }) => _dojoengine_recs.Entity;
        components: _dojoengine_recs.Component<_dojoengine_recs.Schema, _dojoengine_recs.Metadata, unknown>[];
        registerComponent: (component: _dojoengine_recs.Component) => void;
        dispose: (namespace?: string) => void;
        registerDisposer: (disposer: () => void, namespace?: string) => void;
        hasEntity: (entity: _dojoengine_recs.Entity) => boolean;
        getEntities: () => IterableIterator<_dojoengine_recs.Entity>;
        entitySymbols: Set<_dojoengine_recs.EntitySymbol>;
        deleteEntity: (entity: _dojoengine_recs.Entity) => void;
    };
    burnerManager: BurnerManager;
}>;

declare const world: {
    registerEntity: ({ id, idSuffix }?: {
        id?: string | undefined;
        idSuffix?: string | undefined;
    }) => _dojoengine_recs.Entity;
    components: _dojoengine_recs.Component<_dojoengine_recs.Schema, _dojoengine_recs.Metadata, unknown>[];
    registerComponent: (component: _dojoengine_recs.Component) => void;
    dispose: (namespace?: string) => void;
    registerDisposer: (disposer: () => void, namespace?: string) => void;
    hasEntity: (entity: _dojoengine_recs.Entity) => boolean;
    getEntities: () => IterableIterator<_dojoengine_recs.Entity>;
    entitySymbols: Set<_dojoengine_recs.EntitySymbol>;
    deleteEntity: (entity: _dojoengine_recs.Entity) => void;
};

declare function createSystemCalls({ provider }: {
    provider: _bibliothecadao_eternum.EternumProvider;
}): {
    send_resources: (props: _bibliothecadao_eternum.SendResourcesProps) => Promise<void>;
    send_resources_multiple: (props: _bibliothecadao_eternum.SendResourcesMultipleProps) => Promise<void>;
    pickup_resources: (props: _bibliothecadao_eternum.PickupResourcesProps) => Promise<void>;
    remove_liquidity: (props: _bibliothecadao_eternum.RemoveLiquidityProps) => Promise<void>;
    add_liquidity: (props: _bibliothecadao_eternum.AddLiquidityProps) => Promise<void>;
    sell_resources: (props: _bibliothecadao_eternum.SellResourcesProps) => Promise<void>;
    buy_resources: (props: _bibliothecadao_eternum.BuyResourcesProps) => Promise<void>;
    change_bank_owner_fee: (props: _bibliothecadao_eternum.ChangeBankOwnerFeeProps) => Promise<void>;
    open_account: (props: _bibliothecadao_eternum.OpenAccountProps) => Promise<void>;
    create_bank: (props: _bibliothecadao_eternum.CreateBankProps) => Promise<void>;
    explore: (props: _bibliothecadao_eternum.ExploreProps) => Promise<void>;
    set_address_name: (props: _bibliothecadao_eternum.SetAddressNameProps) => Promise<void>;
    set_entity_name: (props: _bibliothecadao_eternum.SetEntityNameProps) => Promise<void>;
    isLive: () => Promise<boolean>;
    create_order: (props: _bibliothecadao_eternum.CreateOrderProps) => Promise<void>;
    accept_order: (props: _bibliothecadao_eternum.AcceptOrderProps) => Promise<void>;
    cancel_order: (props: _bibliothecadao_eternum.CancelOrderProps) => Promise<void>;
    accept_partial_order: (props: _bibliothecadao_eternum.AcceptPartialOrderProps) => Promise<void>;
    upgrade_realm: (props: _bibliothecadao_eternum.UpgradeRealmProps) => Promise<void>;
    create_multiple_realms: (props: _bibliothecadao_eternum.CreateMultipleRealmsProps) => Promise<void>;
    create_multiple_realms_dev: (props: _bibliothecadao_eternum.CreateMultipleRealmsDevProps) => Promise<void>;
    transfer_resources: (props: _bibliothecadao_eternum.TransferResourcesProps) => Promise<void>;
    travel_hex: (props: _bibliothecadao_eternum.TravelHexProps) => Promise<void>;
    destroy_building: (props: _bibliothecadao_eternum.DestroyBuildingProps) => Promise<void>;
    pause_production: (props: _bibliothecadao_eternum.PauseProductionProps) => Promise<void>;
    resume_production: (props: _bibliothecadao_eternum.ResumeProductionProps) => Promise<void>;
    create_building: (props: _bibliothecadao_eternum.CreateBuildingProps) => Promise<void>;
    create_army: (props: _bibliothecadao_eternum.ArmyCreateProps) => Promise<void>;
    delete_army: (props: _bibliothecadao_eternum.ArmyDeleteProps) => Promise<void>;
    uuid: () => Promise<number>;
    create_hyperstructure: (props: _bibliothecadao_eternum.CreateHyperstructureProps) => Promise<void>;
    contribute_to_construction: (props: _bibliothecadao_eternum.ContributeToConstructionProps) => Promise<void>;
    set_access: (props: _bibliothecadao_eternum.SetAccessProps) => Promise<void>;
    set_co_owners: (props: _bibliothecadao_eternum.SetCoOwnersProps) => Promise<void>;
    get_points: (props: _bibliothecadao_eternum.GetPointsProps) => Promise<starknet.Result>;
    end_game: (props: _bibliothecadao_eternum.EndGameProps) => Promise<void>;
    register_to_leaderboard: (props: _bibliothecadao_eternum.RegisterToLeaderboardProps) => Promise<void>;
    claim_leaderboard_rewards: (props: _bibliothecadao_eternum.ClaimLeaderboardRewardsProps) => Promise<void>;
    claim_quest: (props: _bibliothecadao_eternum.ClaimQuestProps) => Promise<void>;
    mint_resources: (props: _bibliothecadao_eternum.MintResourcesProps) => Promise<void>;
    army_buy_troops: (props: _bibliothecadao_eternum.ArmyBuyTroopsProps) => Promise<void>;
    army_merge_troops: (props: _bibliothecadao_eternum.ArmyMergeTroopsProps) => Promise<void>;
    create_guild: (props: _bibliothecadao_eternum.CreateGuildProps) => Promise<void>;
    join_guild: (props: _bibliothecadao_eternum.JoinGuildProps) => Promise<void>;
    whitelist_player: (props: _bibliothecadao_eternum.WhitelistPlayerProps) => Promise<void>;
    transfer_guild_ownership: (props: _bibliothecadao_eternum.TransferGuildOwnership) => Promise<void>;
    remove_guild_member: (props: _bibliothecadao_eternum.RemoveGuildMember) => Promise<void>;
    disband_guild: (props: _bibliothecadao_eternum.DisbandGuild) => Promise<void>;
    remove_player_from_whitelist: (props: _bibliothecadao_eternum.RemovePlayerFromWhitelist) => Promise<void>;
    battle_start: (props: _bibliothecadao_eternum.BattleStartProps) => Promise<void>;
    battle_force_start: (props: _bibliothecadao_eternum.BattleForceStartProps) => Promise<void>;
    battle_resolve: (props: _bibliothecadao_eternum.BattleResolveProps) => Promise<void>;
    battle_leave: (props: _bibliothecadao_eternum.BattleLeaveProps) => Promise<void>;
    battle_join: (props: _bibliothecadao_eternum.BattleJoinProps) => Promise<void>;
    battle_claim: (props: _bibliothecadao_eternum.BattleClaimProps) => Promise<void>;
    battle_pillage: (props: _bibliothecadao_eternum.BattlePillageProps) => Promise<void>;
    battle_leave_and_claim: (props: _bibliothecadao_eternum.BattleClaimAndLeaveProps) => Promise<void>;
    battle_leave_and_pillage: (props: _bibliothecadao_eternum.BattleLeaveAndRaidProps) => Promise<void>;
};

interface DojoAccount {
    create: () => void;
    list: () => any[];
    get: (id: string) => any;
    select: (id: string) => void;
    account: Account | AccountInterface;
    isDeploying: boolean;
    clear: () => void;
    accountDisplay: string;
}
interface DojoContextType extends SetupResult {
    masterAccount: Account | AccountInterface;
    account: DojoAccount;
}
interface DojoResult {
    setup: DojoContextType;
    account: DojoAccount;
    network: SetupNetworkResult;
    masterAccount: Account | AccountInterface;
}
declare const DojoContext: React$1.Context<DojoContextType | null>;
declare const useDojo: () => DojoResult;

type BattleInfo = ComponentValue<ClientComponents["Battle"]["schema"]> & {
    isStructureBattle: boolean;
    position: ComponentValue<ClientComponents["Position"]["schema"]>;
};
declare const useBattleManager: (battleEntityId: ID) => BattleManager;
declare const useBattlesByPosition: ({ x, y }: Position$1) => BattleInfo[];
declare const useUserBattles: () => BattleInfo[];

declare const useArmiesByEntityOwner: ({ entity_owner_entity_id }: {
    entity_owner_entity_id: ID;
}) => {
    entityArmies: ArmyInfo[];
};
declare const useArmiesByEntityOwnerWithPositionAndQuantity: ({ entity_owner_entity_id, }: {
    entity_owner_entity_id: ID;
}) => {
    entityArmies: ArmyInfo[];
};
declare const getArmiesByBattleId: () => (battle_id: ID) => ArmyInfo[];
declare const useArmyByArmyEntityId: (entityId: ID) => ArmyInfo | undefined;
declare const getUserArmyInBattle: (battle_id: ID) => ArmyInfo;
declare const useOwnArmiesByPosition: ({ position, inBattle, playerStructures, }: {
    position: Position$1;
    inBattle: boolean;
    playerStructures: PlayerStructure[];
}) => ArmyInfo[];
declare const useEnemyArmiesByPosition: ({ position, playerStructures, }: {
    position: Position$1;
    playerStructures: PlayerStructure[];
}) => ArmyInfo[];
declare const getArmyByEntityId: () => {
    getAliveArmy: (entity_id: ID) => ArmyInfo | undefined;
    getArmy: (entity_id: ID) => ArmyInfo | undefined;
};
declare const getArmiesByPosition: () => (position: Position$1) => ArmyInfo[];

declare const useGetBanks: (onlyMine?: boolean) => {
    entityId: ID;
    position: Position$1;
    owner: string;
    ownerFee: number;
    depositFee: number;
    withdrawFee: number;
}[];

declare const useBattleStart: (battleEntityId: ID) => (_dojoengine_recs.ComponentValue<{
    id: _dojoengine_recs.Type.Number;
    event_id: _dojoengine_recs.Type.String;
    battle_entity_id: _dojoengine_recs.Type.Number;
    attacker: _dojoengine_recs.Type.BigInt;
    attacker_name: _dojoengine_recs.Type.BigInt;
    attacker_army_entity_id: _dojoengine_recs.Type.Number;
    defender_name: _dojoengine_recs.Type.BigInt;
    defender: _dojoengine_recs.Type.BigInt;
    defender_army_entity_id: _dojoengine_recs.Type.Number;
    duration_left: _dojoengine_recs.Type.Number;
    x: _dojoengine_recs.Type.Number;
    y: _dojoengine_recs.Type.Number;
    structure_type: _dojoengine_recs.Type.String;
    timestamp: _dojoengine_recs.Type.Number;
}, unknown> | undefined)[];
declare const useBattleJoin: (battleEntityId: ID, joinerSide?: BattleSide) => (_dojoengine_recs.ComponentValue<{
    id: _dojoengine_recs.Type.Number;
    event_id: _dojoengine_recs.Type.String;
    battle_entity_id: _dojoengine_recs.Type.Number;
    joiner: _dojoengine_recs.Type.BigInt;
    joiner_name: _dojoengine_recs.Type.BigInt;
    joiner_army_entity_id: _dojoengine_recs.Type.Number;
    joiner_side: _dojoengine_recs.Type.String;
    duration_left: _dojoengine_recs.Type.Number;
    x: _dojoengine_recs.Type.Number;
    y: _dojoengine_recs.Type.Number;
    timestamp: _dojoengine_recs.Type.Number;
}, unknown> | undefined)[];
declare const useBattleLeave: (battleEntityId: ID, leaverSide?: BattleSide) => (_dojoengine_recs.ComponentValue<{
    id: _dojoengine_recs.Type.Number;
    event_id: _dojoengine_recs.Type.String;
    battle_entity_id: _dojoengine_recs.Type.Number;
    leaver: _dojoengine_recs.Type.BigInt;
    leaver_name: _dojoengine_recs.Type.BigInt;
    leaver_army_entity_id: _dojoengine_recs.Type.Number;
    leaver_side: _dojoengine_recs.Type.String;
    duration_left: _dojoengine_recs.Type.Number;
    x: _dojoengine_recs.Type.Number;
    y: _dojoengine_recs.Type.Number;
    timestamp: _dojoengine_recs.Type.Number;
}, unknown> | undefined)[];

interface Building {
    name: string;
    category: string;
    paused: boolean;
    produced: ResourceCost;
    consumed: ResourceCost[];
    bonusPercent: number;
    innerCol: number;
    innerRow: number;
}
declare const useBuildings: () => {
    getBuildings: (outerCol: number, outerRow: number) => Building[];
};

declare const useContributions: () => {
    getContributions: (hyperstructureEntityId: ID) => ComponentValue<ClientComponents["Contribution"]["schema"]>[];
    useContributionsByPlayerAddress: (playerAddress: ContractAddress, hyperstructureEntityId: ID) => ComponentValue<{
        hyperstructure_entity_id: _dojoengine_recs.Type.Number;
        player_address: _dojoengine_recs.Type.BigInt;
        resource_type: _dojoengine_recs.Type.Number;
        amount: _dojoengine_recs.Type.BigInt;
    }, unknown>[];
    getContributionsTotalPercentage: (hyperstructureId: number, contributions: Resource[]) => number;
};
declare const useGetHyperstructuresWithContributionsFromPlayer: () => () => Set<number>;
declare const useGetUnregisteredContributions: () => () => number[];

type PlayerStructure = ComponentValue<ClientComponents["Structure"]["schema"]> & {
    position: ComponentValue<ClientComponents["Position"]["schema"]>;
    name: string;
    category?: string | undefined;
    owner: ComponentValue<ClientComponents["Owner"]["schema"]>;
};
type RealmWithPosition = ComponentValue<ClientComponents["Realm"]["schema"]> & {
    position: ComponentValue<ClientComponents["Position"]["schema"]>;
    name: string;
    owner: ComponentValue<ClientComponents["Owner"]["schema"]>;
};
declare const useEntities: () => {
    playerRealms: (filterFn?: (realm: RealmWithPosition) => boolean) => RealmWithPosition[];
    playerStructures: (filterFn?: (structure: PlayerStructure) => boolean) => PlayerStructure[];
};
declare const useEntitiesUtils: () => {
    getEntityName: (entityId: ID, abbreviate?: boolean) => string;
    getEntityInfo: (entityId: ID) => {
        entityId: number;
        arrivalTime: bigint | undefined;
        blocked: boolean;
        capacity: number;
        intermediateDestination: {
            x: number;
            y: number;
        } | undefined;
        position: {
            x: number;
            y: number;
        } | undefined;
        homePosition: {
            x: number;
            y: number;
        } | undefined;
        owner: bigint | undefined;
        isMine: boolean;
        isRoundTrip: boolean;
        resources: _bibliothecadao_eternum.Resource[];
        entityType: EntityType;
        structureCategory: string | undefined;
        structure: ComponentValue<{
            entity_id: _dojoengine_recs.Type.Number;
            category: _dojoengine_recs.Type.String;
            created_at: _dojoengine_recs.Type.BigInt;
        }, unknown> | undefined;
        name: string;
    };
    getAddressName: (address: ContractAddress) => string | undefined;
    getAddressNameFromEntity: (entityId: ID) => string | undefined;
    getPlayerAddressFromEntity: (entityId: ID) => ContractAddress | undefined;
};

declare const useFragmentMines: () => {
    fragmentMines: {
        owner: string;
        name: string;
        entity_id?: number | undefined;
        resource_type?: number | undefined;
        building_count?: number | undefined;
        production_rate?: bigint | undefined;
        consumption_rate?: bigint | undefined;
        last_updated_tick?: bigint | undefined;
        input_finish_tick?: bigint | undefined;
        outer_col?: number | undefined;
        outer_row?: number | undefined;
        inner_col?: number | undefined;
        inner_row?: number | undefined;
        category?: string | undefined;
        produced_resource_type?: number | undefined;
        bonus_percent?: number | undefined;
        outer_entity_id?: number | undefined;
        paused?: boolean | undefined;
        x?: number | undefined;
        y?: number | undefined;
        created_at?: bigint | undefined;
    }[];
};

declare const useGetAllPlayers: (env: {
    viteLordsAddress: string;
}) => () => Player[];

declare const useGuilds: () => {
    useGuildQuery: () => {
        guilds: GuildInfo[];
    };
    getGuildFromPlayerAddress: (accountAddress: ContractAddress) => GuildInfo | undefined;
    useGuildMembers: (guildEntityId: ID, players: Player[]) => {
        guildMembers: GuildMemberInfo[];
    };
    useGuildWhitelist: (guildEntityId: ID, players: Player[]) => GuildWhitelistInfo[];
    usePlayerWhitelist: (address: ContractAddress) => GuildWhitelistInfo[];
    getGuildFromEntityId: (entityId: ID, accountAddress: ContractAddress) => {
        guild: GuildInfo;
        isOwner: boolean;
        name: string;
    } | undefined;
    getPlayersInPlayersGuild: (accountAddress: ContractAddress) => {
        name: string;
        address: string;
    }[];
    getPlayerListInGuild: (guild_entity_id: ID) => {
        name: string;
        address: string;
    }[];
};

type ProgressWithPercentage = {
    percentage: number;
    costNeeded: number;
    hyperstructure_entity_id: ID;
    resource_type: ResourcesIds;
    amount: number;
};
declare const useHyperstructures: () => {
    hyperstructures: {
        owner: string;
        isOwner: boolean;
        ownerName: string | undefined;
        entityIdPoseidon: Entity;
        name: string;
        length: number;
        toString(): string;
        toLocaleString(): string;
        toLocaleString(locales: string | string[], options?: Intl.NumberFormatOptions & Intl.DateTimeFormatOptions): string;
        pop(): ComponentValue<_dojoengine_recs.Schema, unknown> | undefined;
        push(...items: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]): number;
        concat(...items: ConcatArray<ComponentValue<_dojoengine_recs.Schema, unknown> | undefined>[]): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        concat(...items: (ComponentValue<_dojoengine_recs.Schema, unknown> | ConcatArray<ComponentValue<_dojoengine_recs.Schema, unknown> | undefined> | undefined)[]): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        join(separator?: string): string;
        reverse(): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        shift(): ComponentValue<_dojoengine_recs.Schema, unknown> | undefined;
        slice(start?: number, end?: number): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        sort(compareFn?: ((a: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, b: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined) => number) | undefined): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        splice(start: number, deleteCount?: number): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        splice(start: number, deleteCount: number, ...items: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        unshift(...items: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]): number;
        indexOf(searchElement: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, fromIndex?: number): number;
        lastIndexOf(searchElement: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, fromIndex?: number): number;
        every<S extends ComponentValue<_dojoengine_recs.Schema, unknown> | undefined>(predicate: (value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, index: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => value is S, thisArg?: any): this is S[];
        every(predicate: (value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, index: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => unknown, thisArg?: any): boolean;
        some(predicate: (value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, index: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => unknown, thisArg?: any): boolean;
        forEach(callbackfn: (value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, index: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => void, thisArg?: any): void;
        map<U>(callbackfn: (value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, index: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => U, thisArg?: any): U[];
        filter<S extends ComponentValue<_dojoengine_recs.Schema, unknown> | undefined>(predicate: (value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, index: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => value is S, thisArg?: any): S[];
        filter(predicate: (value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, index: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => unknown, thisArg?: any): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        reduce(callbackfn: (previousValue: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, currentValue: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, currentIndex: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => ComponentValue<_dojoengine_recs.Schema, unknown> | undefined): ComponentValue<_dojoengine_recs.Schema, unknown> | undefined;
        reduce(callbackfn: (previousValue: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, currentValue: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, currentIndex: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, initialValue: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined): ComponentValue<_dojoengine_recs.Schema, unknown> | undefined;
        reduce<U>(callbackfn: (previousValue: U, currentValue: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, currentIndex: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => U, initialValue: U): U;
        reduceRight(callbackfn: (previousValue: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, currentValue: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, currentIndex: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => ComponentValue<_dojoengine_recs.Schema, unknown> | undefined): ComponentValue<_dojoengine_recs.Schema, unknown> | undefined;
        reduceRight(callbackfn: (previousValue: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, currentValue: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, currentIndex: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, initialValue: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined): ComponentValue<_dojoengine_recs.Schema, unknown> | undefined;
        reduceRight<U>(callbackfn: (previousValue: U, currentValue: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, currentIndex: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => U, initialValue: U): U;
        find<S extends ComponentValue<_dojoengine_recs.Schema, unknown> | undefined>(predicate: (value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, index: number, obj: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => value is S, thisArg?: any): S | undefined;
        find(predicate: (value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, index: number, obj: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => unknown, thisArg?: any): ComponentValue<_dojoengine_recs.Schema, unknown> | undefined;
        findIndex(predicate: (value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, index: number, obj: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => unknown, thisArg?: any): number;
        fill(value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, start?: number, end?: number): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        copyWithin(target: number, start: number, end?: number): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        entries(): ArrayIterator<[number, ComponentValue<_dojoengine_recs.Schema, unknown> | undefined]>;
        keys(): ArrayIterator<number>;
        values(): ArrayIterator<ComponentValue<_dojoengine_recs.Schema, unknown> | undefined>;
        includes(searchElement: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, fromIndex?: number): boolean;
        flatMap<U, This = undefined>(callback: (this: This, value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, index: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => U | readonly U[], thisArg?: This | undefined): U[];
        flat<A, D extends number = 1>(this: A, depth?: D | undefined): FlatArray<A, D>[];
        at(index: number): ComponentValue<_dojoengine_recs.Schema, unknown> | undefined;
        findLast<S extends ComponentValue<_dojoengine_recs.Schema, unknown> | undefined>(predicate: (value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, index: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => value is S, thisArg?: any): S | undefined;
        findLast(predicate: (value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, index: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => unknown, thisArg?: any): ComponentValue<_dojoengine_recs.Schema, unknown> | undefined;
        findLastIndex(predicate: (value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, index: number, array: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]) => unknown, thisArg?: any): number;
        toReversed(): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        toSorted(compareFn?: ((a: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined, b: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined) => number) | undefined): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        toSpliced(start: number, deleteCount: number, ...items: (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[]): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        toSpliced(start: number, deleteCount?: number): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        with(index: number, value: ComponentValue<_dojoengine_recs.Schema, unknown> | undefined): (ComponentValue<_dojoengine_recs.Schema, unknown> | undefined)[];
        [Symbol.iterator](): ArrayIterator<ComponentValue<_dojoengine_recs.Schema, unknown> | undefined>;
        [Symbol.unscopables]: {
            [x: number]: boolean | undefined;
            length?: boolean | undefined;
            toString?: boolean | undefined;
            toLocaleString?: boolean | undefined;
            pop?: boolean | undefined;
            push?: boolean | undefined;
            concat?: boolean | undefined;
            join?: boolean | undefined;
            reverse?: boolean | undefined;
            shift?: boolean | undefined;
            slice?: boolean | undefined;
            sort?: boolean | undefined;
            splice?: boolean | undefined;
            unshift?: boolean | undefined;
            indexOf?: boolean | undefined;
            lastIndexOf?: boolean | undefined;
            every?: boolean | undefined;
            some?: boolean | undefined;
            forEach?: boolean | undefined;
            map?: boolean | undefined;
            filter?: boolean | undefined;
            reduce?: boolean | undefined;
            reduceRight?: boolean | undefined;
            find?: boolean | undefined;
            findIndex?: boolean | undefined;
            fill?: boolean | undefined;
            copyWithin?: boolean | undefined;
            entries?: boolean | undefined;
            keys?: boolean | undefined;
            values?: boolean | undefined;
            includes?: boolean | undefined;
            flatMap?: boolean | undefined;
            flat?: boolean | undefined;
            at?: boolean | undefined;
            findLast?: boolean | undefined;
            findLastIndex?: boolean | undefined;
            toReversed?: boolean | undefined;
            toSorted?: boolean | undefined;
            toSpliced?: boolean | undefined;
            with?: boolean | undefined;
            [Symbol.iterator]?: boolean | undefined;
            readonly [Symbol.unscopables]?: boolean | undefined;
        };
        entity_id?: number | undefined;
        x?: number | undefined;
        y?: number | undefined;
        category?: string | undefined;
        created_at?: bigint | undefined;
        current_epoch?: number | undefined;
        completed?: boolean | undefined;
        last_updated_by?: bigint | undefined;
        last_updated_timestamp?: number | undefined;
        access?: string | undefined;
        randomness?: bigint | undefined;
    }[];
};
declare const useGetHyperstructureProgress: () => (hyperstructureEntityId: ID) => {
    percentage: number;
    progresses: {
        hyperstructure_entity_id: number;
        resource_type: ResourcesIds;
        amount: number;
        percentage: number;
        costNeeded: number;
    }[];
};
declare const useHyperstructureProgress: (hyperstructureEntityId: ID) => {
    percentage: number;
    progresses: {
        hyperstructure_entity_id: number;
        resource_type: ResourcesIds;
        amount: number;
        percentage: number;
        costNeeded: number;
    }[];
};
declare const useHyperstructureUpdates: (hyperstructureEntityId: ID) => (ComponentValue<{
    entity_id: _dojoengine_recs.Type.Number;
    current_epoch: _dojoengine_recs.Type.Number;
    completed: _dojoengine_recs.Type.Boolean;
    last_updated_by: _dojoengine_recs.Type.BigInt;
    last_updated_timestamp: _dojoengine_recs.Type.Number;
    access: _dojoengine_recs.Type.String;
    randomness: _dojoengine_recs.Type.BigInt;
}, unknown> | undefined)[];
declare const useGetPlayerEpochs: () => () => {
    hyperstructure_entity_id: ID;
    epoch: number;
}[];
declare const useGetUnregisteredEpochs: () => () => {
    hyperstructure_entity_id: ID;
    epoch: number;
}[];

type Track = {
    name: string;
    url: string;
};
declare const tracks: Track[];
declare const useMusicPlayer: () => {
    play: use_sound_dist_types.PlayFunction;
    stop: (id?: string) => void;
    trackName: string;
    next: () => Promise<void>;
    isPlaying: boolean;
};

declare const useNextBlockTimestamp: () => {
    nextBlockTimestamp: number;
    currentDefaultTick: number;
    currentArmiesTick: number;
};

declare const useQuery: () => {
    isLocation: (col: number, row: number) => boolean;
    handleUrlChange: (url: string) => void;
    hexPosition: {
        col: number;
        row: number;
    };
    isMapView: boolean;
};

declare enum QuestStatus {
    InProgress = 0,
    Completed = 1,
    Claimed = 2
}
declare const useQuests: () => {
    quests: {
        status: QuestStatus;
        name: string;
        prizes: Prize[];
        depth: number;
        id: QuestType;
    }[];
};
declare const useUnclaimedQuestsCount: () => {
    unclaimedQuestsCount: number;
};
declare const armyHasTroops: (entityArmies: (ArmyInfo | undefined)[]) => boolean;

interface RealmInfo {
    realmId: ID;
    entityId: ID;
    name: string;
    resourceTypesPacked: bigint;
    order: number;
    position: ComponentValue<ClientComponents["Position"]["schema"]>;
    population?: number | undefined;
    capacity?: number;
    hasCapacity: boolean;
    owner: ContractAddress;
    ownerName: string;
    hasWonder: boolean;
}
declare function useRealm(): {
    getQuestResources: () => _bibliothecadao_eternum.ResourceInputs;
    getEntityOwner: (entityId: ID) => number | undefined;
    isRealmIdSettled: (realmId: ID) => boolean;
    getNextRealmIdForOrder: (order: number) => number;
    getAddressName: (address: ContractAddress) => string | undefined;
    getAddressOrder: (address: ContractAddress) => number | undefined;
    getRealmAddressName: (realmEntityId: ID) => string;
    getRealmIdForOrderAfter: (order: number, realmId: ID) => ID;
    getRealmIdFromRealmEntityId: (realmEntityId: ID) => number | undefined;
    getRealmEntityIdFromRealmId: (realmId: ID) => ID | undefined;
    isEntityIdRealm: (entityId: ID) => boolean;
    getRealmEntityIdsOnPosition: (x: number, y: number) => number | undefined;
    getRandomUnsettledRealmId: () => number;
};
declare function useGetRealm(realmEntityId: ID | undefined): {
    realm: any;
};
declare function getRealms(): RealmInfo[];
declare function usePlayerRealms(): RealmInfo[];

type ArrivalInfo = {
    entityId: ID;
    recipientEntityId: ID;
    position: Position$1;
    arrivesAt: bigint;
    isOwner: boolean;
    hasResources: boolean;
    isHome: boolean;
};
declare const usePlayerArrivalsNotifications: () => {
    arrivedNotificationLength: number;
    nonArrivedNotificationLength: number;
    arrivals: ArrivalInfo[];
};

declare function useResourcesUtils(): {
    getRealmsWithSpecificResource: (resourceId: ResourcesIds, minAmount: number) => Array<{
        realmEntityId: ID;
        realmId: ID;
        amount: number;
    }>;
    getResourcesFromBalance: (entityId: ID) => Resource[];
    getResourceCosts: (costUuid: bigint, count: number) => {
        resourceId: number;
        amount: number;
    }[];
    useResourcesFromBalance: (entityId: ID) => {
        resourceId: number;
        amount: number;
    }[];
};
declare function useResourceBalance(): {
    getFoodResources: (entityId: ID) => Resource[];
    getBalance: (entityId: ID, resourceId: ResourcesIds) => {
        balance: number;
        resourceId: ResourcesIds;
    };
    useBalance: (entityId: ID, resourceId: ResourcesIds) => Resource;
    getResourcesBalance: (entityId: ID) => (_dojoengine_recs.ComponentValue<{
        entity_id: _dojoengine_recs.Type.Number;
        index: _dojoengine_recs.Type.Number;
        resource_type: _dojoengine_recs.Type.Number;
        resource_amount: _dojoengine_recs.Type.BigInt;
    }, unknown> | undefined)[];
    getResourceProductionInfo: (entityId: ID, resourceId: ResourcesIds) => _dojoengine_recs.ComponentValue<{
        entity_id: _dojoengine_recs.Type.Number;
        resource_type: _dojoengine_recs.Type.Number;
        building_count: _dojoengine_recs.Type.Number;
        production_rate: _dojoengine_recs.Type.BigInt;
        consumption_rate: _dojoengine_recs.Type.BigInt;
        last_updated_tick: _dojoengine_recs.Type.BigInt;
        input_finish_tick: _dojoengine_recs.Type.BigInt;
    }, unknown> | undefined;
};
declare const useResourceManager: (entityId: ID, resourceId: ResourcesIds) => ResourceManager;

declare const usePrizePool: (env: {
    viteLordsAddress: string;
}) => bigint;

declare const useScreenOrientation: () => {
    orientation: OrientationType | undefined;
    toggleFullScreen: () => void;
    isFullScreen: () => boolean;
};

declare const useSeasonStart: () => {
    seasonStart: bigint;
    countdown: bigint;
    nextBlockTimestamp: bigint;
};

declare const useStaminaManager: (entityId: ID) => StaminaManager;

declare const useStartingTutorial: () => void;

declare const useStructureEntityId: () => void;

declare const useStructureAtPosition: ({ x, y }: Position$1) => Structure | undefined;
declare const useStructureByPosition: () => ({ x, y }: Position$1) => {
    entityOwner: _dojoengine_recs.ComponentValue<{
        entity_id: _dojoengine_recs.Type.Number;
        entity_owner_id: _dojoengine_recs.Type.Number;
    }, unknown>;
    owner: _dojoengine_recs.ComponentValue<{
        entity_id: _dojoengine_recs.Type.Number;
        address: _dojoengine_recs.Type.BigInt;
    }, unknown>;
    name: string;
    protector: _bibliothecadao_eternum.ArmyInfo | undefined;
    isMine: boolean;
    isMercenary: boolean;
    entity_id: number;
    category: string;
    created_at: bigint;
} | undefined;
declare const useStructureByEntityId: (entityId: ID) => {
    entityOwner: _dojoengine_recs.ComponentValue<{
        entity_id: _dojoengine_recs.Type.Number;
        entity_owner_id: _dojoengine_recs.Type.Number;
    }, unknown>;
    owner: _dojoengine_recs.ComponentValue<{
        entity_id: _dojoengine_recs.Type.Number;
        address: _dojoengine_recs.Type.BigInt;
    }, unknown>;
    name: string;
    position: _dojoengine_recs.ComponentValue<{
        entity_id: _dojoengine_recs.Type.Number;
        x: _dojoengine_recs.Type.Number;
        y: _dojoengine_recs.Type.Number;
    }, unknown> | undefined;
    protector: _bibliothecadao_eternum.ArmyInfo | undefined;
    isMine: boolean;
    isMercenary: boolean;
    ownerName: string;
    entity_id: number;
    category: string;
    created_at: bigint;
} | undefined;
declare const useStructures: () => {
    getStructureByEntityId: (entityId: ID) => {
        entityOwner: _dojoengine_recs.ComponentValue<{
            entity_id: _dojoengine_recs.Type.Number;
            entity_owner_id: _dojoengine_recs.Type.Number;
        }, unknown>;
        owner: _dojoengine_recs.ComponentValue<{
            entity_id: _dojoengine_recs.Type.Number;
            address: _dojoengine_recs.Type.BigInt;
        }, unknown>;
        name: string;
        position: _dojoengine_recs.ComponentValue<{
            entity_id: _dojoengine_recs.Type.Number;
            x: _dojoengine_recs.Type.Number;
            y: _dojoengine_recs.Type.Number;
        }, unknown> | undefined;
        protector: _bibliothecadao_eternum.ArmyInfo | undefined;
        isMine: boolean;
        isMercenary: boolean;
        ownerName: string;
        entity_id: number;
        category: string;
        created_at: bigint;
    } | undefined;
};
declare const useIsStructureImmune: (structure: {
    category: string;
    created_at: bigint;
} | undefined, currentTimestamp: number) => boolean;
declare const useStructureImmunityTimer: (structure: Structure | undefined, nextBlockTimestamp: number) => number;
declare const useIsResourcesLocked: (structureEntityId: ID) => boolean;

type TradeResourcesFromViewpoint = {
    resourcesGet: Resource[];
    resourcesGive: Resource[];
};
type TradeResources = {
    takerGets: Resource[];
    makerGets: Resource[];
};
declare function useTrade(): {
    getTradeResources: (tradeId: ID) => TradeResources;
    getTradeResourcesFromEntityViewpoint: (entityId: ID, tradeId: ID) => TradeResourcesFromViewpoint;
    canAcceptOffer: ({ realmEntityId, resourcesGive, }: {
        realmEntityId: ID;
        resourcesGive: Resource[];
    }) => boolean;
    computeTrades: (entityIds: Entity[], nextBlockTimestamp: number) => MarketInterface[];
};
declare function useGetMyOffers(): MarketInterface[];
declare function useSetMarket(): {
    userTrades: MarketInterface[];
    bidOffers: MarketInterface[];
    askOffers: MarketInterface[];
};

declare function useTravel(): {
    computeTravelTime: (fromId: ID, toId: ID, secPerKm: number, pickup?: boolean) => number | undefined;
};

declare const questSteps: Map<QuestType, StepOptions[]>;
declare const useTutorial: (steps: StepOptions[] | undefined) => {
    handleStart: () => void;
};

declare const dir = "/sound/";
declare const soundSelector: {
    hoverClick: string;
    click: string;
    sign: string;
    fly: string;
    levelUp: string;
    explore: string;
    shovelMain: string;
    shovelAlternative: string;
    buildLabor: string;
    buildMilitary: string;
    buildCastle: string;
    buildBarracks: string;
    buildArcherRange: string;
    buildMageTower: string;
    buildWorkHut: string;
    buildFishingVillage: string;
    buildFarm: string;
    buildStorehouse: string;
    buildMine: string;
    buildMarket: string;
    buildStables: string;
    buildLumberMill: string;
    destroyWooden: string;
    destroyStone: string;
    addWheat: string;
    addFish: string;
    addWood: string;
    addStone: string;
    addCoal: string;
    addCopper: string;
    addObsidian: string;
    addSilver: string;
    addIronwood: string;
    addColdIron: string;
    addGold: string;
    addHartwood: string;
    addDiamonds: string;
    addSapphire: string;
    addRuby: string;
    addDeepCrystal: string;
    addIgnium: string;
    addEtherealSilica: string;
    addTrueIce: string;
    addTwilightQuartz: string;
    addAlchemicalSilver: string;
    addAdamantine: string;
    addMithral: string;
    addDragonhide: string;
    addLords: string;
    burnDonkey: string;
    unitRunning: string;
    unitRunningAlternative: string;
    battleDefeat: string;
    battleVictory: string;
    snap: string;
    sword1: string;
    subtleDrumTap: string;
    unitSelected1: string;
    unitSelected2: string;
    unitSelected3: string;
    unitMarching1: string;
    unitMarching2: string;
    gong: string;
};
declare const useUiSounds: (selector: string) => {
    play: use_sound_dist_types.PlayFunction;
    stop: (id?: string) => void;
    fade: () => void;
    repeat: () => void;
};
declare const usePlayResourceSound: () => {
    playResourceSound: (resourceId: ResourcesIds) => void;
};

export { type AppStore, type ArmySystemUpdate, type ArrivalInfo, type BattleInfo, type BattleSystemUpdate, type BattleViewInfo, type BlockchainStore, type BuildModeStore, type Building, type BuildingSystemUpdate, type DojoAccount, DojoContext, type DojoContextType, type DojoResult, LeftView, LoadingStateKey, type PlayerStructure, type PopupsStore, Position, type Prize, type ProgressWithPercentage, QuestStatus, type RealmInfo, type RealmStore, type RealmSystemUpdate, type RealmWithPosition, RightView, type SetupNetworkResult, type SetupResult, StepButton, type StructureInfo, StructureProgress, type StructureSystemUpdate, type ThreeStore, type TileSystemUpdate, UNDEFINED_STRUCTURE_ENTITY_ID, type WorldStore, armyHasTroops, buildFoodSteps, buildResourceSteps, configManager, createAttackArmySteps, createBlockchainStore, createBuildModeStoreSlice, createDefenseArmySteps, createPopupsSlice, createRealmStoreSlice, createSystemCalls, createThreeStoreSlice, createTradeSteps, createWorldStoreSlice, dir, getArmiesByBattleId, getArmiesByPosition, getArmyByEntityId, getRealms, getUserArmyInBattle, pauseProductionSteps, questDetails, questSteps, settleSteps, setup, setupNetwork, soundSelector, tracks, travelSteps, useAccountStore, useAddressStore, useArmiesByEntityOwner, useArmiesByEntityOwnerWithPositionAndQuantity, useArmyByArmyEntityId, useBattleJoin, useBattleLeave, useBattleManager, useBattleStart, useBattlesByPosition, useBuildings, useContributions, useDojo, useEnemyArmiesByPosition, useEntities, useEntitiesUtils, useFetchBlockchainData, useFragmentMines, useGetAllPlayers, useGetBanks, useGetHyperstructureProgress, useGetHyperstructuresWithContributionsFromPlayer, useGetMyOffers, useGetPlayerEpochs, useGetRealm, useGetUnregisteredContributions, useGetUnregisteredEpochs, useGuilds, useHyperstructureData, useHyperstructureProgress, useHyperstructureUpdates, useHyperstructures, useIsResourcesLocked, useIsStructureImmune, useLeaderBoardStore, useMarketStore, useModalStore, useMusicPlayer, useNextBlockTimestamp, useOwnArmiesByPosition, usePlayResourceSound, usePlayerArrivalsNotifications, usePlayerRealms, usePrizePool, useQuery, useQuests, useRealm, useResourceBalance, useResourceManager, useResourcesUtils, useScreenOrientation, useSeasonStart, useSetMarket, useStaminaManager, useStartingTutorial, useStructureAtPosition, useStructureByEntityId, useStructureByPosition, useStructureEntityId, useStructureImmunityTimer, useStructures, useTrade, useTravel, useTutorial, useUIStore, useUiSounds, useUnclaimedQuestsCount, useUserBattles, waitForElement, world };
