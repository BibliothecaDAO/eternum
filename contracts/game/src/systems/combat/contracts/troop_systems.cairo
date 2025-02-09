use s1_eternum::alias::ID;
use s1_eternum::models::troop::{TroopType, TroopTier, GuardSlot};
use s1_eternum::models::position::Direction;


#[starknet::interface]
trait ITroopSystems<TContractState> {

    fn guard_add(ref self: TContractState, for_structure_id: ID, slot: GuardSlot, category: TroopType, tier: TroopTier, amount: u128);
    fn guard_delete(ref self: TContractState, for_structure_id: ID, slot: GuardSlot);

    fn explorer_create(ref self: TContractState, for_structure_id: ID, category: TroopType, tier: TroopTier, amount: u128) -> ID;
    fn explorer_add(ref self: TContractState, to_explorer_id: ID, category: TroopType, tier: TroopTier, amount: u128);
    fn explorer_swap(ref self: TContractState, from_explorer_id: ID, to_explorer_id: ID, to_explorer_direction: Direction, count: u128);
    fn explorer_delete(ref self: TContractState, explorer_id: ID);
    // fn explorer_move(ref self: TContractState, explorer_id: ID, direction: Direction);

}

#[dojo::contract]
mod troop_systems {
    use core::num::traits::Bounded;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{ResourceTypes};
    use s1_eternum::constants::{WORLD_CONFIG_ID, ARMY_ENTITY_TYPE, DEFAULT_NS};
    use s1_eternum::models::capacity::{CapacityCategory};
    use s1_eternum::models::config::{
        TickConfig, TickImpl, TickTrait, SpeedConfig, TroopConfig, TroopConfigImpl, TroopConfigTrait, BattleConfigTrait,
        CapacityConfig, CapacityConfigImpl, CapacityConfigCategory, CombatConfig
    };
    use s1_eternum::models::owner::{OwnerTrait, Owner, EntityOwner, EntityOwnerTrait};
    use s1_eternum::models::position::{
        Position, Coord, CoordTrait, PositionTrait, Direction, 
        Occupier, OccupierTrait, OccupiedBy
    };
    use s1_eternum::models::resource::resource::{ResourceCost};
    use s1_eternum::models::resource::r3esource::{
        SingleR33esource, SingleR33esourceImpl, SingleR33esourceStoreImpl, 
        R3esource, R3esourceImpl,
        WeightStoreImpl, WeightUnitImpl,
        StructureSingleR33esourceFoodImpl
    };

    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::models::stamina::{Stamina, StaminaTrait};
    use s1_eternum::models::structure::{Structure, StructureTrait, StructureCategory};
    use s1_eternum::models::weight::{W3eight, W3eightTrait};
    use s1_eternum::models::troop::{
        Troops, TroopsTrait, TroopType, TroopTier, 
        GuardSlot, GuardTroops, GuardImpl, GuardTrait,
        ExplorerTroops
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
            let tick = TickImpl::get_default_tick_config(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();
            InternalTroopImpl::update_troop_resource(
                ref world, for_structure_id, amount, category, tier, current_tick);

            // ensure guard slot is valid
            let mut guard: GuardTroops = world.read_model(for_structure_id);
            let (mut troops, troops_destroyed_tick): (Troops, u32) = guard.get_slot(slot);
            
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

            // update troop in guard slot
            guard.set_slot(slot, troops, current_tick);
            world.write_model(@guard);

            // update structure
            world.write_model(@structure); 
        }



        fn guard_delete(ref self: ContractState, for_structure_id: ID, slot: GuardSlot ) {
            
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);
   
            // ensure caller owns structure
            let mut structure: Structure = world.read_model(for_structure_id);
            structure.owner.assert_caller_owner();

            // deduct resources used to create guard
            let tick = TickImpl::get_default_tick_config(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();
     
            // ensure guard slot is valid
            let mut guard: GuardTroops = world.read_model(for_structure_id);
            let (mut troops, troops_destroyed_tick): (Troops, u32) = guard.get_slot(slot);
            
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
            guard.set_slot(slot, troops, current_tick);
            world.write_model(@guard);

            // reduce structure guard count
            structure.troop.guard_count -= 1;
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
            let tick = TickImpl::get_default_tick_config(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();
            InternalTroopImpl::update_troop_resource(
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
            let tick = TickImpl::get_default_tick_config(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();
            InternalTroopImpl::update_troop_resource(
                ref world, owner_structure_id, amount, category, tier, current_tick);

            // add troops to explorer
            explorer.troops.count += amount;
            world.write_model(@explorer);

            // update troop capacity
            InternalTroopImpl::update_capacity(ref world, to_explorer_id, explorer, amount, true);


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
            InternalTroopImpl::update_capacity(ref world, from_explorer_id, from_explorer, count, false);
            InternalTroopImpl::update_capacity(ref world, to_explorer_id, to_explorer, count, true);

            // get current tick
            let tick = TickImpl::get_default_tick_config(ref world);
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

        // fn explorer_move(ref self: ContractState, explorer_id: ID, direction: Direction) {
        //     let mut world = self.world(DEFAULT_NS());
        //     SeasonImpl::assert_season_is_not_over(world);

        //     // ensure caller owns explorer
        //     let mut explorer: ExplorerTroops = world.read_model(explorer_id);
        //     explorer.owner.assert_caller_owner(world);

        //     // ensure explorer is alive
        //     assert!(explorer.troops.count.is_non_zero(), "explorer is dead");

        //     // ensure next coordinate is not occupied
        //     let next_coord = explorer.coord.neighbor(direction);
        //     let mut occupier: Occupier = world.read_model((next_coord.x, next_coord.y));
        //     assert!(occupier.values.len() == 0, "next coordinate is occupied");

        //     // update explorer position
        //     explorer.coord = next_coord;
        //     world.write_model(@explorer);

        //     // update occupier
        //     occupier.entity = OccupiedBy::Explorer(explorer_id);
        //     world.write_model(@occupier);
        // }
    }


    #[generate_trait]
    pub impl InternalTroopImpl of InternalTroopTrait {

        fn update_capacity(ref world: WorldStorage, explorer_id: ID, explorer: ExplorerTroops, troop_amount: u128, add: bool) {
            // let troop_config: TroopConfig = world.read_model(explorer.troops.category);
            // let weight_grams: u128 = ResourceUnitImpl::grams(ref world, explorer.troops.category, explorer.troops.tier);
            let weight_grams: u128 = 200; // todo: remove placeholder
            let mut troop_weight: W3eight = WeightStoreImpl::retrieve(ref world, explorer_id);
            if add {
                troop_weight.add_capacity(weight_grams * troop_amount);
            } else {
                troop_weight.deduct_capacity(weight_grams * troop_amount);
            }
            troop_weight.store(ref world, explorer_id);
        }

        fn update_troop_resource(
            ref world: WorldStorage,
            from_structure_id: ID,
            amount: u128, 
            category: TroopType, 
            tier: TroopTier, 
            current_tick: u64
        ) {
            let resource_type = match tier {
                TroopTier::T1 => {
                    match category {
                        TroopType::Knight => ResourceTypes::KNIGHT_T1,
                        TroopType::Crossbowman => ResourceTypes::CROSSBOWMAN_T1,
                        TroopType::Paladin => ResourceTypes::PALADIN_T1,
                    }
                },

                TroopTier::T2 => {
                    match category {
                        TroopType::Knight => ResourceTypes::KNIGHT_T2,
                        TroopType::Crossbowman => ResourceTypes::CROSSBOWMAN_T2,
                        TroopType::Paladin => ResourceTypes::PALADIN_T2,
                    }
                },

                TroopTier::T3 => {
                    match category {
                        TroopType::Knight => ResourceTypes::KNIGHT_T3,
                        TroopType::Crossbowman => ResourceTypes::CROSSBOWMAN_T3,
                        TroopType::Paladin => ResourceTypes::PALADIN_T3,
                    }
                }
            };


        
            let mut structure_weight: W3eight = WeightStoreImpl::retrieve(ref world, from_structure_id);
            let troop_resource_weight_grams: u128 = WeightUnitImpl::grams(ref world, resource_type);
            let mut structure_troop_resource: SingleR33esource = SingleR33esourceStoreImpl::retrieve(
                ref world, from_structure_id, resource_type, ref structure_weight, troop_resource_weight_grams, Option::Some(current_tick.try_into().unwrap())
            );
            structure_troop_resource.spend(amount, ref structure_weight, troop_resource_weight_grams);
            structure_troop_resource.store(ref world);

        }
    }
}
