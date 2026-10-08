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
    #[external(v0)]
    fn entity_counter(self: @ContractState, game: u32) -> u32 { self.data.games.next_entity.read(game) }
}
