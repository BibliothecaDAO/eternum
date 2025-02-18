use s1_eternum::alias::ID;
use s1_eternum::models::position::Direction;

#[starknet::interface]
trait ITroopMovementSystems<TContractState> {
    fn explorer_move(ref self: TContractState, explorer_id: ID, directions: Span<Direction>, explore: bool);
}

#[dojo::contract]
mod troop_movement_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS, ResourceTypes, WORLD_CONFIG_ID};
    use s1_eternum::models::{
        config::{
            BattleConfigTrait, CapacityConfig, CombatConfigImpl, MapConfig, SpeedConfig, TickConfig, TickImpl,
            TickTrait, TroopLimitConfig, TroopStaminaConfig, WorldConfigUtilImpl,
        },
        map::{Tile, TileImpl}, owner::{EntityOwner, EntityOwnerTrait, Owner, OwnerTrait},
        position::{Coord, CoordTrait, Direction, OccupiedBy, Occupier, OccupierTrait, Position, PositionTrait},
        resource::resource::{
            ResourceWeightImpl, SingleResource, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
        },
        season::SeasonImpl, stamina::{Stamina, StaminaTrait}, structure::{Structure, StructureCategory, StructureTrait},
        troop::{
            ExplorerTroops, GuardImpl, GuardSlot, GuardTrait, GuardTroops, TroopTier, TroopType, Troops, TroopsTrait,
        },
        weight::{Weight, WeightTrait},
    };
    use s1_eternum::systems::utils::map::iMapImpl;
    use s1_eternum::systems::utils::{mine::iMineDiscoveryImpl, troop::{iExplorerImpl, iTroopImpl}};

    use s1_eternum::utils::map::{biomes::{Biome, get_biome}};


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
            let occupier = Occupier { x: explorer.coord.x, y: explorer.coord.y, entity: OccupiedBy::None };
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
                let mut occupy_destination: bool = true;
                if explore {
                    // ensure only one tile can be explored
                    assert!(directions.len().is_zero(), "explorer can only move one direction when exploring");

                    // ensure target tile is not explored
                    assert!(!tile.discovered(), "tile is already explored");

                    // set tile as explored
                    iMapImpl::explore(ref world, ref tile, biome);

                    // perform lottery to discover mine
                    let map_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));
                    let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
                    let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
                    let lottery_won: bool = iMineDiscoveryImpl::lottery(
                        ref world,
                        starknet::get_caller_address(),
                        next,
                        map_config,
                        troop_limit_config,
                        troop_stamina_config,
                    );

                    // ensure explorer does not occupy fragment mine tile when mines are discovered
                    if lottery_won {
                        occupy_destination = false;
                    }

                    // grant resource reward for exploration
                    let (explore_reward_id, explore_reward_amount) = iExplorerImpl::exploration_reward(
                        ref world, map_config,
                    );
                    let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
                    let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, explore_reward_id);
                    let mut resource = SingleResourceStoreImpl::retrieve(
                        ref world, explorer_id, explore_reward_id, ref explorer_weight, resource_weight_grams, false,
                    );
                    resource.add(explore_reward_amount, ref explorer_weight, resource_weight_grams);
                    resource.store(ref world);
                    explorer_weight.store(ref world, explorer_id);
                } else {
                    // ensure all tiles passed through during travel are explored
                    assert!(tile.discovered(), "tile is not explored");
                }

                // update explorer coordinate
                explorer.coord = next;

                // set explorer as occupier of target coordinate
                if directions.len().is_zero() {
                    if occupy_destination {
                        occupier.entity = OccupiedBy::Explorer(explorer_id);
                        world.write_model(@occupier);
                    }
                    break;
                }
            };

            // burn stamina cost
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            iExplorerImpl::burn_stamina_cost(
                ref world,
                ref explorer,
                troop_stamina_config,
                explore,
                biomes,
                TickImpl::get_tick_config(ref world).current(),
            );

            // burn food cost
            iExplorerImpl::burn_food_cost(ref world, ref explorer, troop_stamina_config, explore);

            // update explorer
            world.write_model(@explorer);
        }
    }
}
