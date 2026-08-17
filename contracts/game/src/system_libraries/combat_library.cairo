use dojo::world::WorldStorage;
use crate::models::config::{TroopDamageConfig, TroopStaminaConfig};
use crate::models::position::Coord;
use crate::models::troop::Troops;

#[starknet::interface]
pub trait ICombatLibrary<T> {
    fn troops_attack(
        self: @T,
        world: WorldStorage,
        game_id: u32,
        attacker: Troops,
        defender: Troops,
        attacker_coord: Coord,
        defender_coord: Coord,
        attacker_is_structure_guard: bool,
        defender_is_structure_guard: bool,
        troop_stamina_config: TroopStaminaConfig,
        troop_damage_config: TroopDamageConfig,
        current_tick: u64,
        current_tick_interval: u64,
    ) -> (Troops, Troops);
}

#[dojo::library]
mod combat_library {
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use crate::models::config::{TroopDamageConfig, TroopStaminaConfig};
    use crate::models::position::{Coord, CoordTrait, TravelTrait};
    use crate::models::troop::{CombatContext, Troops, TroopsTrait};
    use crate::system_libraries::biome_library::{IBiomeLibraryDispatcherTrait, biome_library};

    #[abi(embed_v0)]
    pub impl CombatLibraryImpl of super::ICombatLibrary<ContractState> {
        fn troops_attack(
            self: @ContractState,
            world: WorldStorage,
            game_id: u32,
            attacker: Troops,
            defender: Troops,
            attacker_coord: Coord,
            defender_coord: Coord,
            attacker_is_structure_guard: bool,
            defender_is_structure_guard: bool,
            troop_stamina_config: TroopStaminaConfig,
            troop_damage_config: TroopDamageConfig,
            current_tick: u64,
            current_tick_interval: u64,
        ) -> (Troops, Troops) {
            let mut world = world;
            let mut attacker_mut = attacker;
            let mut defender_mut = defender;
            let combat_context = build_combat_context(
                ref world,
                game_id,
                attacker_coord,
                defender_coord,
                attacker_is_structure_guard,
                defender_is_structure_guard,
            );
            attacker_mut
                .attack_with_context(
                    ref defender_mut,
                    combat_context,
                    troop_stamina_config,
                    troop_damage_config,
                    current_tick,
                    current_tick_interval,
                );
            (attacker_mut, defender_mut)
        }
    }

    pub fn get_dispatcher(world: @WorldStorage) -> super::ICombatLibraryLibraryDispatcher {
        let (_, class_hash) = world.dns(@"combat_library_v0_1_14").expect('combat_library not found');
        super::ICombatLibraryLibraryDispatcher { class_hash }
    }

    fn build_combat_context(
        ref world: WorldStorage,
        game_id: u32,
        attacker_coord: Coord,
        defender_coord: Coord,
        attacker_is_structure_guard: bool,
        defender_is_structure_guard: bool,
    ) -> CombatContext {
        let biome_library = biome_library::get_dispatcher(@world);
        let defender_biome = biome_library
            .get_biome(world, game_id, defender_coord.alt, defender_coord.x.into(), defender_coord.y.into());

        CombatContext {
            attacker_biome: defender_biome,
            defender_biome,
            attack_distance: resolve_attack_distance(attacker_coord, defender_coord),
            attacker_is_structure_guard,
            defender_is_structure_guard,
        }
    }

    fn resolve_attack_distance(attacker_coord: Coord, defender_coord: Coord) -> u32 {
        if attacker_coord.alt != defender_coord.alt {
            return 1;
        }

        let step_distance: u128 = attacker_coord.step_distance().into();
        let tile_distance = attacker_coord.tile_distance(defender_coord);
        (tile_distance / step_distance).try_into().unwrap()
    }
}
