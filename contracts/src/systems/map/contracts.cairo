use eternum::alias::ID;

#[starknet::interface]
trait IMapSystems<T> {
    fn explore(ref self: T, unit_id: ID, direction: eternum::models::position::Direction);
}

#[dojo::contract]
mod map_systems {
    use arcade_trophy::store::{Store, StoreTrait};
    use core::num::traits::Bounded;
    use core::option::OptionTrait;
    use core::traits::Into;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use eternum::alias::ID;
    use eternum::constants::{WORLD_CONFIG_ID, DEFAULT_NS, TravelTypes, ResourceTypes, ARMY_ENTITY_TYPE};
    use eternum::models::buildings::{BuildingCategory, Building, BuildingCustomImpl};
    use eternum::models::capacity::{CapacityCategory};
    use eternum::models::combat::{
        Health, HealthCustomTrait, Army, ArmyCustomTrait, Troops, TroopsImpl, TroopsTrait, Protector, Protectee
    };
    use eternum::models::config::{
        ProductionConfig, CapacityConfigCategory, MapConfig, MapConfigImpl, MercenariesConfig, TroopConfigCustomImpl,
        TickImpl, TickTrait, TravelStaminaCostConfig, TravelFoodCostConfig, TravelFoodCostConfigImpl
    };
    use eternum::models::map::Tile;
    use eternum::models::movable::{Movable, ArrivalTime, MovableCustomTrait, ArrivalTimeCustomTrait};
    use eternum::models::owner::{Owner, EntityOwner, OwnerCustomTrait, EntityOwnerCustomTrait};
    use eternum::models::position::{Coord, CoordTrait, Direction, Position};
    use eternum::models::production::ProductionDeadline;
    use eternum::models::quantity::Quantity;
    use eternum::models::realm::{Realm};
    use eternum::models::resources::{
        Resource, ResourceCost, ResourceCustomTrait, ResourceFoodImpl, ResourceTransferLock, RESOURCE_PRECISION
    };

    use eternum::models::season::SeasonImpl;
    use eternum::models::stamina::StaminaCustomImpl;
    use eternum::models::structure::{Structure, StructureCategory, StructureCount, StructureCountCustomTrait};
    use eternum::systems::combat::contracts::troop_systems::troop_systems::{InternalTroopImpl};
    use eternum::systems::map::map_generation::map_generation_systems::{InternalMapGenerationSystemsImpl};
    use eternum::systems::resources::contracts::resource_systems::resource_systems::{InternalResourceSystemsImpl};
    use eternum::systems::transport::contracts::travel_systems::travel_systems::{InternalTravelSystemsImpl};
    use eternum::utils::map::biomes::{Biome, get_biome};
    use eternum::utils::random;
    use eternum::utils::tasks::index::{Task, TaskTrait};

    use starknet::ContractAddress;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: true)]
    struct MapExplored {
        #[key]
        entity_id: ID,
        #[key]
        col: u32,
        #[key]
        row: u32,
        #[key]
        id: ID,
        entity_owner_id: ID,
        biome: Biome,
        reward: Span<(u8, u128)>,
        timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: true)]
    struct FragmentMineDiscovered {
        #[key]
        entity_owner_id: ID,
        #[key]
        mine_entity_id: ID,
        #[key]
        production_deadline_tick: u64,
        discovered_at: u64
    }

    // @DEV TODO: We can generalise this more...
    #[abi(embed_v0)]
    impl MapSystemsImpl of super::IMapSystems<ContractState> {
        fn explore(ref self: ContractState, unit_id: ID, direction: Direction) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // check that caller owns unit
            let unit_entity_owner: EntityOwner = world.read_model(unit_id);
            unit_entity_owner.assert_caller_owner(world);

            // ensure unit is alive
            let health: Health = world.read_model(unit_id);
            health.assert_alive("Army");

            let unit_quantity: Quantity = world.read_model(unit_id);
            assert(unit_quantity.value.is_non_zero(), 'unit quantity is zero');

            // ensure unit can move
            let movable: Movable = world.read_model(unit_id);
            movable.assert_moveable();

            // ensure unit is not in transit
            let arrival_time: ArrivalTime = world.read_model(unit_id);
            arrival_time.assert_not_travelling();

            let stamina_cost: TravelStaminaCostConfig = world.read_model((WORLD_CONFIG_ID, TravelTypes::EXPLORE));
            StaminaCustomImpl::handle_stamina_costs(unit_id, stamina_cost.cost, ref world);

            let army: Army = world.read_model(unit_id);

            // explore coordinate, pay food and mint reward
            TravelFoodCostConfigImpl::pay_exploration_cost(ref world, unit_entity_owner, army.troops);
            let exploration_reward = MapConfigImpl::random_reward(ref world);

            InternalResourceSystemsImpl::transfer(ref world, 0, unit_id, exploration_reward, 0, false, false);

            let current_position: Position = world.read_model(unit_id);
            let current_coord: Coord = current_position.into();
            let next_coord = current_coord.neighbor(direction);
            InternalMapSystemsImpl::explore(ref world, unit_id, next_coord, exploration_reward);
            let is_shards_mine = InternalMapGenerationSystemsImpl::discover_shards_mine(
                ref world, unit_entity_owner, next_coord
            );

            // travel to explored tile location
            InternalTravelSystemsImpl::travel_hex(ref world, unit_id, current_coord, array![direction].span());

            // [Achievement] Explore a tile
            let player_id: felt252 = starknet::get_caller_address().into();
            let task_id: felt252 = Task::Explorer.identifier();
            let time = starknet::get_block_timestamp();
            let store = StoreTrait::new(world);
            store.progress(player_id, task_id, count: 1, time: time,);

            // [Achievement] Discover a shards mine
            if is_shards_mine {
                let task_id: felt252 = Task::Discoverer.identifier();
                store.progress(player_id, task_id, count: 1, time: time,);
            }
        }
    }


    #[generate_trait]
    pub impl InternalMapSystemsImpl of InternalMapSystemsTrait {
        fn explore(ref world: WorldStorage, entity_id: ID, coord: Coord, reward: Span<(u8, u128)>) -> Tile {
            let mut tile: Tile = world.read_model((coord.x, coord.y));
            assert(tile.explored_at == 0, 'already explored');

            // set tile as explored
            tile.explored_by_id = entity_id;
            tile.explored_at = starknet::get_block_timestamp();
            tile.biome = get_biome(coord.x.into(), coord.y.into());
            world.write_model(@tile);

            // emit explored event
            let entity_owned_by: EntityOwner = world.read_model(entity_id);

            world
                .emit_event(
                    @MapExplored {
                        id: world.dispatcher.uuid(),
                        entity_id: entity_id,
                        entity_owner_id: entity_owned_by.entity_owner_id,
                        col: tile.col,
                        row: tile.row,
                        biome: tile.biome,
                        reward,
                        timestamp: starknet::get_block_timestamp()
                    }
                );

            tile
        }
    }
}
