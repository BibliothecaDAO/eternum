use crate::combat::TroopsTrait;
use crate::stamina::StaminaTrait;

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
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
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

const DAMAGE_END_SCALE: u128 = 0x10000;
const DEFENSE_PERCENT_SCALE: u128 = 0x1000000000000;
const DEFENSE_END_SCALE: u128 = 0x10000000000000000;
const STAMINA_PERCENT_SCALE: u128 = 0x1000000000000000000000000;
const STAMINA_TICKS_SCALE: u128 = 0x10000000000000000000000000000;

// Damage, defense and stamina use 120 low-limb bits; exploration uses 48 high-limb bits.
pub impl TroopBoostsPacking of starknet::storage_access::StorePacking<TroopBoosts, felt252> {
    fn pack(value: TroopBoosts) -> felt252 {
        let low = value.incr_damage_dealt_percent_num.into()
            + value.incr_damage_dealt_end_tick.into() * DAMAGE_END_SCALE
            + value.decr_damage_gotten_percent_num.into() * DEFENSE_PERCENT_SCALE
            + value.decr_damage_gotten_end_tick.into() * DEFENSE_END_SCALE
            + value.incr_stamina_regen_percent_num.into() * STAMINA_PERCENT_SCALE
            + value.incr_stamina_regen_tick_count.into() * STAMINA_TICKS_SCALE;
        let high = value.incr_explore_reward_percent_num.into()
            + value.incr_explore_reward_end_tick.into() * DAMAGE_END_SCALE;
        u256 { low, high }.try_into().unwrap()
    }
    fn unpack(value: felt252) -> TroopBoosts {
        let value: u256 = value.into();
        TroopBoosts {
            incr_damage_dealt_percent_num: (value.low % 0x10000).try_into().unwrap(),
            incr_damage_dealt_end_tick: (value.low / DAMAGE_END_SCALE % 0x100000000).try_into().unwrap(),
            decr_damage_gotten_percent_num: (value.low / DEFENSE_PERCENT_SCALE % 0x10000).try_into().unwrap(),
            decr_damage_gotten_end_tick: (value.low / DEFENSE_END_SCALE % 0x100000000).try_into().unwrap(),
            incr_stamina_regen_percent_num: (value.low / STAMINA_PERCENT_SCALE % 0x10000).try_into().unwrap(),
            incr_stamina_regen_tick_count: (value.low / STAMINA_TICKS_SCALE).try_into().unwrap(),
            incr_explore_reward_percent_num: (value.high % 0x10000).try_into().unwrap(),
            incr_explore_reward_end_tick: (value.high / DAMAGE_END_SCALE).try_into().unwrap(),
        }
    }
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq)]
pub struct Troops {
    pub category: TroopType,
    pub tier: TroopTier,
    pub count: u128,
    pub stamina: Stamina,
    pub boosts: TroopBoosts,
    pub battle_cooldown_end: u32,
}
// Counts retain their full u128 range; stamina and combat flags each use one word.
#[derive(Copy, Drop, starknet::Store)]
pub struct PackedTroops {
    pub count: u128,
    pub stamina: u128,
    pub boosts: felt252,
    pub combat: u64,
}
const STAMINA_TICK_SCALE: u128 = 0x10000000000000000;
const TIER_SCALE: u64 = 4;
const COOLDOWN_SCALE: u64 = 16;
pub impl TroopsPacking of starknet::storage_access::StorePacking<Troops, PackedTroops> {
    fn pack(value: Troops) -> PackedTroops {
        let category: u8 = value.category.into();
        let tier: u64 = match value.tier {
            TroopTier::T1 => 0,
            TroopTier::T2 => 1,
            TroopTier::T3 => 2,
        };
        PackedTroops {
            count: value.count,
            stamina: value.stamina.amount.into() + value.stamina.updated_tick.into() * STAMINA_TICK_SCALE,
            boosts: TroopBoostsPacking::pack(value.boosts),
            combat: category.into() + tier * TIER_SCALE + value.battle_cooldown_end.into() * COOLDOWN_SCALE,
        }
    }
    fn unpack(value: PackedTroops) -> Troops {
        let category = match value.combat % TIER_SCALE {
            0 => TroopType::Knight,
            1 => TroopType::Paladin,
            2 => TroopType::Crossbowman,
            _ => panic!("invalid stored troop type"),
        };
        let tier = match value.combat / TIER_SCALE % TIER_SCALE {
            0 => TroopTier::T1,
            1 => TroopTier::T2,
            2 => TroopTier::T3,
            _ => panic!("invalid stored troop tier"),
        };
        Troops {
            category,
            tier,
            count: value.count,
            stamina: Stamina {
                amount: (value.stamina % STAMINA_TICK_SCALE).try_into().unwrap(),
                updated_tick: (value.stamina / STAMINA_TICK_SCALE).try_into().unwrap(),
            },
            boosts: TroopBoostsPacking::unpack(value.boosts),
            battle_cooldown_end: (value.combat / COOLDOWN_SCALE).try_into().unwrap(),
        }
    }
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
    pub max_reward: Span<crate::resources::ResourceAmount>,
    pub attacker: crate::combat_actions::BattleSide,
    pub defender: crate::combat_actions::BattleSide,
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
            self.explorer(key).expect('missing explorer');

            // The existence bit is authoritative; recreation overwrites the complete value.
            self.exists.write((key.game_id, key.explorer_id), false);
            let mut keys = array![];
            key.serialize(ref keys);
            self.emit(RowDeleted { version: 1, model: 'ExplorerTroops', keys: keys.span() });
        }
    }
}

