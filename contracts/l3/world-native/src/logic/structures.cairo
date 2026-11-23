use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess};
use crate::resources::ResourceKey;
use crate::structures::{Structure, StructureRecord};

pub fn owner(key: ResourceKey) -> ContractAddress {
    let state = crate::state::read();
    state.structures.structures.entry((key.game_id, key.entity_id)).owner.read()
}

pub fn exists(key: ResourceKey) -> bool {
    let state = crate::state::read();
    let category = state.structures.structures.entry((key.game_id, key.entity_id)).base.read().category;
    category != 0
}

pub fn record(key: ResourceKey) -> StructureRecord {
    let state = crate::state::read();
    assert!(exists(key), "missing structure");
    state.structures.structures.read((key.game_id, key.entity_id))
}

pub fn structure(key: ResourceKey) -> Option<Structure> {
    if !exists(key) {
        return None;
    }
    let record = record(key);
    Some(
        Structure {
            owner: record.owner,
            base: record.base,
            resources_packed: record.resources_packed,
            metadata: record.metadata,
        },
    )
}

pub mod StructureState {
    use starknet::Event as EventTrait;
    use starknet::storage::{StorageMapWriteAccess, StoragePathEntry, StoragePointerWriteAccess};
    use crate::events::{RowDeleted, RowMemberSet, RowSet};
    use crate::resources::ResourceKey;
    use crate::structures::StructureRecord;

    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowMemberSet: RowMemberSet,
        RowDeleted: RowDeleted,
    }

    pub fn mark_starting_troops(key: ResourceKey) {
        let state = crate::state::write();
        let mut base = crate::logic::structures::record(key).base;
        base.starting_troops_granted = true;
        state.structures.structures.entry((key.game_id, key.entity_id)).base.write(base);
        emit_base(key, base);
    }
    pub fn record_depth(key: ResourceKey, depth: u8) {
        let mut metadata = crate::logic::structures::record(key).metadata;
        if depth <= metadata.deepest_depth {
            return;
        }
        metadata.deepest_depth = depth;
        crate::state::write().structures.structures.entry((key.game_id, key.entity_id)).metadata.write(metadata);
        let mut values = array![];
        metadata.serialize(ref values);
        emit(
            Event::RowMemberSet(
                RowMemberSet {
                    version: 1,
                    model: 'Structure',
                    member: 'metadata',
                    keys: array![key.game_id.into(), key.entity_id.into()].span(),
                    values: values.span(),
                },
            ),
        );
    }
    pub fn emit_base(key: ResourceKey, base: crate::structures::StructureBase) {
        let mut values = array![];
        base.serialize(ref values);
        emit(
            Event::RowMemberSet(
                RowMemberSet {
                    version: 1,
                    model: 'Structure',
                    member: 'base',
                    keys: array![key.game_id.into(), key.entity_id.into()].span(),
                    values: values.span(),
                },
            ),
        );
    }

    pub fn create(key: ResourceKey, record: StructureRecord) {
        let state = crate::state::write();
        assert!(
            key.game_id != 0
                && key.entity_id != 0
                && record.base.category != 0
                && !crate::logic::structures::exists(key),
            "invalid new structure",
        );
        state.structures.structures.write((key.game_id, key.entity_id), record);
        let mut keys = array![];
        key.serialize(ref keys);
        let mut values = array![];
        crate::structures::Structure {
            owner: record.owner,
            base: record.base,
            resources_packed: record.resources_packed,
            metadata: record.metadata,
        }
            .serialize(ref values);
        emit(Event::RowSet(RowSet { version: 1, model: 'Structure', keys: keys.span(), values: values.span() }));
    }
    pub fn remove(key: ResourceKey) {
        assert!(crate::logic::structures::exists(key), "missing structure");
        crate::state::write()
            .structures
            .structures
            .write(
                (key.game_id, key.entity_id),
                StructureRecord {
                    owner: 0.try_into().unwrap(),
                    base: Default::default(),
                    resources_packed: 0,
                    metadata: Default::default(),
                },
            );
        emit(
            Event::RowDeleted(
                RowDeleted {
                    version: 1, model: 'Structure', keys: array![key.game_id.into(), key.entity_id.into()].span(),
                },
            ),
        );
    }

    pub fn transfer_owner(key: ResourceKey, owner: starknet::ContractAddress) {
        assert!(crate::logic::structures::exists(key), "missing structure");
        crate::state::write().structures.structures.entry((key.game_id, key.entity_id)).owner.write(owner);
        emit(
            Event::RowMemberSet(
                RowMemberSet {
                    version: 1,
                    model: 'Structure',
                    member: 'owner',
                    keys: array![key.game_id.into(), key.entity_id.into()].span(),
                    values: array![owner.into()].span(),
                },
            ),
        );
    }

    pub fn upgrade(
        key: ResourceKey, mut base: crate::structures::StructureBase, config: crate::rules::TroopLimitConfig,
    ) {
        let state = crate::state::write();
        base.level += 1;
        let (explorers, guards) = crate::upgrades::troop_limits(config, base.level);
        base.troop_max_explorer_count = explorers;
        base.troop_max_guard_count = guards;
        state.structures.structures.entry((key.game_id, key.entity_id)).base.write(base);
        emit_base(key, base);
    }
    pub fn emit(event: Event) {
        let mut keys = array![selector!("StructureEvent")];
        let mut data = array![];
        event.append_keys_and_data(ref keys, ref data);
        starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
    }
}

