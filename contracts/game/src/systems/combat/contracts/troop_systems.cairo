use s1_eternum::alias::ID;
use s1_eternum::models::troop::{TroopType, TroopTier, GuardSlot};
use s1_eternum::models::position::Direction;



#[starknet::interface]
trait ITroopSystems<TContractState> {
    // guard
    fn guard_add(ref self: TContractState, for_structure_id: ID, slot: GuardSlot, category: TroopType, tier: TroopTier, amount: u128);
    fn guard_delete(ref self: TContractState, for_structure_id: ID, slot: GuardSlot);

    // explorer
    fn explorer_create(ref self: TContractState, for_structure_id: ID, category: TroopType, tier: TroopTier, amount: u128) -> ID;
    fn explorer_add(ref self: TContractState, to_explorer_id: ID, category: TroopType, tier: TroopTier, amount: u128);
    fn explorer_swap(ref self: TContractState, from_explorer_id: ID, to_explorer_id: ID, to_explorer_direction: Direction, count: u128);
    fn explorer_delete(ref self: TContractState, explorer_id: ID);
}

#[starknet::interface]
trait ITroopMovementSystems<TContractState> {
    fn explorer_move(ref self: TContractState, explorer_id: ID, directions: Span<Direction>, explore: bool);
}


#[dojo::contract]
mod troop_systems {
    use core::num::traits::Bounded;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{ResourceTypes, WORLD_CONFIG_ID, ARMY_ENTITY_TYPE, DEFAULT_NS};
    use s1_eternum::models::{
        capacity::{CapacityCategory},
        config::{
            TickConfig, TickImpl, TickTrait, 
            SpeedConfig, 
            TroopConfig, TroopConfigImpl, TroopConfigTrait, 
            BattleConfigTrait,
            CapacityConfig, CapacityConfigImpl, CapacityConfigCategory, 
            CombatConfig
        },
        map::Tile,
        owner::{OwnerTrait, Owner, EntityOwner, EntityOwnerTrait},
        position::{Position, Coord, CoordTrait, PositionTrait, Direction, Occupier, OccupierTrait, OccupiedBy},
        resource::{
            resource::{ResourceCost},
            r3esource::{
                SingleR33esource, SingleR33esourceImpl, SingleR33esourceStoreImpl,
                R3esource, R3esourceImpl,
                WeightStoreImpl, WeightUnitImpl,
                StructureSingleR33esourceFoodImpl
            }
        },
        season::SeasonImpl,
        stamina::{Stamina, StaminaTrait},
        structure::{Structure, StructureTrait, StructureCategory},
        troop::{
            Troops, TroopsTrait, TroopType, TroopTier,
            GuardSlot, GuardTroops, GuardImpl, GuardTrait,
            ExplorerTroops
        },
        weight::{W3eight, W3eightTrait}
    };

    use s1_eternum::utils::map::{biomes::{Biome, get_biome}};
    use s1_eternum::systems::utils::map::iMapImpl;

    use s1_eternum::systems::utils::{
        mine::iMineDiscoveryImpl,
        troop::{iExplorerImpl, iTroopImpl}
    };

    use super::ITroopSystems;

    #[abi(embed_v0)]
    impl TroopSystemsImpl of ITroopSystems<ContractState> {

        fn guard_add(ref self: ContractState, for_structure_id: ID, slot: GuardSlot, category: TroopType, tier: TroopTier, amount: u128 ) {

            assert!(amount.is_non_zero(), "amount must be greater than 0");
            
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);
   
            // ensure caller owns structure
            let mut structure: Structure = world.read_model(for_structure_id);
            structure.owner.assert_caller_owner();

            // deduct resources used to create guard
            let tick = TickImpl::retrieve(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();
            iTroopImpl::update_troop_resource(
                ref world, for_structure_id, amount, category, tier, current_tick);

            // ensure guard slot is valid
            let mut guard: GuardTroops = structure.guards;
            let (mut troops, troops_destroyed_tick): (Troops, u32) = guard.from_slot(slot);
            
            // ensure delay from troop defeat is over
            let combat_config: CombatConfig = world.read_model(WORLD_CONFIG_ID);
            if troops_destroyed_tick.is_non_zero() {
                let next_troop_update_at = troops_destroyed_tick 
                    + tick.convert_from_seconds(combat_config.guard_resurrection_delay).try_into().unwrap();
                assert!(current_tick >= next_troop_update_at.into(), "you need to wait for the delay from troop defeat to be over");
            }

            if troops.count.is_zero() {
                // ensure structure has not reached the hard limit of guards
                assert!(
                    structure.troop.guard_count < structure.troop.max_guards_allowed, 
                        "reached limit of guards per structure"
                );

                // ensure structure has not reached the hard limit of troops
                let structure_troop_count = structure.troop.explorers.len() + structure.troop.guard_count;
                assert!(
                    structure_troop_count < structure.troop.max_troops_allowed, 
                        "reached limit of troops per structure"
                );


                // update guard count
                structure.troop.guard_count += 1;

                // set category and tier
                troops.category = category;
                troops.tier = tier;
            }

            troops.count += amount;
            troops.stamina.refill(troops.category, combat_config, current_tick);

            // update guard slot and structure
            guard.to_slot(slot, troops, current_tick);
            structure.guards = guard;
            world.write_model(@structure); 
        }



