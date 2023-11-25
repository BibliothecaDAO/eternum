#[dojo::contract]
mod hyperstructure_systems {
    use eternum::alias::ID;
    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::resources::{Resource, ResourceCost};
    use eternum::models::owner::Owner;
    use eternum::models::position::{Coord, Position};

    use eternum::systems::hyperstructure::interface::IHyperstructureSystems;


    #[external(v0)]
    impl HyperstructureSystemsImpl of IHyperstructureSystems<ContractState> {

        fn upgrade_level(
            self: @ContractState,
            world: IWorldDispatcher,
            hyperstructure_id: u128,
        ){
            let mut hyperstructure = get!(world, hyperstructure_id, HyperStructure);
            assert(hyperstructure.construction_resource_id != 0, 'does not exist');
            assert(hyperstructure.level < hyperstructure.max_level, 'max level reached');
            
            let new_level = hyperstructure.level + 1;

            let mut index = 0;
            loop {
                if index == hyperstructure.construction_resource_count {
                    break;
                }


                let total_construction_resource_cost 
                    = get!(world, (hyperstructure.construction_resource_id, index), ResourceCost);
                let hyperstructure_resource 
                    = get!(world, 
                        (hyperstructure.entity_id, total_construction_resource_cost.resource_type), Resource);
                
                assert(
                    hyperstructure_resource.balance 
                        >= (new_level.into() * total_construction_resource_cost.amount) 
                            / hyperstructure.max_level.into(),
                                'not enough resources' 
                );

                index += 1;
            };

            hyperstructure.level = new_level;
            set!(world, (hyperstructure));
        }


        fn downgrade_level(
            self: @ContractState,
            world: IWorldDispatcher,
            hyperstructure_id: u128,
        ){
            let mut hyperstructure = get!(world, hyperstructure_id, HyperStructure);
            assert(hyperstructure.construction_resource_id != 0, 'does not exist');
            assert(hyperstructure.level != 0, 'least level reached');

            let mut index = 0;
            let mut can_downgrade = false;

            loop {
                if index == hyperstructure.construction_resource_count {
                    break;
                }


                let total_construction_resource_cost 
                    = get!(world, (hyperstructure.construction_resource_id, index), ResourceCost);
                let hyperstructure_resource 
                    = get!(world, 
                        (hyperstructure.entity_id, total_construction_resource_cost.resource_type), Resource);
                
                if (
                    hyperstructure_resource.balance 
                        < (hyperstructure.level.into() * total_construction_resource_cost.amount) 
                            / hyperstructure.max_level.into()
                ) {
                    can_downgrade = true;
                    break;
                };

                index += 1;
            };

            assert(can_downgrade, 'can not downgrade');

            hyperstructure.level -= 1;
            set!(world, (hyperstructure));

        }
    }
}