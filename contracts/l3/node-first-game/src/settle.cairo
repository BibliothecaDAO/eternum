//! Throwaway season-opening host; no homes exist until players settle.
#[starknet::contract]
pub mod SettleGames {
    use starknet::{ClassHash, ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use world_native::realms::{ISeasonRealmsDispatcherTrait, ISeasonRealmsLibraryDispatcher, SettleSeason};
    use world_native::registrar::{IRegistrarDispatcherTrait, IRegistrarLibraryDispatcher, CreateGameParams};
    use world_native::spike_ids::{ISpikeSeatsDispatcherTrait, ISpikeSeatsLibraryDispatcher};
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[flat]
        data: world_native::state::Storage,
        account_class: ClassHash,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {}
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress, account_class: ClassHash, release: world_native::logic::release::Release) {
        self.data.authority.write(authority);
        self.data.current_release.write(1);
        self.data.releases.write(1, release);
        self.data.registrar.next_game.write(1);
        self.account_class.write(account_class);
    }
    fn owner(self: @ContractState) { assert!(get_caller_address() == self.data.authority.read(), "only spike owner"); }
    fn realm_logic(self: @ContractState) -> ISeasonRealmsLibraryDispatcher {
        ISeasonRealmsLibraryDispatcher { class_hash: self.data.releases.read(1).classes.settlement }
    }
    #[external(v0)]
    fn initialize_realm_traits(ref self: ContractState, first_realm: u32, packed_traits: Span<u32>) {
        owner(@self); realm_logic(@self).initialize_realm_traits(first_realm, packed_traits);
    }
    #[external(v0)]
    fn register_preset(ref self: ContractState, preset_id: u32, definition: world_native::presets::PresetDefinition) {
        owner(@self);
        IRegistrarLibraryDispatcher { class_hash: self.data.releases.read(1).classes.registry }.register_preset(preset_id, definition);
    }
    #[external(v0)]
    fn create_game(ref self: ContractState, params: CreateGameParams) -> u32 {
        owner(@self);
        IRegistrarLibraryDispatcher { class_hash: self.data.releases.read(1).classes.registry }.create_game(params)
    }
    #[external(v0)]
    fn assign_seats(ref self: ContractState, game: u32, actors: Span<ContractAddress>) {
        owner(@self);
        assert!(self.data.games.next_entity.read(game) == 1, "homes already exist");
        ISpikeSeatsLibraryDispatcher { class_hash: self.data.releases.read(1).classes.settlement }.assign_spike_seats(game, actors);
    }
    #[external(v0)]
    fn seal_seats(ref self: ContractState, game: u32) {
        owner(@self);
        assert!(self.data.games.next_entity.read(game) == 1, "homes already exist");
        // The pool now contains reservations, not homes. No aggregate is written by Y's settle.
        ISpikeSeatsLibraryDispatcher { class_hash: self.data.releases.read(1).classes.settlement }.seal_spike_seats(game);
    }
    #[external(v0)]
    fn start_now(ref self: ContractState, game: u32) {
        owner(@self);
        let mut row = world_native::logic::game::game(game);
        row.start_main_at = get_block_timestamp(); row.start_settling_at = row.start_main_at; row.end_at = row.start_main_at + 86400;
        world_native::logic::game::write_game(game, row);
    }
    #[external(v0)]
    fn day(self: @ContractState, game: u32) -> world_native::days::Day {
        world_native::days::day_of(world_native::logic::game::game(game), world_native::logic::game::rules(game).day_unit_seconds, get_block_timestamp())
    }
    #[external(v0)]
    fn settle_season(ref self: ContractState, game: u32, name: felt252) {
        let actor = get_caller_address();
        assert!(starknet::syscalls::get_class_hash_at_syscall(actor).unwrap() == self.account_class.read(), "RealmsAccount required");
        realm_logic(@self).settle_season(game, actor, SettleSeason { name, selected_realm: None },
            world_native::commands::ActionContext { raw_root: world_native::spike_ids::action_root(actor), timestamp: get_block_timestamp() },
            world_native::ownership::StoryCursor { order: 0, index: 0 });
    }
    #[external(v0)]
    fn entity_counter(self: @ContractState, game: u32) -> u32 { self.data.games.next_entity.read(game) }
    #[external(v0)]
    fn realm_count(self: @ContractState, game: u32) -> u16 { self.data.settlements.progress.read(game).realm_count }
    #[external(v0)]
    fn seat(self: @ContractState, game: u32, actor: ContractAddress) -> u16 { world_native::spike_ids::settlement_seat(game, actor).unwrap_or(0) }
    #[external(v0)]
    fn settle_state(self: @ContractState, game: u32, actor: ContractAddress) -> (u32, ContractAddress, u16, world_native::troops::Coord, world_native::troops::Coord, bool) {
        let id = world_native::spike_ids::last(game, actor);
        if id == 0 { return (0, actor, 0, Default::default(), Default::default(), false); }
        let key = world_native::resources::ResourceKey { game_id: game, entity_id: id };
        let record = world_native::logic::structures::record(key);
        let realm = record.metadata.realm_id;
        let rules = world_native::logic::game::rules(game);
        let today = world_native::days::day_of(world_native::logic::game::game(game), rules.day_unit_seconds, record.base.created_at.into()).index;
        let site = world_native::expeditions::site(world_native::logic::settlement::rules(game).spacing, realm, today, 0);
        let entry = world_native::logic::settlement::entry(world_native::settlement::EntryKey { game_id: game, owner: actor });
        let buildings = self.data.buildings.structure_buildings.read((game, id));
        let ready = record.owner == actor && record.base.category == world_native::taxonomy::REALM_CATEGORY
            && record.base.starting_troops_granted && entry.map(|entry| entry.player == actor).unwrap_or(false)
            && world_native::logic::research::require(key).learned == 0
            && self.data.resources.resource_exists.read((game, id))
            && buildings.packed_counts_2 / 0x10000000000000000 % 256 == 1;
        (id, record.owner, realm, world_native::settlement::off_map_realm_reference(realm.into()), site, ready)
    }
}