        fn guard_delete(ref self: ContractState, for_structure_id: ID, slot: GuardSlot ) {
            
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);
   
            // ensure caller owns structure
            let mut structure: Structure = world.read_model(for_structure_id);
            structure.owner.assert_caller_owner();

            // deduct resources used to create guard
            let tick = TickImpl::retrieve(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();
     
            // ensure guard slot is valid
            let mut guard: GuardTroops = structure.guards;
            let (mut troops, troops_destroyed_tick): (Troops, u32) = guard.from_slot(slot);
            
            // ensure delay from troop defeat is over
            let combat_config: CombatConfig = world.read_model(WORLD_CONFIG_ID);
            if troops_destroyed_tick.is_non_zero() {
                let next_troop_update_at = troops_destroyed_tick 
                    + tick.convert_from_seconds(combat_config.guard_resurrection_delay).try_into().unwrap();
                assert!(current_tick >= next_troop_update_at.into(), "you need to wait for the delay from troop defeat to be over");
            }

            // clear troop
            troops.count = 0;
            troops.stamina.reset(current_tick);
            guard.to_slot(slot, troops, current_tick);
            structure.guards = guard;

            // reduce structure guard count
            structure.troop.guard_count -= 1;

            // update structure
            world.write_model(@structure);
        }

        
        fn explorer_create(ref self: ContractState, for_structure_id: ID, category: TroopType, tier: TroopTier, amount: u128) -> ID {
            assert!(amount.is_non_zero(), "amount must be greater than 0");
            
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);
   
            // ensure caller owns structure
            let mut structure: Structure = world.read_model(for_structure_id);
            structure.owner.assert_caller_owner();

            // deduct resources used to create explorer
            let tick = TickImpl::retrieve(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();
            iTroopImpl::update_troop_resource(
                ref world, for_structure_id, amount, category, tier, current_tick);

            // ensure structure has not reached the hard limit of troops
            let structure_troop_count = structure.troop.explorers.len() + structure.troop.guard_count;
            assert!(
                structure_troop_count < structure.troop.max_troops_allowed, 
                    "reached limit of troops per structure"
            );


            // create explorer
            let mut explorer_id: ID = world.dispatcher.uuid();
            
            // add explorer count to structure
            let mut explorers: Array<ID> = structure.troop.explorers.into();
            explorers.append(explorer_id);
            structure.troop.explorers = explorers.span();
            world.write_model(@structure);

            // add explorer to location occupier
            let coord: Coord = structure.coord;
            let mut occupier: Occupier = world.read_model((coord.x, coord.y));
            occupier.entity = OccupiedBy::Explorer(explorer_id);
            world.write_model(@occupier);


            // todo: ensure max_allowed is updated. ensure it includes
            //       troop_config.army_free_per_structure,
            //       troop_config.army_extra_per_building
            //       troop_config.army_max_per_structure


            // ensure explorer amount does not exceed max
            let combat_config: CombatConfig = world.read_model(WORLD_CONFIG_ID);
            assert!(
                amount <= combat_config.explorer_max_troop_count, 
                    "reached limit of explorers amount per armys"
            );

            // set troop stamina
            let mut troops
                = Troops {category, tier, count: amount, stamina: Stamina {amount: 0, updated_tick: 0}};
            troops.stamina.refill(troops.category, combat_config, current_tick);

            // set explorer
            world
                .write_model(
                @ExplorerTroops {
                    explorer_id, 
                    coord,
                    troops,
                    owner: EntityOwner {
                        entity_id: explorer_id,
                        entity_owner_id: structure.entity_id,
                    }
                });

            explorer_id

        }

