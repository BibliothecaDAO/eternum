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
    state.structures.structures.entry((key.game_id, key.entity_id)).base.read().category != 0
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
    use starknet::storage::{
        StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use crate::events::{RowMemberSet, RowSet};
    use crate::resources::ResourceKey;
    use crate::structures::StructureRecord;

    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowMemberSet: RowMemberSet,
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
        crate::logic::structures::structure(key).unwrap().serialize(ref values);
        emit(Event::RowSet(RowSet { version: 1, model: 'Structure', keys: keys.span(), values: values.span() }));
    }
    pub fn transfer_owner(key: ResourceKey, owner: starknet::ContractAddress) {
        let state = crate::state::write();
        assert!(crate::logic::structures::exists(key), "missing structure");
        if state.structures.structures.entry((key.game_id, key.entity_id)).owner.read() == owner {
            return;
        }
        state.structures.structures.entry((key.game_id, key.entity_id)).owner.write(owner);
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
    #[cfg(test)]
    use starknet::get_block_timestamp;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::buildings::{Building, BuildingKey};
    use crate::discovery::Discovery;
    use crate::events::RowSet;
    use crate::game::{IPointsDispatcherTrait, IPointsLibraryDispatcher, assert_playing};
    use crate::geometry::tile_key;
    use crate::logic::buildings::BuildingState;
    use crate::logic::guilds::GuildState;
    use crate::logic::release::ReleaseState;
    use crate::logic::structures::StructureState;
    use crate::map::{IMapLogicDispatcherTrait, IMapLogicLibraryDispatcher};
    use crate::mines::{IMineRulesDispatcherTrait, IMineRulesLibraryDispatcher, MinePoolKey};
    use crate::ownership::{Story, StoryEvent, StoryResultTrait, TransferOwnership};
    use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};
    use crate::rules::RESOURCE_PRECISION;
    use crate::settlement::{ISettlementDisplacementDispatcherTrait, ISettlementDisplacementLibraryDispatcher};
    use crate::structures::{StructureBase, StructureRecord};
    use crate::troops::{Coord, ExplorerKey};
    component!(path: BuildingState, storage: buildings, event: BuildingEvent);
    impl BuildingInternal = BuildingState::InternalImpl<ContractState>;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    component!(path: GuildState, storage: guilds, event: GuildEvent);
    #[abi(embed_v0)]
    impl Guilds = GuildState::GuildsImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[flat]
        pub data: crate::state::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        buildings: BuildingState::Storage,
        #[substorage(v0)]
        guilds: GuildState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ReleaseEvent: ReleaseState::Event,
        StructureEvent: StructureState::Event,
        BuildingEvent: BuildingState::Event,
        GuildEvent: GuildState::Event,
        StoryEvent: StoryEvent,
        RowSet: RowSet,
    }
    #[abi(embed_v0)]
    impl Camps of crate::camps::ICampRules<ContractState> {
        fn camp_resources(self: @ContractState, game_id: u32) -> Span<crate::resources::ResourceAmount> {
            let preset = crate::logic::preset_record::for_game(game_id);
            let count = preset.camp_resource_count.read();
            let mut resources = array![];
            for index in 0..count {
                resources.append(preset.camp_grants.read(index));
            }
            resources.span()
        }
    }
    #[abi(embed_v0)]
    impl BankCreation of crate::market::IBankCreation<ContractState> {
        fn create_bank(
            ref self: ContractState,
            key: ResourceKey,
            owner: ContractAddress,
            coord: Coord,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::load_context(key.game_id, game_context);

            assert!(key.entity_id >= 0xfffffff9 && key.entity_id <= 0xfffffffe, "invalid regional bank id");
            assert!(!coord.alt && owner != 0.try_into().unwrap(), "invalid bank placement");
            let rules = game_context.rules.unbox();
            assert!(!crate::logic::structures::exists(key), "bank already exists");
            self.reveal_structure_tile(key.game_id, coord, game_context);
            self
                .map_dispatcher(key.game_id)
                .reveal_structure_surroundings(key.game_id, coord, crate::commands::biome_context(game_context));
            let record = StructureRecord {
                owner,
                base: StructureBase {
                    category: 3,
                    level: 3,
                    troop_max_guard_count: 4,
                    troop_max_explorer_count: 0,
                    created_at: timestamp.try_into().unwrap(),
                    ..Default::default(),
                },
                resources_packed: 0,
                metadata: Default::default(),
            };
            crate::logic::structures::StructureState::create(key, record);
            crate::logic::map::MapState::occupy(tile_key(key.game_id, coord), key.entity_id, 14, true);
            self
                .resources_dispatcher(key.game_id)
                .initialize_resources(
                    key,
                    rules.structure_capacity_config.bank_structure_capacity.into() * RESOURCE_PRECISION,
                    3,
                    timestamp,
                    crate::commands::action_context(game_context),
                );
            let seed: u256 = Into::<felt252, u256>::into('what could possibly go wrong') - key.entity_id.into();
            crate::guards::IGuardsDispatcherTrait::initialize_structure_guards(
                crate::guards::IGuardsLibraryDispatcher { class_hash: self.release.classes(key.game_id).troops.read() },
                key,
                seed,
                None,
                timestamp,
                crate::commands::action_context(game_context),
            );
        }
    }

    #[abi(embed_v0)]
    impl Structures of crate::structures::IStructureOperations<ContractState> {
        fn create_discovery(
            ref self: ContractState,
            game_id: u32,
            coord: Coord,
            discovery: Discovery,
            seed: u256,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) -> u32 {
            let game_context = crate::commands::load_context(game_id, game_context);

            self.place_discovery(game_id, coord, discovery, seed, timestamp, false, game_context)
        }

        #[cfg(test)]
        fn provision_realm(
            ref self: ContractState, game_id: u32, actor: ContractAddress, coord: Coord, grants: Span<(u8, u128)>,
        ) -> u32 {
            let game_context = crate::commands::load_context(
                game_id, crate::commands::ActionContext { raw_root: 0, timestamp: starknet::get_block_timestamp() },
            );

            self.assert_authority();
            let game = game_context.game.unbox();
            assert!(game.dev_mode_on, "fixture provisioning requires development game");
            assert!(!coord.alt && actor != 0.try_into().unwrap(), "invalid realm owner or layer");
            let record = realm_record(actor, get_block_timestamp(), game_context.rules.unbox().troop_limit_config);
            let key = self.place_settlement(game_id, coord, record, game_context);
            for grant in grants {
                let (resource_type, amount) = *grant;
                self
                    .resources_dispatcher(game_id)
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
        fn pay_for_explorer(
            ref self: ContractState,
            key: ResourceKey,
            actor: ContractAddress,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
        ) {
            let game_context = crate::commands::load_context(key.game_id, game_context);

            assert_playing(game_context.game.unbox(), timestamp);
            assert!(crate::logic::structures::record(key).owner == actor, "actor does not own structure");
            assert!(resource_type >= 26 && resource_type <= 34, "invalid troop resource");
            assert!(amount > 0 && amount % RESOURCE_PRECISION == 0, "invalid troop amount");
            self.spend(key, resource_type, amount, timestamp, crate::commands::resource_context(game_context));
        }
    }
    #[abi(embed_v0)]
    impl BlitzHyperstructures of crate::settlement::IBlitzHyperstructures<ContractState> {
        fn create_reserved_hyperstructure(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            coord: Coord,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) {
            let context = crate::commands::load_context(game_id, context);

            let classes = self.release.classes(game_id);
            let game = context.game.unbox();
            assert!(
                crate::rules::rule_enabled(context.rules.unbox(), crate::rules::RESERVED_HYPERSTRUCTURES),
                "reserved hyperstructures disabled",
            );
            assert!(game.end_at == 0 || context.timestamp < game.end_at, "game ended");
            crate::settlement::IBlitzReservationsDispatcherTrait::release_hyperstructure(
                crate::settlement::IBlitzReservationsLibraryDispatcher { class_hash: classes.placement.read() },
                game_id,
                coord,
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
            self
                .place_discovery(
                    game_id, coord, Discovery::Hyperstructure, seed.into(), context.timestamp, true, context,
                );
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
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> (u32, crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

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
                    assert!(connected.base.category == 1, "connected entity is not a realm");
                    assert!(village.resource >= 1 && village.resource <= 22, "invalid village resource");
                    record.base.category = crate::ownership::VILLAGE_CATEGORY;
                    record.metadata.village_realm = village.connected_realm;
                    record.resources_packed = pack_realm_resources(array![village.resource].span());
                },
            }
            let key = self.place_settlement(game_id, coord, record, context);
            match creation {
                crate::settlement::SettlementCreation::Realm(realm) => {
                    if context.rules.unbox().epoch_seconds != 0 {
                        crate::logic::research::write(key, crate::research::RealmKnowledge { learned: 0 });
                        self.raise_realm_home(game_id, realm.realm_id, context);
                    }

                    if realm.activate_economy {
                        self.provision_realm_economy(key, context.timestamp, context, ref story_cursor);
                    } else if realm.grant_troops {
                        self.grant_realm_troops(key, context.timestamp, context, ref story_cursor);
                    }
                    crate::logic::stories::emit_entity_story(
                        key,
                        actor,
                        Story::RealmCreatedStory(crate::ownership::RealmCreatedStory { coord }),
                        context.timestamp,
                        ref story_cursor,
                    );
                },
                crate::settlement::SettlementCreation::Village(_) => {
                    self
                        .grant_non_troop_resources(
                            key, self.village_rules(game_id).resources, context.timestamp, context,
                        );
                    let rules = context.rules.unbox();
                    self
                        .create_producer(
                            key,
                            0,
                            crate::logic::resources::rule(key.game_id, 23).village_rate,
                            23,
                            25,
                            rules.building_config.base_population,
                            context.timestamp,
                            context,
                        );
                },
            }
            (key.entity_id, story_cursor)
        }
    }
    #[abi(embed_v0)]
    impl Villages of crate::village::IVillageArmy<ContractState> {
        fn receive_village_army(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            village_id: u32,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            assert_playing(context.game.unbox(), context.timestamp);
            let key = ResourceKey { game_id, entity_id: village_id };
            let record = crate::logic::structures::record(key);
            assert!(record.owner == actor, "actor does not own village");
            assert!(record.base.category == crate::ownership::VILLAGE_CATEGORY, "structure is not a village");
            assert!(!record.base.starting_troops_granted, "army grant already claimed");
            let grants = self.village_rules(game_id);
            let interval = context.rules.unbox().tick_config.armies_tick_in_seconds;
            let claimable_at: u64 = record.base.created_at.into() / interval + grants.troop_delay_ticks.into();
            assert!(context.timestamp / interval >= claimable_at, "army grant cannot be claimed yet");
            self
                .grant_starting_troops(
                    key, grants.resources, 10 * RESOURCE_PRECISION, context.timestamp, context, ref story_cursor,
                );
            ((), story_cursor)
        }
    }
    #[abi(embed_v0)]
    impl RealmCreation of crate::settlement::IRealmCreation<ContractState> {
        fn provision_and_upgrade_realm(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            structure_id: u32,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            Self::activate_realm_economy(
                ref self, game_id, actor, structure_id, crate::commands::action_context(context), story_cursor,
            )
                .resume_story(ref story_cursor);
            crate::upgrades::IStructureUpgradesDispatcherTrait::level_up(
                crate::upgrades::IStructureUpgradesLibraryDispatcher {
                    class_hash: self.release.classes(game_id).construction.read(),
                },
                game_id,
                actor,
                structure_id,
                crate::commands::action_context(context),
                story_cursor,
            )
                .resume_story(ref story_cursor);
            ((), story_cursor)
        }

        fn activate_realm_economy(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            structure_id: u32,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            assert_playing(context.game.unbox(), context.timestamp);
            let key = ResourceKey { game_id, entity_id: structure_id };
            let record = crate::logic::structures::record(key);
            assert!(record.owner == actor, "actor does not own structure");
            assert!(record.base.category == 1, "not a realm");
            self.provision_realm_economy(key, context.timestamp, context, ref story_cursor);
            ((), story_cursor)
        }
    }

    #[abi(embed_v0)]
    impl Names of crate::names::INames<ContractState> {
        #[cfg(test)]
        fn entity_name(self: @ContractState, key: ResourceKey) -> crate::names::EntityName {
            crate::names::EntityName { name: self.data.structure_rules.entity_names.read((key.game_id, key.entity_id)) }
        }
        fn set_entity_name(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::names::SetEntityName,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) {
            let context = crate::commands::load_context(game_id, context);

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
    impl Ownership of crate::ownership::IStructureOwnership<ContractState> {
        fn transfer_structure_ownership(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: TransferOwnership,
            context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let context = crate::commands::load_context(game_id, context);

            let game = context.game.unbox();
            assert_playing(game, context.timestamp);
            let key = ResourceKey { game_id, entity_id: command.entity_id };
            let record = crate::logic::structures::record(key);
            assert!(record.owner == actor, "actor does not own structure");
            assert!(crate::logic::game::game_exists(game_id), "ownership rules require initialized game");
            assert!(command.new_owner != 0.try_into().unwrap(), "new owner is zero");
            assert!(record.base.category != crate::ownership::VILLAGE_CATEGORY, "cannot transfer ownership of village");
            if record.owner == command.new_owner {
                return ((), story_cursor);
            }
            self.change_owner(key, command.new_owner, context.timestamp, context, ref story_cursor);
            ((), story_cursor)
        }
    }
    #[abi(embed_v0)]
    impl ExpeditionSites of crate::expeditions::IExpeditionSite<ContractState> {
        fn expedition_site(self: @ContractState, key: ResourceKey) -> Option<crate::expeditions::ExpeditionSite> {
            crate::logic::expeditions::expedition_site(key)
        }
    }

    #[abi(embed_v0)]
    impl Capture of crate::guards::IStructureCapture<ContractState> {
        fn capture_structure(
            ref self: ContractState,
            key: ResourceKey,
            capturing_home: u32,
            timestamp: u64,
            game_context: crate::commands::ActionContext,
            mut story_cursor: crate::ownership::StoryCursor,
        ) -> ((), crate::ownership::StoryCursor) {
            let game_context = crate::commands::load_context(key.game_id, game_context);

            let record = crate::logic::structures::record(key);
            let owner = crate::logic::structures::record(
                ResourceKey { game_id: key.game_id, entity_id: capturing_home },
            )
                .owner;
            assert!(owner != 0.try_into().unwrap(), "capturing home is unowned");
            if record.base.category == 8 {
                crate::bitcoin::IBitcoinFundingDispatcherTrait::bitcoin_mine_captured(
                    crate::bitcoin::IBitcoinFundingLibraryDispatcher {
                        class_hash: self.release.classes(key.game_id).prizes.read(),
                    },
                    key,
                    timestamp,
                    crate::commands::action_context(game_context),
                );
            }
            self.change_owner(key, owner, timestamp, game_context, ref story_cursor);
            let points = if record.owner == 0.try_into().unwrap() {
                IPointsLibraryDispatcher { class_hash: self.release.classes(key.game_id).season.read() }
                    .register_capture(
                        key.game_id, owner, record.base.category, crate::commands::action_context(game_context),
                    )
            } else {
                0
            };
            crate::logic::stories::emit_entity_story(
                key,
                owner,
                Story::StructureCapturedStory(
                    crate::ownership::StructureCapturedStory { previous_owner: record.owner, new_owner: owner, points },
                ),
                timestamp,
                ref story_cursor,
            );
            ((), story_cursor)
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
                category: 1,
                level: 0,
                starting_troops_granted: false,
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
            game_context: crate::commands::ExecutionContext,
        ) -> u32 {
            let rules = game_context.rules.unbox();
            let id = crate::logic::game::allocate_entity(game_id);
            let key = ResourceKey { game_id, entity_id: id };
            let (mut record, occupier, capacity) = crate::structures::discovered_structure(
                coord, discovery, rules.structure_capacity_config, rules.troop_limit_config.camp_armies, timestamp,
            );
            let depth = if crate::rules::rule_enabled(rules, crate::rules::DEPTH_CONTENTS) {
                Some(crate::logic::expeditions::depth_rules_at(game_id, coord))
            } else {
                None
            };
            self.reveal_structure_tile(game_id, coord, game_context);
            let reveal_neighbors = match depth {
                Some(value) => value.reveal_site_neighbors,
                None => discovery != Discovery::Mine,
            };
            if reveal_neighbors {
                self
                    .map_dispatcher(game_id)
                    .reveal_structure_surroundings(game_id, coord, crate::commands::biome_context(game_context));
            }
            self
                .resources_dispatcher(game_id)
                .initialize_resources(
                    key,
                    capacity * RESOURCE_PRECISION,
                    record.base.category,
                    timestamp,
                    crate::commands::action_context(game_context),
                );
            match discovery {
                Discovery::Mine => {
                    if rules.epoch_seconds == 0 {
                        let (kind, config, cap) = IMineRulesLibraryDispatcher {
                            class_hash: self.release.classes(game_id).production.read(),
                        }
                            .mine_draw(MinePoolKey { game_id }, seed);
                        record.metadata.mine_kind = kind;
                        self
                            .create_producer(
                                key,
                                cap,
                                config.production_rate,
                                config.resource_type,
                                config.building_category,
                                rules.building_config.base_population,
                                timestamp,
                                game_context,
                            );
                    }
                },
                Discovery::Hyperstructure => self.create_hyperstructure(key, seed, completed),
                Discovery::BitcoinMine => {},
                Discovery::Camp => {
                    if rules.epoch_seconds == 0 {
                        assert!(
                            crate::rules::rule_enabled(rules, crate::rules::DISCOVER_CAMPS),
                            "camp discovery is disabled",
                        );
                        for resource in self.camp_resources(game_id) {
                            self
                                .resources_dispatcher(game_id)
                                .grant_resource(
                                    key,
                                    *resource.resource_type,
                                    *resource.amount,
                                    timestamp,
                                    crate::commands::resource_context(game_context),
                                );
                        }
                        let labor_rate = crate::logic::resources::rule(game_id, 23).village_rate;
                        assert!(labor_rate != 0, "zero camp labor rate");
                        self
                            .create_producer(
                                key,
                                0xffffffffffffffffffffffffffffffff,
                                labor_rate,
                                23,
                                25,
                                rules.building_config.base_population,
                                timestamp,
                                game_context,
                            );
                    }
                },
                Discovery::FallenRealm => { assert!(rules.epoch_seconds != 0, "fallen realm requires expeditions"); },
                Discovery::None | Discovery::Chest => panic!("discovery is not a structure"),
            }
            crate::logic::structures::StructureState::create(key, record);
            crate::logic::map::MapState::occupy(tile_key(game_id, coord), id, occupier, true);
            let site_kind = if rules.epoch_seconds == 0 {
                None
            } else {
                Some(
                    match discovery {
                        Discovery::Camp => crate::expeditions::SiteKind::Camp,
                        Discovery::Mine => crate::expeditions::SiteKind::Rift,
                        Discovery::FallenRealm => crate::expeditions::SiteKind::FallenRealm,
                        _ => panic!("invalid expedition site"),
                    },
                )
            };
            crate::guards::IGuardsDispatcherTrait::initialize_structure_guards(
                crate::guards::IGuardsLibraryDispatcher { class_hash: self.release.classes(game_id).troops.read() },
                key,
                seed,
                site_kind,
                timestamp,
                crate::commands::action_context(game_context),
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
            let key = ResourceKey { game_id, entity_id: crate::logic::game::allocate_entity(game_id) };
            let rules = game_context.rules.unbox();
            let village = record.base.category == crate::ownership::VILLAGE_CATEGORY;
            let on_map = rules.epoch_seconds == 0 || village;
            if on_map {
                self.prepare_settlement_tile(game_id, coord, game_context);
            }
            crate::logic::structures::StructureState::create(key, record);
            if on_map {
                let occupier = if village {
                    13
                } else if record.metadata.has_wonder {
                    5
                } else {
                    1
                };
                crate::logic::map::MapState::occupy(tile_key(game_id, coord), key.entity_id, occupier, true);
            }
            let capacity = if village {
                rules.structure_capacity_config.village_capacity
            } else {
                rules.structure_capacity_config.realm_capacity
            };
            self
                .resources_dispatcher(game_id)
                .initialize_resources(
                    key,
                    capacity.into() * RESOURCE_PRECISION,
                    record.base.category,
                    record.base.created_at.into(),
                    crate::commands::action_context(game_context),
                );
            key
        }
        fn raise_realm_home(
            self: @ContractState, game_id: u32, realm_id: u16, context: crate::commands::ExecutionContext,
        ) {
            if context.timestamp < context.game.unbox().start_main_at {
                return;
            }
            let origin = crate::expeditions::site(
                context.game.unbox().start_main_at,
                context.rules.unbox().epoch_seconds,
                crate::logic::settlement::rules(game_id).spacing,
                realm_id,
                context.timestamp,
                0,
            );
            crate::logic::map::raise_expedition_home(
                tile_key(game_id, origin), crate::commands::biome_context(context),
            );
        }

        fn prepare_settlement_tile(
            ref self: ContractState, game_id: u32, coord: Coord, game_context: crate::commands::ExecutionContext,
        ) {
            let tile = crate::logic::map::tile(tile_key(game_id, coord)).map(|tile| tile.data).unwrap_or(0);
            if tile % 0x20000000000 != 0 {
                assert!(tile % 2 == 0, "tile occupied by structure");
                let explorer_id = (tile / 512 % 0x100000000).try_into().unwrap();
                ISettlementDisplacementLibraryDispatcher { class_hash: self.release.classes(game_id).movement.read() }
                    .displace_explorer(game_id, explorer_id, crate::commands::action_context(game_context));
            }
            self.reveal_structure_tile(game_id, coord, game_context);
            self
                .map_dispatcher(game_id)
                .reveal_structure_surroundings(game_id, coord, crate::commands::biome_context(game_context));
        }

        fn provision_realm_economy(
            ref self: ContractState,
            key: ResourceKey,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            let counts = self.buildings.data.buildings.structure_buildings.read((key.game_id, key.entity_id));
            const LABOR_COUNT_SCALE: u128 = 0x10000000000000000;
            assert!(counts.packed_counts_2 / LABOR_COUNT_SCALE % 256 == 0, "realm already provisioned");
            self.grant_realm_troops(key, timestamp, game_context, ref story_cursor);
            let grants = crate::logic::settlement::grants(key.game_id);
            self.grant_non_troop_resources(key, grants.resources, timestamp, game_context);
            let rules = game_context.rules.unbox();
            self
                .create_producer(
                    key,
                    0xffffffffffffffffffffffffffffffff,
                    crate::logic::resources::rule(key.game_id, 23).realm_rate,
                    23,
                    25,
                    rules.building_config.base_population,
                    timestamp,
                    game_context,
                );
        }
        fn village_rules(self: @ContractState, game_id: u32) -> crate::village::VillageRules {
            crate::logic::village::rules(game_id)
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
                    self
                        .resources_dispatcher(key.game_id)
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
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            let grants = crate::logic::settlement::grants(key.game_id);
            let guards = game_context.rules.unbox().troop_limit_config.starting_guard;
            self
                .grant_starting_troops(
                    key,
                    grants.resources,
                    guards.into() * RESOURCE_PRECISION,
                    timestamp,
                    game_context,
                    ref story_cursor,
                );
        }
        fn grant_starting_troops(
            ref self: ContractState,
            key: ResourceKey,
            resources: Span<crate::resources::ResourceAmount>,
            guards: u128,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            let record = crate::logic::structures::record(key);
            if record.base.starting_troops_granted {
                return;
            }
            crate::logic::structures::StructureState::mark_starting_troops(key);
            let coord = if game_context.rules.unbox().epoch_seconds != 0 && record.base.category == 1 {
                crate::settlement::off_map_realm_reference(record.metadata.realm_id.into())
            } else {
                crate::structures::structure_coord(key)
            };
            let biome = self
                .map_dispatcher(key.game_id)
                .biome(tile_key(key.game_id, coord), crate::commands::biome_context(game_context));
            assert!(biome > 0 && biome <= 17, "starting troops require a biome");
            let grants = crate::logic::settlement::grants(key.game_id);
            let category = *grants.starting_troops.at((biome - 1).into());
            let resource_type = crate::troops::troop_resource(category, 0);
            for grant in resources {
                let kind = *grant.resource_type;
                let amount = *grant.amount;
                if kind == resource_type {
                    self
                        .resources_dispatcher(key.game_id)
                        .grant_resource(
                            key, kind, amount + guards, timestamp, crate::commands::resource_context(game_context),
                        );
                    if guards != 0 {
                        self.spend(key, kind, guards, timestamp, crate::commands::resource_context(game_context));
                        crate::guards::IGuardsDispatcherTrait::add_starting_guard(
                            crate::guards::IGuardsLibraryDispatcher {
                                class_hash: self.release.classes(key.game_id).troops.read(),
                            },
                            key,
                            category,
                            guards,
                            timestamp,
                            crate::commands::action_context(game_context),
                        );
                        crate::logic::stories::emit_entity_story(
                            key,
                            record.owner,
                            Story::GuardAddStory(
                                crate::ownership::GuardAddStory {
                                    structure_id: key.entity_id,
                                    slot: 0,
                                    category,
                                    tier: crate::troops::TroopTier::T1,
                                    amount: guards,
                                },
                            ),
                            timestamp,
                            ref story_cursor,
                        );
                    }
                }
            }
        }

        fn change_owner(
            ref self: ContractState,
            key: ResourceKey,
            owner: ContractAddress,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
            ref story_cursor: crate::ownership::StoryCursor,
        ) {
            let record = crate::logic::structures::record(key);
            let rules = game_context.rules.unbox();
            if record.owner != 0.try_into().unwrap() && rules.faith_enabled {
                crate::faith::IFaithOwnershipDispatcherTrait::transfer_faith_ownership(
                    crate::faith::IFaithOwnershipLibraryDispatcher {
                        class_hash: self.release.classes(key.game_id).prizes.read(),
                    },
                    key,
                    owner,
                    timestamp,
                    crate::commands::action_context(game_context),
                    story_cursor,
                )
                    .resume_story(ref story_cursor);
            }
            crate::logic::structures::StructureState::transfer_owner(key, owner);
        }

        fn create_producer(
            ref self: ContractState,
            key: ResourceKey,
            cap: u128,
            rate: u64,
            resource_type: u8,
            building_category: u8,
            base_population: u32,
            timestamp: u64,
            game_context: crate::commands::ExecutionContext,
        ) {
            let building_rule = self
                .buildings
                .rule(crate::buildings::BuildingRuleKey { game_id: key.game_id, category: building_category });
            self
                .resources_dispatcher(key.game_id)
                .start_production(
                    key, resource_type, rate, cap, timestamp, crate::commands::resource_context(game_context),
                );
            self
                .buildings
                .create(
                    BuildingKey { game_id: key.game_id, structure_id: key.entity_id, inner_col: 10, inner_row: 10 },
                    Building { category: building_category, paused: false, labor_paid: 0, tier: 1 },
                    // A producer the world places at a structure's centre costs no population: only a player's
                    // building does. The centre labor producer cannot be destroyed, so nothing refunds this.
                    0,
                    building_rule.capacity_grant,
                    base_population,
                );
        }
        fn create_hyperstructure(ref self: ContractState, key: ResourceKey, seed: u256, completed: bool) {
            crate::hyperstructures::IHyperstructuresDispatcherTrait::record_hyperstructure(
                crate::hyperstructures::IHyperstructuresLibraryDispatcher {
                    class_hash: self.release.classes(key.game_id).economy.read(),
                },
                key,
                seed.try_into().unwrap(),
                completed,
            );
        }
        fn assert_authority(self: @ContractState) {
            assert!(get_caller_address() == self.release.authority(), "only domain authority");
        }

        fn map_dispatcher(self: @ContractState, game_id: u32) -> IMapLogicLibraryDispatcher {
            IMapLogicLibraryDispatcher { class_hash: self.release.classes(game_id).map.read() }
        }
        fn resources_dispatcher(self: @ContractState, game_id: u32) -> IResourceOperationsLibraryDispatcher {
            IResourceOperationsLibraryDispatcher { class_hash: self.release.classes(game_id).resources.read() }
        }
        fn spend(
            ref self: ContractState,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            timestamp: u64,
            game_context: crate::commands::ResourceContext,
        ) {
            self.resources_dispatcher(key.game_id).spend_resource(key, resource_type, amount, timestamp, game_context);
        }
        fn reveal_structure_tile(
            ref self: ContractState, game_id: u32, coord: Coord, game_context: crate::commands::ExecutionContext,
        ) {
            let key = tile_key(game_id, coord);
            let tile = crate::logic::map::tile(key);
            let data = tile.map(|tile| tile.data).unwrap_or(0);
            assert!(data % 0x20000000000 == 0, "occupied structure tile");
            if (data / 0x20000000000) % 0x100 == 0 {
                crate::logic::map::MapState::reveal(
                    key, self.map_dispatcher(game_id).biome(key, crate::commands::biome_context(game_context)),
                );
            }
        }
    }
}
