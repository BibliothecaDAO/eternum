use starknet::ContractAddress;
use crate::discovery::Discovery;
use crate::resources::ResourceKey;
use crate::troops::Coord;

#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct StructureBase {
    pub troop_explorer_count: u16,
    pub troop_max_guard_count: u8,
    pub troop_max_explorer_count: u16,
    pub created_at: u32,
    pub category: u8,
    pub coord_x: u32,
    pub coord_y: u32,
    pub level: u8,
    // This lets delayed provisioning know whether the one-time troop start was already applied.
    pub starting_troops_granted: bool,
    pub alt: bool,
}

pub fn structure_coord(base: StructureBase) -> Coord {
    Coord { alt: base.alt, x: base.coord_x, y: base.coord_y }
}

const EXPLORER_COUNT_SCALE: u128 = 0x10000;
const EXPLORER_LIMIT_SCALE: u128 = 0x100000000;
const CREATED_AT_SCALE: u128 = 0x1000000000000;
const LEVEL_SCALE: u128 = 0x100000000000000000000;
const CATEGORY_SCALE: u128 = 0x10000000000000000000000;
const TROOPS_GRANTED_SCALE: u128 = 0x1000000000000000000000000;
const LAYER_SCALE: u128 = 0x2000000000000000000000000;
const COORDINATE_SCALE: u128 = 0x100000000;

