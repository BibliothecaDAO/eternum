#[starknet::contract]
pub mod RegistryDomain {
    use starknet::get_caller_address;
    use starknet::storage::StorageMapReadAccess;
    use crate::entry::EntryAdministration;
    use crate::game::{GameRegistry, GameState};
    use crate::guilds::GuildState;
    use crate::lifecycle::Lifecycle;
    use crate::registrar::RegistrarState;
    use crate::rules::SliceRules;
    use crate::upgrades::{UpgradeLimits, UpgradeRecipe, UpgradeState};
    component!(path: GameState, storage: games, event: GameEvent);
    impl GameInternal = GameState::InternalImpl<ContractState>;
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: UpgradeState, storage: upgrades, event: UpgradeEvent);
    impl UpgradeInternal = UpgradeState::InternalImpl<ContractState>;
    component!(path: GuildState, storage: guilds, event: GuildEvent);
    component!(path: EntryAdministration, storage: entry, event: EntryEvent);
    #[abi(embed_v0)]
    impl Entry = EntryAdministration::LedgerOperatorImpl<ContractState>;
    component!(path: RegistrarState, storage: registrar, event: RegistrarEvent);
    #[abi(embed_v0)]
    impl Registrar = RegistrarState::RegistrarImpl<ContractState>;
    impl RegistrarInternal = RegistrarState::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Guilds = GuildState::GuildsImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        games: GameState::Storage,
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        guilds: GuildState::Storage,
        #[substorage(v0)]
        entry: EntryAdministration::Storage,
        #[substorage(v0)]
        registrar: RegistrarState::Storage,
        #[substorage(v0)]
        upgrades: UpgradeState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        GameEvent: GameState::Event,
        LifecycleEvent: Lifecycle::Event,
        GuildEvent: GuildState::Event,
        EntryEvent: EntryAdministration::Event,
        RegistrarEvent: RegistrarState::Event,
        UpgradeEvent: UpgradeState::Event,
    }
    #[abi(embed_v0)]
    impl UpgradeRules of crate::upgrades::IUpgradeRules<ContractState> {
        fn configure_upgrades(
            ref self: ContractState, game_id: u32, limits: UpgradeLimits, recipes: Span<UpgradeRecipe>,
        ) {
            self.lifecycle.assert_configurator();
            self.games.game(game_id);
            self.upgrades.configure(game_id, limits, recipes);
        }
        fn upgrade_limits(self: @ContractState, game_id: u32) -> UpgradeLimits {
            self.upgrades.limits(game_id)
        }
        fn upgrade_recipe(self: @ContractState, game_id: u32, level: u8) -> UpgradeRecipe {
            self.upgrades.recipe(game_id, level)
        }
    }

    #[abi(embed_v0)]
    impl Games of crate::game::IGame<ContractState> {
        fn write_game(ref self: ContractState, game_id: u32, game: GameRegistry) {
            assert!(get_caller_address() == self.lifecycle.require_active().season, "only season domain");
            self.games.game(game_id);
            self.games.write_game(game_id, game);
        }

        fn ownership_rules_ready(self: @ContractState, game_id: u32) -> bool {
            self.games.ownership_rules_ready.read(game_id)
        }

        fn game(self: @ContractState, game_id: u32) -> GameRegistry {
            self.games.game(game_id)
        }
        fn rules(self: @ContractState, game_id: u32) -> SliceRules {
            self.games.rules(game_id)
        }
        fn start_blitz(ref self: ContractState, game_id: u32, timestamp: u64) {
            assert!(get_caller_address() == self.lifecycle.require_active().settlement, "only settlement domain");
            assert!(self.games.rules(game_id).entry_rule == crate::rules::ENTRY_ROSTER, "fixed roster required");
            let mut game = self.games.game(game_id);
            assert!(!game.ready, "roster already ready");
            let duration = game.end_at - game.start_main_at;
            game.start_main_at = core::cmp::max(game.start_main_at, timestamp);
            game.end_at = game.start_main_at + duration;
            game.ready = true;
            self.games.write_game(game_id, game);
        }
        fn allocate_entity(ref self: ContractState, game_id: u32) -> u32 {
            let peers = self.lifecycle.require_active();
            let caller = get_caller_address();
            assert!(
                caller == peers.season
                    || caller == peers.troops
                    || caller == peers.combat
                    || caller == peers.map
                    || caller == peers.structures
                    || caller == peers.resources
                    || caller == peers.bridge
                    || caller == peers.economy
                    || caller == peers.prizes,
                "only gameplay domain",
            );
            self.games.allocate(game_id)
        }
    }

    #[constructor]
    fn constructor(ref self: ContractState, authority: starknet::ContractAddress) {
        self.lifecycle.initialize(authority);
        self.registrar.initialize();
    }
}