        fn explorer_add(ref self: ContractState, to_explorer_id: ID, category: TroopType, tier: TroopTier, amount: u128) {
            assert!(amount.is_non_zero(), "amount must be greater than 0");
            
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns explorer
            let mut explorer: ExplorerTroops = world.read_model(to_explorer_id);
            explorer.owner.assert_caller_owner(world);

            // ensure explorer is at home 
            let owner_structure_id: ID = explorer.owner.entity_owner_id;
            let explorer_owner_structure: Structure = world.read_model(owner_structure_id);
            assert!(explorer_owner_structure.coord == explorer.coord, "explorer not at home structure");

            // deduct resources used to create explorer
            let tick = TickImpl::retrieve(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();
            iTroopImpl::update_troop_resource(
                ref world, owner_structure_id, amount, category, tier, current_tick);

            // add troops to explorer
            explorer.troops.count += amount;
            world.write_model(@explorer);

            // update troop capacity
            iExplorerImpl::update_capacity(ref world, to_explorer_id, explorer, amount, true);


            // ensure explorer count does not exceed max count
            let combat_config: CombatConfig = world.read_model(WORLD_CONFIG_ID);
            assert!(
                explorer.troops.count <= combat_config.explorer_max_troop_count, 
                    "reached limit of explorers amount per armys"
            );

        }

        fn explorer_swap(
            ref self: ContractState, 
            from_explorer_id: ID, 
            to_explorer_id: ID, 
            to_explorer_direction: Direction, 
            count: u128
        ) {
            assert!(count.is_non_zero(), "count must be greater than 0");
            
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller address owns both explorers 
            // (not necessarily the same structure)
            let mut from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
            from_explorer.owner.assert_caller_owner(world);

            let mut to_explorer: ExplorerTroops = world.read_model(to_explorer_id);
            to_explorer.owner.assert_caller_owner(world);

            // ensure explorers are adjacent to one another
            let to_explorer_coord = to_explorer.coord.neighbor(to_explorer_direction);
            let to_explorer_occupier: Occupier = world.read_model(to_explorer_coord);
            assert!(to_explorer_occupier.entity == OccupiedBy::Explorer(to_explorer_id), "to explorer is not at the target coordinate");

            // ensure both explorers have troops
            assert!(from_explorer.troops.count.is_non_zero(), "from explorer has no troops");
            assert!(to_explorer.troops.count.is_zero(), "to explorer has troops");

            // update troops
            from_explorer.troops.count -= count;
            to_explorer.troops.count += count;

            // update troop capacity
            iExplorerImpl::update_capacity(ref world, from_explorer_id, from_explorer, count, false);
            iExplorerImpl::update_capacity(ref world, to_explorer_id, to_explorer, count, true);

            // get current tick
            let tick = TickImpl::retrieve(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();

            // ensure there is no stamina advantage gained by swapping
            let combat_config: CombatConfig = world.read_model(WORLD_CONFIG_ID);
            from_explorer.troops.stamina.refill(from_explorer.troops.category, combat_config, current_tick);
            to_explorer.troops.stamina.refill(to_explorer.troops.category, combat_config, current_tick);
            if from_explorer.troops.stamina.amount < to_explorer.troops.stamina.amount {
                to_explorer.troops.stamina.amount = from_explorer.troops.stamina.amount;
            }

            // update explorer models
            world.write_model(@from_explorer);
            world.write_model(@to_explorer);

            // ensure to_explorer count does not exceed max count
            assert!(
                to_explorer.troops.count <= combat_config.explorer_max_troop_count, 
                    "reached limit of explorers amount per armys"
            );
        }

        fn explorer_delete(ref self: ContractState, explorer_id: ID) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns explorer
            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            explorer.owner.assert_caller_owner(world);

            // ensure army is dead
            assert!(explorer.troops.count.is_zero(), "explorer unit is alive");

            let occupier: Occupier = world.read_model((explorer.coord.x, explorer.coord.y));
            let resource: R3esource = R3esourceImpl::key_only(explorer_id);

            // todo: IMPORTANT: check the cost of erasing the resource model
    
            // delete explorer
            world.erase_model(@occupier);
            world.erase_model(@explorer);
            world.erase_model(@resource);

        }

    }
}



#[dojo::contract]
mod troop_movement_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{ResourceTypes, WORLD_CONFIG_ID, ARMY_ENTITY_TYPE, DEFAULT_NS};
    use s1_eternum::models::{
        capacity::{CapacityCategory},
        config::{
            TickConfig, TickImpl, TickTrait, 
            SpeedConfig, MapConfig,
            TroopConfig, TroopConfigImpl, TroopConfigTrait, 
            BattleConfigTrait,
            CapacityConfig, CapacityConfigImpl, CapacityConfigCategory, 
            CombatConfig
        },
        map::Tile,
        owner::{OwnerTrait, Owner, EntityOwner, EntityOwnerTrait},
        position::{Position, Coord, CoordTrait, PositionTrait, Direction, Occupier, OccupierTrait, OccupiedBy},
        resource::r3esource::{
            SingleR33esource, SingleR33esourceImpl, SingleR33esourceStoreImpl,
            WeightStoreImpl, WeightUnitImpl
        },
        season::SeasonImpl,
        stamina::{Stamina, StaminaTrait},
        structure::{Structure, StructureTrait, StructureCategory},
        troop::{
            Troops, TroopsTrait, TroopType, TroopTier,
            GuardSlot, GuardTroops, GuardImpl, GuardTrait,
            ExplorerTroops
        },
        weight::{W3eight, W3eightTrait}
    };

