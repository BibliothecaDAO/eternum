#[dojo::contract]
mod hyperstructure_systems {
    use eternum::alias::ID;
    use eternum::constants::HYPERSTRUCTURE_LEVELING_CONFIG_ID;
    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::resources::{Resource, ResourceCost};
    use eternum::models::owner::Owner;
    use eternum::models::position::{Coord, Position};
    use eternum::models::config::LevelingConfig;
    use eternum::models::level::Level;

    use eternum::systems::hyperstructure::interface::IHyperstructureSystems;
    use eternum::systems::leveling::contracts::leveling_systems::{InternalLevelingSystemsImpl as leveling};

    #[external(v0)]
    impl HyperstructureSystemsImpl of IHyperstructureSystems<ContractState> {

        fn level_up(
            self: @ContractState,
            world: IWorldDispatcher,
            hyperstructure_id: u128,
        ){
            let mut hyperstructure = get!(world, hyperstructure_id, HyperStructure);
            assert(hyperstructure.order != 0, 'does not exist');

            leveling::level_up(world, hyperstructure_id, HYPERSTRUCTURE_LEVELING_CONFIG_ID);
        }


        fn downgrade_level(
            self: @ContractState,
            world: IWorldDispatcher,
            hyperstructure_id: u128,
        ){
            let mut hyperstructure = get!(world, hyperstructure_id, HyperStructure);
            assert(hyperstructure.order != 0, 'does not exist');

            let level = get!(world, (hyperstructure_id), Level);

            assert(level.level != 0, 'least level reached');

            //let mut index = 0;
            //let mut can_downgrade = false;

            //loop {
                //if index == current_level_construction_resources_config.resource_cost_count {
                    //break;
                //}


                //let current_level_construction_resource_cost 
                    //= get!(world, (current_level_construction_resources_config.resource_cost_id, index), ResourceCost);
                //let hyperstructure_resource 
                    //= get!(world, 
                        //(hyperstructure.entity_id, current_level_construction_resource_cost.resource_type), Resource);
                
                //if (
                    //hyperstructure_resource.balance 
                        //< (hyperstructure.level.into() * current_level_construction_resource_cost.amount) 
                            /// hyperstructure.max_level.into()
                //) {
                    //can_downgrade = true;
                    //break;
                //};

                //index += 1;
            //};

            //assert(can_downgrade, 'can not downgrade');

            //hyperstructure.level -= 1;
            //set!(world, (hyperstructure));
        }
    }

    // TODO: get order_hyperstructure
    //#[generate_trait]
    //impl InternalHyperstructureSystemsImpl of InternalHyperstructureSystemsTrait {
        //get_order_hyperstructure_id(world, order_id: u128) -> ID {

            //// use world.entities to retrieve hyperstructure ids

            //// loop over hyperstructures and find the one with right order_id

        //}
    //}
}