#[dojo::contract]
mod hyperstructure_systems {
    use eternum::alias::ID;
    use eternum::models::resources::{Resource, ResourceCost};
    use eternum::models::owner::Owner;
    use eternum::models::hyperstructure::{HyperStructure};
    use eternum::models::realm::{Realm};
    use eternum::models::order::{Order};
    use eternum::models::position::{Coord, Position, PositionTrait};

    use eternum::systems::hyperstructure::interface::IHyperstructureSystems;
    use eternum::constants::WORLD_CONFIG_ID;



    #[external(v0)]
    impl HyperstructureSystemsImpl of IHyperstructureSystems<ContractState> {

        fn build(
            self: @ContractState, world: IWorldDispatcher, hyperstructure_id: ID, order_id: u8
        ) {

            let mut hyperstructure = get!(world, hyperstructure_id, HyperStructure);
            assert(hyperstructure.completion_resource_count > 0, 'hyperstructure does not exist');

            if hyperstructure.controlling_order != 0 {
                // ensure that the hyperstructure has been completely
                // conquered by checking that it has no resources

                let completion_cost_id = hyperstructure.completion_cost_id;
                let mut index = 0;
                loop {
                    if index == hyperstructure.completion_resource_count {
                        break;
                    }

                    let resource_cost = get!(world, (completion_cost_id, index), ResourceCost);
                    let resource = get!(world, (hyperstructure_id, resource_cost.resource_type), Resource);
                    assert(resource.balance == 0, 'not conquered');

                    index += 1;
                };

                // update controlling order's hyperstructure count 
                // if it completed the hyperstructure
                if hyperstructure.completed {
                    let mut order = get!(world, hyperstructure.controlling_order, Order);
                    order.hyperstructure_count -= 1;
                    set!(world, (order));
                }
            }

            // set the controlling order to the new order
            hyperstructure.controlling_order = order_id;
            hyperstructure.completed = false;
            set!(world, (hyperstructure));
        }


        fn complete(
            self: @ContractState, world: IWorldDispatcher, hyperstructure_id: ID
        ) {

            let mut hyperstructure = get!(world, hyperstructure_id, HyperStructure);
            assert(hyperstructure.completion_resource_count > 0, 'hyperstructure does not exist');
            assert(hyperstructure.controlling_order != 0, 'not controlled by any order');


            let completion_cost_id = hyperstructure.completion_cost_id;
            let mut index = 0;
            loop {
                if index == hyperstructure.completion_resource_count {
                    break;
                }

                let resource_cost = get!(world, (completion_cost_id, index), ResourceCost);
                let resource = get!(world, (hyperstructure_id, resource_cost.resource_type), Resource);
                assert(resource.balance >= resource_cost.amount, 'not enough resources');

                index += 1;
            }; 


            // set hyperstructure to completed
            hyperstructure.completed = true;
            set!(world, (hyperstructure));

            // update order hyperstructure count
            let mut order = get!(world, hyperstructure.controlling_order, Order);
            order.hyperstructure_count += 1;
            set!(world, (order));
        }

       
    }
}