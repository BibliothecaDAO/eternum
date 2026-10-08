//! Throwaway direct Games host. Genuine gameplay libraries; no recorded protocol.
#[starknet::contract]
pub mod BlitzGames {
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ClassHash, ContractAddress, get_block_timestamp, get_caller_address};
    use world_native::commands::ActionContext;
    use world_native::registrar::{
        CreateGameParams, IRegistrarDispatcherTrait, IRegistrarLibraryDispatcher,
    };
    use world_native::resources::{
        IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceAmount,
        ResourceKey,
    };


    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[flat]
        data: world_native::state::Storage,
        spike_account_class: ClassHash,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {}
    #[constructor]
    fn constructor(
        ref self: ContractState,
        authority: ContractAddress,
        account_class: ClassHash,
        release: world_native::logic::release::Release,
    ) {
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
    fn register_preset(
        ref self: ContractState,
        preset_id: u32,
        definition: world_native::presets::PresetDefinition,
    ) {
        owner(@self);
        IRegistrarLibraryDispatcher { class_hash: self.data.releases.read(1).classes.registry }
            .register_preset(preset_id, definition);
    }
    #[external(v0)]
    fn create_game(ref self: ContractState, params: CreateGameParams) -> u32 {
        owner(@self);
        IRegistrarLibraryDispatcher { class_hash: self.data.releases.read(1).classes.registry }
            .create_game(params)
    }
    fn actor(self: @ContractState) -> ContractAddress {
        let actor = get_caller_address();
        assert!(
            starknet::syscalls::get_class_hash_at_syscall(actor)
                .unwrap() == self
                .spike_account_class
                .read(),
            "RealmsAccount required",
        );
        actor
    }
    #[external(v0)]
    fn create_building(
        ref self: ContractState, game: u32, command: world_native::buildings::CreateBuilding,
    ) {
        world_native::buildings::IBuildingCommandsDispatcherTrait::create_building(
            world_native::buildings::IBuildingCommandsLibraryDispatcher {
                class_hash: classes(@self, game).classes.construction,
            },
            game,
            actor(@self),
            command,
            ActionContext { raw_root: 123456789, timestamp: get_block_timestamp() },
            world_native::ownership::StoryCursor { order: 0, index: 0 },
        );
    }
    #[external(v0)]
    fn destroy_building(
        ref self: ContractState, game: u32, command: world_native::buildings::ChangeBuilding,
    ) {
        world_native::buildings::IBuildingCommandsDispatcherTrait::destroy_building(
            world_native::buildings::IBuildingCommandsLibraryDispatcher {
                class_hash: classes(@self, game).classes.construction,
            },
            game,
            actor(@self),
            command,
            ActionContext { raw_root: 123456789, timestamp: get_block_timestamp() },
            world_native::ownership::StoryCursor { order: 0, index: 0 },
        );
    }
    // Fixture preparation only: real roster settlement, never a measured shortcut.
    #[external(v0)]
    fn prepare_roster(ref self: ContractState, game: u32) -> u64 {
        owner(@self);
        let (remaining, _) =
            world_native::settlement::ISettlementCommandsDispatcherTrait::settle_blitz_roster(
            world_native::settlement::ISettlementCommandsLibraryDispatcher {
                class_hash: classes(@self, game).classes.settlement,
            },
            game,
            get_caller_address(),
            ActionContext { raw_root: 123456789, timestamp: get_block_timestamp() },
            world_native::ownership::StoryCursor { order: 0, index: 0 },
        );
        remaining
    }
    fn actor_home(self: @ContractState, game: u32, actor: ContractAddress) -> u32 {
        let end = self.data.games.next_entity.read(game);
        let mut id = 1;
        loop {
            if id >= end {
                break;
            }
            if world_native::logic::structures::exists(
                ResourceKey { game_id: game, entity_id: id },
            ) {
                let row = world_native::logic::structures::record(
                    ResourceKey { game_id: game, entity_id: id },
                );
                if row.owner == actor
                    && row.base.category == world_native::taxonomy::REALM_CATEGORY {
                    return id;
                }
            }
            id += 1;
        }
        panic!("Blitz actor has no home")
    }
    #[external(v0)]
    fn prepare_actor(
        ref self: ContractState, game: u32, actor: ContractAddress, grants: Span<ResourceAmount>,
    ) -> u32 {
        owner(@self);
        let home = actor_home(@self, game, actor);
        let context = ActionContext { raw_root: 123456789, timestamp: get_block_timestamp() };
        let loaded = world_native::commands::load_context(game, context);
        for grant in grants {
            IResourceOperationsLibraryDispatcher {
                class_hash: classes(@self, game).classes.resources,
            }
                .grant_resource(
                    ResourceKey { game_id: game, entity_id: home },
                    *grant.resource_type,
                    *grant.amount,
                    context.timestamp,
                    world_native::commands::resource_context(loaded),
                );
        }
        world_native::spike_ids::configure(game, actor, home);

        home
    }
    #[external(v0)]
    fn home(self: @ContractState, game: u32, actor: ContractAddress) -> u32 {
        actor_home(self, game, actor)
    }
}
