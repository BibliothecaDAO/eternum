pub use snforge_std::{
    EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_caller_address, stop_cheat_caller_address,
};
pub use crate::combat::TroopsTrait;
pub use crate::combat_actions::{AttackExplorer, GuardAttack, Raid};
pub use crate::commands::{Command, CreateExplorer};
pub use crate::guards::{Guard, GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
pub use crate::map::{IMapLogicDispatcher, IMapLogicDispatcherTrait};
pub use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceKey, ResourceSlot};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::structures::{IStructureOperationsDispatcher, StructureRecord};
pub use crate::tests::state::{
    CombatObservationTrait, GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait,
    TroopObservationTrait,
};
pub use crate::troops::{Coord, ExplorerKey, ExplorerTroops, Stamina, Troops};
pub use super::resource_commands::{assert_terminal_rejection, execute, grant, set_fixture};
pub fn setup(blitz: bool) -> (super::Deployment, ResourceKey, ResourceKey, u64, u64) {
    setup_with_immunity(blitz, 0)
}
pub fn setup_with_immunity(blitz: bool, immunity: u8) -> (super::Deployment, ResourceKey, ResourceKey, u64, u64) {
    setup_with_mode(blitz, immunity, 0)
}
pub fn setup_with_mode(
    blitz: bool, immunity: u8, extra_mode_rules: u32,
) -> (super::Deployment, ResourceKey, ResourceKey, u64, u64) {
    let mode_rules = extra_mode_rules
        + if blitz {
            super::play_fixture::BLITZ_RULES
        } else {
            super::play_fixture::ETERNUM_RULES
        };
    setup_with_rule_mask(blitz, immunity, mode_rules)
}
pub fn setup_with_rule_mask(
    blitz: bool, immunity: u8, mode_rules: u32,
) -> (super::Deployment, ResourceKey, ResourceKey, u64, u64) {
    setup_with_cooldown(blitz, immunity, mode_rules, 5, (100, 1))
}
pub fn setup_with_cooldown(
    blitz: bool, immunity: u8, mode_rules: u32, cooldown_seconds: u32, counts: (u128, u128),
) -> (super::Deployment, ResourceKey, ResourceKey, u64, u64) {
    let mut rules = super::play_fixture::rules();
    rules.mode_rules = mode_rules;
    rules
        .command_mask =
            if blitz {
                super::play_fixture::BLITZ_COMMAND_MASK
            } else {
                super::play_fixture::ETERNUM_COMMAND_MASK
            };
    rules.entry_rule = if blitz {
        crate::rules::ENTRY_ROSTER
    } else {
        crate::rules::ENTRY_ENTITLEMENT
    };
    rules.battle_config.regular_immunity_ticks = immunity;
    rules.battle_config.village_immunity_ticks = 0;
    rules.battle_config.village_raid_immunity_ticks = 3;
    rules.tick_config.armies_tick_in_seconds = 5;
    rules.battle_config.cooldown_seconds = cooldown_seconds;
    rules.troop_stamina_config.stamina_initial = 120;
    let (d, home, target) = super::resource_commands::setup_with_rules(rules);
    let mut ids = array![];
    let (attacker_count, defender_count) = counts;
    for (key, amount) in array![(home, attacker_count), (target, defender_count)] {
        grant(d, key, 26, amount * RESOURCE_PRECISION);
        assert!(
            execute(
                d,
                Command::CreateExplorer(
                    CreateExplorer {
                        structure_id: key.entity_id,
                        category: 0,
                        tier: 0,
                        amount: amount * RESOURCE_PRECISION,
                        direction: 0,
                    },
                ),
                80,
            ),
        );
        ids.append(*IStructureOperationsDispatcher { contract_address: d.games }.home_armies(key).at(0));
    }
    let attacker = *ids.at(0);
    let defender = *ids.at(1);
    move_fixture(d, attacker, 2000009);
    move_fixture(d, defender, 2000008);
    let original = IStructureOperationsDispatcher { contract_address: d.games }.structure(target).unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, target.entity_id.into()].span(),
        StructureRecord {
            owner: 999.try_into().unwrap(),
            base: original.base,
            resources_packed: original.resources_packed,
            metadata: original.metadata,
        },
    );
    (d, home, target, attacker, defender)
}
pub fn troop(d: super::Deployment, id: u64) -> Option<ExplorerTroops> {
    GameState { contract_address: d.games }.explorer(ExplorerKey { game_id: 3, explorer_id: id })
}
pub fn move_fixture(d: super::Deployment, id: u64, x: u32) {
    move_to(d, id, Coord { alt: false, x, y: 2000000 });
}
pub fn move_to(d: super::Deployment, id: u64, coord: Coord) {
    let mut explorer = troop(d, id).unwrap();
    let map = IMapLogicDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, d.games);
    map.vacate(crate::geometry::tile_key(3, explorer.coord), id);
    explorer.coord = coord;
    map.occupy(crate::geometry::tile_key(3, explorer.coord), id, 2, false);
    stop_cheat_caller_address(d.games);
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: id }, explorer,
    );
}
pub fn balance(d: super::Deployment, id: u64, resource_type: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_balance(ResourceSlot { game_id: 3, entity_id: id, resource_type })
}
pub fn resources(amount: u128) -> Span<ResourceAmount> {
    array![ResourceAmount { resource_type: 2, amount }].span()
}
pub fn raid(attacker: u64, target: ResourceKey, amounts: Span<ResourceAmount>) -> Command {
    Command::Raid(Raid { explorer_id: attacker, structure_id: target.entity_id, steal_resources: amounts })
}
pub fn set_guard(d: super::Deployment, key: ResourceKey, slot: u8, count: u128) {
    set_fixture(
        d.games,
        selector!("guards"),
        selector!("guards"),
        array![3, key.entity_id.into(), slot.into()].span(),
        Guard {
            troops: Troops {
                count: count * RESOURCE_PRECISION,
                stamina: Stamina { amount: 120, settled_at: 80, remainder: 0 }.into(),
                ..Default::default(),
            },
            destroyed_tick: 0,
        },
    );
}
pub fn guard(d: super::Deployment, key: ResourceKey, slot: u8) -> Guard {
    IGuardsDispatcher { contract_address: d.games }.guard(GuardKey { game_id: 3, structure_id: key.entity_id, slot })
}
pub fn limit_guards(d: super::Deployment, key: ResourceKey, maximum: u8) {
    let original = IStructureOperationsDispatcher { contract_address: d.games }.structure(key).unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, key.entity_id.into()].span(),
        StructureRecord {
            owner: original.owner,
            base: crate::structures::StructureBase { troop_max_guard_count: maximum, ..original.base },
            resources_packed: original.resources_packed,
            metadata: original.metadata,
        },
    );
}