    use s1_eternum::utils::map::{biomes::{Biome, get_biome}};
    use s1_eternum::systems::utils::map::iMapImpl;
    use s1_eternum::systems::utils::{
        mine::iMineDiscoveryImpl,
        troop::{iExplorerImpl, iTroopImpl}
    };


    use super::ITroopMovementSystems;



    #[abi(embed_v0)]
    impl TroopMovementSystemsImpl of ITroopMovementSystems<ContractState> {

        fn explorer_move(ref self: ContractState, explorer_id: ID, mut directions: Span<Direction>, explore: bool) {
            // ensure directions are not empty
            assert!(directions.len().is_non_zero(), "directions must be greater than 0");

            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns explorer
            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            explorer.owner.assert_caller_owner(world);

            // ensure explorer is alive
            assert!(explorer.troops.count.is_non_zero(), "explorer is dead");

            // remove explorer from current occupier
            let occupier = Occupier{x: explorer.coord.x, y: explorer.coord.y, entity: OccupiedBy::None};
            world.erase_model(@occupier);

            // move explorer to target coordinate
            let mut biomes: Array<Biome> = array![];
            while true {
                // ensure next coordinate is not occupied
                let next = explorer.coord.neighbor(*(directions.pop_front().unwrap()));
                let mut occupier: Occupier = world.read_model((next.x, next.y));
                assert!(occupier.entity == OccupiedBy::None, "next coordinate is occupied");

                // add biome to biomes
                let biome = get_biome(next.x.into(), next.y.into());
                biomes.append(biome);

                let mut tile: Tile = world.read_model((next.x, next.y));
                if explore {
                    // ensure only one tile can be explored
                    assert!(directions.len().is_zero(), "explorer can only move one direction when exploring");
                    
                    // ensure target tile is not explored 
                    assert(tile.explored_at.is_zero(), 'tile is already explored');
                    
                    // set tile as explored
                    iMapImpl::explore(ref world, ref tile, biome);

                    // perform lottery to discover mine
                    let map_config: MapConfig = world.read_model(WORLD_CONFIG_ID);
                    iMineDiscoveryImpl::lottery(ref world, starknet::get_caller_address(), next, map_config);

                    // grant resource reward for exploration
                    let (explore_reward_id, explore_reward_amount) = iExplorerImpl::exploration_reward(ref world, map_config);
                    let mut explorer_weight: W3eight = WeightStoreImpl::retrieve(ref world, explorer_id);
                    let resource_weight_grams: u128 = WeightUnitImpl::grams(ref world, explore_reward_id);
                    let mut resource = SingleR33esourceStoreImpl::retrieve(
                        ref world, explorer_id, explore_reward_id, ref explorer_weight, resource_weight_grams, false
                    );
                    resource.add(explore_reward_amount, ref explorer_weight, resource_weight_grams);
                    resource.store(ref world);
                    explorer_weight.store(ref world, explorer_id);
                    
                } else {
                    // ensure all tiles passed through are explored during travel
                    assert(tile.explored_at.is_non_zero(), 'tile is not explored');
                }

                // update explorer coordinate
                explorer.coord = next;
                
                // set explorer as occupier of target coordinate    
                if directions.len().is_zero() {
                    occupier.entity = OccupiedBy::Explorer(explorer_id);
                    world.write_model(@occupier);
                    break;
                }
            };

            // retrieve combat config
            let config: CombatConfig = world.read_model(WORLD_CONFIG_ID);

            // burn stamina cost
            iExplorerImpl::burn_stamina_cost(
                    ref world, ref explorer, config, explore, biomes, TickImpl::retrieve(ref world).current());

            // burn food cost
            iExplorerImpl::burn_food_cost(ref world, ref explorer, config, explore);
            
            // update explorer 
            world.write_model(@explorer);
        }

    }

}
