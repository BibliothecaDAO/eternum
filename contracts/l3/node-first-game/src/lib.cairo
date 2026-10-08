//! Throwaway direct Games host. Genuine gameplay libraries; no recorded protocol.
#[starknet::contract]
pub mod Games {
    use starknet::{ClassHash, ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use world_native::commands::{ActionContext, CreateExplorer, ICreateExplorerDispatcherTrait, ICreateExplorerLibraryDispatcher, Explore, IExploreDispatcherTrait, IExploreLibraryDispatcher};
    use world_native::registrar::{IRegistrarDispatcherTrait, IRegistrarLibraryDispatcher, CreateGameParams};
    use world_native::settlement::{ISettlementCreationDispatcherTrait, ISettlementCreationLibraryDispatcher, RealmCreation, SettlementCreation};
    use world_native::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceAmount, ResourceKey};

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[flat]
        data: world_native::state::Storage,
        spike_account_class: ClassHash,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event { Created: Created }
    #[derive(Drop, starknet::Event)]
    struct Created {
        #[key]
        game: u32,
        #[key]
        actor: ContractAddress,
        explorer: u32,
    }

    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress, account_class: ClassHash, release: world_native::logic::release::Release) {
        self.data.authority.write(authority);
        self.data.current_release.write(1);
        self.data.releases.write(1, release);
        self.data.registrar.next_game.write(1);
        self.spike_account_class.write(account_class);
    }
    fn owner(self: @ContractState) {
        assert!(get_caller_address() == self.data.authority.read(), "only spike owner");
    }
    fn classes(self: @ContractState, game: u32) -> world_native::logic::release::Release {
        self.data.releases.read(self.data.game_releases.read(game))
    }
    #[external(v0)]
    fn register_preset(ref self: ContractState, preset_id: u32, definition: world_native::presets::PresetDefinition) {
        owner(@self);
        IRegistrarLibraryDispatcher { class_hash: self.data.releases.read(1).classes.registry }
            .register_preset(preset_id, definition);
    }
    #[external(v0)]
    fn create_game(ref self: ContractState, params: CreateGameParams) -> u32 {
        owner(@self);
        IRegistrarLibraryDispatcher { class_hash: self.data.releases.read(1).classes.registry }.create_game(params)
    }
    #[external(v0)]
    fn prepare_home(ref self: ContractState, game: u32, actor: ContractAddress, realm_id: u16, packed_traits: u32, grants: Span<ResourceAmount>, local_ids: bool) -> u32 {
        owner(@self);
        let release = classes(@self, game);
        let timestamp = get_block_timestamp();
        let context = ActionContext { raw_root: 123456789, timestamp };
        let (id, _) = ISettlementCreationLibraryDispatcher { class_hash: release.classes.structures }.create_settlement(
            game, actor, world_native::troops::Coord { alt: false, x: realm_id.into() * 32, y: 32 },
            SettlementCreation::Realm(RealmCreation {
                realm_id, traits: world_native::realms::decode_traits(packed_traits),
                grant_troops: false, activate_economy: false,
            }), context, world_native::ownership::StoryCursor { order: 0, index: 0 },
        );
        let loaded = world_native::commands::load_context(game, context);
        let resource_context = world_native::commands::resource_context(loaded);
        for grant in grants {
            IResourceOperationsLibraryDispatcher { class_hash: release.classes.resources }
                .grant_resource(ResourceKey { game_id: game, entity_id: id }, *grant.resource_type, *grant.amount, timestamp, resource_context);
        }
        world_native::spike_ids::configure(game, actor, if local_ids { id } else { 0 });
        id
    }
    #[external(v0)]
    fn start_now(ref self: ContractState, game: u32) {
        owner(@self);
        let mut row = world_native::logic::game::game(game);
        row.start_main_at = get_block_timestamp();
        row.start_settling_at = row.start_main_at;
        row.end_at = row.start_main_at + 86400;
        world_native::logic::game::write_game(game, row);
    }
    #[external(v0)]
    fn create_explorer(ref self: ContractState, game: u32, command: CreateExplorer) {
        let actor = get_caller_address();
        assert!(starknet::syscalls::get_class_hash_at_syscall(actor).unwrap() == self.spike_account_class.read(), "RealmsAccount required");
        ICreateExplorerLibraryDispatcher { class_hash: classes(@self, game).classes.troops }
            .create_explorer(game, actor, command, ActionContext { raw_root: 123456789, timestamp: get_block_timestamp() },
                world_native::ownership::StoryCursor { order: 0, index: 0 });
        self.emit(Created { game, actor, explorer: world_native::spike_ids::last(game, actor) });
    }
    // Preparation fixes day zero while the accounts' armies are provisioned. Never measured.
    #[external(v0)]
    fn prepare_explorer(ref self: ContractState, game: u32, command: CreateExplorer) {
        let actor = get_caller_address();
        assert!(starknet::syscalls::get_class_hash_at_syscall(actor).unwrap() == self.spike_account_class.read(), "RealmsAccount required");
        ICreateExplorerLibraryDispatcher { class_hash: classes(@self, game).classes.troops }
            .create_explorer(game, actor, command, ActionContext {
                raw_root: 123456789, timestamp: world_native::logic::game::game(game).start_main_at,
            }, world_native::ownership::StoryCursor { order: 0, index: 0 });
    }
    #[external(v0)]
    fn explore(ref self: ContractState, game: u32, command: Explore) {
        let actor = get_caller_address();
        assert!(starknet::syscalls::get_class_hash_at_syscall(actor).unwrap() == self.spike_account_class.read(), "RealmsAccount required");
        // A constant root with actor-domain separation avoids a single correlated draw for the whole wave.
        let root = core::poseidon::poseidon_hash_span(array![123456789, actor.into()].span());
        IExploreLibraryDispatcher { class_hash: classes(@self, game).classes.movement }
            .explore(game, actor, command, ActionContext { raw_root: root.into(), timestamp: get_block_timestamp() },
                world_native::ownership::StoryCursor { order: 0, index: 0 });
    }
    #[external(v0)]
    fn last_entity(self: @ContractState, game: u32, actor: ContractAddress) -> u32 {
        world_native::spike_ids::last(game, actor)
    }
    #[external(v0)]
    fn day(self: @ContractState, game: u32) -> world_native::days::Day {
        world_native::days::day_of(world_native::logic::game::game(game), world_native::logic::game::rules(game).day_unit_seconds, get_block_timestamp())
    }
    #[external(v0)]
    fn lords_budget(self: @ContractState, game: u32) -> Option<world_native::relics::LordsBudget> {
        world_native::logic::lords_budget::budget(game)
    }
    // Read-only setup gates keep fixture verification on the native storage layout.
    #[external(v0)]
    fn verify_home(self: @ContractState, game: u32, actor: ContractAddress, home: u32, realm: u16, packed_traits: u32, grants: Span<ResourceAmount>) -> bool {
        let key = ResourceKey { game_id: game, entity_id: home };
        let record = world_native::logic::structures::record(key);
        let traits = world_native::realms::decode_traits(packed_traits);
        let mut packed = 0_u128;
        for resource in traits.resources { packed = packed * 256 + (*resource).into(); }
        if record.owner != actor || record.base.category != world_native::taxonomy::REALM_CATEGORY
            || record.base.level != 0 || record.base.starting_troops_granted
            || record.metadata.realm_id != realm || record.metadata.order != traits.order
            || record.metadata.has_wonder != (traits.wonder != 1) || record.resources_packed != packed
            || world_native::logic::research::require(key).learned != 0
            || !world_native::logic::troops::home_armies(key).is_empty() {
            return false;
        }
        for grant in grants {
            let limit = world_native::logic::resources::store_limit(key, *grant.resource_type);
            let expected = limit.map(|cap| core::cmp::min(cap, *grant.amount)).unwrap_or(*grant.amount);
            if world_native::logic::resources::balance(key, *grant.resource_type) != expected { return false; }
        }
        true
    }
    #[external(v0)]
    fn explore_ready(self: @ContractState, game: u32, actor: ContractAddress, home: u32, explorer: u32, amount: u128, direction: u8) -> bool {
        let key = world_native::troops::ExplorerKey { game_id: game, explorer_id: explorer };
        let army = match world_native::logic::troops::explorer(key) { Some(army) => army, None => { return false; } };
        let home_record = world_native::logic::structures::record(ResourceKey { game_id: game, entity_id: home });
        let rules = world_native::logic::game::rules(game);
        let today = world_native::days::day_of(world_native::logic::game::game(game), rules.day_unit_seconds, get_block_timestamp()).index;
        let spacing = world_native::logic::settlement::rules(game).spacing;
        let origin = world_native::expeditions::site(spacing, home_record.metadata.realm_id, today, 0);
        let spawn = world_native::geometry::neighbor(origin, direction);
        let destination = world_native::geometry::neighbor(spawn, direction);
        let tile = world_native::logic::map::tile(world_native::geometry::tile_key(game, destination));
        home_record.owner == actor && army.owner == home && army.coord == spawn
            && army.troops.category == world_native::troops::TroopType::Knight
            && army.troops.tier == world_native::troops::TroopTier::T1 && army.troops.count == amount
            && tile.is_none()
    }
    #[external(v0)]
    fn entity_counter(self: @ContractState, game: u32) -> u32 { self.data.games.next_entity.read(game) }
}

pub mod settle;

pub mod blitz;
