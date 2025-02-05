use s1_eternum::alias::ID;
use s1_eternum::models::{combat::{TroopType, TroopTier}};
use s1_eternum::models::position::Direction;

#[starknet::interface]
trait IExplorerSystems<TContractState> {
    fn explorer_create(ref self: TContractState, for_structure_id: ID, category: TroopType, tier: TroopTier, amount: u128) -> ID;
    fn explorer_add(ref self: TContractState, to_explorer_id: ID, category: TroopType, tier: TroopTier, amount: u128);
    fn explorer_swap(ref self: TContractState, from_explorer_id: ID, to_explorer_id: ID);
    fn explorer_delete(ref self: TContractState, explorer_id: ID);
    fn explorer_move(ref self: TContractState, explorer_id: ID, direction: Direction);
}

#[dojo::contract]
mod explorer_systems {
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
        CapacityConfig, CapacityConfigImpl, CapacityConfigCategory, StaminaRefillConfig
    };

    use s1_eternum::models::owner::{EntityOwner, EntityOwnerImpl, EntityOwnerTrait, Owner, OwnerTrait};
    use s1_eternum::models::position::CoordTrait;
    use s1_eternum::models::position::{Position, Coord, PositionTrait, Direction};
    use s1_eternum::models::resource::resource::{ResourceImpl, ResourceCost};

    use s1_eternum::models::season::SeasonImpl;
    use s1_eternum::models::structure::{Structure, StructureTrait, StructureCategory};
    use s1_eternum::models::weight::Weight;
    use s1_eternum::models::{combat::{}};

    use super::ITroopContract;

    #[abi(embed_v0)]
    impl ExplorerSystemsImpl of IExplorerSystems<ContractState> {
        fn explorer_create(ref self: TContractState, for_structure_id: ID, category: TroopType, tier: TroopTier, amount: u128) -> ID {
            
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);
   
            // ensure caller owns structure
            let structure: Structure = world.read_model(for_structure_id);
            structure.owner.assert_caller_owner(world);

            // deduct resources used to create explorer
            InternalExplorerImpl::deduct_explorer_resource(
                ref world, for_structure_id, amount, category, tier);

            // create explorer
            let mut explorer_id: ID = world.dispatcher.uuid();
            let coord: Coord = structure.coord;
            
            // add explorer to location occupiers
            let mut occupiers: Occupiers = world.read_model((coord.x, coord.y));
            occupiers.values.append(OccupiedBy::Explorer(explorer_id));
            world.write_model(@occupiers);

            // add explorer count to structure
            structure.explorers.all.append(explorer_id);
            world.write_model(@structure);

            // ensure structure has not reached the hard limit of explorers
            assert!(
                structure.explorers.all.len() <= structure.explorers.max_allowed, 
                    "reached hard limit of explorers per structure"
            );

            // todo: ensure max_allowed is updated. ensure it includes
            //       troop_config.army_free_per_structure,
            //       troop_config.army_extra_per_building
            //       troop_config.army_max_per_structure


            // set troop stamina
            let mut troops: Troops = Default::default();
            troops.category = category;
            troops.tier = tier;
            troops.health = amount;
            troops.stamina = Stamina {
                amount: 0,
                last_refill_tick: (
                    armies_tick_config.current()
                    - stamina_refill_config.start_boost_tick_count.into()
                ),
            };

            // set owner
            let owner: EntityOwner = EntityOwner {
                entity_id: explorer_id,
                entity_owner_id: structure.entity_id,
            };

            world
                .write_model(
                @ExplorerTroops {
                    explorer_id, 
                    coord,
                    troops,
                    owner,
                    travel: Default::default(),
                });

            explorer_id

            // todo: limit troop count per explorer
        }


        fn explorer_add(ref self: TContractState, to_explorer_id: ID, category: TroopType, tier: TroopTier, amount: u128) {
            
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);
   
            // ensure caller owns explorer
            let structure: Structure = world.read_model(explorer_id);
            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            explorer.owner.assert_caller_owner(world);

            // ensure explorer is at home 
            let owner_structure_id: ID = explorer.owner.entity_owner_id;
            let explorer_owner_structure: Structure = world.read_model(explorer_owner_structure_id);
            assert!(explorer_owner_structure.coord == explorer.coord, "explorer not at home structure");

            // deduct resources used to create explorer
            InternalExplorerImpl::deduct_explorer_resource(
                ref world, owner_structure_id, amount, category, tier);


            // add troops to explorer
            explorer.troops.health += amount;
            world.write_model(@explorer);

            // todo: ensure explorer health does not exceed max health
            // todo: ensure explorer is adjacent to home 
        }


        fn explorer_swap(ref self: TContractState, from_explorer_id: ID, to_explorer_id: ID, health: u128) {
            
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);
   
            // ensure caller address owns both explorers 
            // (not necessarily the same structure)
            let mut from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
            from_explorer.owner.assert_caller_owner(world);

            let mut to_explorer: ExplorerTroops = world.read_model(to_explorer_id);
            to_explorer.owner.assert_caller_owner(world);

            // ensure explorers are at same location (??)
            assert!(from_explorer.coord == to_explorer.coord, "explorers are not adjacent");

            // ensure both explorers have troops
            assert!(from_explorer.troops.health.is_non_zero(), "from explorer has no troops");
            assert!(to_explorer.troops.health.is_zero(), "to explorer has troops");

            // add troops to explorer
            from_explorer.troops.health -= health;
            to_explorer.troops.health += health;
     
            // ensure there is no stamina advantage gained by swapping
            from_explorer.troops.stamina.refill();
            to_explorer.troops.stamina.refill();
            if from_explorer.troops.stamina.amount < to_explorer.troops.stamina.amount {
                to_explorer.troops.stamina.amount = from_explorer.troops.stamina.amount;
            }

            // update explorer models
            world.write_model(@from_explorer);
            world.write_model(@to_explorer);

            // todo: ensure explorer health does not exceed max health
            // todo: ensure both explorers are adjacent to one another
            // todo: ensure from troop still has enough capacity to carry resources left over 
        }

        fn explorer_delete(ref self: ContractState, explorer_id: ID) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns explorer
            let structure: Structure = world.read_model(explorer_id);
            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            explorer.owner.assert_caller_owner(world);

            // ensure army is dead
            assert!(explorer.troops.health.is_zero(), "explorer unit is alive");

            // get occupiers of the explorer's location
            let occupiers: Occupiers = world.read_model((explorer.coord.x, explorer.coord.y));
            assert!(occupiers.values.len() == 1, "error: occupiers length is not 1");

            // delete explorer
            world.erase_model(@explorer);
            world.erase_model(@occupiers);
        }

        fn explorer_move(ref self: TContractState, explorer_id: ID, direction: Direction) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);


            // ensure caller owns explorer
            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            explorer.owner.assert_caller_owner(world);

            // ensure explorer is alive
            assert!(explorer.troops.health.is_non_zero(), "explorer is dead");

            // ensure explorer can move (??)
            assert!(explorer.travel.blocked == false, "explorer is blocked from moving");

            // let stamina_cost: TravelStaminaCostConfig = world.read_model((WORLD_CONFIG_ID, TravelTypes::EXPLORE));
            // StaminaImpl::handle_stamina_costs(explorer_id, stamina_cost.cost, ref world);

            // pay food 
            // TravelFoodCostConfigImpl::pay_exploration_cost(ref world, unit_entity_owner, army.troops);

            // mint reward
            // let exploration_reward = MapConfigImpl::random_reward(ref world);
            // InternalResourceSystemsImpl::transfer(ref world, 0, explorer_id, exploration_reward, 0, false, false);

            // ensure next coordinate is not occupied
            let next_coord = explorer.coord.neighbor(direction);
            let mut occupiers: Occupiers = world.read_model((next_coord.x, next_coord.y));
            assert!(occupiers.values.len() == 0, "next coordinate is occupied");

            // explore coordinate
            // InternalMapSystemsImpl::explore(ref world, explorer_id, next_coord, exploration_reward);

            // attempt to discover shards mine
            // let (contract_address, _) = world.dns(@"map_generation_systems").unwrap();
            // let map_generation_contract = IMapGenerationSystemsDispatcher { contract_address };
            // let is_shards_mine = map_generation_contract.discover_shards_mine(unit_entity_owner, next_coord);

            // travel to explored tile location
            InternalTravelSystemsImpl::travel_hex(ref world, explorer_id, current_coord, array![direction].span());

            // grant achievement
            // // [Achievement] Explore a tile
            // let player_id: felt252 = starknet::get_caller_address().into();
            // let task_id: felt252 = Task::Explorer.identifier();
            // let time = starknet::get_block_timestamp();
            // let store = StoreTrait::new(world);
            // store.progress(player_id, task_id, count: 1, time: time,);

            // // [Achievement] Discover a shards mine
            // if is_shards_mine {
            //     let task_id: felt252 = Task::Discoverer.identifier();
            //     store.progress(player_id, task_id, count: 1, time: time,);
            // }
        }

}


    #[generate_trait]
    pub impl InternalExplorerImpl of InternalExplorerTrait {
        fn deduct_explorer_resource(
            ref world: WorldStorage,
            from_structure_id: ID,
            amount: u128, 
            category: TroopType, 
            tier: TroopTier
        ) -> ID {
            let resource_type = match tier {
                TroopTier::T1 => {
                    match category {
                        TroopType::Knight => ResourceTypes::KNIGHT_T1,
                        TroopType::Crossbowman => ResourceTypes::CROSSBOWMAN_T1,
                        TroopType::Paladin => ResourceTypes::PALADIN_T1,
                    },
                },

                TroopTier::T2 => {
                    match category {
                        TroopType::Knight => ResourceTypes::KNIGHT_T2,
                        TroopType::Crossbowman => ResourceTypes::CROSSBOWMAN_T2,
                        TroopType::Paladin => ResourceTypes::PALADIN_T2,
                    },
                },

                TroopTier::T3 => {
                    match category {
                        TroopType::Knight => ResourceTypes::KNIGHT_T3,
                        TroopType::Crossbowman => ResourceTypes::CROSSBOWMAN_T3,
                        TroopType::Paladin => ResourceTypes::PALADIN_T3,
                    },
                },
            };

            let mut explorer_resource: Resource 
                = ResourceImpl::get(world, (from_structure_id, resource_type));
            explorer_resource.burn(amount);
            explorer_resource.save(ref world);
        }
    }
}