// The low limb holds counts, limits, time and flags; the high limb holds the two coordinates.
// All 154 field bits are retained; the former guard-count byte is unused. The unused gap keeps decoding within u128
// arithmetic.
pub impl StructureBasePacking of starknet::storage_access::StorePacking<StructureBase, felt252> {
    fn pack(value: StructureBase) -> felt252 {
        let granted = if value.starting_troops_granted {
            1_u128
        } else {
            0
        };
        let low = value.troop_max_guard_count.into() * 256
            + value.troop_explorer_count.into() * EXPLORER_COUNT_SCALE
            + value.troop_max_explorer_count.into() * EXPLORER_LIMIT_SCALE
            + value.created_at.into() * CREATED_AT_SCALE
            + value.level.into() * LEVEL_SCALE
            + value.category.into() * CATEGORY_SCALE
            + granted * TROOPS_GRANTED_SCALE
            + (if value.alt {
                1_u128
            } else {
                0
            }) * LAYER_SCALE;
        let high = value.coord_x.into() + value.coord_y.into() * COORDINATE_SCALE;
        u256 { low, high }.try_into().unwrap()
    }
    fn unpack(value: felt252) -> StructureBase {
        let value: u256 = value.into();
        StructureBase {
            troop_max_guard_count: (value.low / 256 % 256).try_into().unwrap(),
            troop_explorer_count: (value.low / EXPLORER_COUNT_SCALE % 0x10000).try_into().unwrap(),
            troop_max_explorer_count: (value.low / EXPLORER_LIMIT_SCALE % 0x10000).try_into().unwrap(),
            created_at: (value.low / CREATED_AT_SCALE % COORDINATE_SCALE).try_into().unwrap(),
            level: (value.low / LEVEL_SCALE % 256).try_into().unwrap(),
            category: (value.low / CATEGORY_SCALE % 256).try_into().unwrap(),
            starting_troops_granted: value.low / TROOPS_GRANTED_SCALE % 2 != 0,
            alt: value.low / LAYER_SCALE % 2 != 0,
            coord_x: (value.high % COORDINATE_SCALE).try_into().unwrap(),
            coord_y: (value.high / COORDINATE_SCALE).try_into().unwrap(),
        }
    }
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct StructureMetadata {
    // associated with realm
    pub realm_id: u16,
    pub order: u8,
    pub has_wonder: bool,
    // associated with village
    pub village_realm: u32,
    pub mine_kind: u8,
}
const ORDER_SCALE: u128 = 0x10000;
const WONDER_SCALE: u128 = 0x1000000;
const CONNECTED_REALM_SCALE: u128 = 0x100000000;
const MINE_KIND_SCALE: u128 = 0x10000000000000000;
pub impl StructureMetadataPacking of starknet::storage_access::StorePacking<StructureMetadata, u128> {
    fn pack(value: StructureMetadata) -> u128 {
        let wonder = if value.has_wonder {
            1_u128
        } else {
            0
        };
        value.realm_id.into()
            + value.order.into() * ORDER_SCALE
            + wonder * WONDER_SCALE
            + value.village_realm.into() * CONNECTED_REALM_SCALE
            + value.mine_kind.into() * MINE_KIND_SCALE
    }
    fn unpack(value: u128) -> StructureMetadata {
        StructureMetadata {
            realm_id: (value % ORDER_SCALE).try_into().unwrap(),
            order: (value / ORDER_SCALE % 256).try_into().unwrap(),
            has_wonder: value / WONDER_SCALE % 2 != 0,
            village_realm: (value / CONNECTED_REALM_SCALE % COORDINATE_SCALE).try_into().unwrap(),
            mine_kind: (value / MINE_KIND_SCALE).try_into().unwrap(),
        }
    }
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Structure {
    pub owner: ContractAddress,
    pub base: StructureBase,
    pub troop_explorers: Span<u32>,
    pub resources_packed: u128,
    pub metadata: StructureMetadata,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct StructureRecord {
    pub owner: ContractAddress,
    pub base: StructureBase,
    pub resources_packed: u128,
    pub metadata: StructureMetadata,
}

#[starknet::component]
pub mod StructureState {
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use crate::events::{RowMemberSet, RowSet};
    use super::{ContractAddress, ResourceKey, Structure, StructureRecord};
    #[storage]
    pub struct Storage {
        pub structures: Map<(u32, u32), StructureRecord>,
        pub explorers: Map<(u32, u32, u16), u32>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowMemberSet: RowMemberSet,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn owner(self: @ComponentState<TContractState>, key: ResourceKey) -> ContractAddress {
            self.structures.entry((key.game_id, key.entity_id)).owner.read()
        }
        fn mark_starting_troops(ref self: ComponentState<TContractState>, key: ResourceKey) {
            let mut base = self.record(key).base;
            base.starting_troops_granted = true;
            self.structures.entry((key.game_id, key.entity_id)).base.write(base);
            self.emit_base(key, base);
        }
        fn emit_base(ref self: ComponentState<TContractState>, key: ResourceKey, base: super::StructureBase) {
            let mut values = array![];
            base.serialize(ref values);
            self
                .emit(
                    RowMemberSet {
                        version: 1,
                        model: 'Structure',
                        member: 'base',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn exists(self: @ComponentState<TContractState>, key: ResourceKey) -> bool {
            self.structures.entry((key.game_id, key.entity_id)).base.read().category != 0
        }
        fn record(self: @ComponentState<TContractState>, key: ResourceKey) -> StructureRecord {
            assert!(self.exists(key), "missing structure");
            self.structures.read((key.game_id, key.entity_id))
        }
        fn structure(self: @ComponentState<TContractState>, key: ResourceKey) -> Option<Structure> {
            if !self.exists(key) {
                return None;
            }
            let record = self.record(key);
            let mut explorers = array![];
            for index in 0..record.base.troop_explorer_count {
                explorers.append(self.explorers.read((key.game_id, key.entity_id, index)));
            }
            Some(
                Structure {
                    owner: record.owner,
                    base: record.base,
                    troop_explorers: explorers.span(),
                    resources_packed: record.resources_packed,
                    metadata: record.metadata,
                },
            )
        }
        fn create(ref self: ComponentState<TContractState>, key: ResourceKey, record: StructureRecord) {
            assert!(
                key.game_id != 0 && key.entity_id != 0 && record.base.category != 0 && !self.exists(key),
                "invalid new structure",
            );
            self.structures.write((key.game_id, key.entity_id), record);
            let mut keys = array![];
            key.serialize(ref keys);
            let mut values = array![];
            self.structure(key).unwrap().serialize(ref values);
            self.emit(RowSet { version: 1, model: 'Structure', keys: keys.span(), values: values.span() });
        }
        fn transfer_owner(
            ref self: ComponentState<TContractState>, key: ResourceKey, owner: starknet::ContractAddress,
        ) {
            assert!(self.exists(key), "missing structure");
            if self.structures.entry((key.game_id, key.entity_id)).owner.read() == owner {
                return;
            }
            self.structures.entry((key.game_id, key.entity_id)).owner.write(owner);
            self
                .emit(
                    RowMemberSet {
                        version: 1,
                        model: 'Structure',
                        member: 'owner',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        values: array![owner.into()].span(),
                    },
                );
        }
        fn upgrade(ref self: ComponentState<TContractState>, key: ResourceKey, mut base: super::StructureBase) {
            base.level += 1;
            let (explorers, guards) = crate::upgrades::troop_limits(base.level);
            base.troop_max_explorer_count = explorers;
            base.troop_max_guard_count = guards;
            self.structures.entry((key.game_id, key.entity_id)).base.write(base);
            self.emit_base(key, base);
        }
        fn append_explorer(ref self: ComponentState<TContractState>, key: ResourceKey, explorer_id: u32) {
            let mut record = self.record(key);
            assert!(
                record.base.troop_explorer_count < record.base.troop_max_explorer_count, "structure explorer limit",
            );
            self.explorers.write((key.game_id, key.entity_id, record.base.troop_explorer_count), explorer_id);
            record.base.troop_explorer_count += 1;
            self.structures.entry((key.game_id, key.entity_id)).base.write(record.base);
            self.emit_explorers(key);
        }
        fn remove_explorer(ref self: ComponentState<TContractState>, key: ResourceKey, explorer_id: u32) {
            let mut record = self.record(key);
            let mut found = false;
            let mut next = 0;
            for index in 0..record.base.troop_explorer_count {
                let id = self.explorers.read((key.game_id, key.entity_id, index));
                if id == explorer_id {
                    found = true;
                } else {
                    self.explorers.write((key.game_id, key.entity_id, next), id);
                    next += 1;
                }
            }
            assert!(found, "explorer absent from structure");
            record.base.troop_explorer_count = next;
            self.structures.entry((key.game_id, key.entity_id)).base.write(record.base);
            self.emit_explorers(key);
        }
        fn emit_explorers(ref self: ComponentState<TContractState>, key: ResourceKey) {
            let structure = self.structure(key).unwrap();
            let mut keys = array![];
            key.serialize(ref keys);
            let mut base = array![];
            structure.base.serialize(ref base);
            self
                .emit(
                    RowMemberSet {
                        version: 1, model: 'Structure', member: 'base', keys: keys.span(), values: base.span(),
                    },
                );
            let mut explorers = array![];
            structure.troop_explorers.serialize(ref explorers);
            self
                .emit(
                    RowMemberSet {
                        version: 1,
                        model: 'Structure',
                        member: 'troop_explorers',
                        keys: keys.span(),
                        values: explorers.span(),
                    },
                );
        }
    }
}

#[starknet::interface]
pub trait IStructures<T> {
    fn create_discovery(
        ref self: T, game_id: u32, coord: Coord, discovery: crate::discovery::Discovery, seed: u256, timestamp: u64,
    ) -> u32;
    fn building(self: @T, key: crate::buildings::BuildingKey) -> Option<crate::buildings::Building>;
    fn structure_buildings(self: @T, key: ResourceKey) -> crate::buildings::StructureBuildings;
    fn structure(self: @T, key: ResourceKey) -> Option<Structure>;
    fn structure_owner(self: @T, key: ResourceKey) -> ContractAddress;
    fn provision_spire(ref self: T, game_id: u32, coord: Coord) -> u32;
    fn provision_realm(
        ref self: T, game_id: u32, actor: ContractAddress, coord: Coord, grants: Span<(u8, u128)>,
    ) -> u32;
    fn pay_for_explorer(
        ref self: T,
        key: ResourceKey,
        actor: ContractAddress,
        resource_type: u8,
        amount: u128,
        explorer_id: u32,
        timestamp: u64,
    );
    fn remove_explorer(ref self: T, key: ResourceKey, explorer_id: u32);
}

#[starknet::contract]
pub mod StructuresDomain {
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use crate::buildings::{Building, BuildingKey, BuildingState, StructureBuildings};
    use crate::commands::ExecutionContext;
    use crate::discovery::Discovery;
    use crate::events::RowSet;
    use crate::faith::{
        FaithState, FaithfulStructure, PlayerFaithKey, PlayerFaithPoints, WonderFaith, WonderFaithWinners,
    };
    use crate::game::{IGameDispatcher, IGameDispatcherTrait, assert_playing};
    use crate::geometry::tile_key;
    use crate::lifecycle::Lifecycle;
    use crate::map::{IMapDispatcher, IMapDispatcherTrait};
    use crate::mines::{IMineRulesDispatcher, IMineRulesDispatcherTrait, MinePoolKey};
    use crate::ownership::{Story, StoryEvent, TransferOwnership};
    use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceKey};
    use crate::rules::RESOURCE_PRECISION;
    use crate::settlement::{
        ISettlementDisplacementDispatcher, ISettlementDisplacementDispatcherTrait, ISettlementViewsDispatcher,
        ISettlementViewsDispatcherTrait,
    };
    use crate::troops::Coord;
    use crate::upgrades::IUpgradeRulesDispatcherTrait;
    use super::{Structure, StructureBase, StructureRecord, StructureState};
    component!(path: FaithState, storage: faith, event: FaithEvent);
    impl FaithInternal = FaithState::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Faith = FaithState::FaithImpl<ContractState>;
    component!(path: BuildingState, storage: buildings, event: BuildingEvent);
    impl BuildingInternal = BuildingState::InternalImpl<ContractState>;
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: StructureState, storage: structures, event: StructureEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    impl StructureInternal = StructureState::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        structures: StructureState::Storage,
        #[substorage(v0)]
        buildings: BuildingState::Storage,
        #[substorage(v0)]
        faith: FaithState::Storage,
        address_names: Map<ContractAddress, felt252>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        StructureEvent: StructureState::Event,
        BuildingEvent: BuildingState::Event,
        FaithEvent: FaithState::Event,
        StoryEvent: StoryEvent,
        RowSet: RowSet,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl BankCreation of crate::market::IBankCreation<ContractState> {
        fn create_bank(
            ref self: ContractState, key: ResourceKey, owner: ContractAddress, coord: Coord, timestamp: u64,
        ) {
            assert!(get_caller_address() == self.lifecycle.require_active().economy, "only economy domain");
            crate::commands::assert_context_time(timestamp);
            assert!(key.entity_id >= 0xfffffff9 && key.entity_id <= 0xfffffffe, "invalid regional bank id");
            assert!(!coord.alt && owner != 0.try_into().unwrap(), "invalid bank placement");
            let rules = self.game_dispatcher().rules(key.game_id);
            assert!(!rules.blitz_mode_on, "banks require Eternum mode");
            assert!(!self.structures.exists(key), "bank already exists");
            self.reveal_structure_tile(key.game_id, coord);
            self.map_dispatcher().reveal_structure_surroundings(key.game_id, coord);
            let record = StructureRecord {
                owner,
                base: StructureBase {
                    category: 3,
                    level: 3,
                    troop_max_guard_count: 4,
                    troop_max_explorer_count: 0,
                    created_at: timestamp.try_into().unwrap(),
                    coord_x: coord.x,
                    coord_y: coord.y,
                    ..Default::default(),
                },
                resources_packed: 0,
                metadata: Default::default(),
            };
            self.structures.create(key, record);
            self.map_dispatcher().occupy(tile_key(key.game_id, coord), key.entity_id, 14, true);
            self
                .resources_dispatcher()
                .initialize_resources(
                    key,
                    rules.structure_capacity_config.bank_structure_capacity.into() * RESOURCE_PRECISION,
                    3,
                    timestamp,
                );
            let seed: u256 = Into::<felt252, u256>::into('what could possibly go wrong') - key.entity_id.into();
            crate::guards::IGuardsDispatcherTrait::initialize_structure_guards(
                crate::guards::IGuardsDispatcher { contract_address: self.lifecycle.require_active().troops },
                key,
                seed,
                timestamp,
            );
        }
    }
    #[abi(embed_v0)]
    impl BuildingRules of crate::buildings::IBuildingRules<ContractState> {
        fn configure_buildings(
            ref self: ContractState, game_id: u32, rules: Span<crate::buildings::BuildingRuleConfig>,
        ) {
            self.assert_authority();
            let _ = self.game_dispatcher().game(game_id);
            self.buildings.configure(game_id, rules);
        }
        fn building_rule(
            self: @ContractState, key: crate::buildings::BuildingRuleKey,
        ) -> crate::buildings::BuildingRule {
            self.buildings.rule(key)
        }
    }
    #[abi(embed_v0)]
    impl Structures of super::IStructures<ContractState> {
        fn provision_spire(ref self: ContractState, game_id: u32, coord: Coord) -> u32 {
            self.assert_authority();
            assert!(self.game_dispatcher().game(game_id).dev_mode_on, "fixture provisioning requires development game");
            let id = self.game_dispatcher().allocate_entity(game_id);
            for alt in array![false, true] {
                let layer_coord = Coord { alt, ..coord };
                self.reveal_structure_tile(game_id, layer_coord);
                self.map_dispatcher().occupy(tile_key(game_id, layer_coord), id, 35, true);
                for direction in 0_u8..6 {
                    let key = tile_key(game_id, crate::geometry::spire_neighbor(layer_coord, direction));
                    let data = self.map_dispatcher().tile(key).map(|tile| tile.data).unwrap_or(0);
                    if (data / 0x20000000000) % 256 == 0 {
                        self.map_dispatcher().reveal(key, self.map_dispatcher().biome(key));
                    }
                }
            }
            id
        }
        fn building(self: @ContractState, key: BuildingKey) -> Option<Building> {
            self.buildings.building(key)
        }
        fn structure_buildings(self: @ContractState, key: ResourceKey) -> StructureBuildings {
            self.buildings.structure_buildings.read((key.game_id, key.entity_id))
        }
        fn create_discovery(
            ref self: ContractState, game_id: u32, coord: Coord, discovery: Discovery, seed: u256, timestamp: u64,
        ) -> u32 {
            self.assert_troops();
            self.place_discovery(game_id, coord, discovery, seed, timestamp, false)
        }
        fn structure_owner(self: @ContractState, key: ResourceKey) -> ContractAddress {
            self.structures.owner(key)
        }
        fn structure(self: @ContractState, key: ResourceKey) -> Option<Structure> {
            self.structures.structure(key)
        }
        fn provision_realm(
            ref self: ContractState, game_id: u32, actor: ContractAddress, coord: Coord, grants: Span<(u8, u128)>,
        ) -> u32 {
            self.assert_authority();
            let game = self.game_dispatcher().game(game_id);
            assert!(game.dev_mode_on, "fixture provisioning requires development game");
            assert!(!coord.alt && actor != 0.try_into().unwrap(), "invalid realm owner or layer");
            let record = realm_record(actor, coord, get_block_timestamp());
            let key = self.place_settlement(game_id, coord, record);
            for grant in grants {
                let (resource_type, amount) = *grant;
                self.resources_dispatcher().grant_resource(key, resource_type, amount, get_block_timestamp());
            }
            key.entity_id
        }
        fn pay_for_explorer(
            ref self: ContractState,
            key: ResourceKey,
            actor: ContractAddress,
            resource_type: u8,
            amount: u128,
            explorer_id: u32,
            timestamp: u64,
        ) {
            self.assert_troops();
            assert_playing(self.game_dispatcher().game(key.game_id), timestamp);
            assert!(self.structures.record(key).owner == actor, "actor does not own structure");
            assert!(resource_type >= 26 && resource_type <= 34, "invalid troop resource");
            assert!(amount > 0 && amount % RESOURCE_PRECISION == 0, "invalid troop amount");
            self.spend(key, resource_type, amount, timestamp);
            self.structures.append_explorer(key, explorer_id);
        }
        fn remove_explorer(ref self: ContractState, key: ResourceKey, explorer_id: u32) {
            self.assert_troops();
            if key.entity_id != crate::troops::AGENT_HOME {
                self.structures.remove_explorer(key, explorer_id);
            }
            self.resources_dispatcher().destroy_resources(ResourceKey { game_id: key.game_id, entity_id: explorer_id });
        }
    }
    #[abi(embed_v0)]
    impl BlitzHyperstructures of crate::settlement::IBlitzHyperstructures<ContractState> {
        fn create_reserved_hyperstructure(
            ref self: ContractState, game_id: u32, actor: ContractAddress, coord: Coord, context: ExecutionContext,
        ) {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.season, "only season domain");
            let game = self.game_dispatcher().game(game_id);
            assert!(self.game_dispatcher().rules(game_id).blitz_mode_on, "not a Blitz game");
            assert!(game.end_at == 0 || context.timestamp < game.end_at, "game ended");
            crate::settlement::IBlitzReservationsDispatcherTrait::release_hyperstructure(
                crate::settlement::IBlitzReservationsDispatcher { contract_address: peers.map }, game_id, coord,
            );
            let coord_seed = (if coord.alt {
                1_felt252
            } else {
                0
            }) * 0x10000000000000000
                + coord.x.into() * 0x100000000
                + coord.y.into();
            let seed = core::poseidon::poseidon_hash_span(
                array![game_id.into(), coord_seed, context.timestamp.into()].span(),
            );
            self.place_discovery(game_id, coord, Discovery::Hyperstructure, seed.into(), context.timestamp, true);
        }
    }
    #[abi(embed_v0)]
    impl SettlementCreation of crate::settlement::ISettlementCreation<ContractState> {
        fn create_settlement(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            coord: Coord,
            creation: crate::settlement::SettlementCreation,
            context: ExecutionContext,
        ) -> u32 {
            assert!(get_caller_address() == self.lifecycle.require_active().settlement, "only settlement domain");
            let mut record = realm_record(actor, coord, context.timestamp);
            match creation {
                crate::settlement::SettlementCreation::Realm(realm) => {
                    record.metadata.realm_id = realm.realm_id;
                    record.metadata.order = realm.traits.order;
                    record.metadata.has_wonder = realm.traits.wonder != 1;
                    record.resources_packed = pack_realm_resources(realm.traits.resources);
                },
                crate::settlement::SettlementCreation::Village(village) => {
                    let connected = self.structures.record(ResourceKey { game_id, entity_id: village.connected_realm });
                    assert!(connected.base.category == 1, "connected entity is not a realm");
                    assert!(village.resource >= 1 && village.resource <= 22, "invalid village resource");
                    record.base.category = crate::ownership::VILLAGE_CATEGORY;
                    record.metadata.village_realm = village.connected_realm;
                    record.resources_packed = pack_realm_resources(array![village.resource].span());
                },
            }
            let key = self.place_settlement(game_id, coord, record);
            match creation {
                crate::settlement::SettlementCreation::Realm(realm) => {
                    if realm.activate_economy {
                        self.provision_realm_economy(key, context.timestamp);
                    } else if realm.grant_troops {
                        self.grant_realm_troops(key, context.timestamp);
                    }
                    self
                        .emit_structure_story(
                            key,
                            actor,
                            Story::RealmCreatedStory(crate::ownership::RealmCreatedStory { coord }),
                            context.timestamp,
                        );
                },
                crate::settlement::SettlementCreation::Village(_) => {
                    self.grant_non_troop_resources(key, self.village_rules(game_id).resources, context.timestamp);
                    let rules = self.game_dispatcher().rules(game_id);
                    self
                        .create_producer(
                            key,
                            coord,
                            0,
                            self.resources_dispatcher().resource_rule(key.game_id, 23).village_rate,
                            23,
                            25,
                            rules.building_config.base_population,
                            context.timestamp,
                        );
                },
            }
            key.entity_id
        }
    }
    #[abi(embed_v0)]
    impl Villages of crate::village::IVillageArmy<ContractState> {
        fn receive_village_army(
            ref self: ContractState, game_id: u32, actor: ContractAddress, village_id: u32, context: ExecutionContext,
        ) {
            assert!(get_caller_address() == self.lifecycle.require_active().season, "only season domain");
            assert_playing(self.game_dispatcher().game(game_id), context.timestamp);
            let key = ResourceKey { game_id, entity_id: village_id };
            let record = self.structures.record(key);
            assert!(record.owner == actor, "actor does not own village");
            assert!(record.base.category == crate::ownership::VILLAGE_CATEGORY, "structure is not a village");
            assert!(!record.base.starting_troops_granted, "army grant already claimed");
            let grants = self.village_rules(game_id);
            let interval = self.game_dispatcher().rules(game_id).tick_config.armies_tick_in_seconds;
            let claimable_at: u64 = record.base.created_at.into() / interval + grants.troop_delay_ticks.into();
            assert!(context.timestamp / interval >= claimable_at, "army grant cannot be claimed yet");
            self.grant_starting_troops(key, grants.resources, 10 * RESOURCE_PRECISION, context.timestamp);
        }
    }
    #[abi(embed_v0)]
    impl RealmCreation of crate::settlement::IRealmCreation<ContractState> {
        fn activate_realm_economy(
            ref self: ContractState, game_id: u32, actor: ContractAddress, structure_id: u32, context: ExecutionContext,
        ) {
            assert!(get_caller_address() == self.lifecycle.require_active().season, "only season domain");
            assert_playing(self.game_dispatcher().game(game_id), context.timestamp);
            let key = ResourceKey { game_id, entity_id: structure_id };
            let record = self.structures.record(key);
            assert!(record.owner == actor, "actor does not own structure");
            assert!(record.base.category == 1, "not a realm");
            self.provision_realm_economy(key, context.timestamp);
        }
    }
    #[abi(embed_v0)]
    impl BuildingCommands of crate::buildings::IBuildingCommands<ContractState> {
        fn create_building(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::CreateBuilding,
            context: ExecutionContext,
        ) {
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let base = self.assert_building_command(key, actor, context.timestamp);
            let coord = self.resolve_building_coord(game_id, base, command.directions);
            let location = building_key(game_id, base, coord);
            let rule = self.buildings.rule(crate::buildings::BuildingRuleKey { game_id, category: command.category });
            self.erect_building(key, actor, base, location, coord, command.category, rule, context.timestamp);
            let count = crate::buildings::category_count(
                self.buildings.structure_buildings.read((game_id, command.structure_id)), command.category,
            );
            let costs = if command.use_simple {
                rule.simple_cost
            } else {
                rule.complex_cost
            };
            self
                .pay_building_costs(
                    key,
                    actor,
                    coord,
                    command.category,
                    count,
                    costs,
                    self.game_dispatcher().rules(game_id).building_config.base_cost_percent_increase,
                    context.timestamp,
                );
        }
        fn destroy_building(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::ChangeBuilding,
            context: ExecutionContext,
        ) {
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let base = self.assert_building_command(key, actor, context.timestamp);
            let location = building_key(game_id, base, command.coord);
            let building = self.buildings.building(location).expect('missing building');
            assert!(building.category != 25, "cannot destroy labor building");
            if !building.paused {
                self.change_building_production(key, building.category, base.category, false, context.timestamp);
            }
            self.change_building_capacity(key, building.category, false);
            let rule = self.buildings.rule(crate::buildings::BuildingRuleKey { game_id, category: building.category });
            self
                .buildings
                .remove(
                    location, building, rule, self.game_dispatcher().rules(game_id).building_config.base_population,
                );
            self
                .emit_building_change(
                    key,
                    actor,
                    command.coord,
                    building.category,
                    crate::ownership::BuildingChange::Destroyed,
                    context.timestamp,
                );
        }
        fn pause_building_production(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::ChangeBuilding,
            context: ExecutionContext,
        ) {
            self.set_building_paused(game_id, actor, command, true, context.timestamp);
        }
        fn resume_building_production(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::ChangeBuilding,
            context: ExecutionContext,
        ) {
            self.set_building_paused(game_id, actor, command, false, context.timestamp);
        }
    }
    fn building_key(game_id: u32, base: StructureBase, coord: Coord) -> BuildingKey {
        let outer = super::structure_coord(base);
        BuildingKey {
            game_id, alt: outer.alt, outer_col: outer.x, outer_row: outer.y, inner_col: coord.x, inner_row: coord.y,
        }
    }
    #[abi(embed_v0)]
    impl Upgrades of crate::upgrades::IStructureUpgrades<ContractState> {
        fn level_up(
            ref self: ContractState, game_id: u32, actor: ContractAddress, structure_id: u32, context: ExecutionContext,
        ) {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.season, "only authenticated command domain");
            crate::commands::assert_context_time(context.timestamp);
            assert_playing(self.game_dispatcher().game(game_id), context.timestamp);
            let key = ResourceKey { game_id, entity_id: structure_id };
            let record = self.structures.record(key);
            assert!(record.owner == actor, "actor does not own structure");
            assert!(record.base.category == 1 || record.base.category == 5, "structure is not a realm or village");
            let rules = crate::upgrades::IUpgradeRulesDispatcher { contract_address: peers.season };
            let limits = rules.upgrade_limits(game_id);
            let maximum = if record.base.category == 1 {
                limits.realm_max
            } else {
                limits.village_max
            };
            assert!(record.base.level < maximum, "structure is already at max level");
            let next_level = record.base.level + 1;
            for cost in rules.upgrade_recipe(game_id, next_level).costs {
                self.spend(key, *cost.resource_type, *cost.amount, context.timestamp);
            }
            self.structures.upgrade(key, record.base);
            if record.base.category == 1 {
                let coord = Coord { alt: false, x: record.base.coord_x, y: record.base.coord_y };
                self
                    .map_dispatcher()
                    .upgrade_realm(tile_key(game_id, coord), structure_id, record.metadata.has_wonder, next_level);
            }
            self.emit_structure_upgrade(key, actor, next_level, context.timestamp);
        }
    }
    #[abi(embed_v0)]
    impl Names of crate::names::INames<ContractState> {
        fn address_name(self: @ContractState, address: ContractAddress) -> crate::names::AddressName {
            crate::names::AddressName { name: self.address_names.read(address) }
        }
        fn set_address_name(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::names::SetAddressName,
            context: ExecutionContext,
        ) {
            let peers = self.lifecycle.require_active();
            let caller = get_caller_address();
            assert!(caller == peers.season || caller == peers.settlement, "only authenticated command domain");
            crate::commands::assert_context_time(context.timestamp);
            let key = (game_id, command.owned_structure_id);
            assert!(
                self.structures.exists(ResourceKey { game_id, entity_id: command.owned_structure_id }),
                "actor does not own structure",
            );
            assert!(self.structures.structures.entry(key).owner.read() == actor, "actor does not own structure");
            self.address_names.write(actor, command.name);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'AddressName',
                        keys: array![actor.into()].span(),
                        values: array![command.name].span(),
                    },
                );
        }
    }
    #[abi(embed_v0)]
    impl Ownership of crate::ownership::IStructureOwnership<ContractState> {
        fn transfer_structure_ownership(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: TransferOwnership,
            context: ExecutionContext,
        ) {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.season, "only authenticated command domain");
            crate::commands::assert_context_time(context.timestamp);
            let game = self.game_dispatcher().game(game_id);
            assert_playing(game, context.timestamp);
            let key = ResourceKey { game_id, entity_id: command.entity_id };
            let record = self.structures.record(key);
            assert!(record.owner == actor, "actor does not own structure");
            assert!(self.game_dispatcher().ownership_rules_ready(game_id), "ownership rules require initialized game");
            let rules = self.game_dispatcher().rules(game_id);
            assert!(!rules.blitz_mode_on, "cannot transfer structure in Blitz");
            assert!(command.new_owner != 0.try_into().unwrap(), "new owner is zero");
            assert!(record.base.category != crate::ownership::VILLAGE_CATEGORY, "cannot transfer ownership of village");
            if record.owner == command.new_owner {
                return;
            }
            self.change_owner(key, command.new_owner, context.timestamp);
        }
    }
    #[abi(embed_v0)]
    impl Capture of crate::guards::IStructureCapture<ContractState> {
        fn capture_structure(ref self: ContractState, key: ResourceKey, capturing_home: u32, timestamp: u64) {
            self.assert_troops();
            let record = self.structures.record(key);
            let owner = self.structures.record(ResourceKey { game_id: key.game_id, entity_id: capturing_home }).owner;
            assert!(owner != 0.try_into().unwrap(), "capturing home is unowned");
            self.change_owner(key, owner, timestamp);
            if record.base.category == 8 {
                crate::bitcoin::IBitcoinFundingDispatcherTrait::bitcoin_mine_captured(
                    crate::bitcoin::IBitcoinFundingDispatcher {
                        contract_address: self.lifecycle.require_active().resources,
                    },
                    key,
                    timestamp,
                );
            }
            let points = if record.owner == 0.try_into().unwrap() {
                self.game_dispatcher().register_capture(key.game_id, owner, record.base.category)
            } else {
                0
            };
            if record.owner == 0.try_into().unwrap() {
                self
                    .emit_structure_story(
                        key,
                        owner,
                        Story::StructureCapturedStory(
                            crate::ownership::StructureCapturedStory {
                                previous_owner: record.owner, new_owner: owner, points,
                            },
                        ),
                        timestamp,
                    );
            }
        }
    }
    #[abi(embed_v0)]
    impl FaithViews of crate::faith::IFaithOwnershipViews<ContractState> {
        fn wonder_faith(self: @ContractState, key: ResourceKey) -> WonderFaith {
            self.faith.faith_wonders.read((key.game_id, key.entity_id))
        }
        fn faithful_structure(self: @ContractState, key: ResourceKey) -> FaithfulStructure {
            self.faith.faith_pledges.read((key.game_id, key.entity_id))
        }
        fn player_faith_points(self: @ContractState, key: PlayerFaithKey) -> PlayerFaithPoints {
            self.faith.faith_players.read((key.game_id, key.player, key.wonder_id))
        }
        fn wonder_faith_winners(self: @ContractState, game_id: u32) -> WonderFaithWinners {
            self.faith.winners(game_id)
        }
    }
    #[inline(never)]
    fn pack_realm_resources(resources: Span<u8>) -> u128 {
        let mut packed = 0;
        for resource in resources {
            packed = packed * 256 + (*resource).into();
        }
        packed
    }
    fn realm_record(actor: ContractAddress, coord: Coord, timestamp: u64) -> StructureRecord {
        StructureRecord {
            owner: actor,
            base: StructureBase {
                troop_explorer_count: 0,
                troop_max_guard_count: 1,
                troop_max_explorer_count: 1,
                created_at: timestamp.try_into().unwrap(),
                category: 1,
                coord_x: coord.x,
                coord_y: coord.y,
                level: 0,
                starting_troops_granted: false,
                alt: coord.alt,
            },
            resources_packed: 0,
            metadata: Default::default(),
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn place_discovery(
            ref self: ContractState,
            game_id: u32,
            coord: Coord,
            discovery: Discovery,
            seed: u256,
            timestamp: u64,
            completed: bool,
        ) -> u32 {
            let rules = self.game_dispatcher().rules(game_id);
            let id = self.game_dispatcher().allocate_entity(game_id);
            let key = ResourceKey { game_id, entity_id: id };
            let (mut record, occupier, capacity) = super::discovered_structure(
                coord, discovery, rules.structure_capacity_config, timestamp,
            );
            self.reveal_structure_tile(game_id, coord);
            if discovery != Discovery::Mine {
                self.map_dispatcher().reveal_structure_surroundings(game_id, coord);
            }
            self
                .resources_dispatcher()
                .initialize_resources(key, capacity * RESOURCE_PRECISION, record.base.category, timestamp);
            match discovery {
                Discovery::Mine => {
                    let (kind, config, cap) = IMineRulesDispatcher {
                        contract_address: self.lifecycle.require_active().resources,
                    }
                        .mine_draw(MinePoolKey { game_id, alt: coord.alt }, seed);
                    record.metadata.mine_kind = kind;
                    self
                        .create_producer(
                            key,
                            coord,
                            cap,
                            config.production_rate,
                            config.resource_type,
                            config.building_category,
                            rules.building_config.base_population,
                            timestamp,
                        );
                },
                Discovery::Hyperstructure => self.create_hyperstructure(key, seed, completed),
                Discovery::BitcoinMine => {},
                Discovery::None => panic!("cannot create empty discovery"),
            }
            self.structures.create(key, record);
            crate::guards::IGuardsDispatcherTrait::initialize_structure_guards(
                crate::guards::IGuardsDispatcher { contract_address: self.lifecycle.require_active().troops },
                key,
                seed,
                timestamp,
            );
            self.map_dispatcher().occupy(tile_key(game_id, coord), id, occupier, true);
            id
        }

        fn settlement_rules(self: @ContractState) -> ISettlementViewsDispatcher {
            ISettlementViewsDispatcher { contract_address: self.lifecycle.require_active().settlement }
        }
        fn place_settlement(
            ref self: ContractState, game_id: u32, coord: Coord, record: StructureRecord,
        ) -> ResourceKey {
            assert!(!coord.alt && record.owner != 0.try_into().unwrap(), "invalid realm owner or layer");
            let key = ResourceKey { game_id, entity_id: self.game_dispatcher().allocate_entity(game_id) };
            let tile = self.map_dispatcher().tile(tile_key(game_id, coord)).map(|tile| tile.data).unwrap_or(0);
            if tile % 0x20000000000 != 0 {
                assert!(tile % 2 == 0, "tile occupied by structure");
                let explorer_id = (tile / 512 % 0x100000000).try_into().unwrap();
                ISettlementDisplacementDispatcher { contract_address: self.lifecycle.require_active().troops }
                    .displace_explorer(game_id, explorer_id);
            }
            let rules = self.game_dispatcher().rules(game_id);
            self.reveal_structure_tile(game_id, coord);
            self.structures.create(key, record);
            let village = record.base.category == crate::ownership::VILLAGE_CATEGORY;
            let occupier = if village {
                13
            } else if record.metadata.has_wonder {
                5
            } else {
                1
            };
            self.map_dispatcher().occupy(tile_key(game_id, coord), key.entity_id, occupier, true);
            let capacity = if village {
                rules.structure_capacity_config.village_capacity
            } else {
                rules.structure_capacity_config.realm_capacity
            };
            self
                .resources_dispatcher()
                .initialize_resources(
                    key, capacity.into() * RESOURCE_PRECISION, record.base.category, record.base.created_at.into(),
                );
            key
        }
        fn emit_structure_story(
            ref self: ContractState, key: ResourceKey, actor: ContractAddress, story: Story, timestamp: u64,
        ) {
            self
                .emit(
                    StoryEvent {
                        version: 1,
                        game_id: key.game_id,
                        id: self.game_dispatcher().allocate_entity(key.game_id),
                        owner: Some(actor),
                        entity_id: Some(key.entity_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story,
                        timestamp,
                    },
                );
        }
        fn provision_realm_economy(ref self: ContractState, key: ResourceKey, timestamp: u64) {
            let record = self.structures.record(key);
            let counts = self.buildings.structure_buildings.read((key.game_id, key.entity_id));
            const LABOR_COUNT_SCALE: u128 = 0x10000000000000000;
            assert!(counts.packed_counts_2 / LABOR_COUNT_SCALE % 256 == 0, "realm already provisioned");
            let coord = Coord { alt: false, x: record.base.coord_x, y: record.base.coord_y };
            self.grant_realm_troops(key, timestamp);
            let grants = self.settlement_rules().realm_grants(key.game_id);
            self.grant_non_troop_resources(key, grants.resources, timestamp);
            let rules = self.game_dispatcher().rules(key.game_id);
            self
                .create_producer(
                    key,
                    coord,
                    0xffffffffffffffffffffffffffffffff,
                    self.resources_dispatcher().resource_rule(key.game_id, 23).realm_rate,
                    23,
                    25,
                    rules.building_config.base_population,
                    timestamp,
                );
        }
        fn village_rules(self: @ContractState, game_id: u32) -> crate::village::VillageRules {
            crate::village::IVillagesDispatcherTrait::village_rules(
                crate::village::IVillagesDispatcher { contract_address: self.lifecycle.require_active().settlement },
                game_id,
            )
        }
        fn grant_non_troop_resources(
            ref self: ContractState, key: ResourceKey, grants: Span<crate::resources::ResourceAmount>, timestamp: u64,
        ) {
            for grant in grants {
                let resource_type = *grant.resource_type;
                assert!(resource_type != crate::resources::LORDS, "invalid start resource");
                if resource_type < 26 || resource_type > 34 {
                    self.resources_dispatcher().grant_resource(key, resource_type, *grant.amount, timestamp);
                }
            }
        }
        fn grant_realm_troops(ref self: ContractState, key: ResourceKey, timestamp: u64) {
            let grants = self.settlement_rules().realm_grants(key.game_id);
            self.grant_starting_troops(key, grants.resources, 1500 * RESOURCE_PRECISION, timestamp);
        }
        fn grant_starting_troops(
            ref self: ContractState,
            key: ResourceKey,
            resources: Span<crate::resources::ResourceAmount>,
            guards: u128,
            timestamp: u64,
        ) {
            let record = self.structures.record(key);
            if record.base.starting_troops_granted {
                return;
            }
            self.structures.mark_starting_troops(key);
            let coord = Coord { alt: false, x: record.base.coord_x, y: record.base.coord_y };
            let biome = self.map_dispatcher().biome(tile_key(key.game_id, coord));
            assert!(biome > 0 && biome <= 17, "starting troops require a biome");
            let grants = self.settlement_rules().realm_grants(key.game_id);
            let category = *grants.starting_troops.at((biome - 1).into());
            let resource_type = crate::troops::troop_resource(category, 0);
            for grant in resources {
                let kind = *grant.resource_type;
                let amount = *grant.amount;
                if kind == resource_type {
                    self.resources_dispatcher().grant_resource(key, kind, amount + guards, timestamp);
                    self.spend(key, kind, guards, timestamp);
                    crate::guards::IGuardsDispatcherTrait::add_starting_guard(
                        crate::guards::IGuardsDispatcher { contract_address: self.lifecycle.require_active().troops },
                        key,
                        category,
                        guards,
                        timestamp,
                    );
                    self
                        .emit_structure_story(
                            key,
                            record.owner,
                            Story::GuardAddStory(
                                crate::ownership::GuardAddStory {
                                    structure_id: key.entity_id,
                                    slot: 3,
                                    category: category.into(),
                                    tier: 0,
                                    amount: guards,
                                },
                            ),
                            timestamp,
                        );
                }
            }
        }
        fn emit_structure_upgrade(
            ref self: ContractState, key: ResourceKey, actor: ContractAddress, next_level: u8, timestamp: u64,
        ) {
            self
                .emit(
                    StoryEvent {
                        version: 1,
                        game_id: key.game_id,
                        id: self.game_dispatcher().allocate_entity(key.game_id),
                        owner: Some(actor),
                        entity_id: Some(key.entity_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::StructureLevelUpStory(
                            crate::ownership::StructureLevelUpStory { new_level: next_level },
                        ),
                        timestamp,
                    },
                );
        }
        fn change_owner(ref self: ContractState, key: ResourceKey, owner: ContractAddress, timestamp: u64) {
            let record = self.structures.record(key);
            let rules = self.game_dispatcher().rules(key.game_id);
            if record.owner != 0.try_into().unwrap() && rules.faith_enabled {
                let game = self.game_dispatcher().game(key.game_id);
                self.faith.transfer(key.game_id, key.entity_id, owner, timestamp, game.end_at);
            }
            self.structures.transfer_owner(key, owner);
        }
        fn erect_building(
            ref self: ContractState,
            key: ResourceKey,
            actor: ContractAddress,
            base: StructureBase,
            location: BuildingKey,
            coord: Coord,
            category: u8,
            rule: crate::buildings::BuildingRule,
            timestamp: u64,
        ) {
            // Allocation order affects later gameplay identities even though buildings use coordinate keys.
            self.game_dispatcher().allocate_entity(key.game_id);
            let building = Building { category, outer_entity_id: key.entity_id, paused: false };
            let rules = self.game_dispatcher().rules(key.game_id);
            self
                .buildings
                .create(
                    location,
                    building,
                    rule.population_cost,
                    rule.capacity_grant,
                    rules.building_config.base_population,
                );
            self.change_building_production(key, building.category, base.category, true, timestamp);
            self.change_building_capacity(key, building.category, true);
            self.assert_structure_produces(key, building.category);
            self
                .emit_building_change(
                    key, actor, coord, building.category, crate::ownership::BuildingChange::Created, timestamp,
                );
        }
        fn resolve_building_coord(
            self: @ContractState, game_id: u32, base: StructureBase, directions: Span<u8>,
        ) -> Coord {
            let limits = crate::upgrades::IUpgradeRulesDispatcher {
                contract_address: self.lifecycle.require_active().season,
            }
                .upgrade_limits(game_id);
            let maximum = match base.category {
                1 => limits.realm_max,
                5 => limits.village_max,
                _ => 0,
            };
            assert!(!directions.is_empty(), "building path is empty");
            assert!(directions.len() <= Into::<u8, u32>::into(maximum) + 1, "building outside maximum level");
            assert!(directions.len() <= Into::<u8, u32>::into(base.level) + 1, "building outside current level");
            let mut coord = Coord { alt: false, x: 10, y: 10 };
            for direction in directions {
                coord = crate::geometry::neighbor(coord, *direction);
            }
            coord
        }
        fn assert_building_command(
            self: @ContractState, key: ResourceKey, actor: ContractAddress, timestamp: u64,
        ) -> StructureBase {
            assert!(
                get_caller_address() == self.lifecycle.require_active().season, "only authenticated command domain",
            );
            crate::commands::assert_context_time(timestamp);
            assert_playing(self.game_dispatcher().game(key.game_id), timestamp);
            assert!(self.structures.owner(key) == actor, "actor does not own structure");
            let base = self.structures.structures.entry((key.game_id, key.entity_id)).base.read();
            assert!(
                base.category == 1 || base.category == 5 || base.category == 7, "structure does not support production",
            );
            base
        }
        fn assert_structure_produces(self: @ContractState, key: ResourceKey, category: u8) {
            let resources = self.structures.structures.entry((key.game_id, key.entity_id)).resources_packed.read();
            assert!(crate::buildings::can_produce(category, resources), "structure cannot produce building resource");
        }
        fn change_building_production(
            ref self: ContractState,
            key: ResourceKey,
            category: u8,
            structure_category: u8,
            enabled: bool,
            timestamp: u64,
        ) {
            let resource_type = crate::buildings::produced_resource(category);
            if resource_type == 0 {
                return;
            }
            let resources = self.resources_dispatcher();
            let rule = resources.resource_rule(key.game_id, resource_type);
            let rate = if structure_category == 1 {
                rule.realm_rate
            } else {
                rule.village_rate
            };
            if enabled {
                assert!(rate != 0, "resource cannot be produced");
                resources.start_production(key, resource_type, rate, 0, timestamp);
            } else {
                resources.stop_production(key, resource_type, rate, timestamp);
            }
        }
        fn change_building_capacity(ref self: ContractState, key: ResourceKey, category: u8, adding: bool) {
            if category != 2 {
                return;
            }
            let amount = Into::<
                u32, u128,
            >::into(self.game_dispatcher().rules(key.game_id).capacity_config.storehouse_boost_capacity)
                * RESOURCE_PRECISION;
            self.resources_dispatcher().change_structure_capacity(key, amount, adding);
        }
        fn set_building_paused(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::buildings::ChangeBuilding,
            paused: bool,
            timestamp: u64,
        ) {
            let key = ResourceKey { game_id, entity_id: command.structure_id };
            let base = self.assert_building_command(key, actor, timestamp);
            let location = building_key(game_id, base, command.coord);
            let mut building = self.buildings.building(location).expect('missing building');
            assert!(building.paused != paused, "building already in requested state");
            self.change_building_production(key, building.category, base.category, !paused, timestamp);
            building.paused = paused;
            self.buildings.write_building(location, building);
            let change = if paused {
                crate::ownership::BuildingChange::Paused
            } else {
                crate::ownership::BuildingChange::Resumed
            };
            self.emit_building_change(key, actor, command.coord, building.category, change, timestamp);
        }
        fn emit_building_change(
            ref self: ContractState,
            key: ResourceKey,
            actor: ContractAddress,
            coord: Coord,
            category: u8,
            change: crate::ownership::BuildingChange,
            timestamp: u64,
        ) {
            self
                .emit_structure_story(
                    key,
                    actor,
                    Story::BuildingPlacementStory(crate::ownership::BuildingPlacementStory { coord, category, change }),
                    timestamp,
                );
        }
        fn pay_building_costs(
            ref self: ContractState,
            key: ResourceKey,
            actor: ContractAddress,
            coord: Coord,
            category: u8,
            count: u8,
            costs: Span<crate::resources::ResourceAmount>,
            increase: u16,
            timestamp: u64,
        ) {
            assert!(!costs.is_empty(), "missing building erection cost");
            let scale: u128 = (count - 1).into();
            let mut paid = array![];
            for cost in costs {
                let amount = *cost.amount
                    + scale * scale * crate::math::PercentageImpl::get(*cost.amount, increase.into());
                assert!(amount != 0, "zero building erection cost");
                self.spend(key, *cost.resource_type, amount, timestamp);
                paid.append(crate::resources::ResourceAmount { resource_type: *cost.resource_type, amount });
            }
            self
                .emit_structure_story(
                    key,
                    actor,
                    Story::BuildingPaymentStory(
                        crate::ownership::BuildingPaymentStory { coord, category, cost: paid.span() },
                    ),
                    timestamp,
                );
        }
        fn create_producer(
            ref self: ContractState,
            key: ResourceKey,
            coord: Coord,
            cap: u128,
            rate: u64,
            resource_type: u8,
            building_category: u8,
            base_population: u32,
            timestamp: u64,
        ) {
            self.game_dispatcher().allocate_entity(key.game_id);
            let building_rule = self
                .buildings
                .rule(crate::buildings::BuildingRuleKey { game_id: key.game_id, category: building_category });
            assert!(rate != 0, "resource cannot be produced");
            self.resources_dispatcher().start_production(key, resource_type, rate, cap, timestamp);
            self
                .buildings
                .create(
                    BuildingKey {
                        game_id: key.game_id,
                        alt: coord.alt,
                        outer_col: coord.x,
                        outer_row: coord.y,
                        inner_col: 10,
                        inner_row: 10,
                    },
                    Building { category: building_category, outer_entity_id: key.entity_id, paused: false },
                    building_rule.population_cost,
                    building_rule.capacity_grant,
                    base_population,
                );
            self.game_dispatcher().allocate_entity(key.game_id);
        }
        fn create_hyperstructure(ref self: ContractState, key: ResourceKey, seed: u256, completed: bool) {
            crate::hyperstructures::IHyperstructuresDispatcherTrait::record_hyperstructure(
                crate::hyperstructures::IHyperstructuresDispatcher {
                    contract_address: self.lifecycle.require_active().economy,
                },
                key,
                seed.try_into().unwrap(),
                completed,
            );
        }
        fn assert_authority(self: @ContractState) {
            assert!(get_caller_address() == self.lifecycle.domain_state().authority, "only domain authority");
            self.lifecycle.require_active();
        }
        fn assert_troops(self: @ContractState) {
            assert!(get_caller_address() == self.lifecycle.require_active().troops, "only troops domain");
        }
        fn game_dispatcher(self: @ContractState) -> IGameDispatcher {
            IGameDispatcher { contract_address: self.lifecycle.require_active().season }
        }
        fn map_dispatcher(self: @ContractState) -> IMapDispatcher {
            IMapDispatcher { contract_address: self.lifecycle.require_active().map }
        }
        fn resources_dispatcher(self: @ContractState) -> IResourcesDispatcher {
            IResourcesDispatcher { contract_address: self.lifecycle.require_active().resources }
        }
        fn spend(ref self: ContractState, key: ResourceKey, resource_type: u8, amount: u128, timestamp: u64) {
            self.resources_dispatcher().spend_resource(key, resource_type, amount, timestamp);
        }
        fn reveal_structure_tile(ref self: ContractState, game_id: u32, coord: Coord) {
            let key = tile_key(game_id, coord);
            let tile = self.map_dispatcher().tile(key);
            let data = tile.map(|tile| tile.data).unwrap_or(0);
            assert!(data % 0x20000000000 == 0, "occupied structure tile");
            if (data / 0x20000000000) % 0x100 == 0 {
                self.map_dispatcher().reveal(key, self.map_dispatcher().biome(key));
            }
        }
    }
}

fn discovered_structure(
    coord: Coord,
    discovery: crate::discovery::Discovery,
    capacities: crate::rules::StructureCapacityConfig,
    timestamp: u64,
) -> (StructureRecord, u8, u128) {
    let (category, occupier, level, capacity) = match discovery {
        Discovery::Mine => (4_u8, 12_u8, 0_u8, capacities.fragment_mine_capacity),
        Discovery::Hyperstructure => (2, 9, 3, capacities.hyperstructure_capacity),
        Discovery::BitcoinMine => (8, 38, 3, capacities.bitcoin_mine_capacity),
        Discovery::None => panic!("cannot create empty discovery"),
    };
    assert!(
        discovery == Discovery::Mine || coord.alt == (discovery == Discovery::BitcoinMine), "invalid discovery layer",
    );
    let max_guards = if discovery == Discovery::Mine {
        1
    } else {
        4
    };
    let base = StructureBase {
        troop_explorer_count: 0,
        troop_max_guard_count: max_guards,
        troop_max_explorer_count: 0,
        created_at: timestamp.try_into().unwrap(),
        category,
        coord_x: coord.x,
        coord_y: coord.y,
        level,
        starting_troops_granted: false,
        alt: coord.alt,
    };
    (
        StructureRecord { owner: 0.try_into().unwrap(), base, resources_packed: 0, metadata: Default::default() },
        occupier,
        capacity.into(),
    )
}