#[starknet::contract]
pub mod StructuresLogic {
    #[cfg(feature: "test_support")]
    use starknet::get_block_timestamp;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::buildings::{Building, BuildingKey};
    use crate::discovery::Discovery;
    use crate::events::RowSet;
    use crate::game::assert_playing;
    use crate::geometry::tile_key;
    use crate::logic::buildings::BuildingState;
    use crate::logic::release::ReleaseState;
    use crate::logic::structures::StructureState;
    use crate::map::IMapLogicDispatcherTrait;
    use crate::ownership::{Story, StoryEvent};
    use crate::resources::{IResourceOperationsDispatcherTrait, ResourceKey};
    use crate::rules::RESOURCE_PRECISION;
    use crate::settlement::{ISettlementDisplacementDispatcherTrait, ISettlementDisplacementLibraryDispatcher};
    use crate::structures::{StructureBase, StructureRecord};
    use crate::troops::{Coord, ExplorerKey};
    component!(path: BuildingState, storage: buildings, event: BuildingEvent);
    impl BuildingInternal = BuildingState::InternalImpl<ContractState>;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[flat]
        pub data: crate::state::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        buildings: BuildingState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ReleaseEvent: ReleaseState::Event,
        StructureEvent: StructureState::Event,
        BuildingEvent: BuildingState::Event,
        StoryEvent: StoryEvent,
        RowSet: RowSet,
    }
    #[abi(embed_v0)]
    impl Villages of crate::village::IVillageArmy<ContractState> {
        fn receive_village_army(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            village_id: u64,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            assert_playing(context.game.unbox(), context.timestamp);
            let key = ResourceKey { game_id, entity_id: village_id };
            let record = crate::logic::structures::record(key);
            assert!(record.owner == actor, "actor does not own village");
            assert!(record.base.category == crate::taxonomy::VILLAGE_CATEGORY, "structure is not a village");
            assert!(!record.base.starting_troops_granted, "army grant already claimed");
            let grants = crate::logic::village::rules();
            let interval = context.rules.unbox().tick_config.armies_tick_in_seconds;
            let claimable_at: u64 = record.base.created_at.into() / interval + grants.troop_delay_ticks.into();
            assert!(context.timestamp / interval >= claimable_at, "army grant cannot be claimed yet");
            let category = crate::logic::structure_actions::biome_troop(key, context);
            crate::logic::structure_actions::grant_starting_troops(
                key, category, grants.resources, 10 * RESOURCE_PRECISION, context.timestamp, context,
            );
            ()
        }
    }

    #[abi(embed_v0)]
    #[abi(embed_v0)]
    impl Structures of crate::structures::IStructureOperations<ContractState> {
        fn create_discovery(
            ref self: ContractState,
            game_id: u32,
            home_id: u64,
            coord: Coord,
            discovery: Discovery,
            seed: u256,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) -> u64 {
            let game_context = crate::commands::execution_context(game_id, game_context);

            self.place_discovery(game_id, home_id, coord, discovery, seed, timestamp, game_context)
        }

        #[cfg(feature: "test_support")]
        fn provision_realm(
            ref self: ContractState, game_id: u32, actor: ContractAddress, coord: Coord, grants: Span<(u8, u128)>,
        ) -> u64 {
            let game_context = crate::commands::load_context(game_id, 0, starknet::get_block_timestamp());

            self.assert_authority();
            let game = game_context.game.unbox();
            assert!(game.dev_mode_on, "fixture provisioning requires development game");
            assert!(!coord.alt && actor != 0.try_into().unwrap(), "invalid realm owner or layer");
            let record = realm_record(actor, get_block_timestamp(), game_context.rules.unbox().troop_limit_config);
            let key = self.place_settlement(game_id, coord, record, game_context);
            for grant in grants {
                let (resource_type, amount) = *grant;
                crate::logic::structure_actions::resources_dispatcher(game_id)
                    .grant_resource(
                        key,
                        resource_type,
                        amount,
                        get_block_timestamp(),
                        crate::commands::resource_context(game_context),
                    );
            }
            key.entity_id
        }
    }

    #[cfg(feature: "blitz")]
    #[abi(embed_v0)]
    impl ReservedHyperstructures of crate::structures::IReservedHyperstructures<ContractState> {
        fn raise_hyperstructure(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            coord: Coord,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::execution_context(game_id, context);
            let game = context.game.unbox();
            assert!(game.end_at == 0 || context.timestamp < game.end_at, "game ended");
            crate::logic::map::MapState::release_hyperstructure(tile_key(game_id, coord));
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id);
            self.place_discovery(game_id, 0, coord, Discovery::Hyperstructure, seed, context.timestamp, context);
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
            context: crate::commands::ActionContext,
        ) -> u64 {
            let context = crate::commands::execution_context(game_id, context);

            let mut record = realm_record(actor, context.timestamp, context.rules.unbox().troop_limit_config);
            match creation {
                crate::settlement::SettlementCreation::Realm(realm) => {
                    record.metadata.realm_id = realm.realm_id;
                    record.metadata.order = realm.traits.order;
                    record.metadata.has_wonder = realm.traits.wonder != 1;
                    record.resources_packed = pack_realm_resources(realm.traits.resources);
                },
                crate::settlement::SettlementCreation::Village(village) => {
                    let connected = crate::logic::structures::record(
                        ResourceKey { game_id, entity_id: village.connected_realm },
                    );
                    assert!(
                        connected.base.category == crate::taxonomy::REALM_CATEGORY, "connected entity is not a realm",
                    );
                    assert!(village.resource >= 1 && village.resource <= 22, "invalid village resource");
                    record.base.category = crate::taxonomy::VILLAGE_CATEGORY;
                    record.metadata.village_realm = village.connected_realm;
                    record.resources_packed = pack_realm_resources(array![village.resource].span());
                },
            }
            let key = self.place_settlement(game_id, coord, record, context);
            match creation {
                crate::settlement::SettlementCreation::Realm(realm) => {
                    crate::logic::research::write(key, crate::research::RealmKnowledge { learned: 0 });
                    if crate::rules::DAYS_IN_PLAY {
                        self.raise_realm_home(game_id, crate::entity_ids::namespace(key.entity_id), context);
                    }

                    if realm.activate_economy {
                        self.provision_realm_economy(key, realm.troops, context.timestamp, context);
                    } else if realm.troops != crate::settlement::StartingTroops::None {
                        let grants = crate::logic::settlement::grants();
                        self.grant_realm_troops(key, realm.troops, grants.resources, context.timestamp, context);
                    }
                    crate::logic::stories::emit_entity_story(
                        key,
                        actor,
                        Story::RealmCreatedStory(crate::ownership::RealmCreatedStory { coord }),
                        context.timestamp,
                    );
                },
                crate::settlement::SettlementCreation::Village(_) => {
                    self
                        .grant_non_troop_resources(
                            key, crate::logic::village::rules().resources, context.timestamp, context,
                        );
                    self
                        .create_producer(
                            key, 0, crate::logic::resources::rule(23).village_rate, 23, 25, context.timestamp, context,
                        );
                },
            }
            (key.entity_id)
        }
    }

    #[abi(embed_v0)]
    impl RealmCreation of crate::settlement::IRealmCreation<ContractState> {
        fn provision_and_upgrade_realm(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            structure_id: u64,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            Self::activate_realm_economy(
                ref self, game_id, actor, structure_id, crate::commands::action_context(context),
            );
            crate::upgrades::IStructureUpgradesDispatcherTrait::level_up(
                crate::upgrades::IStructureUpgradesLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::CONSTRUCTION),
                },
                game_id,
                actor,
                structure_id,
                crate::commands::action_context(context),
            );
            ()
        }

        fn activate_realm_economy(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            structure_id: u64,
            context: crate::commands::ActionContext,
        ) -> () {
            let context = crate::commands::execution_context(game_id, context);

            assert_playing(context.game.unbox(), context.timestamp);
            let key = ResourceKey { game_id, entity_id: structure_id };
            let record = crate::logic::structures::record(key);
            assert!(record.owner == actor, "actor does not own structure");
            assert!(record.base.category == crate::taxonomy::REALM_CATEGORY, "not a realm");
            self.provision_realm_economy(key, crate::settlement::StartingTroops::Biome, context.timestamp, context);
            ()
        }
    }

    #[abi(embed_v0)]
    impl Names of crate::names::INames<ContractState> {
        #[cfg(feature: "test_support")]
        fn entity_name(self: @ContractState, key: ResourceKey) -> crate::names::EntityName {
            crate::names::EntityName { name: self.data.structure_rules.entity_names.read((key.game_id, key.entity_id)) }
        }
        fn set_entity_name(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::names::SetEntityName,
            context: crate::commands::ActionContext,
        ) {
            let context = crate::commands::execution_context(game_id, context);

            assert_playing(context.game.unbox(), context.timestamp);
            let key = ResourceKey { game_id, entity_id: command.entity_id };
            let home = match crate::logic::structures::structure(key) {
                Option::Some(_) => key,
                Option::None => {
                    let explorer = crate::logic::troops::active_explorer(
                        ExplorerKey { game_id, explorer_id: command.entity_id }, context.timestamp, context,
                    );
                    ResourceKey { game_id, entity_id: explorer.owner }
                },
            };
            assert!(crate::logic::structures::record(home).owner == actor, "actor does not own entity");
            self.data.structure_rules.entity_names.write((game_id, command.entity_id), command.name);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'EntityName',
                        keys: array![game_id.into(), command.entity_id.into()].span(),
                        values: array![command.name].span(),
                    },
                );
        }
    }
    #[abi(embed_v0)]
    impl ExpeditionSites of crate::expeditions::IExpeditionSite<ContractState> {
        fn expedition_site(self: @ContractState, key: ResourceKey) -> Option<crate::expeditions::ExpeditionSite> {
            crate::logic::expeditions::expedition_site(key)
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
    fn realm_record(actor: ContractAddress, timestamp: u64, config: crate::rules::TroopLimitConfig) -> StructureRecord {
        let (armies, guards) = crate::upgrades::troop_limits(config, 0);
        StructureRecord {
            owner: actor,
            base: StructureBase {
                troop_max_guard_count: guards,
                troop_max_explorer_count: armies,
                created_at: timestamp.try_into().unwrap(),
                category: crate::taxonomy::REALM_CATEGORY,
                level: 0,
                starting_troops_granted: false,
            },
            resources_packed: 0,
            metadata: Default::default(),
        }
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn reveal_structure_tile(
            ref self: ContractState, game_id: u32, coord: Coord, game_context: crate::commands::ExecutionContext,
        ) {
            let key = tile_key(game_id, coord);
            let tile = crate::logic::map::tile(key);
            let data = tile.map(|tile| tile.data).unwrap_or(0);
            assert!(crate::logic::map::occupancy(key).is_none(), "occupied structure tile");
            if (data / 0x20000000000) % 0x100 == 0 {
                crate::logic::map::MapState::reveal(
                    key,
                    crate::logic::structure_actions::map_dispatcher(game_id)
                        .biome(key, crate::commands::biome_context(game_context)),
                );
            }
        }
        fn create_producer(
            ref self: ContractState,
            key: ResourceKey,
            cap: u128,
            rate: u64,
            resource_type: u8,
            building_category: u8,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            crate::logic::structure_actions::resources_dispatcher(key.game_id)
                .start_production(
                    key, resource_type, rate, cap, timestamp, crate::commands::resource_context(game_context),
                );
            self
                .buildings
                .create(
                    BuildingKey { game_id: key.game_id, structure_id: key.entity_id, inner_col: 10, inner_row: 10 },
                    Building { category: building_category, paused: false, labor_paid: 0 },
                );
        }
        #[cfg(feature: "blitz")]
        fn place_discovery(
            ref self: ContractState,
            game_id: u32,
            home_id: u64,
            coord: Coord,
            discovery: Discovery,
            seed: u256,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> u64 {
            let rules = game_context.rules.unbox();
            let key = if discovery == Discovery::Hyperstructure {
                crate::logic::blitz::hyperstructures::claim_id(game_id)
            } else {
                ResourceKey { game_id, entity_id: crate::entity_ids::allocate_home(game_id, home_id) }
            };
            let id = key.entity_id;
            let (mut record, occupier, capacity) = crate::structures::discovered_structure(
                coord, discovery, rules.structure_capacity_config, rules.troop_limit_config.camp_armies, timestamp,
            );
            self.reveal_structure_tile(game_id, coord, game_context);
            if discovery == Discovery::Camp {
                crate::logic::structure_actions::map_dispatcher(game_id)
                    .reveal_structure_surroundings(game_id, coord, crate::commands::biome_context(game_context));
            }
            crate::logic::structure_actions::resources_dispatcher(game_id)
                .initialize_resources(key, capacity * RESOURCE_PRECISION);
            if discovery == Discovery::Mine {
                record.metadata.mine_kind = self.open_mine(key, seed, timestamp, game_context);
            } else if discovery == Discovery::Camp {
                self.stock_camp(key, timestamp, game_context);
            }
            crate::logic::structures::StructureState::create(key, record);
            crate::logic::map::MapState::occupy(tile_key(game_id, coord), id, occupier, true);
            crate::guards::IGuardInitializationDispatcherTrait::initialize_structure_guards(
                crate::guards::IGuardInitializationLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::MAP),
                },
                key,
                seed,
                timestamp,
                rules,
            );
            id
        }
        #[cfg(feature: "blitz")]
        fn open_mine(
            ref self: ContractState,
            key: ResourceKey,
            seed: u256,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> u8 {
            let (kind, config, cap) = crate::mines::IMineRulesDispatcherTrait::mine_draw(
                crate::mines::IMineRulesLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(key.game_id, crate::slots::PRODUCTION),
                },
                crate::mines::MinePoolKey { game_id: key.game_id },
                seed,
            );
            self
                .create_producer(
                    key,
                    cap,
                    config.production_rate,
                    config.resource_type,
                    config.building_category,
                    timestamp,
                    game_context,
                );
            kind
        }
        #[cfg(feature: "blitz")]
        fn stock_camp(
            ref self: ContractState, key: ResourceKey, timestamp: u64, game_context: crate::commands::ExecutionContext,
        ) {
            for grant in crate::balance::structures::CAMP_GRANTS.span() {
                crate::logic::structure_actions::resources_dispatcher(key.game_id)
                    .grant_resource(
                        key,
                        *grant.resource_type,
                        *grant.amount,
                        timestamp,
                        crate::commands::resource_context(game_context),
                    );
            }
            self
                .create_producer(
                    key,
                    crate::resources::UNLIMITED_OUTPUT,
                    crate::balance::structures::CAMP_LABOR_RATE,
                    crate::resources::LABOR,
                    crate::research::WORKSHOP,
                    timestamp,
                    game_context,
                );
        }
        #[cfg(not(feature: "blitz"))]
        fn place_discovery(
            ref self: ContractState,
            game_id: u32,
            home_id: u64,
            coord: Coord,
            discovery: Discovery,
            seed: u256,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) -> u64 {
            let rules = game_context.rules.unbox();
            let id = crate::entity_ids::allocate_home(game_id, home_id);
            let key = ResourceKey { game_id, entity_id: id };
            let (mut record, occupier, capacity) = crate::structures::discovered_structure(
                coord, discovery, rules.structure_capacity_config, rules.troop_limit_config.camp_armies, timestamp,
            );
            self.reveal_structure_tile(game_id, coord, game_context);
            if crate::logic::expeditions::depth_rules_at(game_id, coord).reveal_site_neighbors {
                crate::logic::structure_actions::map_dispatcher(game_id)
                    .reveal_structure_surroundings(game_id, coord, crate::commands::biome_context(game_context));
            }
            crate::logic::structure_actions::resources_dispatcher(game_id)
                .initialize_resources(key, capacity * RESOURCE_PRECISION);
            match discovery {
                Discovery::Camp => {},
                Discovery::Rift | Discovery::Beasts => {},
                Discovery::Ruin(reward) => {
                    crate::logic::army_relics::store_ruin(key, reward);
                    let depth = crate::logic::expeditions::depth_at(game_id, coord);
                    if crate::fragments::holds_cache(seed, depth) {
                        crate::logic::army_relics::store_cache(key, reward, depth);
                    }
                },
                Discovery::None | Discovery::Shrine | Discovery::Well |
                Discovery::Spire => panic!("discovery is not a structure"),
            }
            crate::logic::structures::StructureState::create(key, record);
            crate::logic::map::MapState::occupy(tile_key(game_id, coord), id, occupier, true);
            crate::guards::IGuardInitializationDispatcherTrait::initialize_structure_guards(
                crate::guards::IGuardInitializationLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::MAP),
                },
                key,
                seed,
                timestamp,
                game_context.rules.unbox(),
            );
            id
        }
        fn place_settlement(
            ref self: ContractState,
            game_id: u32,
            coord: Coord,
            record: StructureRecord,
            game_context: crate::commands::ExecutionContext,
        ) -> ResourceKey {
            assert!(!coord.alt && record.owner != 0.try_into().unwrap(), "invalid realm owner or layer");
            let id = if record.base.category == crate::taxonomy::VILLAGE_CATEGORY {
                crate::entity_ids::allocate_home(game_id, record.metadata.village_realm)
            } else if crate::rules::ROSTER_ENTRY {
                record.metadata.realm_id.into()
            } else {
                crate::entity_ids::claim_home(game_id, record.owner)
            };
            let key = ResourceKey { game_id, entity_id: id };
            let village = record.base.category == crate::taxonomy::VILLAGE_CATEGORY;
            let on_map = crate::rules::ROSTER_ENTRY || village;
            if on_map {
                self.prepare_settlement_tile(game_id, coord, game_context);
            }
            crate::logic::structures::StructureState::create(key, record);
            if on_map {
                let occupier = if village {
                    crate::taxonomy::VILLAGE_OCCUPIER
                } else if record.metadata.has_wonder {
                    crate::taxonomy::REALM_WONDER_LEVEL_1_OCCUPIER
                } else {
                    crate::taxonomy::REALM_REGULAR_LEVEL_1_OCCUPIER
                };
                crate::logic::map::MapState::occupy(tile_key(game_id, coord), key.entity_id, occupier, true);
            }
            let capacity: u128 = core::num::traits::Bounded::MAX;
            crate::logic::structure_actions::resources_dispatcher(game_id).initialize_resources(key, capacity);
            key
        }
        fn raise_realm_home(
            self: @ContractState, game_id: u32, realm_id: u32, context: crate::commands::ExecutionContext,
        ) {
            if context.timestamp < context.game.unbox().start_main_at {
                return;
            }
            let today = crate::days::day_of(
                context.game.unbox(), crate::balance::rules::SWITCHES.day_unit_seconds, context.timestamp,
            )
                .index;
            let origin = crate::expeditions::site(crate::logic::settlement::spacing(), realm_id, today, 0);
            crate::logic::map::raise_expedition_home(
                tile_key(game_id, origin), crate::commands::biome_context(context),
            );
        }

        fn prepare_settlement_tile(
            ref self: ContractState, game_id: u32, coord: Coord, game_context: crate::commands::ExecutionContext,
        ) {
            if let Some(occupancy) = crate::logic::map::occupancy(tile_key(game_id, coord)) {
                assert!(!occupancy.is_structure, "tile occupied by structure");
                ISettlementDisplacementLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::MOVEMENT),
                }
                    .displace_explorer(game_id, occupancy.entity_id, crate::commands::action_context(game_context));
            }
            self.reveal_structure_tile(game_id, coord, game_context);
            crate::logic::structure_actions::map_dispatcher(game_id)
                .reveal_structure_surroundings(game_id, coord, crate::commands::biome_context(game_context));
        }

        fn provision_realm_economy(
            ref self: ContractState,
            key: ResourceKey,
            troops: crate::settlement::StartingTroops,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let counts = self.buildings.data.buildings.structure_buildings.read((key.game_id, key.entity_id));
            const LABOR_COUNT_SCALE: u128 = 0x10000000000000000;
            assert!(counts.packed_counts_2 / LABOR_COUNT_SCALE % 256 == 0, "realm already provisioned");
            let grants = crate::logic::settlement::grants();
            self.grant_realm_troops(key, troops, grants.resources, timestamp, game_context);
            self.grant_non_troop_resources(key, grants.resources, timestamp, game_context);
            self
                .create_producer(
                    key,
                    crate::resources::UNLIMITED_OUTPUT,
                    crate::logic::resources::castle_labor_rate(crate::logic::structures::record(key).base.level),
                    crate::resources::LABOR,
                    crate::research::WORKSHOP,
                    timestamp,
                    game_context,
                );
        }

        fn grant_non_troop_resources(
            ref self: ContractState,
            key: ResourceKey,
            grants: Span<crate::resources::ResourceAmount>,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            for grant in grants {
                let resource_type = *grant.resource_type;
                assert!(resource_type != crate::resources::LORDS, "invalid start resource");
                if resource_type < 26 || resource_type > 34 {
                    crate::logic::structure_actions::resources_dispatcher(key.game_id)
                        .grant_resource(
                            key,
                            resource_type,
                            *grant.amount,
                            timestamp,
                            crate::commands::resource_context(game_context),
                        );
                }
            }
        }
        fn grant_realm_troops(
            ref self: ContractState,
            key: ResourceKey,
            troops: crate::settlement::StartingTroops,
            resources: Span<crate::resources::ResourceAmount>,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let category = match troops {
                crate::settlement::StartingTroops::None => { return; },
                crate::settlement::StartingTroops::Biome => crate::logic::structure_actions::biome_troop(
                    key, game_context,
                ),
            };
            let guards = game_context.rules.unbox().troop_limit_config.starting_guard;
            crate::logic::structure_actions::grant_starting_troops(
                key, category, resources, guards.into() * RESOURCE_PRECISION, timestamp, game_context,
            );
        }

        fn assert_authority(self: @ContractState) {
            assert!(get_caller_address() == self.release.authority(), "only domain authority");
        }
    }
}
