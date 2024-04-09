// use starknet::get_block_timestamp;

// // Gameplay

// // Generate Troops like Resources (see resource)
// // fn create_army() this will convert Troops into an Army and burn the resources.
// // Now an Army exists at a location and it can travel
// // Army can initiate a combat with another Army or a Entity that has a combat trait

// // initiating combat
// // players select another Army, which must be at the same location, then start a Battle.
// // The Battle calculates the strength of each side and deducts health from each side per tick
// // If reinforcements arrive the Battle updates to the new strength and outcome is updated.

// const TICK_DURATION: u64 = 360;

// #[derive(Copy, Drop, Serde)]
// struct Troops {
//     a: u32,
//     b: u32,
//     c: u32,
// }

// #[derive(Model, Copy, Drop, Serde)]
// struct CommittedBattle {
//     #[key]
//     entity_id: u128,
//     battle_entity_id: u128, // battle id
//     battle_id_side: u8, // attacking or defending 
// }

// #[derive(Model, Copy, Drop, Serde)]
// struct Army {
//     #[key]
//     entity_id: u128,
//     troops: Troops,
//     health: u64,
// }

// #[derive(Model, Copy, Drop, Serde)]
// struct Battle {
//     #[key]
//     entity_id: u128,
//     attacking_side: Army,
//     defending_side: Army,
//     advantage_multiplier: u32,
//     disadvantage_multiplier: u32,
//     last_updated: u64,
//     active: bool,
// }

// #[generate_trait]
// impl BattleImpl of BattleTrait {
//     // starts a battle
//     fn start(self: Battle, attacking_army: Army, defending_army: Army) -> Battle {
//         Battle {
//             entity_id: self.entity_id,
//             attacking_side: attacking_army,
//             defending_side: defending_army,
//             advantage_multiplier: 1, // if the attacking side has an advantage
//             disadvantage_multiplier: 1, // if the defending side has an advantage - a Realm for example would have defence bonus
//             last_updated: get_block_timestamp(),
//             active: true,
//         }
//     }
//     fn reinforce_attacking_army(ref self: Battle, new_army: Army) -> Battle {
//         // we need to update the battle state before we can reinforce the defending army
//         self.battle_state();
//         let new_attacking_army = Army {
//             entity_id: self.attacking_side.entity_id,
//             troops: Troops {
//                 a: self.attacking_side.troops.a + new_army.troops.a,
//                 b: self.attacking_side.troops.b + new_army.troops.b,
//                 c: self.attacking_side.troops.c + new_army.troops.c,
//             },
//             health: self.attacking_side.health + new_army.health,
//         };

//         self.attacking_side = new_attacking_army;
//         self
//     }

//     fn reinforce_defending_army(ref self: Battle, new_army: Army) -> Battle {
//         // we need to update the battle state before we can reinforce the defending army
//         self.battle_state();
//         let new_defending_army = Army {
//             entity_id: self.defending_side.entity_id,
//             troops: Troops {
//                 a: self.defending_side.troops.a + new_army.troops.a,
//                 b: self.defending_side.troops.b + new_army.troops.b,
//                 c: self.defending_side.troops.c + new_army.troops.c,
//             },
//             health: self.defending_side.health + new_army.health,
//         };

//         self.defending_side = new_defending_army;
//         self
//     }
//     fn calculate_delta(self: Battle) -> (u32, u32) {
//         // Assuming troop 'a' is strong against 'b', 'b' is strong against 'c', and 'c' is strong against 'a'.
//         // Calculate the effective strength of each troop type considering RPS (Rock, Paper, Scissors) mechanics
//         let attacking_strength_a = self.attacking_side.troops.a * self.advantage_multiplier
//             - self.defending_side.troops.b * self.disadvantage_multiplier;
//         let attacking_strength_b = self.attacking_side.troops.b * self.advantage_multiplier
//             - self.defending_side.troops.c * self.disadvantage_multiplier;
//         let attacking_strength_c = self.attacking_side.troops.c * self.advantage_multiplier
//             - self.defending_side.troops.a * self.disadvantage_multiplier;

