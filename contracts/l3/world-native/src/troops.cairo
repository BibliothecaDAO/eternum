use crate::combat::TroopsTrait;
use crate::stamina::StaminaTrait;
pub const AGENT_HOME: u32 = 4294967288;
const AGENT_OCCUPIER_OFFSET: u8 = 9;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AgentPopulation {
    pub count: u16,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct Coord {
    pub alt: bool,
    pub x: u32,
    pub y: u32,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub enum TroopType {
    #[default]
    Knight,
    Paladin,
    Crossbowman,
}
impl TroopTypeIntoU8 of Into<TroopType, u8> {
    fn into(self: TroopType) -> u8 {
        match self {
            TroopType::Knight => 0,
            TroopType::Paladin => 1,
            TroopType::Crossbowman => 2,
        }
    }
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub enum TroopTier {
    #[default]
    T1,
    T2,
    T3,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct Stamina {
    pub amount: u64,
    pub updated_tick: u64,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct TroopBoosts {
    pub incr_damage_dealt_percent_num: u16,
    pub incr_damage_dealt_end_tick: u32,
    pub decr_damage_gotten_percent_num: u16,
    pub decr_damage_gotten_end_tick: u32,
    pub incr_stamina_regen_percent_num: u16,
    pub incr_stamina_regen_tick_count: u8,
    pub incr_explore_reward_percent_num: u16,
    pub incr_explore_reward_end_tick: u32,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct Troops {
    pub category: TroopType,
    pub tier: TroopTier,
    pub count: u128,
    pub stamina: Stamina,
    pub boosts: TroopBoosts,
    pub battle_cooldown_end: u32,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExplorerKey {
    pub game_id: u32,
    pub explorer_id: u32,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct ExplorerTroops {
    pub owner: u32,
    pub troops: Troops,
    pub coord: Coord,
}

#[derive(Drop, starknet::Event)]
pub struct BattleEvent {
    #[key]
    pub version: u8,
    #[key]
    pub game_id: u32,
    #[key]
    pub attacker_id: u32,
    #[key]
    pub defender_id: u32,
    #[key]
    pub attacker_owner: u32,
    #[key]
    pub defender_owner: u32,
    pub winner_id: u32,
    pub coord: Coord,
    pub max_reward: Span<(u8, u128)>,
    pub timestamp: u64,
}

#[starknet::component]
pub mod TroopState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowDeleted, RowMemberSet, RowSet};
    use super::{ExplorerKey, ExplorerTroops, Troops};
    #[storage]
    pub struct Storage {
        pub explorers: Map<(u32, u32), ExplorerTroops>,
        pub exists: Map<(u32, u32), bool>,
        pub agent_count: Map<u32, u16>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowMemberSet: RowMemberSet,
        RowDeleted: RowDeleted,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn explorer(self: @ComponentState<TContractState>, key: ExplorerKey) -> Option<ExplorerTroops> {
            if self.exists.read((key.game_id, key.explorer_id)) {
                Some(self.explorers.read((key.game_id, key.explorer_id)))
            } else {
                None
            }
        }
        fn create(ref self: ComponentState<TContractState>, key: ExplorerKey, explorer: ExplorerTroops) {
            assert!(key.game_id != 0 && key.explorer_id != 0, "reserved explorer key");
            assert!(self.explorer(key).is_none(), "explorer already exists");
            self.explorers.write((key.game_id, key.explorer_id), explorer);
            self.exists.write((key.game_id, key.explorer_id), true);
            if explorer.owner == super::AGENT_HOME {
                self.write_agent_count(key.game_id, self.agent_count.read(key.game_id) + 1);
            }
            let mut keys = array![];
            key.serialize(ref keys);
            let mut values = array![];
            explorer.serialize(ref values);
            self.emit(RowSet { version: 1, model: 'ExplorerTroops', keys: keys.span(), values: values.span() });
        }
        fn save(ref self: ComponentState<TContractState>, key: ExplorerKey, explorer: ExplorerTroops) {
            assert!(self.explorer(key).is_some(), "missing explorer");
            self.explorers.write((key.game_id, key.explorer_id), explorer);
            let mut keys = array![];
            key.serialize(ref keys);
            let mut values = array![];
            explorer.serialize(ref values);
            self.emit(RowSet { version: 1, model: 'ExplorerTroops', keys: keys.span(), values: values.span() });
        }
        fn update_troops(ref self: ComponentState<TContractState>, key: ExplorerKey, troops: Troops) {
            let mut explorer = self.explorer(key).expect('missing explorer');
            explorer.troops = troops;
            self.explorers.write((key.game_id, key.explorer_id), explorer);
            let mut keys = array![];
            key.serialize(ref keys);
            let mut values = array![];
            troops.serialize(ref values);
            self
                .emit(
                    RowMemberSet {
                        version: 1, model: 'ExplorerTroops', member: 'troops', keys: keys.span(), values: values.span(),
                    },
                );
        }
        fn destroy(ref self: ComponentState<TContractState>, key: ExplorerKey) {
            let explorer = self.explorer(key).expect('missing explorer');
            if explorer.owner == super::AGENT_HOME {
                self.write_agent_count(key.game_id, self.agent_count.read(key.game_id) - 1);
            }
            // The existence bit is authoritative; recreation overwrites the complete value.
            self.exists.write((key.game_id, key.explorer_id), false);
            let mut keys = array![];
            key.serialize(ref keys);
            self.emit(RowDeleted { version: 1, model: 'ExplorerTroops', keys: keys.span() });
        }
        fn write_agent_count(ref self: ComponentState<TContractState>, game_id: u32, count: u16) {
            self.agent_count.write(game_id, count);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'AgentPopulation',
                        keys: array![game_id.into()].span(),
                        values: array![count.into()].span(),
                    },
                );
        }
    }
}

#[starknet::interface]
pub trait ITroops<T> {
    fn explorer(self: @T, key: ExplorerKey) -> Option<ExplorerTroops>;
    fn agent_population(self: @T, game_id: u32) -> AgentPopulation;
}

#[starknet::contract]
pub mod TroopsDomain {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::combat::{CombatContext, TroopsTrait};
    use crate::commands::{Battle, CreateExplorer, ExecutionContext, Explore};
    use crate::game::{IGameDispatcher, IGameDispatcherTrait, assert_playing};
    use crate::geometry::{distance, neighbor, spire_neighbor, tile_key};
    use crate::lifecycle::Lifecycle;
    use crate::map::{IMapDispatcher, IMapDispatcherTrait};
    use crate::resources::ResourceKey;
    use crate::rules::{RESOURCE_PRECISION, SliceRules};
    use crate::stamina::StaminaTrait;
    use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait, Structure};
    use super::{Coord, ExplorerKey, ExplorerTroops, TroopState, TroopTier, TroopType, Troops};
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: TroopState, storage: troops, event: TroopEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    impl TroopInternal = TroopState::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        troops: TroopState::Storage,
        agent_owners: starknet::storage::Map<(u32, u32), ContractAddress>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        TroopEvent: TroopState::Event,
        BattleEvent: super::BattleEvent,
        OwnershipRow: crate::events::RowSet,
        OwnershipDeleted: crate::events::RowDeleted,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl TroopViews of super::ITroops<ContractState> {
        fn explorer(self: @ContractState, key: ExplorerKey) -> Option<ExplorerTroops> {
            self.troops.explorer(key)
        }
        fn agent_population(self: @ContractState, game_id: u32) -> super::AgentPopulation {
            super::AgentPopulation { count: self.troops.agent_count.read(game_id) }
        }
    }
    #[abi(embed_v0)]
    impl SettlementDisplacement of crate::settlement::ISettlementDisplacement<ContractState> {
        fn displace_explorer(ref self: ContractState, game_id: u32, explorer_id: u32) {
            assert!(get_caller_address() == self.lifecycle.require_active().structures, "only structures domain");
            let key = ExplorerKey { game_id, explorer_id };
            let mut explorer = self.troops.explorer(key).expect('missing blocking explorer');
            assert!(explorer.owner != 0, "blocking explorer has no owner");
            let origin = tile_key(game_id, explorer.coord);
            for direction in 0_u8..6 {
                let destination = neighbor(explorer.coord, direction);
                let tile = tile_key(game_id, destination);
                let data = self.map_dispatcher().tile(tile).map(|tile| tile.data).unwrap_or(0);
                if (data / 2) % 256 != 0 {
                    continue;
                }
                if (data / 0x20000000000) % 256 == 0 {
                    self.map_dispatcher().reveal(tile, self.map_dispatcher().biome(tile));
                }
                let category = super::troop_occupier(explorer.troops)
                    + if explorer.owner == super::AGENT_HOME {
                        super::AGENT_OCCUPIER_OFFSET
                    } else {
                        0
                    };
                self.map_dispatcher().occupy(tile, explorer_id, category, false);
                explorer.coord = destination;
                self.troops.save(key, explorer);
                self.map_dispatcher().vacate(origin, explorer_id);
                return;
            }
            self.destroy_explorer(key, explorer);
        }
    }
    #[abi(embed_v0)]
    impl Ownership of crate::ownership::IAgentOwnership<ContractState> {
        fn agent_owner(self: @ContractState, game_id: u32, explorer_id: u32) -> ContractAddress {
            self.agent_owners.read((game_id, explorer_id))
        }
        fn transfer_agent_ownership(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::ownership::TransferOwnership,
            context: ExecutionContext,
        ) {
            let _ = self.authorize(game_id, context);
            assert!(actor == self.game_dispatcher().agent_controller(), "actor is not agent controller");
            self.agent_owners.write((game_id, command.entity_id), command.new_owner);
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'AgentOwner',
                        keys: array![game_id.into(), command.entity_id.into()].span(),
                        values: array![command.new_owner.into()].span(),
                    },
                );
        }
    }
    #[abi(embed_v0)]
    impl Actions of crate::commands::ITroopCommands<ContractState> {
        fn create_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: CreateExplorer,
            context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            let home = self.owned_structure(game_id, command.structure_id, actor);
            let category = troop_type(command.category);
            let tier = troop_tier(command.tier);
            let id = self.game_dispatcher().allocate_entity(game_id);
            let resource_type = super::troop_resource(category, command.tier);
            self
                .structures_dispatcher()
                .pay_for_explorer(
                    ResourceKey { game_id, entity_id: command.structure_id },
                    actor,
                    resource_type,
                    command.amount,
                    id,
                    context.timestamp,
                );
            let coord = neighbor(
                Coord { alt: home.category == 8, x: home.base.coord_x, y: home.base.coord_y }, command.direction,
            );
            assert!(
                command.amount <= super::max_army_size(rules.troop_limit_config, home.base.level, tier).into()
                    * RESOURCE_PRECISION,
                "army size limit",
            );
            let troops = initial_troops(category, tier, command.amount, rules, context.timestamp);
            self.map_dispatcher().occupy(tile_key(game_id, coord), id, super::troop_occupier(troops), false);
            self
                .troops
                .create(
                    ExplorerKey { game_id, explorer_id: id },
                    ExplorerTroops { owner: command.structure_id, troops, coord },
                );
            self
                .structures_dispatcher()
                .initialize_explorer_resources(ResourceKey { game_id, entity_id: id }, command.amount);
            self.game_dispatcher().allocate_entity(game_id);
        }
        fn explore(
            ref self: ContractState, game_id: u32, actor: ContractAddress, command: Explore, context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut explorer = self.owned_explorer(key, actor);
            assert!(explorer.troops.count != 0, "explorer is dead");
            self.map_dispatcher().vacate(tile_key(game_id, explorer.coord), command.explorer_id);
            let destination = neighbor(explorer.coord, command.direction);
            let tile = tile_key(game_id, destination);
            let data = self.map_dispatcher().tile(tile).map(|tile| tile.data).unwrap_or(0);
            assert!(data % 0x20000000000 == 0, "destination occupied");
            let biome: crate::biome::Biome = self.map_dispatcher().biome(tile).into();
            let exploring = (data / 0x20000000000) % 0x100 == 0;
            let mut raw_root = context.raw_root;
            let game = self.game_dispatcher().game(game_id);
            let seed = crate::random::game_root(ref raw_root, game_id, game.seed);
            let mut discovery = crate::discovery::Discovery::None;
            if exploring {
                self.map_dispatcher().reveal(tile, biome.into());
                self.game_dispatcher().register_exploration(game_id, actor);
                discovery = self
                    .map_dispatcher()
                    .discovery(
                        tile, seed, self.structures_dispatcher().hyperstructure_count(game_id), context.timestamp,
                    );
                if discovery != crate::discovery::Discovery::None {
                    self
                        .structures_dispatcher()
                        .create_discovery(game_id, destination, discovery, seed, context.timestamp);
                }
            }
            if discovery == crate::discovery::Discovery::None {
                explorer.coord = destination;
            }
            self
                .map_dispatcher()
                .occupy(
                    tile_key(game_id, explorer.coord),
                    command.explorer_id,
                    super::troop_occupier(explorer.troops),
                    false,
                );
            self.pay_movement(game_id, ref explorer, rules, biome, exploring, context.timestamp);
            self.troops.save(key, explorer);
            self.game_dispatcher().allocate_entity(game_id);
            if exploring {
                self.game_dispatcher().allocate_entity(game_id);
            }
        }
        fn battle(
            ref self: ContractState, game_id: u32, actor: ContractAddress, command: Battle, context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            let attacker_key = ExplorerKey { game_id, explorer_id: command.attacker_id };
            let defender_key = ExplorerKey { game_id, explorer_id: command.defender_id };
            let mut attacker = self.owned_explorer(attacker_key, actor);
            let mut defender = self.troops.explorer(defender_key).expect('missing defender');
            let defender_home = self
                .structures_dispatcher()
                .structure(ResourceKey { game_id, entity_id: defender.owner })
                .expect('missing defender home');
            assert!(defender_home.owner != actor, "actor owns defender");
            self.assert_battle_immunity(game_id, attacker.owner, rules, context.timestamp);
            self.assert_battle_immunity(game_id, defender.owner, rules, context.timestamp);
            assert!(attacker.troops.count > 0 && defender.troops.count > 0, "dead combatant");
            self.assert_battle_range(game_id, attacker, defender);
            let attacker_before = attacker.troops.count;
            let defender_before = defender.troops.count;
            let combat = self.combat_context(game_id, attacker, defender, context);
            attacker
                .troops
                .attack_with_context(
                    ref defender.troops,
                    combat,
                    rules.troop_stamina_config,
                    rules.troop_damage_config,
                    context.timestamp / rules.tick_config.armies_tick_in_seconds,
                    rules.tick_config.armies_tick_in_seconds,
                );
            self.finish_battle(attacker_key, attacker, attacker_before);
            self.finish_battle(defender_key, defender, defender_before);
            self
                .emit(
                    super::BattleEvent {
                        version: 1,
                        game_id,
                        attacker_id: command.attacker_id,
                        defender_id: command.defender_id,
                        attacker_owner: attacker.owner,
                        defender_owner: defender.owner,
                        winner_id: battle_winner(attacker, defender),
                        coord: defender.coord,
                        max_reward: array![].span(),
                        timestamp: context.timestamp,
                    },
                );
            self.game_dispatcher().allocate_entity(game_id);
            self.game_dispatcher().allocate_entity(game_id);
        }
    }
    #[abi(embed_v0)]
    impl Travel of crate::commands::ITravelCommands<ContractState> {
        fn move_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::commands::Move,
            context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            assert!(!command.directions.is_empty(), "empty movement path");
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut explorer = self.owned_explorer(key, actor);
            assert!(explorer.troops.count != 0, "explorer is dead");
            self.map_dispatcher().vacate(tile_key(game_id, explorer.coord), command.explorer_id);
            for direction in command.directions {
                let destination = neighbor(explorer.coord, *direction);
                let tile = tile_key(game_id, destination);
                let data = self.map_dispatcher().tile(tile).expect('undiscovered movement tile').data;
                assert!(data % 0x20000000000 == 0, "movement tile occupied");
                assert!((data / 0x20000000000) % 256 != 0, "undiscovered movement tile");
                let biome = self.map_dispatcher().biome(tile).into();
                super::spend_stamina(ref explorer, rules, biome, false, context.timestamp);
                explorer.coord = destination;
            }
            self
                .map_dispatcher()
                .occupy(
                    tile_key(game_id, explorer.coord),
                    command.explorer_id,
                    super::troop_occupier(explorer.troops),
                    false,
                );
            self.pay_food(game_id, explorer, rules, false, context.timestamp);
            self.troops.save(key, explorer);
            self.game_dispatcher().allocate_entity(game_id);
        }
        fn toggle_alternate(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::commands::ToggleAlternate,
            context: ExecutionContext,
        ) {
            self.authorize(game_id, context);
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut explorer = self.owned_explorer(key, actor);
            assert!(explorer.troops.count != 0, "explorer is dead");
            let spire = self
                .map_dispatcher()
                .tile(tile_key(game_id, spire_neighbor(explorer.coord, command.spire_direction)))
                .expect('missing spire');
            assert!((spire.data / 2) % 256 == 35, "explorer must be adjacent to spire");
            let destination = Coord { alt: !explorer.coord.alt, ..explorer.coord };
            let destination_key = tile_key(game_id, destination);
            let data = self.map_dispatcher().tile(destination_key).map(|tile| tile.data).unwrap_or(0);
            assert!(data % 0x20000000000 == 0, "portal landing occupied");
            self
                .structures_dispatcher()
                .spend_spire_fee(ResourceKey { game_id, entity_id: explorer.owner }, context.timestamp);
            if (data / 0x20000000000) % 256 == 0 {
                self.map_dispatcher().reveal(destination_key, self.map_dispatcher().biome(destination_key));
            }
            self.map_dispatcher().vacate(tile_key(game_id, explorer.coord), command.explorer_id);
            self
                .map_dispatcher()
                .occupy(destination_key, command.explorer_id, super::troop_occupier(explorer.troops), false);
            explorer.coord = destination;
            self.troops.save(key, explorer);
            self.game_dispatcher().allocate_entity(game_id);
        }
    }
    fn battle_winner(attacker: ExplorerTroops, defender: ExplorerTroops) -> u32 {
        if attacker.troops.count == 0 && defender.troops.count > 0 {
            return defender.owner;
        }
        if defender.troops.count == 0 && attacker.troops.count > 0 {
            return attacker.owner;
        }
        0
    }
    fn troop_type(value: u8) -> TroopType {
        match value {
            0 => TroopType::Knight,
            1 => TroopType::Paladin,
            2 => TroopType::Crossbowman,
            _ => panic!("invalid troop type"),
        }
    }
    fn troop_tier(value: u8) -> TroopTier {
        match value {
            0 => TroopTier::T1,
            1 => TroopTier::T2,
            2 => TroopTier::T3,
            _ => panic!("invalid troop tier"),
        }
    }
    fn initial_troops(category: TroopType, tier: TroopTier, count: u128, rules: SliceRules, timestamp: u64) -> Troops {
        let mut troops = Troops { category, tier, count, ..Default::default() };
        troops
            .stamina
            .refill(
                ref troops.boosts,
                category,
                tier,
                rules.troop_stamina_config,
                timestamp / rules.tick_config.armies_tick_in_seconds,
            );
        troops
    }
    #[generate_trait]
    impl Internal of InternalTrait {
        fn authorize(self: @ContractState, game_id: u32, context: ExecutionContext) -> SliceRules {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == peers.season, "only authenticated command domain");
            crate::commands::assert_context_time(context.timestamp);
            assert_playing(self.game_dispatcher().game(game_id), context.timestamp);
            self.game_dispatcher().rules(game_id)
        }
        fn game_dispatcher(self: @ContractState) -> IGameDispatcher {
            IGameDispatcher { contract_address: self.lifecycle.require_active().season }
        }
        fn structures_dispatcher(self: @ContractState) -> IStructuresDispatcher {
            IStructuresDispatcher { contract_address: self.lifecycle.require_active().structures }
        }
        fn map_dispatcher(self: @ContractState) -> IMapDispatcher {
            IMapDispatcher { contract_address: self.lifecycle.require_active().map }
        }
        fn owned_structure(self: @ContractState, game_id: u32, entity_id: u32, actor: ContractAddress) -> Structure {
            let home = self
                .structures_dispatcher()
                .structure(ResourceKey { game_id, entity_id })
                .expect('missing home structure');
            assert!(home.owner == actor, "actor does not own structure");
            home
        }
        fn owned_explorer(self: @ContractState, key: ExplorerKey, actor: ContractAddress) -> ExplorerTroops {
            let explorer = self.troops.explorer(key).expect('missing explorer');
            self.owned_structure(key.game_id, explorer.owner, actor);
            explorer
        }
        fn pay_movement(
            ref self: ContractState,
            game_id: u32,
            ref explorer: ExplorerTroops,
            rules: SliceRules,
            biome: crate::biome::Biome,
            exploring: bool,
            timestamp: u64,
        ) {
            super::spend_stamina(ref explorer, rules, biome, exploring, timestamp);
            self.pay_food(game_id, explorer, rules, exploring, timestamp);
        }
        fn pay_food(
            ref self: ContractState,
            game_id: u32,
            explorer: ExplorerTroops,
            rules: SliceRules,
            exploring: bool,
            timestamp: u64,
        ) {
            let stamina = rules.troop_stamina_config;
            let (wheat, fish) = if exploring {
                (stamina.stamina_explore_wheat_cost, stamina.stamina_explore_fish_cost)
            } else {
                (stamina.stamina_travel_wheat_cost, stamina.stamina_travel_fish_cost)
            };
            let units = explorer.troops.count / RESOURCE_PRECISION;
            self
                .structures_dispatcher()
                .spend_food(
                    ResourceKey { game_id, entity_id: explorer.owner },
                    wheat.into() * units,
                    fish.into() * units,
                    timestamp,
                );
        }
        fn assert_battle_immunity(self: @ContractState, game_id: u32, home_id: u32, rules: SliceRules, timestamp: u64) {
            let game = self.game_dispatcher().game(game_id);
            let home = self.structures_dispatcher().structure(ResourceKey { game_id, entity_id: home_id }).unwrap();
            let tick = timestamp / rules.tick_config.armies_tick_in_seconds;
            assert!(
                tick >= game.start_main_at / rules.tick_config.armies_tick_in_seconds
                    + rules.battle_config.regular_immunity_ticks.into(),
                "season immunity",
            );
            if home.category == 5 {
                assert!(
                    tick >= home.base.created_at.into() / rules.tick_config.armies_tick_in_seconds
                        + rules.battle_config.village_immunity_ticks.into(),
                    "village immunity",
                );
            }
        }
        fn adjacent_to_spire(self: @ContractState, game_id: u32, coord: Coord) -> bool {
            for direction in 0_u8..6 {
                let key = tile_key(game_id, spire_neighbor(coord, direction));
                if self.map_dispatcher().tile(key).map(|tile| (tile.data / 2) % 256 == 35).unwrap_or(false) {
                    return true;
                }
            }
            false
        }
        fn assert_battle_range(
            self: @ContractState, game_id: u32, mut attacker: ExplorerTroops, defender: ExplorerTroops,
        ) {
            let within = if attacker.coord.alt != defender.coord.alt {
                attacker.coord.x == defender.coord.x
                    && attacker.coord.y == defender.coord.y
                    && self.adjacent_to_spire(game_id, attacker.coord)
            } else {
                let separation = distance(attacker.coord, defender.coord);
                let stride: u128 = if attacker.coord.alt {
                    15
                } else {
                    1
                };
                separation > 0 && separation <= attacker.troops.attack_range().into() * stride
            };
            assert!(within, "explorers out of range");
        }
        fn combat_context(
            self: @ContractState,
            game_id: u32,
            attacker: ExplorerTroops,
            defender: ExplorerTroops,
            context: ExecutionContext,
        ) -> CombatContext {
            let biome: crate::biome::Biome = self.map_dispatcher().biome(tile_key(game_id, defender.coord)).into();
            let (attacker_roll, defender_roll) = if defender.coord.alt {
                let mut raw_root = context.raw_root;
                let seed = crate::random::game_root(ref raw_root, game_id, self.game_dispatcher().game(game_id).seed);
                (
                    1_u8 + crate::random::range(seed, 1, 20).try_into().unwrap(),
                    1_u8 + crate::random::range(seed, 2, 20).try_into().unwrap(),
                )
            } else {
                (0_u8, 0_u8)
            };
            let attack_distance = if attacker.coord.alt != defender.coord.alt {
                1
            } else {
                let stride = if attacker.coord.alt {
                    15
                } else {
                    1
                };
                (distance(attacker.coord, defender.coord) / stride).try_into().unwrap()
            };
            CombatContext {
                timestamp: context.timestamp,
                attacker_roll,
                defender_roll,
                attacker_biome: biome,
                defender_biome: biome,
                attack_distance,
                attacker_is_structure_guard: false,
                defender_is_structure_guard: false,
            }
        }
        fn finish_battle(ref self: ContractState, key: ExplorerKey, explorer: ExplorerTroops, before: u128) {
            self
                .structures_dispatcher()
                .reduce_explorer_capacity(
                    ResourceKey { game_id: key.game_id, entity_id: key.explorer_id }, before - explorer.troops.count,
                );
            if explorer.troops.count == 0 {
                self.destroy_explorer(key, explorer);
            } else {
                self.troops.save(key, explorer);
            }
        }
        fn destroy_explorer(ref self: ContractState, key: ExplorerKey, explorer: ExplorerTroops) {
            self
                .structures_dispatcher()
                .remove_explorer(ResourceKey { game_id: key.game_id, entity_id: explorer.owner }, key.explorer_id);
            self.map_dispatcher().vacate(tile_key(key.game_id, explorer.coord), key.explorer_id);
            self.troops.destroy(key);
            if explorer.owner == super::AGENT_HOME {
                self.agent_owners.write((key.game_id, key.explorer_id), 0.try_into().unwrap());
                self
                    .emit(
                        crate::events::RowDeleted {
                            version: 1,
                            model: 'AgentOwner',
                            keys: array![key.game_id.into(), key.explorer_id.into()].span(),
                        },
                    );
            }
        }
    }
}

