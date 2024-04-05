#[dojo::contract]
mod building {
    use eternum::alias::ID;
    use eternum::models::{
        resources::{Resource, ResourceCost}, owner::Owner, hyperstructure::HyperStructure,
        realm::Realm, order::Orders, position::{Coord, Position, PositionTrait, Direction},
        buildings::{BuildingCategory, Building, BuildingCategoryTrait, BuildingImpl},
        production::{Production, ProductionRateTrait}
    };
    use eternum::systems::buildings::interface::IBuildingContract;
    use eternum::constants::WORLD_CONFIG_ID;

    #[abi(embed_v0)]
    impl BuildingContractImpl of IBuildingContract<ContractState> {
        fn create_building(
            self: @TContractState, world: IWorldDispatcher, entity_id: u128,
            building_coord: Coord, building_category: BuildingCategory,
        ) {
            // check that entity is a realm
            BuildingImpl::create(world, entity_id, building_category, building_coord);
        }
        
        fn destroy_building(
            self: @TContractState, world: IWorldDispatcher, entity_id: u128, building_coord: Coord,
        ) {
            BuildingImpl::destroy(world, entity_id, building_coord);
        }


        fn start_resource_production(
            self: @TContractState, world: IWorldDispatcher, entity_id: u128, resource_type: u8,
        ) {
            let owner = get!(world, entity_id, Owner);

            assert!(
                owner.address == starknet::get_caller_address(), "caller not outer entity owner"
            );

            let mut production: Production = get!(world, (entity_id, resource_type), Production);

            production.activate();

            set!(world, (production));
        }


        fn stop_resource_production(
            self: @TContractState, world: IWorldDispatcher, entity_id: u128, resource_type: u8,
        ) {
            let owner = get!(world, entity_id, Owner);

            assert!(
                owner.address == starknet::get_caller_address(), "caller not outer entity owner"
            );

            let mut production: Production = get!(world, (entity_id, resource_type), Production);

            production.deactivate();

            set!(world, (production));
        }
    }
}
