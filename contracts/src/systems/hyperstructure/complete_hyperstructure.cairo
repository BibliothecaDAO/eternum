#[system]
mod CompleteHyperStructure {
    use eternum::alias::ID;
    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::resources::{Resource, ResourceCost};

    use dojo::world::Context;

    use core::traits::Into;

    fn execute(ctx: Context, hyperstructure_id: ID) {
        
        let hyperstructure = get!(ctx.world, hyperstructure_id, HyperStructure);
        assert(hyperstructure.initialized_at != 0 , 'hyperstructure not initialized');
        assert(hyperstructure.completed_at == 0 , 'hyperstructure completed');

        let mut index = 0;
        loop {
            if index == hyperstructure.construction_resource_count {
                break;
            }

            let construction_resource_cost = get!(ctx.world, (hyperstructure.construction_resource_id, index), ResourceCost);
            let hyperstructure_resource = get!(ctx.world, (hyperstructure_id, construction_resource_cost.resource_type), Resource);
            assert(hyperstructure_resource.balance >= construction_resource_cost.amount, 'not enough resources');
            
            index += 1;
        };

        set!(ctx.world, (
             HyperStructure {
                entity_id: hyperstructure.entity_id,
                hyperstructure_type: hyperstructure.hyperstructure_type,
                initialization_resource_id: hyperstructure.initialization_resource_id,
                initialization_resource_count: hyperstructure.initialization_resource_count,
                construction_resource_id: hyperstructure.construction_resource_id,
                construction_resource_count: hyperstructure.construction_resource_count,
                initialized_at: hyperstructure.initialized_at,
                completed_at: starknet::get_block_timestamp(),
                coord_x: hyperstructure.coord_x,
                coord_y: hyperstructure.coord_y
            }
        ));

    }        
}



#[cfg(test)]
mod tests {

    use eternum::models::position::{Coord, Position};
    use eternum::models::resources::Resource;
    use eternum::models::hyperstructure::HyperStructure;
    use eternum::models::owner::Owner;

    use eternum::constants::ResourceTypes;
    
    use eternum::utils::testing::spawn_eternum;
    
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    use starknet::contract_address_const;

    use core::array::ArrayTrait;
    use core::serde::Serde;
    use core::traits::TryInto;
    use core::option::OptionTrait;
    use core::clone::Clone;


    fn setup() -> (IWorldDispatcher, felt252 ){
        let world = spawn_eternum();

        let entity_id: u128 = 44;

        starknet::testing::set_contract_address(world.executor());
        set!(world, ( 
            Owner { entity_id, address: contract_address_const::<'entity'>()},
            // set resources for initialization
            Resource {
                entity_id: entity_id,
                resource_type: ResourceTypes::STONE,
                balance: 400
            },
            Resource {
                entity_id: entity_id,
                resource_type: ResourceTypes::WOOD,
                balance: 400
            },
            Position {
                entity_id: entity_id,
                x: 20,
                y: 30
            }
        ));


        starknet::testing::set_contract_address(contract_address_const::<'entity'>());

        
        let hyperstructure_type = 1_u8;
        let initialization_resources = array![
            (ResourceTypes::STONE, 10_u8), // 10 stone
            (ResourceTypes::WOOD, 13_u8)  // 13 wood
        ];
        let construction_resources = array![
            (ResourceTypes::STONE, 40_u8), // 40 stone
            (ResourceTypes::WOOD, 50_u8)  // 50 wood
        ];
        let hyperstructure_coord = Coord{ x:20, y:30 };


        let mut calldata = array![];
        Serde::serialize(@hyperstructure_type, ref calldata);
        Serde::serialize(@initialization_resources, ref calldata); 
        Serde::serialize(@construction_resources, ref calldata); 
        Serde::serialize(@hyperstructure_coord, ref calldata);
        let result = world.execute('DefineHyperStructure', calldata);
        let hyperstructure_id = *result[0];

        // update block timestamp
        starknet::testing::set_block_timestamp(1);
        let mut calldata = array![];
        Serde::serialize(@entity_id, ref calldata);
        Serde::serialize(@hyperstructure_id, ref calldata);
        world.execute('InitializeHyperStructure', calldata);

        (world, hyperstructure_id)
    }



    #[test]
    #[available_gas(3000000000000)]  
    fn test_complete() {
        let (world, hyperstructure_id) = setup();

        starknet::testing::set_contract_address(world.executor());
        set!(world, ( 
            Resource {
                entity_id: hyperstructure_id.try_into().unwrap(),
                resource_type: ResourceTypes::STONE,
                balance: 60
            },
            Resource {
                entity_id: hyperstructure_id.try_into().unwrap(),
                resource_type: ResourceTypes::WOOD,
                balance: 50
            }   
        ));

        starknet::testing::set_contract_address(contract_address_const::<'entity'>());
        let mut calldata = array![];
        Serde::serialize(@hyperstructure_id, ref calldata);
        world.execute('CompleteHyperStructure', calldata);

        let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
        assert(hyperstructure.completed_at != 0, 'not completed');
    }





    #[test]
    #[available_gas(3000000000000)]  
    #[should_panic(expected: ('not enough resources','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_not_enough_resources() {
        let (world, hyperstructure_id) = setup();

        starknet::testing::set_contract_address(world.executor());
        set!(world, ( 
            Resource {
                entity_id: hyperstructure_id.try_into().unwrap(),
                resource_type: ResourceTypes::WOOD,
                balance: 50
            }
        ));

        starknet::testing::set_contract_address(contract_address_const::<'entity'>());
        let mut calldata = array![];
        Serde::serialize(@hyperstructure_id, ref calldata);
        world.execute('CompleteHyperStructure', calldata);
    }





    #[test]
    #[available_gas(3000000000000)]  
    #[should_panic(expected: ('hyperstructure completed','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_already_completed() {
        let (world, hyperstructure_id) = setup();

        starknet::testing::set_contract_address(world.executor());
        set!(world, ( 
            Resource {
                entity_id: hyperstructure_id.try_into().unwrap(),
                resource_type: ResourceTypes::STONE,
                balance: 40
            },
            Resource {
                entity_id: hyperstructure_id.try_into().unwrap(),
                resource_type: ResourceTypes::WOOD,
                balance: 50
            }   
        ));

        starknet::testing::set_contract_address(contract_address_const::<'entity'>());
        let mut calldata = array![];
        Serde::serialize(@hyperstructure_id, ref calldata);

        // call complete system twice
        world.execute('CompleteHyperStructure', calldata.clone());
        world.execute('CompleteHyperStructure', calldata.clone());
    }
}