#[starknet::interface]
pub trait ITroops<T> {
    fn explorer(self: @T, key: ExplorerKey) -> Option<ExplorerTroops>;
    fn authorized_explorer(self: @T, key: ExplorerKey, actor: starknet::ContractAddress) -> ExplorerTroops;
}

#[starknet::contract]
pub mod TroopsDomain {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::combat::{CombatContext, TroopsTrait};
    use crate::combat_actions::battle_side;
    use crate::combat_domain::{ICombatDispatcher, ICombatDispatcherTrait};
    use crate::commands::{Battle, CreateExplorer, ExecutionContext, Explore};
    use crate::game::{IGameDispatcher, IGameDispatcherTrait, assert_playing};
    use crate::geometry::{distance, neighbor, spire_neighbor, tile_key};
    use crate::lifecycle::Lifecycle;
    use crate::map::{IMapDispatcher, IMapDispatcherTrait};
    use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceKey};
    use crate::rules::{RESOURCE_PRECISION, SliceRules};
    use crate::stamina::StaminaTrait;
    use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait, Structure};
    use super::{Coord, ExplorerKey, ExplorerTroops, TroopState, TroopTier, TroopType, Troops};
    component!(path: crate::guards::GuardState, storage: guards, event: GuardEvent);
    impl GuardInternal = crate::guards::GuardState::InternalImpl<ContractState>;
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
        #[substorage(v0)]
        guards: crate::guards::GuardState::Storage,
        village_raids: starknet::storage::Map<(u32, u32), u64>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        GuardEvent: crate::guards::GuardState::Event,
        LifecycleEvent: Lifecycle::Event,
        TroopEvent: TroopState::Event,
        BattleEvent: super::BattleEvent,
        RaidEvent: crate::combat_actions::RaidEvent,
        OwnershipRow: crate::events::RowSet,
        OwnershipDeleted: crate::events::RowDeleted,
    }

    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl RelicTroops of crate::relics::IRelicTroops<ContractState> {
        fn apply_troop_relic(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::relics::ApplyRelic,
            rule: crate::relics::RelicRule,
            timestamp: u64,
        ) {
            assert!(get_caller_address() == self.lifecycle.require_active().economy, "only economy domain");
            crate::commands::assert_context_time(timestamp);
            assert_playing(self.game_dispatcher().game(game_id), timestamp);
            let rules = self.game_dispatcher().rules(game_id);
            let tick = timestamp / rules.tick_config.armies_tick_in_seconds;
            match command.recipient {
                crate::relics::Recipient::Explorer => self.boost_explorer(game_id, actor, command, rule, rules, tick),
                crate::relics::Recipient::StructureGuard => self
                    .boost_guards(game_id, actor, command, rule, rules, tick),
                crate::relics::Recipient::StructureProduction => panic!("production relic requires resources domain"),
            }
        }
    }
    #[abi(embed_v0)]
    impl Guards of crate::guards::IGuards<ContractState> {
        fn guard(self: @ContractState, key: crate::guards::GuardKey) -> crate::guards::Guard {
            self.guards.guard(key)
        }
        fn initialize_structure_guards(ref self: ContractState, key: ResourceKey, seed: u256, timestamp: u64) {
            assert!(get_caller_address() == self.lifecycle.require_active().structures, "only structures domain");
            let category = self
                .structures_dispatcher()
                .structure(key)
                .expect('missing guarded structure')
                .base
                .category;
            assert!(
                category == 2
                    || category == 3
                    || category == 4
                    || category == crate::camps::CAMP_CATEGORY
                    || category == 8,
                "invalid guarded structure category",
            );
            let guards = super::discovery_guards(category, seed, self.game_dispatcher().rules(key.game_id), timestamp);
            for slot in 0..guards.len() {
                let troops = *guards.at(slot);
                let slot: u8 = slot.try_into().unwrap();
                let guard_key = crate::guards::GuardKey { game_id: key.game_id, structure_id: key.entity_id, slot };
                assert!(self.guards.guard(guard_key) == Default::default(), "guards already initialized");
                self.guards.save(guard_key, crate::guards::Guard { troops, destroyed_tick: 0 });
            }
        }
        fn add_starting_guard(
            ref self: ContractState, key: ResourceKey, category: TroopType, amount: u128, timestamp: u64,
        ) {
            assert!(get_caller_address() == self.lifecycle.require_active().structures, "only structures domain");
            let home = self.structures_dispatcher().structure(key).expect('missing guard structure');
            let guard_key = crate::guards::GuardKey { game_id: key.game_id, structure_id: key.entity_id, slot: 0 };
            let mut guard = self.guards.guard(guard_key);
            let rules = self.game_dispatcher().rules(key.game_id);
            self
                .add_guard_troops(
                    guard_key,
                    ref guard,
                    Troops { category, tier: TroopTier::T1, ..Default::default() },
                    amount,
                    home,
                    rules,
                    timestamp,
                    true,
                );
            self.guards.save(guard_key, guard);
        }
    }
    #[abi(embed_v0)]
    impl TroopViews of super::ITroops<ContractState> {
        fn explorer(self: @ContractState, key: ExplorerKey) -> Option<ExplorerTroops> {
            self.troops.explorer(key)
        }
        fn authorized_explorer(self: @ContractState, key: ExplorerKey, actor: ContractAddress) -> ExplorerTroops {
            self.owned_explorer(key, actor)
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
                let category = super::explorer_occupier(explorer);
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
    impl Management of crate::troop_management::ITroopManagement<ContractState> {
        fn manage_troops(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::troop_management::ManageTroops,
            context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            match command {
                crate::troop_management::ManageTroops::RecruitGuard(value) => self
                    .recruit_guard(game_id, actor, value, rules, context.timestamp),
                crate::troop_management::ManageTroops::RemoveGuard(value) => self
                    .remove_managed_guard(game_id, actor, value),
                crate::troop_management::ManageTroops::RecruitExplorer(value) => self
                    .recruit_explorer(game_id, actor, value, rules, context.timestamp),
                crate::troop_management::ManageTroops::RemoveExplorer(id) => self
                    .remove_managed_explorer(game_id, actor, id),
                crate::troop_management::ManageTroops::Transfer(value) => self
                    .transfer_troops(game_id, actor, value, rules, context.timestamp),
            }
        }
    }

    #[derive(Copy, Drop)]
    struct ManagedArmy {
        troops: Troops,
        home: u32,
        coord: Coord,
        level: u8,
    }
    #[generate_trait]
    impl ManagementInternal of ManagementInternalTrait {
        fn remove_managed_guard(
            ref self: ContractState, game_id: u32, actor: ContractAddress, slot: crate::troop_management::GuardSlot,
        ) {
            let home = self.owned_structure(game_id, slot.structure_id, actor);
            assert!(slot.slot < home.base.troop_max_guard_count, "invalid guard slot");
            let key = crate::guards::GuardKey { game_id, structure_id: slot.structure_id, slot: slot.slot };
            let mut guard = self.guards.guard(key);
            assert!(guard.troops.count != 0, "guard is empty");
            guard.troops.count = 0;
            guard.troops.stamina.reset();
            self.guards.save(key, guard);
        }
        fn remove_managed_explorer(ref self: ContractState, game_id: u32, actor: ContractAddress, id: u32) {
            let key = ExplorerKey { game_id, explorer_id: id };
            let explorer = self.owned_explorer(key, actor);
            assert!(explorer.troops.count != 0, "explorer is dead");
            self.destroy_explorer(key, explorer);
        }

        fn pay_troops(
            ref self: ContractState,
            game_id: u32,
            home: u32,
            category: TroopType,
            tier: TroopTier,
            amount: u128,
            timestamp: u64,
        ) {
            crate::troop_management::assert_amount(amount);
            let tier = match tier {
                TroopTier::T1 => 0,
                TroopTier::T2 => 1,
                TroopTier::T3 => 2,
            };
            self
                .resources_dispatcher()
                .spend_resource(
                    ResourceKey { game_id, entity_id: home }, super::troop_resource(category, tier), amount, timestamp,
                );
        }
        fn recruit_guard(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::troop_management::RecruitGuard,
            rules: SliceRules,
            timestamp: u64,
        ) {
            let home = self.owned_structure(game_id, command.guard.structure_id, actor);
            self
                .pay_troops(
                    game_id, command.guard.structure_id, command.category, command.tier, command.amount, timestamp,
                );
            let key = crate::guards::GuardKey {
                game_id, structure_id: command.guard.structure_id, slot: command.guard.slot,
            };
            let mut guard = self.guards.guard(key);
            let incoming = Troops { category: command.category, tier: command.tier, ..Default::default() };
            self.add_guard_troops(key, ref guard, incoming, command.amount, home, rules, timestamp, true);
            self.guards.save(key, guard);
        }
        fn recruit_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::troop_management::RecruitExplorer,
            rules: SliceRules,
            timestamp: u64,
        ) {
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut explorer = self.owned_explorer(key, actor);
            let home = self.owned_structure(game_id, explorer.owner, actor);
            assert!(
                crate::geometry::adjacent(explorer.coord, crate::structures::structure_coord(home.base)),
                "explorer not adjacent to home",
            );
            self
                .pay_troops(
                    game_id, explorer.owner, explorer.troops.category, explorer.troops.tier, command.amount, timestamp,
                );
            explorer.troops.count += command.amount;
            crate::troop_management::refill(ref explorer.troops, rules, timestamp);
            explorer
                .troops
                .stamina
                .revert_initial_amount(
                    rules.troop_stamina_config, timestamp / rules.tick_config.armies_tick_in_seconds,
                );
            crate::troop_management::assert_size(explorer.troops, home.base.level, rules);
            self
                .resources_dispatcher()
                .change_explorer_capacity(
                    ResourceKey { game_id, entity_id: command.explorer_id }, command.amount, true,
                );
            self.troops.update_troops(key, explorer.troops);
        }
        fn read_managed_army(
            self: @ContractState, game_id: u32, actor: ContractAddress, army: crate::troop_management::Army,
        ) -> ManagedArmy {
            match army {
                crate::troop_management::Army::Explorer(id) => {
                    let explorer = self.owned_explorer(ExplorerKey { game_id, explorer_id: id }, actor);
                    let home = self.owned_structure(game_id, explorer.owner, actor);
                    ManagedArmy {
                        troops: explorer.troops, home: explorer.owner, coord: explorer.coord, level: home.base.level,
                    }
                },
                crate::troop_management::Army::Guard(slot) => {
                    let home = self.owned_structure(game_id, slot.structure_id, actor);
                    assert!(slot.slot < home.base.troop_max_guard_count, "invalid guard slot");
                    let guard = self
                        .guards
                        .guard(crate::guards::GuardKey { game_id, structure_id: slot.structure_id, slot: slot.slot });
                    ManagedArmy {
                        troops: guard.troops,
                        home: slot.structure_id,
                        coord: crate::structures::structure_coord(home.base),
                        level: home.base.level,
                    }
                },
            }
        }
        fn transfer_troops(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::troop_management::TransferTroops,
            rules: SliceRules,
            timestamp: u64,
        ) {
            crate::troop_management::assert_amount(command.amount);
            let mut source = self.read_managed_army(game_id, actor, command.source);
            let mut target = self.read_managed_army(game_id, actor, command.target);
            assert!(crate::geometry::adjacent(source.coord, target.coord), "armies are not adjacent");
            assert!(command.amount <= source.troops.count, "insufficient source troops");
            let target_is_explorer = match command.target {
                crate::troop_management::Army::Explorer(_) => {
                    assert!(source.home == target.home, "armies must share a home");
                    assert!(target.troops.count != 0, "target explorer is dead");
                    true
                },
                crate::troop_management::Army::Guard(_) => {
                    assert!(
                        match command.source {
                            crate::troop_management::Army::Explorer(_) => true,
                            _ => false,
                        },
                        "guard to guard transfer is unsupported",
                    );
                    false
                },
            };
            if target.troops.count != 0 {
                crate::troop_management::assert_matching(source.troops, target.troops);
            }
            source.troops.count -= command.amount;
            crate::troop_management::merge_timers(ref source.troops, ref target.troops, rules, timestamp);
            self.apply_transfer_source(game_id, command.source, source.troops, command.amount, target_is_explorer);
            match command.target {
                crate::troop_management::Army::Explorer(id) => {
                    target.troops.count += command.amount;
                    crate::troop_management::assert_size(target.troops, target.level, rules);
                    self
                        .resources_dispatcher()
                        .change_explorer_capacity(ResourceKey { game_id, entity_id: id }, command.amount, true);
                    self.troops.update_troops(ExplorerKey { game_id, explorer_id: id }, target.troops);
                },
                crate::troop_management::Army::Guard(slot) => {
                    let key = crate::guards::GuardKey { game_id, structure_id: slot.structure_id, slot: slot.slot };
                    let mut guard = crate::guards::Guard { troops: target.troops, ..self.guards.guard(key) };
                    let home = self.owned_structure(game_id, slot.structure_id, actor);
                    self.add_guard_troops(key, ref guard, source.troops, command.amount, home, rules, timestamp, false);
                    self.guards.save(key, guard);
                },
            }
        }
        fn apply_transfer_source(
            ref self: ContractState,
            game_id: u32,
            source: crate::troop_management::Army,
            mut troops: Troops,
            amount: u128,
            check_weight: bool,
        ) {
            match source {
                crate::troop_management::Army::Explorer(id) => {
                    let key = ResourceKey { game_id, entity_id: id };
                    self.resources_dispatcher().change_explorer_capacity(key, amount, false);
                    if check_weight {
                        let weight = self.resources_dispatcher().resource_weight(key);
                        assert!(weight.weight <= weight.capacity, "source explorer would be overweight");
                    }
                    let explorer_key = ExplorerKey { game_id, explorer_id: id };
                    if troops.count == 0 {
                        self.destroy_explorer(explorer_key, self.troops.explorer(explorer_key).unwrap());
                    } else {
                        self.troops.update_troops(explorer_key, troops);
                    }
                },
                crate::troop_management::Army::Guard(slot) => {
                    let key = crate::guards::GuardKey { game_id, structure_id: slot.structure_id, slot: slot.slot };
                    if troops.count == 0 {
                        troops.stamina.reset();
                    }
                    self.guards.save(key, crate::guards::Guard { troops, ..self.guards.guard(key) });
                },
            }
        }
        fn add_guard_troops(
            self: @ContractState,
            key: crate::guards::GuardKey,
            ref guard: crate::guards::Guard,
            incoming: Troops,
            amount: u128,
            home: Structure,
            rules: SliceRules,
            timestamp: u64,
            reset_stamina: bool,
        ) {
            assert!(key.slot < home.base.troop_max_guard_count, "invalid guard slot");
            let empty = guard.troops.count == 0;
            let tick = timestamp / rules.tick_config.armies_tick_in_seconds;
            if empty {
                if guard.destroyed_tick != 0 {
                    let seconds: u64 = rules.troop_limit_config.guard_resurrection_delay.into();
                    let duration = rules.tick_config.armies_tick_in_seconds;
                    let delay = seconds / duration + if seconds % duration == 0 {
                        0
                    } else {
                        1
                    };
                    assert!(tick >= Into::<u32, u64>::into(guard.destroyed_tick) + delay, "guard resurrection delay");
                }
                guard.troops.category = incoming.category;
                guard.troops.tier = incoming.tier;
            } else {
                crate::troop_management::assert_matching(incoming, guard.troops);
            }
            crate::troop_management::refill(ref guard.troops, rules, timestamp);
            if empty {
                guard.troops.stamina.amount = 0;
            }
            if reset_stamina {
                guard.troops.stamina.revert_initial_amount(rules.troop_stamina_config, tick);
            }
            guard.troops.count += amount;
            crate::troop_management::assert_size(guard.troops, home.base.level, rules);
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
            let coord = neighbor(crate::structures::structure_coord(home.base), command.direction);
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
                .resources_dispatcher()
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
                if !destination.alt {
                    crate::relics::IRelicMapDispatcherTrait::discover_relic_chest(
                        crate::relics::IRelicMapDispatcher { contract_address: self.lifecycle.require_active().map },
                        game_id,
                        destination,
                        seed,
                        context.timestamp,
                    );
                }
                discovery = self
                    .map_dispatcher()
                    .discovery(
                        tile,
                        seed,
                        crate::hyperstructures::IHyperstructuresDispatcherTrait::hyperstructure_count(
                            crate::hyperstructures::IHyperstructuresDispatcher {
                                contract_address: self.lifecycle.require_active().economy,
                            },
                            game_id,
                        ),
                        context.timestamp,
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
                    tile_key(game_id, explorer.coord), command.explorer_id, super::explorer_occupier(explorer), false,
                );
            self.pay_movement(game_id, ref explorer, rules, biome, exploring, context.timestamp);
            self.troops.save(key, explorer);
            self.game_dispatcher().allocate_entity(game_id);
            if exploring {
                self.game_dispatcher().allocate_entity(game_id);
            }
            if !explorer.coord.alt {
                crate::exploration_rewards::IExtractionDispatcherTrait::extract_exploration_reward(
                    crate::exploration_rewards::IExtractionDispatcher {
                        contract_address: self.lifecycle.require_active().map,
                    },
                    game_id,
                    actor,
                    command.explorer_id,
                    ExecutionContext { raw_root, timestamp: context.timestamp },
                );
            }
        }
        fn battle(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::combat_actions::AttackExplorer,
            context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            crate::resources::assert_unique_resources(command.steal_resources);
            let attacker_key = ExplorerKey { game_id, explorer_id: command.attacker_id };
            let defender_key = ExplorerKey { game_id, explorer_id: command.defender_id };
            let mut attacker = self.owned_explorer(attacker_key, actor);
            let mut defender = self.troops.explorer(defender_key).expect('missing defender');
            let defender_owner = self.explorer_owner(defender_key, defender);
            assert!(defender_owner != actor, "actor owns defender");
            self.assert_battle_immunity(game_id, attacker.owner, rules, context.timestamp);
            self.assert_battle_immunity(game_id, defender.owner, rules, context.timestamp);
            assert!(attacker.troops.count > 0 && defender.troops.count > 0, "dead combatant");
            self.assert_battle_range(game_id, attacker, defender);
            let attacker_before = attacker.troops.count;
            let defender_before = defender.troops.count;
            let combat = self.combat_context(game_id, attacker, defender, context);
            let (attacker_after, defender_after) = ICombatDispatcher {
                contract_address: self.lifecycle.require_active().combat,
            }
                .resolve_battle(game_id, attacker.troops, defender.troops, combat);
            attacker.troops = attacker_after;
            defender.troops = defender_after;
            self.finish_battle(attacker_key, attacker, attacker_before);
            if defender.troops.count == 0 && attacker.troops.count != 0 {
                self
                    .take_loot(
                        game_id,
                        command.defender_id,
                        command.attacker_id,
                        command.steal_resources,
                        false,
                        context.timestamp,
                    );
            }
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
                        max_reward: command.steal_resources,
                        attacker: battle_side(actor, attacker_before, attacker.troops, combat.attacker_roll),
                        defender: battle_side(defender_owner, defender_before, defender.troops, combat.defender_roll),
                        timestamp: context.timestamp,
                    },
                );
            self.game_dispatcher().allocate_entity(game_id);
            self.game_dispatcher().allocate_entity(game_id);
        }
    }
    #[abi(embed_v0)]
    impl GuardCombat of crate::guards::IGuardCombat<ContractState> {
        fn battle_guard(
            ref self: ContractState, game_id: u32, actor: ContractAddress, command: Battle, context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            let key = ExplorerKey { game_id, explorer_id: command.attacker_id };
            let mut attacker = self.owned_explorer(key, actor);
            let target_key = ResourceKey { game_id, entity_id: command.defender_id };
            let target = self.structures_dispatcher().structure(target_key).expect('missing guarded structure');
            assert!(target.owner != actor, "actor owns defender");
            assert!(attacker.troops.count != 0, "aggressor has no troops");
            self.assert_battle_immunity(game_id, attacker.owner, rules, context.timestamp);
            self.assert_battle_immunity(game_id, command.defender_id, rules, context.timestamp);
            let destination = crate::structures::structure_coord(target.base);
            let stride: u128 = if destination.alt {
                15
            } else {
                1
            };
            let separation = distance(attacker.coord, destination);
            assert!(
                attacker.coord.alt == destination.alt
                    && separation > 0
                    && separation <= attacker.troops.attack_range().into()
                    * stride,
                "structure is out of range",
            );
            let adjacent = separation == stride;
            let slot = self.guards.next(target_key, target.base.troop_max_guard_count);
            let tick = context.timestamp / rules.tick_config.armies_tick_in_seconds;
            let mut guard: Troops = Default::default();
            let attacker_before = attacker.troops.count;
            let mut defender_before = 0;
            let mut rolls = (0_u8, 0_u8);
            if let Some(slot) = slot {
                guard = self.guards.guard(slot).troops;
                defender_before = guard.count;
                let before = attacker.troops.count;
                let defender = ExplorerTroops { owner: command.defender_id, coord: destination, troops: guard };
                let combat = CombatContext {
                    defender_is_structure_guard: true, ..self.combat_context(game_id, attacker, defender, context),
                };
                rolls = (combat.attacker_roll, combat.defender_roll);
                let (attacker_after, guard_after) = ICombatDispatcher {
                    contract_address: self.lifecycle.require_active().combat,
                }
                    .resolve_battle(game_id, attacker.troops, guard, combat);
                attacker.troops = attacker_after;
                guard = guard_after;
                self.finish_battle(key, attacker, before);
                let mut row = self.guards.guard(slot);
                if guard.count == 0 {
                    guard.stamina.reset();
                    row.destroyed_tick = tick.try_into().unwrap();
                }
                row.troops = guard;
                self.guards.save(slot, row);
            } else {
                assert!(adjacent, "structure claim requires adjacency");
                attacker
                    .troops
                    .stamina
                    .spend(
                        ref attacker.troops.boosts,
                        attacker.troops.category,
                        attacker.troops.tier,
                        rules.troop_stamina_config,
                        rules.troop_stamina_config.stamina_attack_req.into(),
                        tick,
                        true,
                    );
                self.troops.save(key, attacker);
            }
            self.try_capture(attacker, target_key, target, rules, context.timestamp);
            if slot.is_some() {
                let (attacker_roll, defender_roll) = rolls;
                let winner = if attacker.troops.count == 0 && guard.count != 0 {
                    command.defender_id
                } else if guard.count == 0 && attacker.troops.count != 0 {
                    attacker.owner
                } else {
                    0
                };
                self
                    .emit(
                        super::BattleEvent {
                            version: 1,
                            game_id,
                            attacker_id: command.attacker_id,
                            defender_id: command.defender_id,
                            attacker_owner: attacker.owner,
                            defender_owner: 0,
                            winner_id: winner,
                            coord: destination,
                            max_reward: array![].span(),
                            attacker: battle_side(actor, attacker_before, attacker.troops, attacker_roll),
                            defender: battle_side(target.owner, defender_before, guard, defender_roll),
                            timestamp: context.timestamp,
                        },
                    );
                self.game_dispatcher().allocate_entity(game_id);
                self.game_dispatcher().allocate_entity(game_id);
            }
        }
    }
    #[abi(embed_v0)]
    impl CombatActions of crate::combat_actions::ICombatActions<ContractState> {
        fn village_last_raided(self: @ContractState, key: ResourceKey) -> u64 {
            self.village_raids.read((key.game_id, key.entity_id))
        }
        fn guard_attack(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::combat_actions::GuardAttack,
            context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            let home = self.owned_structure(game_id, command.guard.structure_id, actor);
            assert!(command.guard.slot < home.base.troop_max_guard_count, "invalid guard slot");
            let guard_key = crate::guards::GuardKey {
                game_id, structure_id: command.guard.structure_id, slot: command.guard.slot,
            };
            let mut guard = self.guards.guard(guard_key);
            let defender_key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let mut defender = self.troops.explorer(defender_key).expect('missing defender');
            let defender_owner = self.explorer_owner(defender_key, defender);
            assert!(guard.troops.count != 0 && defender.troops.count != 0, "dead combatant");
            let coord = crate::structures::structure_coord(home.base);
            assert_structure_range(coord, defender.coord, guard.troops.attack_range());
            self.assert_battle_immunity(game_id, command.guard.structure_id, rules, context.timestamp);
            self.assert_battle_immunity(game_id, defender.owner, rules, context.timestamp);
            let attacker = ExplorerTroops { owner: command.guard.structure_id, coord, troops: guard.troops };
            let combat = CombatContext {
                attacker_is_structure_guard: true, ..self.combat_context(game_id, attacker, defender, context),
            };
            let (attacker_after, defender_after) = ICombatDispatcher {
                contract_address: self.lifecycle.require_active().combat,
            }
                .resolve_battle(game_id, guard.troops, defender.troops, combat);
            let before = defender.troops.count;
            defender.troops = defender_after;
            self.finish_battle(defender_key, defender, before);
            guard.troops = attacker_after;
            if guard.troops.count == 0 {
                guard.troops.stamina.reset();
                guard
                    .destroyed_tick = (context.timestamp / rules.tick_config.armies_tick_in_seconds)
                    .try_into()
                    .unwrap();
            }
            self.guards.save(guard_key, guard);
            self
                .try_capture(
                    defender,
                    ResourceKey { game_id, entity_id: command.guard.structure_id },
                    home,
                    rules,
                    context.timestamp,
                );
            self
                .emit(
                    super::BattleEvent {
                        version: 1,
                        game_id,
                        attacker_id: command.guard.structure_id,
                        defender_id: command.explorer_id,
                        attacker_owner: 0,
                        defender_owner: defender.owner,
                        winner_id: battle_winner(ExplorerTroops { troops: guard.troops, ..attacker }, defender),
                        coord: defender.coord,
                        max_reward: array![].span(),
                        attacker: battle_side(actor, attacker.troops.count, guard.troops, combat.attacker_roll),
                        defender: battle_side(defender_owner, before, defender.troops, combat.defender_roll),
                        timestamp: context.timestamp,
                    },
                );
            self.game_dispatcher().allocate_entity(game_id);
            self.game_dispatcher().allocate_entity(game_id);
        }
        fn raid(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::combat_actions::Raid,
            context: ExecutionContext,
        ) {
            let rules = self.authorize(game_id, context);
            assert!(!rules.blitz_mode_on, "no raid in blitz mode");
            crate::resources::assert_unique_resources(command.steal_resources);
            let key = ExplorerKey { game_id, explorer_id: command.explorer_id };
            let explorer = self.owned_explorer(key, actor);
            let target_key = ResourceKey { game_id, entity_id: command.structure_id };
            let target = self.structures_dispatcher().structure(target_key).expect('missing raid target');
            assert!(target.owner != actor, "actor owns defender");
            assert!(explorer.troops.count != 0, "aggressor has no troops");
            let destination = crate::structures::structure_coord(target.base);
            assert!(crate::geometry::adjacent(explorer.coord, destination), "raid requires adjacency");
            self.assert_battle_immunity(game_id, explorer.owner, rules, context.timestamp);
            self.assert_battle_immunity(game_id, command.structure_id, rules, context.timestamp);
            let result = self.resolve_raid(game_id, explorer, target_key, destination, context);
            let troops_before = explorer.troops.count;
            self.apply_raid_losses(key, explorer, target_key, result);
            let success = self.raid_success(game_id, result, context);
            if success {
                self.collect_raid_loot(game_id, command, target, rules, context.timestamp);
            }
            self
                .emit(
                    crate::combat_actions::RaidEvent {
                        version: 1,
                        game_id,
                        explorer_id: command.explorer_id,
                        structure_id: command.structure_id,
                        success,
                        player: actor,
                        target_owner: target.owner,
                        troops_before,
                        troops_after: result.explorer.count,
                        requested_loot: command.steal_resources,
                        timestamp: context.timestamp,
                    },
                );
        }
    }
    #[generate_trait]
    impl CombatActionsInternal of CombatActionsInternalTrait {
        fn apply_raid_losses(
            ref self: ContractState,
            key: ExplorerKey,
            explorer: ExplorerTroops,
            target: ResourceKey,
            result: crate::raid::RaidResolution,
        ) {
            if !result.guarded {
                return;
            }
            self.finish_battle(key, ExplorerTroops { troops: result.explorer, ..explorer }, explorer.troops.count);
            for index in 0_usize..4 {
                self
                    .guards
                    .save(
                        crate::guards::GuardKey {
                            game_id: key.game_id, structure_id: target.entity_id, slot: 3 - index.try_into().unwrap(),
                        },
                        *result.guards.at(index),
                    );
            }
        }
        fn explorer_owner(self: @ContractState, key: ExplorerKey, explorer: ExplorerTroops) -> ContractAddress {
            self
                .structures_dispatcher()
                .structure_owner(ResourceKey { game_id: key.game_id, entity_id: explorer.owner })
        }

        fn resolve_raid(
            self: @ContractState,
            game_id: u32,
            explorer: ExplorerTroops,
            target: ResourceKey,
            destination: Coord,
            context: ExecutionContext,
        ) -> crate::raid::RaidResolution {
            let mut guards = array![];
            // Resolve outer guards first, preserving damage and cooldown evaluation order.
            let mut slot = 4_u8;
            while slot != 0 {
                slot -= 1;
                guards
                    .append(
                        self.guards.guard(crate::guards::GuardKey { game_id, structure_id: target.entity_id, slot }),
                    );
            }
            let biome = self.map_dispatcher().biome(tile_key(game_id, destination)).into();
            ICombatDispatcher { contract_address: self.lifecycle.require_active().combat }
                .resolve_raid(game_id, explorer.troops, guards.span(), biome, context.timestamp)
        }
        fn raid_success(
            self: @ContractState, game_id: u32, result: crate::raid::RaidResolution, context: ExecutionContext,
        ) -> bool {
            let mut raw_root = context.raw_root;
            let seed = crate::random::game_root(ref raw_root, game_id, self.game_dispatcher().game(game_id).seed);
            crate::raid::success(result, seed, context.timestamp)
        }
        fn collect_raid_loot(
            ref self: ContractState,
            game_id: u32,
            command: crate::combat_actions::Raid,
            target: Structure,
            rules: SliceRules,
            timestamp: u64,
        ) {
            let village = target.base.category == 5;
            let tick = timestamp / rules.tick_config.armies_tick_in_seconds;
            if village {
                let last = self.village_raids.read((game_id, command.structure_id));
                if last != 0 && tick < last + rules.battle_config.village_raid_immunity_ticks.into() {
                    for resource in command.steal_resources {
                        assert!(
                            crate::resources::is_troop_resource(*resource.resource_type),
                            "village raid resource immunity",
                        );
                    }
                }
            }
            self
                .take_loot(
                    game_id, command.structure_id, command.explorer_id, command.steal_resources, true, timestamp,
                );
            if village {
                self.village_raids.write((game_id, command.structure_id), tick);
                self
                    .emit(
                        crate::events::RowSet {
                            version: 1,
                            model: 'VillageRaid',
                            keys: array![game_id.into(), command.structure_id.into()].span(),
                            values: array![tick.into()].span(),
                        },
                    );
            }
        }
        fn take_loot(
            ref self: ContractState,
            game_id: u32,
            from: u32,
            to: u32,
            resources: Span<crate::resources::ResourceAmount>,
            storable_only: bool,
            timestamp: u64,
        ) {
            let dispatcher = self.resources_dispatcher();
            let from = ResourceKey { game_id, entity_id: from };
            let to = ResourceKey { game_id, entity_id: to };
            for resource in resources {
                let mut amount = *resource.amount;
                if storable_only {
                    let weight = dispatcher.resource_weight(to);
                    let unit = dispatcher.resource_rule(game_id, *resource.resource_type).unit_weight;
                    if unit != 0 && weight.capacity != 0xffffffffffffffffffffffffffffffff {
                        amount =
                            core::cmp::min(
                                amount, (weight.capacity - core::cmp::min(weight.capacity, weight.weight)) / unit,
                            );
                    }
                }
                if amount != 0 {
                    dispatcher.spend_resource(from, *resource.resource_type, amount, timestamp);
                    dispatcher.grant_resource(to, *resource.resource_type, amount, timestamp);
                }
            }
        }
        fn try_capture(
            ref self: ContractState,
            explorer: ExplorerTroops,
            key: ResourceKey,
            target: Structure,
            rules: SliceRules,
            timestamp: u64,
        ) {
            if explorer.troops.count == 0 || (target.base.category == 5 && !rules.blitz_mode_on) {
                return;
            }
            if !crate::geometry::adjacent(explorer.coord, crate::structures::structure_coord(target.base))
                || self.guards.next(key, target.base.troop_max_guard_count).is_some() {
                return;
            }
            self.guards.reset(key);
            crate::guards::IStructureCaptureDispatcherTrait::capture_structure(
                crate::guards::IStructureCaptureDispatcher {
                    contract_address: self.lifecycle.require_active().structures,
                },
                key,
                explorer.owner,
                timestamp,
            );
        }
    }
    fn assert_structure_range(attacker: Coord, defender: Coord, range: u32) {
        let stride: u128 = if attacker.alt {
            15
        } else {
            1
        };
        let separation = distance(attacker, defender);
        assert!(
            attacker.alt == defender.alt && separation > 0 && separation <= range.into() * stride,
            "structure is out of range",
        );
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
                    tile_key(game_id, explorer.coord), command.explorer_id, super::explorer_occupier(explorer), false,
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
                .resources_dispatcher()
                .spend_spire_fee(ResourceKey { game_id, entity_id: explorer.owner }, context.timestamp);
            if (data / 0x20000000000) % 256 == 0 {
                self.map_dispatcher().reveal(destination_key, self.map_dispatcher().biome(destination_key));
            }
            self.map_dispatcher().vacate(tile_key(game_id, explorer.coord), command.explorer_id);
            self
                .map_dispatcher()
                .occupy(destination_key, command.explorer_id, super::explorer_occupier(explorer), false);
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
        fn resources_dispatcher(self: @ContractState) -> IResourcesDispatcher {
            IResourcesDispatcher { contract_address: self.lifecycle.require_active().resources }
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
        fn boost_explorer(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::relics::ApplyRelic,
            rule: crate::relics::RelicRule,
            rules: SliceRules,
            tick: u64,
        ) {
            let key = ExplorerKey { game_id, explorer_id: command.entity_id };
            let mut explorer = self.owned_explorer(key, actor);
            assert!(!explorer.coord.alt, "relic explorer must be on surface");
            explorer
                .troops
                .stamina
                .refill(
                    ref explorer.troops.boosts,
                    explorer.troops.category,
                    explorer.troops.tier,
                    rules.troop_stamina_config,
                    tick,
                );
            crate::relics::boost_explorer(ref explorer.troops.boosts, command.relic_id, rule, tick.try_into().unwrap());
            if command.relic_id == 45 || command.relic_id == 46 {
                crate::relics::IRelicMapDispatcherTrait::reveal_relic_ring(
                    crate::relics::IRelicMapDispatcher { contract_address: self.lifecycle.require_active().map },
                    game_id,
                    explorer.coord,
                    rule.uses,
                );
            }
            self.troops.save(key, explorer);
        }
        fn boost_guards(
            ref self: ContractState,
            game_id: u32,
            actor: ContractAddress,
            command: crate::relics::ApplyRelic,
            rule: crate::relics::RelicRule,
            rules: SliceRules,
            tick: u64,
        ) {
            self.owned_structure(game_id, command.entity_id, actor);
            assert!(command.relic_id == 49 || command.relic_id == 50, "invalid guard relic");
            for slot in 0_u8..4 {
                let key = crate::guards::GuardKey { game_id, structure_id: command.entity_id, slot };
                let mut guard = self.guards.guard(key);
                guard
                    .troops
                    .stamina
                    .refill(
                        ref guard.troops.boosts,
                        guard.troops.category,
                        guard.troops.tier,
                        rules.troop_stamina_config,
                        tick,
                    );
                guard.troops.boosts.decr_damage_gotten_percent_num = rule.rate_bps;
                guard.troops.boosts.decr_damage_gotten_end_tick = TryInto::<u64, u32>::try_into(tick).unwrap()
                    + rule.duration;
                self.guards.save(key, guard);
            }
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
                .resources_dispatcher()
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
            if home.base.category == 5 {
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
                .resources_dispatcher()
                .change_explorer_capacity(
                    ResourceKey { game_id: key.game_id, entity_id: key.explorer_id },
                    before - explorer.troops.count,
                    false,
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
fn explorer_occupier(explorer: ExplorerTroops) -> u8 {
    troop_occupier(explorer.troops)
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

fn discovery_guards(category: u8, seed: u256, rules: crate::rules::SliceRules, timestamp: u64) -> Span<Troops> {
    use crate::troops::{TroopTier, TroopType};
    let light_guard = category == 4 || category == crate::camps::CAMP_CATEGORY;
    let three_guards = category == 2 || category == 3;
    let count = if light_guard {
        1_u8
    } else if three_guards {
        3
    } else {
        4
    };
    let tier = if light_guard {
        TroopTier::T1
    } else {
        TroopTier::T2
    };
    let mut guards = array![];
    for slot in 0_u8..count {
        let category = if light_guard {
            TroopType::Crossbowman
        } else {
            match slot {
                1 => TroopType::Knight,
                2 => TroopType::Crossbowman,
                _ => TroopType::Paladin,
            }
        };
        let guard_seed = seed + if three_guards {
            Into::<u8, u256>::into(slot)
        } else {
            0
        };
        let troops = discovery_guard(category, tier, guard_seed, rules, timestamp);
        guards.append(troops);
    }
    guards.span()
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