pub fn troop_resource(category: TroopType, tier: u8) -> u8 {
    (match category {
        TroopType::Knight => 26,
        TroopType::Paladin => 32,
        TroopType::Crossbowman => 29,
    }) + tier
}
fn troop_occupier(troops: Troops) -> u8 {
    let category = match troops.category {
        TroopType::Knight => 15,
        TroopType::Paladin => 18,
        TroopType::Crossbowman => 21,
    };
    let tier = match troops.tier {
        TroopTier::T1 => 0,
        TroopTier::T2 => 1,
        TroopTier::T3 => 2,
    };
    category + tier
}
pub fn max_army_size(config: crate::rules::TroopLimitConfig, level: u8, tier: TroopTier) -> u32 {
    let cap = match level {
        0 => config.settlement_deployment_cap,
        1 => config.city_deployment_cap,
        2 => config.kingdom_deployment_cap,
        3 => config.empire_deployment_cap,
        _ => panic!("invalid structure level"),
    };
    let (strength, modifier) = match tier {
        TroopTier::T1 => (config.t1_tier_strength, config.t1_tier_modifier),
        TroopTier::T2 => (config.t2_tier_strength, config.t2_tier_modifier),
        TroopTier::T3 => (config.t3_tier_strength, config.t3_tier_modifier),
    };
    cap * modifier.into() / (strength.into() * 100)
}

fn spend_stamina(
    ref explorer: ExplorerTroops,
    rules: crate::rules::SliceRules,
    biome: crate::biome::Biome,
    exploring: bool,
    timestamp: u64,
) {
    let stamina = rules.troop_stamina_config;
    let cost: u64 = if exploring {
        stamina.stamina_explore_stamina_cost.into()
    } else {
        let (increase, bonus) = explorer.troops.stamina_travel_bonus(biome, stamina);
        let base: u64 = stamina.stamina_travel_stamina_cost.into();
        if increase {
            base + bonus.into()
        } else {
            base - bonus.into()
        }
    };
    explorer
        .troops
        .stamina
        .spend(
            ref explorer.troops.boosts,
            explorer.troops.category,
            explorer.troops.tier,
            stamina,
            cost,
            timestamp / rules.tick_config.armies_tick_in_seconds,
            true,
        );
}
