use starknet::ContractAddress;
use crate::commands::ExecutionContext;
use crate::resources::ResourceKey;
use crate::troops::Coord;

pub const FIRST_RELIC: u8 = 39;
pub const LAST_RELIC: u8 = 56;
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct RelicRule {
    pub rate_bps: u16,
    pub duration: u32,
    pub uses: u8,
    pub essence_cost: u128,
    pub draw_weight: u128,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum Recipient {
    Explorer,
    StructureProduction,
    StructureGuard,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ApplyRelic {
    pub entity_id: u32,
    pub relic_id: u8,
    pub recipient: Recipient,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct OpenChest {
    pub explorer_id: u32,
    pub coord: Coord,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ChestOpened {
    pub explorer_id: u32,
    pub coord: Coord,
    pub relics: Span<u8>,
    pub points: u128,
}
#[starknet::interface]
pub trait IRelics<T> {
    fn configure_relics(ref self: T, game_id: u32, rules: Span<RelicRule>);
    fn relic_rules(self: @T, game_id: u32) -> Span<RelicRule>;
    fn open_relic_chest(
        ref self: T, game_id: u32, actor: ContractAddress, command: OpenChest, context: ExecutionContext,
    );
    fn apply_relic(ref self: T, game_id: u32, actor: ContractAddress, command: ApplyRelic, context: ExecutionContext);
}
#[starknet::interface]
pub trait IRelicMap<T> {
    fn relic_discovery_time(self: @T, game_id: u32) -> u64;
    fn discover_relic_chest(ref self: T, game_id: u32, coord: Coord, seed: u256, timestamp: u64);
    fn consume_relic_chest(ref self: T, game_id: u32, coord: Coord);
    fn reveal_relic_ring(ref self: T, game_id: u32, coord: Coord, radius: u8);
}
#[starknet::interface]
pub trait IRelicTroops<T> {
    fn apply_troop_relic(
        ref self: T, game_id: u32, actor: ContractAddress, command: ApplyRelic, rule: RelicRule, timestamp: u64,
    );
}
#[starknet::interface]
pub trait IRelicProduction<T> {
    fn apply_production_relic(ref self: T, key: ResourceKey, relic_id: u8, rule: RelicRule, timestamp: u64);
}

pub fn chest_destination(origin: Coord, seed: u256, timestamp: u64, distance: u8) -> Coord {
    let seed = if seed > 12 {
        seed - 12
    } else {
        seed + 12
    };
    let mut salt: u128 = timestamp.into();
    let mut chosen = 0_u8;
    let mut step = 1_u32;
    let mut coord = origin;
    while step <= 3 {
        salt += 18;
        let direction: u8 = crate::random::range(seed, salt, 6).try_into().unwrap();
        let mask = match direction {
            0 => 1,
            1 => 2,
            2 => 4,
            3 => 8,
            4 => 16,
            5 => 32,
            _ => panic!("invalid direction"),
        };
        if chosen & mask == 0 {
            chosen = chosen | mask;
            coord = crate::geometry::neighbor_at_distance(coord, direction, Into::<u8, u32>::into(distance) / step);
            step += 1;
        }
    }
    coord
}
pub fn draw_relics(rules: Span<RelicRule>, seed: u256, timestamp: u64, count: u8) -> Span<u8> {
    let mut total: u128 = 0;
    for rule in rules {
        total += *rule.draw_weight;
    }
    assert!(total != 0, "empty relic discovery pool");
    let mut chosen = array![];
    let mut salt: u128 = timestamp.into();
    for _ in 0..count {
        salt += 18;
        let roll = crate::random::range(seed, salt, total);
        let mut cumulative = 0;
        for index in 0..rules.len() {
            cumulative += *rules.at(index).draw_weight;
            if roll < cumulative {
                chosen.append(FIRST_RELIC + index.try_into().unwrap());
                break;
            }
        }
    }
    chosen.span()
}
pub fn boost_explorer(ref boosts: crate::troops::TroopBoosts, id: u8, rule: RelicRule, tick: u32) {
    match id {
        39 |
        40 => {
            boosts.incr_stamina_regen_percent_num = rule.rate_bps;
            boosts.incr_stamina_regen_tick_count = rule.uses;
        },
        41 |
        42 => {
            boosts.incr_damage_dealt_percent_num = rule.rate_bps;
            boosts.incr_damage_dealt_end_tick = tick + rule.duration;
        },
        43 |
        44 => {
            boosts.decr_damage_gotten_percent_num = rule.rate_bps;
            boosts.decr_damage_gotten_end_tick = tick + rule.duration;
        },
        47 |
        48 => {
            boosts.incr_explore_reward_percent_num = rule.rate_bps;
            boosts.incr_explore_reward_end_tick = tick + rule.duration;
        },
        45 | 46 => {},
        _ => panic!("invalid explorer relic"),
    }
}
pub fn boost_production(ref bonus: crate::production::ProductionBonus, id: u8, rule: RelicRule, tick: u32) {
    match id {
        51 |
        52 => {
            bonus.incr_resource_rate_percent_num = rule.rate_bps;
            bonus.incr_resource_rate_end_tick = tick + rule.duration;
        },
        53 |
        54 => {
            bonus.incr_labor_rate_percent_num = rule.rate_bps;
            bonus.incr_labor_rate_end_tick = tick + rule.duration;
        },
        55 |
        56 => {
            bonus.incr_troop_rate_percent_num = rule.rate_bps;
            bonus.incr_troop_rate_end_tick = tick + rule.duration;
        },
        _ => panic!("invalid production relic"),
    }
}

#[starknet::component]
pub mod RelicState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::game::{IGameDispatcher, IGameDispatcherTrait, assert_playing};
    use crate::lifecycle::Lifecycle::InternalTrait as LifeInternalTrait;
    use crate::lifecycle::{Lifecycle, Peers};
    use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceKey};
    use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait};
    use crate::troops::{ExplorerKey, ITroopsDispatcher, ITroopsDispatcherTrait};
    use super::{
        ApplyRelic, ExecutionContext, IRelicMapDispatcher, IRelicMapDispatcherTrait, IRelicProductionDispatcher,
        IRelicProductionDispatcherTrait, IRelicTroopsDispatcher, IRelicTroopsDispatcherTrait, OpenChest, Recipient,
        RelicRule,
    };
    #[storage]
    pub struct Storage {
        pub relic_rules: Map<(u32, u8), RelicRule>,
        pub relic_configured: Map<u32, bool>,
        pub artificer_costs: Map<u32, Option<u128>>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: crate::events::RowSet,
        StoryEvent: crate::ownership::StoryEvent,
    }
    #[embeddable_as(RelicsImpl)]
    pub impl Relics<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of super::IRelics<ComponentState<TContractState>> {
        fn configure_relics(ref self: ComponentState<TContractState>, game_id: u32, rules: Span<RelicRule>) {
            get_dep_component!(@self, Life).assert_authority();
            self.games().game(game_id);
            assert!(!self.relic_configured.read(game_id), "relic rules already configured");
            assert!(rules.len() == 18, "all eighteen relic rules required");
            let mut total: u128 = 0;
            for index in 0..18_u32 {
                let rule = *rules.at(index);
                total += rule.draw_weight;
                self.relic_rules.write((game_id, super::FIRST_RELIC + index.try_into().unwrap()), rule);
            }
            assert!(total != 0, "empty relic discovery pool");
            assert!(*rules.at(6).uses == 1 && *rules.at(7).uses == 2, "invalid reveal radii");
            self.relic_configured.write(game_id, true);
            let mut values = array![];
            rules.serialize(ref values);
            self
                .emit(
                    crate::events::RowSet {
                        version: 1, model: 'RelicRules', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
        }
        fn relic_rules(self: @ComponentState<TContractState>, game_id: u32) -> Span<RelicRule> {
            assert!(self.relic_configured.read(game_id), "missing relic rules");
            let mut rules = array![];
            for id in super::FIRST_RELIC..super::LAST_RELIC + 1 {
                rules.append(self.relic_rules.read((game_id, id)));
            }
            rules.span()
        }
        fn open_relic_chest(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            context: ExecutionContext,
        ) {
            self.assert_command(game_id, context.timestamp);
            let peers = self.peers();
            let explorer = ITroopsDispatcher { contract_address: peers.troops }
                .authorized_explorer(ExplorerKey { game_id, explorer_id: command.explorer_id }, actor);
            assert!(crate::geometry::adjacent(explorer.coord, command.coord), "explorer is not adjacent to chest");
            IRelicMapDispatcher { contract_address: peers.map }.consume_relic_chest(game_id, command.coord);
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id, self.games().game(game_id).seed);
            let config = self.games().rules(game_id);
            let relics = super::draw_relics(
                self.relic_rules(game_id), seed, context.timestamp, config.map_config.relic_chest_relics_per_chest,
            );
            let key = ResourceKey { game_id, entity_id: command.explorer_id };
            for id in relics {
                self.resources().grant_resource(key, *id, crate::rules::RESOURCE_PRECISION, context.timestamp);
            }
            let points = config.victory_points_grant_config.relic_open_points.into();
            self.games().register_relic_points(game_id, actor);
            self.record_chest_opened(game_id, actor, command, relics, points, context.timestamp);
        }
        fn apply_relic(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: ApplyRelic,
            context: ExecutionContext,
        ) {
            self.assert_command(game_id, context.timestamp);
            assert!(
                command.relic_id >= super::FIRST_RELIC && command.relic_id <= super::LAST_RELIC,
                "invalid relic resource",
            );
            assert!(self.relic_configured.read(game_id), "missing relic rules");
            let rule = self.relic_rules.read((game_id, command.relic_id));
            let payer = self.apply_effect(game_id, actor, command, rule, context.timestamp);
            self
                .resources()
                .spend_resource(
                    ResourceKey { game_id, entity_id: command.entity_id },
                    command.relic_id,
                    crate::rules::RESOURCE_PRECISION,
                    context.timestamp,
                );
            self
                .resources()
                .spend_resource(
                    ResourceKey { game_id, entity_id: payer },
                    38,
                    rule.essence_cost * crate::rules::RESOURCE_PRECISION,
                    context.timestamp,
                );
        }
    }
    #[embeddable_as(ArtificerImpl)]
    pub impl Artificer<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::artificer::IArtificer<ComponentState<TContractState>> {
        fn configure_artificer(ref self: ComponentState<TContractState>, game_id: u32, research_cost: u128) {
            get_dep_component!(@self, Life).assert_authority();
            self.games().game(game_id);
            assert!(self.artificer_costs.read(game_id).is_none(), "artificer already configured");
            self.artificer_costs.write(game_id, Some(research_cost));
            self
                .emit(
                    crate::events::RowSet {
                        version: 1,
                        model: 'ArtificerCost',
                        keys: array![game_id.into()].span(),
                        values: array![research_cost.into()].span(),
                    },
                );
        }
        fn artificer_cost(self: @ComponentState<TContractState>, game_id: u32) -> u128 {
            self.artificer_costs.read(game_id).expect('missing artificer cost')
        }
        fn craft_relic(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            structure_id: u32,
            context: ExecutionContext,
        ) {
            self.assert_command(game_id, context.timestamp);
            let key = ResourceKey { game_id, entity_id: structure_id };
            let structure = IStructuresDispatcher { contract_address: self.peers().structures }
                .structure(key)
                .expect('missing structure');
            assert!(
                structure.base.category == 1 || structure.base.category == 5, "structure is not a realm or village",
            );
            assert!(structure.owner == actor, "actor does not own structure");
            self
                .resources()
                .spend_resource(key, crate::artificer::RESEARCH, self.artificer_cost(game_id), context.timestamp);
            let mut root = context.raw_root;
            let seed = crate::random::game_root(ref root, game_id, self.games().game(game_id).seed);
            let relic = *super::draw_relics(self.relic_rules(game_id), seed, context.timestamp, 1).at(0);
            self.resources().grant_resource(key, relic, crate::rules::RESOURCE_PRECISION, context.timestamp);
            self.record_crafted_relic(game_id, actor, structure_id, relic, context.timestamp);
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn record_crafted_relic(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            structure_id: u32,
            relic: u8,
            timestamp: u64,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        id: self.games().allocate_entity(game_id),
                        entity_id: Some(structure_id),
                        owner: Some(actor),
                        timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::RelicCrafted(relic),
                    },
                );
        }
        fn record_chest_opened(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: OpenChest,
            relics: Span<u8>,
            points: u128,
            timestamp: u64,
        ) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        id: self.games().allocate_entity(game_id),
                        entity_id: Some(command.explorer_id),
                        owner: Some(actor),
                        timestamp,
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::RelicChestOpened(
                            super::ChestOpened {
                                explorer_id: command.explorer_id, coord: command.coord, relics, points,
                            },
                        ),
                    },
                );
        }
        fn peers(self: @ComponentState<TContractState>) -> Peers {
            get_dep_component!(self, Life).require_active()
        }
        fn games(self: @ComponentState<TContractState>) -> IGameDispatcher {
            IGameDispatcher { contract_address: self.peers().season }
        }
        fn resources(self: @ComponentState<TContractState>) -> IResourcesDispatcher {
            IResourcesDispatcher { contract_address: self.peers().resources }
        }
        fn assert_command(self: @ComponentState<TContractState>, game_id: u32, timestamp: u64) {
            assert!(get_caller_address() == self.peers().season, "only authenticated command domain");
            crate::commands::assert_context_time(timestamp);
            assert_playing(self.games().game(game_id), timestamp);
        }
        fn apply_effect(
            self: @ComponentState<TContractState>,
            game_id: u32,
            actor: ContractAddress,
            command: ApplyRelic,
            rule: RelicRule,
            timestamp: u64,
        ) -> u32 {
            let peers = self.peers();
            if command.recipient == Recipient::Explorer {
                let explorer = ITroopsDispatcher { contract_address: peers.troops }
                    .authorized_explorer(ExplorerKey { game_id, explorer_id: command.entity_id }, actor);
                IRelicTroopsDispatcher { contract_address: peers.troops }
                    .apply_troop_relic(game_id, actor, command, rule, timestamp);
                if explorer.owner == crate::troops::AGENT_HOME {
                    command.entity_id
                } else {
                    explorer.owner
                }
            } else {
                let key = ResourceKey { game_id, entity_id: command.entity_id };
                assert!(
                    IStructuresDispatcher { contract_address: peers.structures }.structure_owner(key) == actor,
                    "actor does not own structure",
                );
                if command.recipient == Recipient::StructureProduction {
                    IRelicProductionDispatcher { contract_address: peers.resources }
                        .apply_production_relic(key, command.relic_id, rule, timestamp);
                } else {
                    IRelicTroopsDispatcher { contract_address: peers.troops }
                        .apply_troop_relic(game_id, actor, command, rule, timestamp);
                }
                command.entity_id
            }
        }
    }
}
