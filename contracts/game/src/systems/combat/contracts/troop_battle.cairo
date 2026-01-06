use crate::alias::ID;
use crate::models::position::Direction;
use crate::models::troop::GuardSlot;


#[starknet::interface]
pub trait ITroopBattleSystems<T> {
    fn attack_explorer_vs_explorer(
        ref self: T,
        aggressor_id: ID,
        defender_id: ID,
        defender_direction: Direction,
        steal_resources: Span<(u8, u128)>,
    );
    fn attack_explorer_vs_guard(ref self: T, explorer_id: ID, structure_id: ID, structure_direction: Direction);
    fn attack_guard_vs_explorer(
        ref self: T, structure_id: ID, structure_guard_slot: GuardSlot, explorer_id: ID, explorer_direction: Direction,
    );
}


#[dojo::contract]
pub mod troop_battle_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use crate::alias::ID;
    use crate::constants::{DAYDREAMS_AGENT_ID, DEFAULT_NS};
    use crate::models::config::{
        BattleConfig, CombatConfigImpl, SeasonConfig, SeasonConfigImpl, TickImpl, TroopDamageConfig, TroopStaminaConfig,
        WorldConfigUtilImpl,
    };
    use crate::models::events::{BattleStory, BattleType, BattleStructureType, Story, StoryEvent};
    use crate::models::owner::OwnerAddressTrait;
    use crate::models::position::{CoordTrait, Direction};
    use crate::models::resource::resource::{ResourceWeightImpl, SingleResourceStoreImpl, WeightStoreImpl};
    use crate::models::stamina::StaminaImpl;
    use crate::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl,
        StructureTroopExplorerStoreImpl, StructureTroopGuardStoreImpl,
    };
    use crate::models::troop::{ExplorerTroops, GuardImpl, GuardSlot, GuardTroops, Troops, TroopsImpl};
    use crate::models::weight::Weight;
    use crate::systems::utils::resource::iResourceTransferImpl;
    use crate::systems::utils::structure::iStructureImpl;
    use crate::systems::utils::troop::{iExplorerImpl, iGuardImpl, iTroopImpl};
    use crate::utils::achievements::index::{AchievementTrait, Tasks};
    use crate::utils::map::biomes::Biome;
    use crate::utils::random::VRFImpl;
    use crate::system_libraries::biome_library::{IBiomeLibraryDispatcherTrait, biome_library};
    use crate::system_libraries::combat_library::{ICombatLibraryDispatcherTrait, combat_library};
    use super::super::super::super::super::models::troop::GuardTrait;


    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct BattleEvent {
        #[key]
        attacker_id: ID,
        #[key]
        defender_id: ID,
        #[key]
        attacker_owner: ID,
        #[key]
        defender_owner: ID,
        winner_id: ID,
        max_reward: Span<(u8, u128)>,
        timestamp: u64,
    }


    #[abi(embed_v0)]
    pub impl TroopBattleSystemsImpl of super::ITroopBattleSystems<ContractState> {
        fn attack_explorer_vs_explorer(
            ref self: ContractState,
            aggressor_id: ID,
            defender_id: ID,
            defender_direction: Direction,
            steal_resources: Span<(u8, u128)>,
        ) {
            let mut world = self.world(DEFAULT_NS());

            // ensure season is open
            let season_config: SeasonConfig = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            // ensure caller owns aggressor
            let mut explorer_aggressor: ExplorerTroops = world.read_model(aggressor_id);
            explorer_aggressor.assert_caller_structure_or_agent_owner(ref world);

            // ensure caller does not own defender
            let mut explorer_defender: ExplorerTroops = world.read_model(defender_id);
            explorer_defender.assert_caller_not_structure_or_agent_owner(ref world);

            // capture owner addresses before battle
            let explorer_aggressor_owner_address: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, explorer_aggressor.owner,
            );
            let explorer_defender_owner_address: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, explorer_defender.owner,
            );

            // ensure attacker is not cloaked
            let battle_config: BattleConfig = WorldConfigUtilImpl::get_member(world, selector!("battle_config"));
            let tick = TickImpl::get_tick_interval(ref world);
            if !explorer_aggressor.is_daydreams_agent() {
                let mut explorer_aggressor_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                    ref world, explorer_aggressor.owner,
                );
                explorer_aggressor_structure.assert_not_cloaked(battle_config, tick, season_config);
            }

            // ensure defender is not cloaked
            if !explorer_defender.is_daydreams_agent() {
                let mut explorer_defender_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                    ref world, explorer_defender.owner,
                );
                explorer_defender_structure.assert_not_cloaked(battle_config, tick, season_config);
            }

            // ensure aggressor has troops
            assert!(explorer_aggressor.troops.count.is_non_zero(), "aggressor has no troops");

            // ensure defender has troops
            let mut explorer_defender: ExplorerTroops = world.read_model(defender_id);
            assert!(explorer_defender.troops.count.is_non_zero(), "defender has no troops");

            // ensure both explorers are adjacent to each other
            assert!(
                explorer_defender.coord == explorer_aggressor.coord.neighbor(defender_direction),
                "explorers are not adjacent",
            );

            // aggressor attacks defender
            let troop_damage_config: TroopDamageConfig = CombatConfigImpl::troop_damage_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            let mut explorer_aggressor_troops: Troops = explorer_aggressor.troops;
            let mut explorer_defender_troops: Troops = explorer_defender.troops;
            let biome_library = biome_library::get_dispatcher(@world);
            let defender_biome: Biome = biome_library
                .get_biome(explorer_defender.coord.alt, explorer_defender.coord.x.into(), explorer_defender.coord.y.into());
            let explorer_aggressor_troop_count_before_attack = explorer_aggressor_troops.count;
            let explorer_defender_troop_count_before_attack = explorer_defender_troops.count;

            let combat_library = combat_library::get_dispatcher(@world);
            let (updated_aggressor, updated_defender) = combat_library
                .troops_attack(
                    explorer_aggressor_troops,
                    explorer_defender_troops,
                    defender_biome,
                    troop_stamina_config,
                    troop_damage_config,
                    tick.current(),
                    tick.interval(),
                );
            explorer_aggressor_troops = updated_aggressor;
            explorer_defender_troops = updated_defender;

            // update both explorers
            explorer_aggressor.troops = explorer_aggressor_troops;
            explorer_defender.troops = explorer_defender_troops;

            // update aggressor troop capacity
            iExplorerImpl::update_capacity(
                ref world,
                aggressor_id,
                explorer_aggressor_troop_count_before_attack - explorer_aggressor.troops.count,
                false,
            );

            // update defender troop capacity
            iExplorerImpl::update_capacity(
                ref world,
                defender_id,
                explorer_defender_troop_count_before_attack - explorer_defender.troops.count,
                false,
            );

            // save or delete explore
            if explorer_aggressor_troops.count.is_zero() {
                if explorer_aggressor.owner == DAYDREAMS_AGENT_ID {
                    iExplorerImpl::explorer_from_agent_delete(ref world, ref explorer_aggressor);

                    // grant kill agent achievement
                    if explorer_defender_owner_address.is_non_zero() {
                        // zero addr check ensures it isnt agent on agent crime
                        AchievementTrait::progress(
                            world,
                            explorer_defender_owner_address.into(),
                            Tasks::KILL_AGENT,
                            1,
                            starknet::get_block_timestamp(),
                        );
                    }
                } else {
                    let mut explorer_aggressor_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                        ref world, explorer_aggressor.owner,
                    );
                    let mut explorer_aggressor_structure_explorers_list: Array<ID> =
                        StructureTroopExplorerStoreImpl::retrieve(
                        ref world, explorer_aggressor.owner,
                    )
                        .into();
                    iExplorerImpl::explorer_from_structure_delete(
                        ref world,
                        ref explorer_aggressor,
                        explorer_aggressor_structure_explorers_list,
                        ref explorer_aggressor_owner_structure,
                        explorer_aggressor.owner,
                    );
                }
            } else {
                world.write_model(@explorer_aggressor);
            }

            if explorer_defender_troops.count.is_zero() {
                // steal resources from defender if dead
                let mut explorer_aggressor_weight: Weight = WeightStoreImpl::retrieve(ref world, aggressor_id);
                let mut explorer_defender_weight: Weight = WeightStoreImpl::retrieve(ref world, defender_id);
                iResourceTransferImpl::troop_to_troop_instant(
                    ref world,
                    explorer_defender,
                    ref explorer_defender_weight,
                    explorer_aggressor,
                    ref explorer_aggressor_weight,
                    steal_resources,
                );
                explorer_aggressor_weight.store(ref world, aggressor_id);
                explorer_defender_weight.store(ref world, defender_id);

                // delete defender
                if explorer_defender.owner == DAYDREAMS_AGENT_ID {
                    iExplorerImpl::explorer_from_agent_delete(ref world, ref explorer_defender);

                    // grant kill agent achievement
                    if explorer_aggressor_owner_address.is_non_zero() {
                        // zero addr check ensures it isnt agent on agent crime
                        AchievementTrait::progress(
                            world,
                            explorer_aggressor_owner_address.into(),
                            Tasks::KILL_AGENT,
                            1,
                            starknet::get_block_timestamp(),
                        );
                    }
                } else {
                    let mut explorer_defender_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                        ref world, explorer_defender.owner,
                    );
                    let mut explorer_defender_structure_explorers_list: Array<ID> =
                        StructureTroopExplorerStoreImpl::retrieve(
                        ref world, explorer_defender.owner,
                    )
                        .into();
                    iExplorerImpl::explorer_from_structure_delete(
                        ref world,
                        ref explorer_defender,
                        explorer_defender_structure_explorers_list,
                        ref explorer_defender_owner_structure,
                        explorer_defender.owner,
                    );
                }
            } else {
                world.write_model(@explorer_defender);
            }

            // you only win if you kill the other AND survive
            let mut winner_owner_structure_id: ID = Zero::zero();
            let mut winner_owner_structure_address: starknet::ContractAddress = Zero::zero();
            if explorer_aggressor_troops.count.is_zero() && explorer_defender_troops.count.is_non_zero() {
                winner_owner_structure_id = explorer_defender.owner;
                winner_owner_structure_address = explorer_defender_owner_address;
            }
            if explorer_defender_troops.count.is_zero() && explorer_aggressor_troops.count.is_non_zero() {
                winner_owner_structure_id = explorer_aggressor.owner;
                winner_owner_structure_address = explorer_aggressor_owner_address;
            }

            // grant achievement
            if winner_owner_structure_address.is_non_zero() {
                AchievementTrait::progress(
                    world, winner_owner_structure_address.into(), Tasks::WIN_BATTLE, 1, starknet::get_block_timestamp(),
                );
            }

            // emit event
            world
                .emit_event(
                    @BattleEvent {
                        attacker_id: explorer_aggressor.explorer_id,
                        defender_id: explorer_defender.explorer_id,
                        attacker_owner: explorer_aggressor.owner,
                        defender_owner: explorer_defender.owner,
                        winner_id: winner_owner_structure_id,
                        max_reward: steal_resources,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            // emit story events
            let battle_story = BattleStory {
                battle_type: BattleType::ExplorerVsExplorer,
                attacker_id: explorer_aggressor.explorer_id,
                attacker_structure: BattleStructureType {
                    structure_category: StructureCategory::None.into(),
                    structure_taken: false,
                },
                attacker_owner_id: explorer_aggressor.owner,
                attacker_owner_address: explorer_aggressor_owner_address,
                attacker_troops_type: explorer_aggressor.troops.category,
                attacker_troops_tier: explorer_aggressor.troops.tier,
                attacker_troops_before: explorer_aggressor_troop_count_before_attack,
                attacker_troops_lost: explorer_aggressor_troop_count_before_attack - explorer_aggressor_troops.count,
                defender_id: explorer_defender.explorer_id,
                defender_structure: BattleStructureType {
                    structure_category: StructureCategory::None.into(),
                    structure_taken: false,
                },
                defender_owner_id: explorer_defender.owner,
                defender_owner_address: explorer_defender_owner_address,
                defender_troops_type: explorer_defender.troops.category,
                defender_troops_tier: explorer_defender.troops.tier,
                defender_troops_before: explorer_defender_troop_count_before_attack,
                defender_troops_lost: explorer_defender_troop_count_before_attack - explorer_defender_troops.count,
                winner_id: winner_owner_structure_id,
                stolen_resources: steal_resources,
            };

            // Emit from attacker perspective
            world
                .emit_event(
                    @StoryEvent {
                        owner: Option::Some(explorer_aggressor_owner_address),
                        entity_id: Option::Some(explorer_aggressor.explorer_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::BattleStory(battle_story),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            // Emit from defender perspective
            world
                .emit_event(
                    @StoryEvent {
                        owner: Option::Some(explorer_defender_owner_address),
                        entity_id: Option::Some(explorer_defender.explorer_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::BattleStory(battle_story),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }


        fn attack_explorer_vs_guard(
            ref self: ContractState, explorer_id: ID, structure_id: ID, structure_direction: Direction,
        ) {
            let mut world = self.world(DEFAULT_NS());

            // ensure season is open
            let season_config: SeasonConfig = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            // ensure caller owns aggressor
            let mut explorer_aggressor: ExplorerTroops = world.read_model(explorer_id);
            explorer_aggressor.assert_caller_structure_or_agent_owner(ref world);

            // ensure caller does not own defender
            let mut guarded_structure_owner: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, structure_id,
            );
            guarded_structure_owner.assert_caller_not_owner();

            // capture owner address before battle
            let explorer_aggressor_owner_address: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, explorer_aggressor.owner,
            );

            // ensure aggressor has troops
            assert!(explorer_aggressor.troops.count.is_non_zero(), "aggressor has no troops");

            let mut structure_claimed_after_battle: bool = false;

            // ensure structure id is for a structure
            let mut guarded_structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            assert!(guarded_structure.category != StructureCategory::None.into(), "defender is not a structure");

            // ensure attacker is not cloaked
            let battle_config: BattleConfig = WorldConfigUtilImpl::get_member(world, selector!("battle_config"));
            let tick = TickImpl::get_tick_interval(ref world);
            if !explorer_aggressor.is_daydreams_agent() {
                let mut explorer_aggressor_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                    ref world, explorer_aggressor.owner,
                );
                explorer_aggressor_structure.assert_not_cloaked(battle_config, tick, season_config);
            }

            // ensure defender is not cloaked
            guarded_structure.assert_not_cloaked(battle_config, tick, season_config);

            // get guard troops
            let mut guard_defender: GuardTroops = StructureTroopGuardStoreImpl::retrieve(ref world, structure_id);
            let guard_slot: Option<GuardSlot> = guard_defender
                .next_attack_slot(guarded_structure.troop_max_guard_count.into());

            // claim structure if there are no guard troops. it is tried again after the attack
            if guard_slot.is_none() {
                // claim structure
                structure_claimed_after_battle = true;
                iStructureImpl::battle_claim(
                    ref world, ref guard_defender, ref guarded_structure, ref explorer_aggressor, structure_id,
                );
                return;
            }

            // get guard troops
            let guard_slot: GuardSlot = guard_slot.unwrap();
            let (mut guard_troops, mut guard_destroyed_tick): (Troops, u32) = guard_defender.from_slot(guard_slot);
            assert!(guard_troops.count.is_non_zero(), "defender has no troops");

            // ensure explorer is adjacent to structure
            assert!(
                explorer_aggressor.coord.neighbor(structure_direction) == guarded_structure.coord(),
                "explorer is not adjacent to structure",
            );

            // aggressor attacks defender
            let mut explorer_aggressor_troops: Troops = explorer_aggressor.troops;
            let biome_library = biome_library::get_dispatcher(@world);
            let defender_biome: Biome = biome_library
                .get_biome(guarded_structure.coord().alt, guarded_structure.coord().x.into(), guarded_structure.coord().y.into());
            let troop_damage_config: TroopDamageConfig = CombatConfigImpl::troop_damage_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            let tick = TickImpl::get_tick_interval(ref world);
            let explorer_aggressor_troop_count_before_attack = explorer_aggressor_troops.count;
            let guard_troop_count_before_attack = guard_troops.count;

            let combat_library = combat_library::get_dispatcher(@world);
            let (updated_aggressor, updated_guard) = combat_library
                .troops_attack(
                    explorer_aggressor_troops,
                    guard_troops,
                    defender_biome,
                    troop_stamina_config,
                    troop_damage_config,
                    tick.current(),
                    tick.interval(),
                );
            explorer_aggressor_troops = updated_aggressor;
            guard_troops = updated_guard;
            // update explorer
            explorer_aggressor.troops = explorer_aggressor_troops;

            // update explorer troop capacity
            iExplorerImpl::update_capacity(
                ref world,
                explorer_id,
                explorer_aggressor_troop_count_before_attack - explorer_aggressor.troops.count,
                false,
            );

            if explorer_aggressor_troops.count.is_zero() {
                if explorer_aggressor.owner == DAYDREAMS_AGENT_ID {
                    iExplorerImpl::explorer_from_agent_delete(ref world, ref explorer_aggressor);

                    // grant kill agent achievement
                    AchievementTrait::progress(
                        world, guarded_structure_owner.into(), Tasks::KILL_AGENT, 1, starknet::get_block_timestamp(),
                    );
                } else {
                    let mut explorer_aggressor_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                        ref world, explorer_aggressor.owner,
                    );
                    let mut explorer_aggressor_structure_explorers_list: Array<ID> =
                        StructureTroopExplorerStoreImpl::retrieve(
                        ref world, explorer_aggressor.owner,
                    )
                        .into();
                    iExplorerImpl::explorer_from_structure_delete(
                        ref world,
                        ref explorer_aggressor,
                        explorer_aggressor_structure_explorers_list,
                        ref explorer_aggressor_owner_structure,
                        explorer_aggressor.owner,
                    );
                }
            } else {
                world.write_model(@explorer_aggressor);
            }

            // update structure guard
            if guard_troops.count.is_zero() {
                // delete guard
                iGuardImpl::delete(
                    ref world,
                    structure_id,
                    ref guarded_structure,
                    ref guard_defender,
                    ref guard_troops,
                    tick.current().try_into().unwrap(),
                    guard_slot,
                    tick.current(),
                );

                // try again to claim structure if there are no guard troops after the attack
                // and explorer is alive
                if explorer_aggressor.troops.count.is_non_zero() {
                    let guard_slot: Option<GuardSlot> = guard_defender
                        .next_attack_slot(guarded_structure.troop_max_guard_count.into());
                    if guard_slot.is_none() {
                        // claim structure
                        structure_claimed_after_battle = true;
                        iStructureImpl::battle_claim(
                            ref world, ref guard_defender, ref guarded_structure, ref explorer_aggressor, structure_id,
                        );
                    }
                }
            } else {
                // update structure guard
                guard_defender.to_slot(guard_slot, guard_troops, guard_destroyed_tick.into());
                StructureTroopGuardStoreImpl::store(ref guard_defender, ref world, structure_id);
            }

            // you only win if you kill the other AND survive
            let mut winner_owner_structure_id: ID = Zero::zero();
            let mut winner_owner_structure_address: starknet::ContractAddress = Zero::zero();
            if explorer_aggressor_troops.count.is_zero() && guard_troops.count.is_non_zero() {
                winner_owner_structure_id = structure_id;
                winner_owner_structure_address = guarded_structure_owner;
            }
            if guard_troops.count.is_zero() && explorer_aggressor_troops.count.is_non_zero() {
                winner_owner_structure_id = explorer_aggressor.owner;
                winner_owner_structure_address = explorer_aggressor_owner_address;
            }
            // grant battle winner achievement
            if winner_owner_structure_address.is_non_zero() {
                AchievementTrait::progress(
                    world, winner_owner_structure_address.into(), Tasks::WIN_BATTLE, 1, starknet::get_block_timestamp(),
                );
            }

            // grant fortress achievement
            if guard_troops.count.is_non_zero() {
                AchievementTrait::progress(
                    world, guarded_structure_owner.into(), Tasks::DEFEND_STRUCTURE, 1, starknet::get_block_timestamp(),
                );
            }

            // emit event
            world
                .emit_event(
                    @BattleEvent {
                        attacker_id: explorer_id,
                        defender_id: structure_id,
                        attacker_owner: explorer_aggressor.owner,
                        defender_owner: 0,
                        winner_id: winner_owner_structure_id,
                        max_reward: array![].span(),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            // emit story events
            let battle_story = BattleStory {
                battle_type: BattleType::ExplorerVsGuard,
                attacker_id: explorer_id,
                attacker_structure: BattleStructureType {
                    structure_category: StructureCategory::None.into(),
                    structure_taken: false,
                },
                attacker_owner_id: explorer_aggressor.owner,
                attacker_owner_address: explorer_aggressor_owner_address,
                attacker_troops_type: explorer_aggressor.troops.category,
                attacker_troops_tier: explorer_aggressor.troops.tier,
                attacker_troops_before: explorer_aggressor_troop_count_before_attack,
                attacker_troops_lost: explorer_aggressor_troop_count_before_attack - explorer_aggressor_troops.count,
                defender_id: structure_id,
                defender_structure: BattleStructureType {
                    structure_category: guarded_structure.category.into(),
                    structure_taken: structure_claimed_after_battle,
                },
                defender_owner_id: structure_id,
                defender_owner_address: guarded_structure_owner,
                defender_troops_type: guard_troops.category,
                defender_troops_tier: guard_troops.tier,
                defender_troops_before: guard_troop_count_before_attack,
                defender_troops_lost: guard_troop_count_before_attack - guard_troops.count,
                winner_id: winner_owner_structure_id,
                stolen_resources: array![].span(),
            };

            // Emit from attacker perspective
            world
                .emit_event(
                    @StoryEvent {
                        owner: Option::Some(explorer_aggressor_owner_address),
                        entity_id: Option::Some(explorer_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::BattleStory(battle_story),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            // Emit from defender perspective
            world
                .emit_event(
                    @StoryEvent {
                        owner: Option::Some(guarded_structure_owner),
                        entity_id: Option::Some(structure_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::BattleStory(battle_story),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }


        fn attack_guard_vs_explorer(
            ref self: ContractState,
            structure_id: ID,
            structure_guard_slot: GuardSlot,
            explorer_id: ID,
            explorer_direction: Direction,
        ) {
            let mut world = self.world(DEFAULT_NS());
            // ensure season is open
            let season_config: SeasonConfig = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            // ensure caller structure owns aggressor
            let structure_aggressor_owner: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, structure_id,
            );
            structure_aggressor_owner.assert_caller_owner();

            // ensure caller does not own defender
            let mut explorer_defender: ExplorerTroops = world.read_model(explorer_id);
            // let explorer_defender_owner: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
            //     ref world, explorer_defender.owner,
            // );
            // explorer_defender_owner.assert_caller_not_owner();

            // capture owner address before battle
            let explorer_defender_owner_address: starknet::ContractAddress = StructureOwnerStoreImpl::retrieve(
                ref world, explorer_defender.owner,
            );

            // ensure explorer has troops
            assert!(explorer_defender.troops.count.is_non_zero(), "defender has no troops");

            let mut structure_claimed_after_battle: bool = false;

            // ensure structure is allowed to use guard slot
            let mut structure_guards_aggressor: GuardTroops = StructureTroopGuardStoreImpl::retrieve(
                ref world, structure_id,
            );
            let mut structure_aggressor_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            structure_guards_aggressor
                .assert_functional_slot(structure_guard_slot, structure_aggressor_base.troop_max_guard_count.into());

            // ensure guard slot is not dead
            let (mut structure_guard_aggressor_troops, mut structure_guard_destroyed_tick): (Troops, u32) =
                structure_guards_aggressor
                .from_slot(structure_guard_slot);
            assert!(structure_guard_aggressor_troops.count.is_non_zero(), "guard slot is dead");

            // ensure attacker is not cloaked
            let battle_config: BattleConfig = WorldConfigUtilImpl::get_member(world, selector!("battle_config"));
            let tick = TickImpl::get_tick_interval(ref world);
            structure_aggressor_base.assert_not_cloaked(battle_config, tick, season_config);

            // ensure defender is not cloaked
            if !explorer_defender.is_daydreams_agent() {
                let mut explorer_defender_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                    ref world, explorer_defender.owner,
                );
                explorer_defender_structure.assert_not_cloaked(battle_config, tick, season_config);
            }

            // ensure structure is adjacent to explorer
            assert!(
                explorer_defender.coord == structure_aggressor_base.coord().neighbor(explorer_direction),
                "structure is not adjacent to explorer",
            );

            // aggressor attacks defender
            let biome_library = biome_library::get_dispatcher(@world);
            let defender_biome: Biome = biome_library
                .get_biome(explorer_defender.coord.alt, explorer_defender.coord.x.into(), explorer_defender.coord.y.into());
            let troop_damage_config: TroopDamageConfig = CombatConfigImpl::troop_damage_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            let mut explorer_defender_troops = explorer_defender.troops;
            let explorer_defender_troop_count_before_attack = explorer_defender_troops.count;
            let structure_guard_aggressor_troop_count_before_attack = structure_guard_aggressor_troops.count;

            let combat_library = combat_library::get_dispatcher(@world);
            let (updated_guard, updated_explorer) = combat_library
                .troops_attack(
                    structure_guard_aggressor_troops,
                    explorer_defender_troops,
                    defender_biome,
                    troop_stamina_config,
                    troop_damage_config,
                    tick.current(),
                    tick.interval(),
                );
            structure_guard_aggressor_troops = updated_guard;
            explorer_defender_troops = updated_explorer;

            // update explorer
            explorer_defender.troops = explorer_defender_troops;

            // update explorer troop capacity
            iExplorerImpl::update_capacity(
                ref world,
                explorer_id,
                explorer_defender_troop_count_before_attack - explorer_defender.troops.count,
                false,
            );

            if explorer_defender.troops.count.is_zero() {
                if explorer_defender.owner == DAYDREAMS_AGENT_ID {
                    iExplorerImpl::explorer_from_agent_delete(ref world, ref explorer_defender);

                    // grant kill agent achievement
                    AchievementTrait::progress(
                        world, structure_aggressor_owner.into(), Tasks::KILL_AGENT, 1, starknet::get_block_timestamp(),
                    );
                } else {
                    let mut explorer_defender_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                        ref world, explorer_defender.owner,
                    );
                    let mut explorer_defender_structure_explorers_list: Array<ID> =
                        StructureTroopExplorerStoreImpl::retrieve(
                        ref world, explorer_defender.owner,
                    )
                        .into();
                    iExplorerImpl::explorer_from_structure_delete(
                        ref world,
                        ref explorer_defender,
                        explorer_defender_structure_explorers_list,
                        ref explorer_defender_owner_structure,
                        explorer_defender.owner,
                    );
                }
            } else {
                world.write_model(@explorer_defender);
            }

            // update structure guard
            if structure_guard_aggressor_troops.count.is_zero() {
                // delete guard
                iGuardImpl::delete(
                    ref world,
                    structure_id,
                    ref structure_aggressor_base,
                    ref structure_guards_aggressor,
                    ref structure_guard_aggressor_troops,
                    tick.current().try_into().unwrap(),
                    structure_guard_slot,
                    tick.current(),
                );

                // try to claim structure if there are no guard troops after the attack
                // and explorer is alive
                if explorer_defender.troops.count.is_non_zero() {
                    let guard_slot: Option<GuardSlot> = structure_guards_aggressor
                        .next_attack_slot(structure_aggressor_base.troop_max_guard_count.into());
                    if guard_slot.is_none() {
                        // claim structure
                        structure_claimed_after_battle = true;
                        iStructureImpl::battle_claim(
                            ref world,
                            ref structure_guards_aggressor,
                            ref structure_aggressor_base,
                            ref explorer_defender,
                            structure_id,
                        );
                    }
                }
            } else {
                // update structure guard
                structure_guards_aggressor
                    .to_slot(
                        structure_guard_slot, structure_guard_aggressor_troops, structure_guard_destroyed_tick.into(),
                    );
                StructureTroopGuardStoreImpl::store(ref structure_guards_aggressor, ref world, structure_id);
            }

            // grant achievement
            let mut winner_owner_structure_id: ID = Zero::zero();
            let mut winner_owner_structure_address: starknet::ContractAddress = Zero::zero();
            if structure_guard_aggressor_troops.count.is_zero() && explorer_defender.troops.count.is_non_zero() {
                winner_owner_structure_id = explorer_defender.owner;
                winner_owner_structure_address = explorer_defender_owner_address;
            }
            if explorer_defender.troops.count.is_zero() && structure_guard_aggressor_troops.count.is_non_zero() {
                winner_owner_structure_id = structure_id;
                winner_owner_structure_address = structure_aggressor_owner;
            }
            if winner_owner_structure_address.is_non_zero() {
                AchievementTrait::progress(
                    world, winner_owner_structure_address.into(), Tasks::WIN_BATTLE, 1, starknet::get_block_timestamp(),
                );
            }

            // emit event
            world
                .emit_event(
                    @BattleEvent {
                        attacker_id: structure_id,
                        defender_id: explorer_id,
                        attacker_owner: 0,
                        defender_owner: explorer_defender.owner,
                        winner_id: winner_owner_structure_id,
                        max_reward: array![].span(),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            // emit story events
            let battle_story = BattleStory {
                battle_type: BattleType::GuardVsExplorer,
                attacker_id: structure_id,
                attacker_structure: BattleStructureType {
                    structure_category: structure_aggressor_base.category.into(),
                    structure_taken: structure_claimed_after_battle,
                },
                attacker_owner_id: structure_id,
                attacker_owner_address: structure_aggressor_owner,
                attacker_troops_type: structure_guard_aggressor_troops.category,
                attacker_troops_tier: structure_guard_aggressor_troops.tier,
                attacker_troops_before: structure_guard_aggressor_troop_count_before_attack,
                attacker_troops_lost: structure_guard_aggressor_troop_count_before_attack
                    - structure_guard_aggressor_troops.count,
                defender_id: explorer_id,
                defender_structure: BattleStructureType {
                    structure_category: StructureCategory::None.into(),
                    structure_taken: false,
                },
                defender_owner_id: explorer_defender.owner,
                defender_owner_address: explorer_defender_owner_address,
                defender_troops_type: explorer_defender.troops.category,
                defender_troops_tier: explorer_defender.troops.tier,
                defender_troops_before: explorer_defender_troop_count_before_attack,
                defender_troops_lost: explorer_defender_troop_count_before_attack - explorer_defender.troops.count,
                winner_id: winner_owner_structure_id,
                stolen_resources: array![].span(),
            };

            // Emit from attacker perspective
            world
                .emit_event(
                    @StoryEvent {
                        owner: Option::Some(structure_aggressor_owner),
                        entity_id: Option::Some(structure_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::BattleStory(battle_story),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            // Emit from defender perspective
            world
                .emit_event(
                    @StoryEvent {
                        owner: Option::Some(explorer_defender_owner_address),
                        entity_id: Option::Some(explorer_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::BattleStory(battle_story),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }
    }
}