//         let defending_strength_a = self.defending_side.troops.a * self.disadvantage_multiplier
//             - self.attacking_side.troops.b * self.advantage_multiplier;
//         let defending_strength_b = self.defending_side.troops.b * self.disadvantage_multiplier
//             - self.attacking_side.troops.c * self.advantage_multiplier;
//         let defending_strength_c = self.defending_side.troops.c * self.disadvantage_multiplier
//             - self.attacking_side.troops.a * self.advantage_multiplier;

//         let total_attacking_strength = attacking_strength_a
//             + attacking_strength_b
//             + attacking_strength_c;
//         let total_defending_strength = defending_strength_a
//             + defending_strength_b
//             + defending_strength_c;

//         // Calculate the difference in strengths
//         let strength_difference = if total_attacking_strength > total_defending_strength {
//             total_attacking_strength - total_defending_strength
//         } else {
//             total_defending_strength - total_attacking_strength
//         };

//         // Calculate the damage multiplier based on the strength difference
//         let damage_multiplier = strength_difference
//             / (total_attacking_strength + total_defending_strength);

//         // Calculate the delta for each army
//         let delta_attacking = if total_attacking_strength > total_defending_strength {
//             (total_attacking_strength * damage_multiplier) + 1
//         } else {
//             (total_defending_strength * damage_multiplier) + 1
//         };

//         let delta_defending = if total_defending_strength > total_attacking_strength {
//             (total_defending_strength * damage_multiplier) + 1
//         } else {
//             (total_attacking_strength * damage_multiplier) + 1
//         };

//         (delta_attacking, delta_defending)
//     }
//     fn since_last_update(self: Battle) -> u64 {
//         (get_block_timestamp() - self.last_updated) / TICK_DURATION
//     }
//     fn battle_state(ref self: Battle) -> Battle {
//         let ticks = self.since_last_update();

//         let (delta_attacking, delta_defending) = self.calculate_delta();

//         let attacking_ticks_to_zero = self.attacking_side.health / delta_defending.into();
//         let defending_ticks_to_zero = self.defending_side.health / delta_attacking.into();

//         let max_battle_duration_ticks = if attacking_ticks_to_zero > defending_ticks_to_zero {
//             attacking_ticks_to_zero
//         } else {
//             defending_ticks_to_zero
//         };

//         let mut new_attacking_health = self.attacking_side.health;
//         let mut new_defending_health = self.defending_side.health;

//         // Cap the health deduction to the maximum battle duration
//         let capped_ticks = if ticks > max_battle_duration_ticks {
//             max_battle_duration_ticks
//         } else {
//             ticks
//         };

//         if capped_ticks > 0 {
//             new_attacking_health -= delta_defending.into() * capped_ticks;
//             new_defending_health -= delta_attacking.into() * capped_ticks;
//         }

//         // check health still exists
//         if new_attacking_health <= 0 {
//             new_attacking_health = 0;
//         }

//         if new_defending_health <= 0 {
//             new_defending_health = 0;
//         }

//         let new_attacking_army = Army {
//             entity_id: self.attacking_side.entity_id,
//             troops: self.attacking_side.troops,
//             health: new_attacking_health,
//         };

//         let new_defending_army = Army {
//             entity_id: self.defending_side.entity_id,
//             troops: self.defending_side.troops,
//             health: new_defending_health,
//         };

//         Battle {
//             entity_id: self.entity_id,
//             attacking_side: new_attacking_army,
//             defending_side: new_defending_army,
//             advantage_multiplier: self.advantage_multiplier,
//             disadvantage_multiplier: self.disadvantage_multiplier,
//             last_updated: get_block_timestamp(),
//             active: self.active,
//         }
//     }
// }


// #[cfg(test)]
// mod tests {
//     #[test]
//     #[available_gas(30000000)]
//     fn test_combat() {}
// }
