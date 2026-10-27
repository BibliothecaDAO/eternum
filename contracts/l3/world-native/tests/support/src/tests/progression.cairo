pub use starknet::storage::StorageMapWriteAccess;
pub use crate::progression::{
    ArmyProgress, ArmyProgressionRules, ProgressPacking, ScoutingKind, SkillPointUse, SpendSkillPoint,
};
pub use crate::resources::IResourceOperationsDispatcherTrait;
pub use crate::stamina::{StaminaSourceTrait, StaminaTrait};
pub use crate::tests::state::{ResourceObservationTrait, TroopObservationTrait};
pub fn rules() -> ArmyProgressionRules {
    ArmyProgressionRules {
        reveal_xp: 2, fixed_xp: 200, common_xp: 100, uncommon_xp: 250, rare_xp: 500, epic_xp: 900, legendary_xp: 1500,
    }
}
pub fn spend(choice: SkillPointUse) -> SpendSkillPoint {
    SpendSkillPoint { explorer_id: 7, choice }
}
pub fn scout(kind: ScoutingKind) -> SpendSkillPoint {
    SpendSkillPoint { explorer_id: 7, choice: SkillPointUse::Scouting(kind) }
}
pub fn read_progress(d: super::Deployment, key: crate::troops::ExplorerKey) -> ArmyProgress {
    snforge_std::interact_with_state(d.games, || crate::logic::progression::require(key))
}
pub fn write_progress(d: super::Deployment, key: crate::troops::ExplorerKey, progress: ArmyProgress) {
    snforge_std::interact_with_state(d.games, || crate::logic::progression::write(key, progress));
}
pub fn execute_spend(d: super::Deployment, key: crate::troops::ExplorerKey, choice: SkillPointUse) -> bool {
    super::resource_commands::execute_in_game(
        d,
        key.game_id,
        crate::commands::Command::SpendSkillPoint(SpendSkillPoint { explorer_id: key.explorer_id, choice }),
        360,
    )
}
pub fn bar(d: super::Deployment, key: crate::troops::ExplorerKey, game_id: u32) -> u64 {
    snforge_std::interact_with_state(
        d.games,
        || {
            let context = crate::commands::load_context(game_id, 123, 360);
            crate::logic::troops::active_explorer(key, 360, context).troops.stamina.inline().amount
        },
    )
}
pub /// Sets the slot army's bar to `amount` at the current second, through the troop write every action uses.
 fn set_bar(d: super::Deployment, key: crate::troops::ExplorerKey, amount: u64, timestamp: u64) {
    snforge_std::interact_with_state(
        d.games,
        || {
            let mut troops = crate::logic::troops::explorer(key).unwrap().troops;
            troops
                .stamina = crate::troops::Stamina { amount, settled_at: timestamp.try_into().unwrap(), remainder: 0 }
                .into();
            crate::logic::troops::TroopState::update_troops(key, troops);
        },
    );
}
pub /// The damage a slot army resolved at `battle` deals to a fixed defender, as Combat computes it.
fn damage_at_battle(
    d: super::Deployment, key: crate::troops::ExplorerKey, battle: u8, rules: crate::rules::SliceRules,
) -> u128 {
    snforge_std::interact_with_state(
        d.games, || crate::logic::progression::write(key, ArmyProgress { battle, ..crate::progression::initial() }),
    );
    let attacker = super::state::GameState { contract_address: d.games }.resolved_explorer(key).unwrap().troops;
    let stamina: crate::troops::StaminaSource = crate::troops::Stamina { amount: 150, settled_at: 360, remainder: 0 }
        .into();
    let mut attacker = crate::troops::Troops { count: 1000 * crate::rules::RESOURCE_PRECISION, stamina, ..attacker };
    let mut defender = crate::troops::Troops {
        count: 1_000_000 * crate::rules::RESOURCE_PRECISION,
        battle_cooldown_end: 0,
        boosts: Default::default(),
        ..attacker,
    };
    let context = crate::combat::CombatContext {
        timestamp: 360,
        attacker_roll: 0,
        defender_roll: 0,
        attacker_biome: crate::biome::Biome::Grassland,
        defender_biome: crate::biome::Biome::Grassland,
        attack_distance: 1,
        attacker_is_structure_guard: false,
        defender_is_structure_guard: false,
    };
    let (dealt, _, _, _) = crate::combat::TroopsTrait::damage_with_context(
        ref attacker,
        ref defender,
        context,
        rules.troop_stamina_config,
        rules.troop_damage_config,
        rules.tick_config.armies_tick_in_seconds,
        0,
    );
    dealt
}
pub fn deploy(d: super::Deployment, game_id: u32, category: u8, direction: u8) -> crate::troops::ExplorerKey {
    let home = crate::resources::ResourceKey { game_id, entity_id: 1 };
    let command = crate::commands::Command::CreateExplorer(
        crate::commands::CreateExplorer {
            slot: direction,
            structure_id: 1,
            category,
            tier: 0,
            amount: 3 * crate::rules::RESOURCE_PRECISION,
            direction,
        },
    );
    assert!(super::resource_commands::execute_in_game(d, game_id, command, 351));
    let armies = crate::tests::state::StructureObservationTrait::home_armies(
        crate::structures::IStructureOperationsDispatcher { contract_address: d.games }, home,
    );
    crate::troops::ExplorerKey { game_id, explorer_id: *armies.at(armies.len() - 1) }
}
