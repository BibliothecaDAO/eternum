use starknet::ContractAddress;
use crate::discovery::Discovery;
use crate::resources::{Production, ResourceKey, ResourceSlot, Weight};
use crate::troops::{Coord, Troops};

#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct StructureBase {
    pub troop_guard_count: u8,
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
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct StructureMetadata {
    // associated with realm
    pub realm_id: u16,
    pub order: u8,
    pub has_wonder: bool,
    pub villages_count: u8,
    // associated with village
    pub village_realm: u32,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct GuardTroops {
    // slot 4
    pub delta: Troops,
    // slot 3
    pub charlie: Troops,
    // slot 2
    pub bravo: Troops,
    // slot 1
    pub alpha: Troops,
    pub delta_destroyed_tick: u32,
    pub charlie_destroyed_tick: u32,
    pub bravo_destroyed_tick: u32,
    pub alpha_destroyed_tick: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Structure {
    pub owner: ContractAddress,
    pub base: StructureBase,
    pub troop_guards: GuardTroops,
    pub troop_explorers: Span<u32>,
    pub resources_packed: u128,
    pub metadata: StructureMetadata,
    pub category: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct StructureRecord {
    pub owner: ContractAddress,
    pub base: StructureBase,
    pub troop_guards: GuardTroops,
    pub resources_packed: u128,
    pub metadata: StructureMetadata,
    pub category: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum ConstructionAccess {
    Public,
    Private,
    GuildOnly,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Hyperstructure {
    pub initialized: bool,
    pub completed: bool,
    pub access: ConstructionAccess,
    pub randomness: felt252,
    pub points_multiplier: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ResourceRule {
    pub resource_type: u8,
    pub unit_weight: u128,
    pub realm_rate: u64,
    pub village_rate: u64,
    pub labor_output_per_resource: u64,
    pub building_population_cost: u8,
    pub building_capacity_grant: u8,
}

#[starknet::component]
pub mod StructureState {
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use crate::events::{RowMemberSet, RowSet};
    use crate::stamina::StaminaTrait;
    use super::{ResourceKey, Structure, StructureRecord};
    #[storage]
    pub struct Storage {
        pub structures: Map<(u32, u32), StructureRecord>,
        pub exists: Map<(u32, u32), bool>,
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
        fn mark_starting_troops(ref self: ComponentState<TContractState>, key: ResourceKey) {
            let mut base = self.record(key).base;
            base.starting_troops_granted = true;
            self.structures.entry((key.game_id, key.entity_id)).base.starting_troops_granted.write(true);
            self.emit_base(key, base);
        }
        fn add_starting_guard(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            category: crate::troops::TroopType,
            amount: u128,
            rules: crate::rules::SliceRules,
            timestamp: u64,
        ) {
            let mut record = self.record(key);
            let mut troops = record.troop_guards.delta;
            let interval = rules.tick_config.armies_tick_in_seconds;
            let current_tick = timestamp / interval;
            if troops.count == 0 {
                let destroyed = record.troop_guards.delta_destroyed_tick;
                if destroyed != 0 {
                    let delay: u64 = rules.troop_limit_config.guard_resurrection_delay.into();
                    let ticks: u32 = (delay / interval + if delay % interval == 0 {
                        0
                    } else {
                        1
                    }).try_into().unwrap();
                    assert!(current_tick >= (destroyed + ticks).into(), "guard resurrection delay");
                }
                assert!(record.base.troop_guard_count < record.base.troop_max_guard_count, "structure guard limit");
                record.base.troop_guard_count += 1;
                troops.category = category;
                troops.tier = crate::troops::TroopTier::T1;
                self
                    .structures
                    .entry((key.game_id, key.entity_id))
                    .base
                    .troop_guard_count
                    .write(record.base.troop_guard_count);
                self.emit_base(key, record.base);
            } else {
                assert!(
                    troops.category == category && troops.tier == crate::troops::TroopTier::T1,
                    "incorrect category or tier",
                );
            }
            troops
                .stamina
                .refill(ref troops.boosts, troops.category, troops.tier, rules.troop_stamina_config, current_tick);
            if troops.count == 0 {
                troops.stamina.amount = 0;
            }
            troops.stamina.revert_initial_amount(rules.troop_stamina_config, current_tick);
            troops.count += amount;
            let limit: u128 = crate::troops::max_army_size(rules.troop_limit_config, record.base.level, troops.tier)
                .into();
            assert!(troops.count <= limit * crate::rules::RESOURCE_PRECISION, "structure guard troop limit");
            record.troop_guards.delta = troops;
            self.structures.entry((key.game_id, key.entity_id)).troop_guards.delta.write(troops);
            let mut values = array![];
            record.troop_guards.serialize(ref values);
            self
                .emit(
                    RowMemberSet {
                        version: 1,
                        model: 'Structure',
                        member: 'troop_guards',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        values: values.span(),
                    },
                );
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
        fn record(self: @ComponentState<TContractState>, key: ResourceKey) -> StructureRecord {
            assert!(self.exists.read((key.game_id, key.entity_id)), "missing structure");
            self.structures.read((key.game_id, key.entity_id))
        }
        fn structure(self: @ComponentState<TContractState>, key: ResourceKey) -> Option<Structure> {
            if !self.exists.read((key.game_id, key.entity_id)) {
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
                    troop_guards: record.troop_guards,
                    troop_explorers: explorers.span(),
                    resources_packed: record.resources_packed,
                    metadata: record.metadata,
                    category: record.category,
                },
            )
        }
        fn create(ref self: ComponentState<TContractState>, key: ResourceKey, record: StructureRecord) {
            assert!(
                key.game_id != 0 && key.entity_id != 0 && !self.exists.read((key.game_id, key.entity_id)),
                "invalid new structure",
            );
            self.structures.write((key.game_id, key.entity_id), record);
            self.exists.write((key.game_id, key.entity_id), true);
            let mut keys = array![];
            key.serialize(ref keys);
            let mut values = array![];
            self.structure(key).unwrap().serialize(ref values);
            self.emit(RowSet { version: 1, model: 'Structure', keys: keys.span(), values: values.span() });
        }
        fn transfer_owner(
            ref self: ComponentState<TContractState>, key: ResourceKey, owner: starknet::ContractAddress,
        ) {
            assert!(self.exists.read((key.game_id, key.entity_id)), "missing structure");
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
            let path = self.structures.entry((key.game_id, key.entity_id)).base;
            path.level.write(base.level);
            path.troop_max_explorer_count.write(explorers);
            path.troop_max_guard_count.write(guards);
            self.emit_base(key, base);
        }
        fn append_explorer(ref self: ComponentState<TContractState>, key: ResourceKey, explorer_id: u32) {
            let mut record = self.record(key);
            assert!(
                record.base.troop_explorer_count < record.base.troop_max_explorer_count, "structure explorer limit",
            );
            self.explorers.write((key.game_id, key.entity_id, record.base.troop_explorer_count), explorer_id);
            record.base.troop_explorer_count += 1;
            self
                .structures
                .entry((key.game_id, key.entity_id))
                .base
                .troop_explorer_count
                .write(record.base.troop_explorer_count);
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
            self
                .structures
                .entry((key.game_id, key.entity_id))
                .base
                .troop_explorer_count
                .write(record.base.troop_explorer_count);
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
    fn hyperstructure_count(self: @T, game_id: u32) -> u32;
    fn create_discovery(
        ref self: T, game_id: u32, coord: Coord, discovery: crate::discovery::Discovery, seed: u256, timestamp: u64,
    ) -> u32;
    fn building(self: @T, key: crate::buildings::BuildingKey) -> Option<crate::buildings::Building>;
    fn structure_buildings(self: @T, key: ResourceKey) -> crate::buildings::StructureBuildings;
    fn structure(self: @T, key: ResourceKey) -> Option<Structure>;
    fn has_resource(self: @T, key: ResourceKey) -> bool;
    fn hyperstructure(self: @T, key: ResourceKey) -> Option<Hyperstructure>;
    fn provision_spire(ref self: T, game_id: u32, coord: Coord) -> u32;
    fn resource_balance(self: @T, key: ResourceSlot) -> u128;
    fn resource_production(self: @T, key: ResourceSlot) -> Production;
    fn resource_weight(self: @T, key: ResourceKey) -> Weight;
    fn configure_resources(ref self: T, game_id: u32, rules: Span<ResourceRule>);
    fn provision_producer(ref self: T, key: ResourceKey, output: u128);
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
    fn initialize_explorer_resources(ref self: T, key: ResourceKey, amount: u128);
    fn remove_explorer(ref self: T, key: ResourceKey, explorer_id: u32);
    fn reduce_explorer_capacity(ref self: T, key: ResourceKey, lost: u128);
    fn spend_food(ref self: T, key: ResourceKey, wheat: u128, fish: u128, timestamp: u64);
    fn spend_spire_fee(ref self: T, key: ResourceKey, timestamp: u64);
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
    use crate::game::{IGameDispatcher, IGameDispatcherTrait, assert_playing};
    use crate::geometry::{neighbor, tile_key};
    use crate::lifecycle::Lifecycle;
    use crate::map::{IMapDispatcher, IMapDispatcherTrait};
    use crate::ownership::{
        FaithOwnershipState, FaithPointsClaimedStory, FaithfulStructure, PlayerFaithKey, PlayerFaithPoints, Story,
        StoryEvent, TransferOwnership, WonderFaith, WonderFaithWinners,
    };
    use crate::resources::{Production, ResourceKey, ResourceSlot, ResourceState, Weight};
    use crate::rules::{RESOURCE_PRECISION, SliceRules};
    use crate::settlement::{
        ISettlementDisplacementDispatcher, ISettlementDisplacementDispatcherTrait, ISettlementViewsDispatcher,
        ISettlementViewsDispatcherTrait,
    };
    use crate::troops::Coord;
    use crate::upgrades::IUpgradeRulesDispatcherTrait;
    use super::{ResourceRule, Structure, StructureBase, StructureRecord, StructureState};
    component!(path: FaithOwnershipState, storage: faith, event: FaithEvent);
    impl FaithInternal = FaithOwnershipState::InternalImpl<ContractState>;
    component!(path: BuildingState, storage: buildings, event: BuildingEvent);
    impl BuildingInternal = BuildingState::InternalImpl<ContractState>;
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: StructureState, storage: structures, event: StructureEvent);
    component!(path: ResourceState, storage: resources, event: ResourceEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    impl StructureInternal = StructureState::InternalImpl<ContractState>;
    impl ResourceInternal = ResourceState::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        structures: StructureState::Storage,
        #[substorage(v0)]
        resources: ResourceState::Storage,
        #[substorage(v0)]
        buildings: BuildingState::Storage,
        hyperstructure_counts: Map<u32, u32>,
        hyperstructure_seeds: Map<(u32, u32), felt252>,
        resource_rules: Map<(u32, u8), ResourceRule>,
        resources_configured: Map<u32, bool>,
        #[substorage(v0)]
        faith: FaithOwnershipState::Storage,
        address_names: Map<ContractAddress, felt252>,
        completed_hyperstructures: Map<(u32, u32), bool>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        StructureEvent: StructureState::Event,
        ResourceEvent: ResourceState::Event,
        BuildingEvent: BuildingState::Event,
        FaithEvent: FaithOwnershipState::Event,
        StoryEvent: StoryEvent,
        RowSet: RowSet,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl Structures of super::IStructures<ContractState> {
        fn has_resource(self: @ContractState, key: ResourceKey) -> bool {
            self.resources.resource_exists.read((key.game_id, key.entity_id))
        }
        fn hyperstructure(self: @ContractState, key: ResourceKey) -> Option<super::Hyperstructure> {
            let structure = self.structures.structure(key);
            match structure {
                Some(value) => {
                    if value.category == 2 {
                        Some(
                            super::Hyperstructure {
                                initialized: self.completed_hyperstructures.read((key.game_id, key.entity_id)),
                                completed: self.completed_hyperstructures.read((key.game_id, key.entity_id)),
                                access: super::ConstructionAccess::Private,
                                randomness: self.hyperstructure_seeds.read((key.game_id, key.entity_id)),
                                points_multiplier: 0,
                            },
                        )
                    } else {
                        None
                    }
                },
                _ => None,
            }
        }
        fn provision_spire(ref self: ContractState, game_id: u32, coord: Coord) -> u32 {
            self.assert_authority();
            assert!(self.game_dispatcher().game(game_id).dev_mode_on, "fixture provisioning requires development game");
            let id = self.game_dispatcher().allocate_entity(game_id);
            let rules = self.game_dispatcher().rules(game_id);
            for alt in array![false, true] {
                let layer_coord = Coord { alt, ..coord };
                self.reveal_structure_tile(game_id, layer_coord, rules);
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
        fn hyperstructure_count(self: @ContractState, game_id: u32) -> u32 {
            self.hyperstructure_counts.read(game_id)
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
        fn structure(self: @ContractState, key: ResourceKey) -> Option<Structure> {
            self.structures.structure(key)
        }
        fn resource_balance(self: @ContractState, key: ResourceSlot) -> u128 {
            self.resources.balance(ResourceKey { game_id: key.game_id, entity_id: key.entity_id }, key.resource_type)
        }
        fn resource_production(self: @ContractState, key: ResourceSlot) -> Production {
            self.resources.production(ResourceKey { game_id: key.game_id, entity_id: key.entity_id }, key.resource_type)
        }
        fn resource_weight(self: @ContractState, key: ResourceKey) -> Weight {
            self.resources.weight(key)
        }
        fn configure_resources(ref self: ContractState, game_id: u32, rules: Span<ResourceRule>) {
            self.assert_authority();
            let _ = self.game_dispatcher().game(game_id);
            assert!(!self.resources_configured.read(game_id), "resource rules already configured");
            assert!(rules.len() == 58, "incomplete resource rules");
            for index in 0_u32..58 {
                let rule = *rules.at(index);
                assert!(rule.resource_type.into() == index + 1, "resource rules must be ordered");
                self.resource_rules.write((game_id, rule.resource_type), rule);
                let mut values = array![];
                rule.serialize(ref values);
                self
                    .emit(
                        RowSet {
                            version: 1,
                            model: 'ResourceRule',
                            keys: array![game_id.into(), rule.resource_type.into()].span(),
                            values: values.span().slice(1, values.len() - 1),
                        },
                    );
            }
            self.resources_configured.write(game_id, true);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'ResourceRulesReady',
                        keys: array![game_id.into()].span(),
                        values: array![1].span(),
                    },
                );
        }
        fn provision_producer(ref self: ContractState, key: ResourceKey, output: u128) {
            self.assert_authority();
            assert!(
                self.game_dispatcher().game(key.game_id).dev_mode_on, "fixture provisioning requires development game",
            );
            let structure = self.structures.record(key);
            assert!(structure.category == 1, "producer fixture requires realm");
            let coord = Coord { alt: false, x: structure.base.coord_x, y: structure.base.coord_y };
            let rules = self.game_dispatcher().rules(key.game_id);
            self.create_producer(key, coord, output, true, 24, 26, rules, get_block_timestamp());
        }
        fn provision_realm(
            ref self: ContractState, game_id: u32, actor: ContractAddress, coord: Coord, grants: Span<(u8, u128)>,
        ) -> u32 {
            self.assert_authority();
            let game = self.game_dispatcher().game(game_id);
            assert!(game.dev_mode_on, "fixture provisioning requires development game");
            assert!(!coord.alt && actor != 0.try_into().unwrap(), "invalid realm owner or layer");
            let record = realm_record(actor, coord, get_block_timestamp());
            let key = self.place_realm(game_id, coord, record);
            for grant in grants {
                let (resource_type, amount) = *grant;
                let rule = self.resource_rule(game_id, resource_type);
                self
                    .resources
                    .grant_resource(
                        key, resource_type, amount, rule.unit_weight, get_block_timestamp().try_into().unwrap(),
                    );
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
        fn initialize_explorer_resources(ref self: ContractState, key: ResourceKey, amount: u128) {
            self.assert_troops();
            let rules = self.game_dispatcher().rules(key.game_id);
            self.resources.initialize(key, rules.capacity_config.troop_capacity.into() * amount);
        }
        fn remove_explorer(ref self: ContractState, key: ResourceKey, explorer_id: u32) {
            self.assert_troops();
            if key.entity_id != crate::troops::AGENT_HOME {
                self.structures.remove_explorer(key, explorer_id);
            }
            self.resources.destroy(ResourceKey { game_id: key.game_id, entity_id: explorer_id });
        }
        fn reduce_explorer_capacity(ref self: ContractState, key: ResourceKey, lost: u128) {
            self.assert_troops();
            let rules = self.game_dispatcher().rules(key.game_id);
            self.resources.decrease_capacity(key, rules.capacity_config.troop_capacity.into() * lost);
        }
        fn spend_food(ref self: ContractState, key: ResourceKey, wheat: u128, fish: u128, timestamp: u64) {
            self.assert_troops();
            self.spend(key, 35, wheat, timestamp);
            self.spend(key, 36, fish, timestamp);
        }
        fn spend_spire_fee(ref self: ContractState, key: ResourceKey, timestamp: u64) {
            self.assert_troops();
            let rules = self.game_dispatcher().rules(key.game_id);
            if rules.spire_travel_essence_cost != 0 {
                self.spend(key, 38, rules.spire_travel_essence_cost, timestamp);
            }
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
    impl SeasonRealmCreation of crate::realms::ISeasonRealmCreation<ContractState> {
        fn create_season_realm(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            realm_id: u16,
            traits: crate::realms::RealmTraits,
            coord: Coord,
            context: ExecutionContext,
        ) -> u32 {
            assert!(get_caller_address() == self.lifecycle.require_active().season, "only season domain");
            let mut record = realm_record(actor, coord, context.timestamp);
            record.metadata.realm_id = realm_id;
            record.metadata.order = traits.order;
            record.metadata.has_wonder = traits.wonder != 1;
            record.resources_packed = pack_realm_resources(traits.resources);
            let key = self.place_realm(game_id, coord, record);
            self.provision_realm_economy(key, context.timestamp);
            self
                .emit_realm_story(
                    key,
                    actor,
                    Story::RealmCreatedStory(crate::ownership::RealmCreatedStory { coord }),
                    context.timestamp,
                );
            key.entity_id
        }
    }
    #[abi(embed_v0)]
    impl RealmCreation of crate::settlement::IRealmCreation<ContractState> {
        fn create_blitz_realm(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            realm_id: u16,
            coord: Coord,
            grant_troops: bool,
            context: ExecutionContext,
        ) -> u32 {
            assert!(get_caller_address() == self.lifecycle.require_active().season, "only season domain");
            let mut record = realm_record(actor, coord, context.timestamp);
            record.metadata.realm_id = realm_id;
            record
                .resources_packed = pack_realm_resources(self.settlement_rules().realm_grants(game_id).realm_resources);
            let key = self.place_realm(game_id, coord, record);
            if grant_troops {
                self.grant_realm_troops(key, context.timestamp);
            }
            self
                .emit_realm_story(
                    key,
                    actor,
                    Story::RealmCreatedStory(crate::ownership::RealmCreatedStory { coord }),
                    context.timestamp,
                );
            key.entity_id
        }
        fn activate_realm_economy(
            ref self: ContractState, game_id: u32, actor: ContractAddress, structure_id: u32, context: ExecutionContext,
        ) {
            assert!(get_caller_address() == self.lifecycle.require_active().season, "only season domain");
            assert_playing(self.game_dispatcher().game(game_id), context.timestamp);
            let key = ResourceKey { game_id, entity_id: structure_id };
            let record = self.structures.record(key);
            assert!(record.owner == actor, "actor does not own structure");
            assert!(record.category == 1, "not a realm");
            self.provision_realm_economy(key, context.timestamp);
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
            assert!(
                get_caller_address() == self.lifecycle.require_active().season, "only authenticated command domain",
            );
            crate::commands::assert_context_time(context.timestamp);
            let key = (game_id, command.owned_structure_id);
            assert!(self.structures.exists.read(key), "actor does not own structure");
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
            if record.owner != 0.try_into().unwrap() && rules.faith_enabled {
                if let Some(accrual) = self
                    .faith
                    .transfer(game_id, command.entity_id, command.new_owner, context.timestamp, game.end_at) {
                    self.emit_faith_accrual(game_id, accrual, context.timestamp);
                }
            }
            self.structures.transfer_owner(key, command.new_owner);
        }
    }
    #[abi(embed_v0)]
    impl FaithViews of crate::ownership::IFaithOwnershipViews<ContractState> {
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
    #[abi(embed_v0)]
    impl ResourceCommands of crate::commands::IResourceCommands<ContractState> {
        fn claim_production(
            ref self: ContractState, game_id: u32, actor: ContractAddress, structure_id: u32, context: ExecutionContext,
        ) {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.season, "only authenticated command domain");
            assert_playing(self.game_dispatcher().game(game_id), context.timestamp);
            let key = ResourceKey { game_id, entity_id: structure_id };
            assert!(self.structures.record(key).owner == actor, "actor does not own structure");
            for resource_type in 1_u8..59 {
                if resource_type < 39 || resource_type > 56 {
                    let rule = self.resource_rule(game_id, resource_type);
                    self
                        .resources
                        .settle_resource(key, resource_type, rule.unit_weight, context.timestamp.try_into().unwrap());
                }
            }
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
                troop_guard_count: 0,
                troop_explorer_count: 0,
                troop_max_guard_count: 1,
                troop_max_explorer_count: 1,
                created_at: timestamp.try_into().unwrap(),
                category: 1,
                coord_x: coord.x,
                coord_y: coord.y,
                level: 0,
                starting_troops_granted: false,
            },
            troop_guards: Default::default(),
            resources_packed: 0,
            metadata: Default::default(),
            category: 1,
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
            let (record, occupier, capacity) = super::discovered_structure(coord, discovery, seed, rules, timestamp);
            self.reveal_structure_tile(game_id, coord, rules);
            if discovery != Discovery::Mine {
                self.reveal_surroundings(game_id, coord);
            }
            self.structures.create(key, record);
            self.map_dispatcher().occupy(tile_key(game_id, coord), id, if completed {
                11
            } else {
                occupier
            }, true);
            self.resources.initialize(key, capacity * RESOURCE_PRECISION);
            match discovery {
                Discovery::Mine => self.create_mine_production(key, coord, seed, rules, timestamp),
                Discovery::Hyperstructure => self.create_hyperstructure(key, seed, completed),
                Discovery::BitcoinMine => {},
                Discovery::None => panic!("cannot create empty discovery"),
            }
            id
        }

        fn settlement_rules(self: @ContractState) -> ISettlementViewsDispatcher {
            ISettlementViewsDispatcher { contract_address: self.lifecycle.require_active().season }
        }
        fn place_realm(ref self: ContractState, game_id: u32, coord: Coord, record: StructureRecord) -> ResourceKey {
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
            self.reveal_structure_tile(game_id, coord, rules);
            self.structures.create(key, record);
            let occupier = if record.metadata.has_wonder {
                5
            } else {
                1
            };
            self.map_dispatcher().occupy(tile_key(game_id, coord), key.entity_id, occupier, true);
            self.resources.initialize(key, rules.structure_capacity_config.realm_capacity.into() * RESOURCE_PRECISION);
            key
        }
        fn emit_realm_story(
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
            self.reveal_surroundings(key.game_id, coord);
            self.grant_realm_troops(key, timestamp);
            let grants = self.settlement_rules().realm_grants(key.game_id);
            for grant in grants.resources {
                let resource_type = *grant.resource_type;
                let amount = *grant.amount;
                assert!(resource_type != crate::resources::LORDS, "invalid start resource");
                if resource_type < 26 || resource_type > 34 {
                    let weight = self.resource_rule(key.game_id, resource_type).unit_weight;
                    self.resources.grant_resource(key, resource_type, amount, weight, timestamp.try_into().unwrap());
                }
            }
            let rules = self.game_dispatcher().rules(key.game_id);
            self.create_producer(key, coord, 0xffffffffffffffffffffffffffffffff, true, 23, 25, rules, timestamp);
        }
        fn grant_realm_troops(ref self: ContractState, key: ResourceKey, timestamp: u64) {
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
            let rules = self.game_dispatcher().rules(key.game_id);
            for grant in grants.resources {
                let kind = *grant.resource_type;
                let amount = *grant.amount;
                if kind == resource_type {
                    let guards = 1500 * RESOURCE_PRECISION;
                    let weight = self.resource_rule(key.game_id, kind).unit_weight;
                    self.resources.grant_resource(key, kind, amount + guards, weight, timestamp.try_into().unwrap());
                    self.spend(key, kind, guards, timestamp);
                    self.structures.add_starting_guard(key, category, guards, rules, timestamp);
                    self
                        .emit_realm_story(
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
        fn emit_faith_accrual(
            ref self: ContractState, game_id: u32, accrual: crate::ownership::Accrual, timestamp: u64,
        ) {
            self
                .emit(
                    StoryEvent {
                        version: 1,
                        game_id,
                        id: self.game_dispatcher().allocate_entity(game_id),
                        owner: None,
                        entity_id: Some(accrual.wonder_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::FaithPointsClaimedStory(
                            FaithPointsClaimedStory {
                                wonder_id: accrual.wonder_id,
                                new_points: accrual.new_points,
                                total_points: accrual.total_points,
                            },
                        ),
                        timestamp,
                    },
                );
        }
        fn reveal_surroundings(ref self: ContractState, game_id: u32, coord: Coord) {
            for direction in 0_u8..6 {
                let key = tile_key(game_id, neighbor(coord, direction));
                let data = self.map_dispatcher().tile(key).map(|tile| tile.data).unwrap_or(0);
                if (data / 0x20000000000) % 0x100 == 0 {
                    self.map_dispatcher().reveal(key, self.map_dispatcher().biome(key));
                }
            }
        }
        fn create_mine_production(
            ref self: ContractState, key: ResourceKey, coord: Coord, seed: u256, rules: SliceRules, timestamp: u64,
        ) {
            let cap = 300000 * RESOURCE_PRECISION * (1 + crate::random::range(seed, 124, 10));
            self.create_producer(key, coord, cap, false, 24, 26, rules, timestamp);
        }
        fn create_producer(
            ref self: ContractState,
            key: ResourceKey,
            coord: Coord,
            cap: u128,
            realm: bool,
            resource_type: u8,
            building_category: u8,
            rules: SliceRules,
            timestamp: u64,
        ) {
            let rule = self.resource_rule(key.game_id, resource_type);
            let building_id = self.game_dispatcher().allocate_entity(key.game_id);
            let rate = if realm {
                rule.realm_rate
            } else {
                rule.village_rate
            };
            assert!(rate != 0, "resource cannot be produced");
            self
                .resources
                .start_production(key, resource_type, rate, cap, rule.unit_weight, timestamp.try_into().unwrap());
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
                    Building {
                        category: building_category,
                        bonus_percent: 0,
                        entity_id: building_id,
                        outer_entity_id: key.entity_id,
                        paused: false,
                    },
                    rule.building_population_cost,
                    rule.building_capacity_grant,
                    rules.building_config.base_population,
                );
            self.game_dispatcher().allocate_entity(key.game_id);
        }
        fn create_hyperstructure(ref self: ContractState, key: ResourceKey, seed: u256, completed: bool) {
            if completed {
                self.completed_hyperstructures.write((key.game_id, key.entity_id), true);
            }
            let randomness: felt252 = seed.try_into().unwrap();
            self.hyperstructure_seeds.write((key.game_id, key.entity_id), randomness);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'Hyperstructure',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        values: array![completed.into(), completed.into(), 1, randomness, 0].span(),
                    },
                );
            let count = self.hyperstructure_counts.read(key.game_id) + 1;
            self.hyperstructure_counts.write(key.game_id, count);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'HyperstructureGlobals',
                        keys: array![key.game_id.into()].span(),
                        values: array![count.into()].span(),
                    },
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
        fn resource_rule(self: @ContractState, game_id: u32, resource_type: u8) -> ResourceRule {
            assert!(self.resources_configured.read(game_id), "missing resource rules");
            assert!(resource_type > 0 && resource_type <= 58, "invalid resource type");
            self.resource_rules.read((game_id, resource_type))
        }
        fn spend(ref self: ContractState, key: ResourceKey, resource_type: u8, amount: u128, timestamp: u64) {
            let rule = self.resource_rule(key.game_id, resource_type);
            self.resources.spend_resource(key, resource_type, amount, rule.unit_weight, timestamp.try_into().unwrap());
        }
        fn reveal_structure_tile(ref self: ContractState, game_id: u32, coord: Coord, rules: SliceRules) {
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
    coord: Coord, discovery: crate::discovery::Discovery, seed: u256, rules: crate::rules::SliceRules, timestamp: u64,
) -> (StructureRecord, u8, u128) {
    let (category, occupier, level, count, capacity) = match discovery {
        Discovery::Mine => (4_u8, 12_u8, 0_u8, 1_u8, rules.structure_capacity_config.fragment_mine_capacity),
        Discovery::Hyperstructure => (2, 9, 3, 3, rules.structure_capacity_config.hyperstructure_capacity),
        Discovery::BitcoinMine => (8, 38, 3, 4, rules.structure_capacity_config.bitcoin_mine_capacity),
        Discovery::None => panic!("cannot create empty discovery"),
    };
    assert!(coord.alt == (discovery == Discovery::BitcoinMine), "invalid discovery layer");
    let max_guards = if discovery == Discovery::Mine {
        1
    } else {
        4
    };
    let base = StructureBase {
        troop_guard_count: count,
        troop_explorer_count: 0,
        troop_max_guard_count: max_guards,
        troop_max_explorer_count: 0,
        created_at: timestamp.try_into().unwrap(),
        category,
        coord_x: coord.x,
        coord_y: coord.y,
        level,
        starting_troops_granted: false,
    };
    (
        StructureRecord {
            owner: 0.try_into().unwrap(),
            base,
            troop_guards: discovery_guards(discovery, seed, rules, timestamp),
            resources_packed: 0,
            metadata: Default::default(),
            category,
        },
        occupier,
        capacity.into(),
    )
}

fn discovery_guards(
    discovery: crate::discovery::Discovery, seed: u256, rules: crate::rules::SliceRules, timestamp: u64,
) -> GuardTroops {
    let mut guards: GuardTroops = Default::default();
    if discovery == crate::discovery::Discovery::Mine {
        guards
            .delta =
                discovery_guard(
                    crate::troops::TroopType::Crossbowman, crate::troops::TroopTier::T1, seed, rules, timestamp,
                );
    } else {
        let hyper = discovery == crate::discovery::Discovery::Hyperstructure;
        guards
            .delta =
                discovery_guard(
                    crate::troops::TroopType::Paladin, crate::troops::TroopTier::T2, seed, rules, timestamp,
                );
        guards
            .charlie =
                discovery_guard(
                    crate::troops::TroopType::Knight,
                    crate::troops::TroopTier::T2,
                    seed + if hyper {
                        1
                    } else {
                        0
                    },
                    rules,
                    timestamp,
                );
        guards
            .bravo =
                discovery_guard(
                    crate::troops::TroopType::Crossbowman,
                    crate::troops::TroopTier::T2,
                    seed + if hyper {
                        2
                    } else {
                        0
                    },
                    rules,
                    timestamp,
                );
        if !hyper {
            guards
                .alpha =
                    discovery_guard(
                        crate::troops::TroopType::Paladin, crate::troops::TroopTier::T2, seed, rules, timestamp,
                    );
        }
    }
    guards
}

fn discovery_guard(
    category: crate::troops::TroopType,
    tier: crate::troops::TroopTier,
    seed: u256,
    rules: crate::rules::SliceRules,
    timestamp: u64,
) -> Troops {
    let lower: u128 = rules.troop_limit_config.mercenaries_troop_lower_bound.into();
    let upper: u128 = rules.troop_limit_config.mercenaries_troop_upper_bound.into();
    Troops {
        category,
        tier,
        count: (lower + crate::random::range(seed, 1, upper - lower)) * crate::rules::RESOURCE_PRECISION,
        stamina: crate::troops::Stamina {
            amount: 0, updated_tick: timestamp / rules.tick_config.armies_tick_in_seconds,
        },
        boosts: Default::default(),
        battle_cooldown_end: 0,
    }
}
