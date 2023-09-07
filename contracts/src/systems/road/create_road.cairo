#[system]
mod CreateRoad {
    
    use eternum::components::position::{Coord};
    use eternum::components::resources::Resource;
    use eternum::components::road::{Road, RoadImpl};
    use eternum::components::owner::Owner;

    use eternum::constants::ResourceTypes;
    
    use dojo::world::Context;

    use core::traits::Into;


    fn execute(ctx: Context, creator_id: u128, start_coord: Coord, end_coord: Coord, usage_count: u32) {

        // assert that creator entity is owned by caller
        let creator_owner = get!(ctx.world, creator_id, Owner);
        assert(creator_owner.address == ctx.origin, 'creator id not owned by caller');

        let road = RoadImpl::get(ctx.world, start_coord, end_coord);
        assert(road.usage_count == 0, 'road already exists');

        let cost_per_usage: u128 = 10;
        let fee: u128 = usage_count.into() * cost_per_usage;

        // ensure fee payment
        let creator_stone_resource = get!(ctx.world, (creator_id, ResourceTypes::STONE), Resource);
        assert(creator_stone_resource.balance >= fee, 'insufficient stone balance');
        
        set!(ctx.world, (
            Road {
                start_coord,
                end_coord,
                usage_count
            },
            Resource {
                entity_id: creator_stone_resource.entity_id,
                resource_type: creator_stone_resource.resource_type,
                balance: creator_stone_resource.balance -  fee
            }
        ));
    }
}



#[cfg(test)]
mod tests {
    use eternum::components::position::{Coord};
    use eternum::components::resources::Resource;
    use eternum::components::road::{Road, RoadImpl};
    use eternum::components::owner::Owner;

    use eternum::constants::ResourceTypes;
    
    use eternum::utils::testing::spawn_eternum;
    
    use dojo::world::IWorldDispatcherTrait;

    use starknet::contract_address_const;

    use core::array::ArrayTrait;
    use core::serde::Serde;

    #[test]
    #[available_gas(3000000000000)]  
    fn test_create() {
        let world = spawn_eternum();

        let creator_id: u128 = 44;

        starknet::testing::set_contract_address(world.executor());
        set!(world, ( 
            Owner { entity_id: creator_id, address: contract_address_const::<'creator'>()},
            Resource {
                entity_id: creator_id,
                resource_type: ResourceTypes::STONE,
                balance: 400
            }
        ));

        let start_coord = Coord { x: 20, y: 30};
        let end_coord = Coord { x: 40, y: 50};

        starknet::testing::set_contract_address(contract_address_const::<'creator'>());

        let mut calldata = array![];
        Serde::serialize(@creator_id, ref calldata);
        Serde::serialize(@end_coord, ref calldata); // end first because order should not matter
        Serde::serialize(@start_coord, ref calldata);
        Serde::serialize(@33, ref calldata);
        world.execute('CreateRoad', calldata);

        let road = RoadImpl::get(world, start_coord, end_coord);
        assert(road.usage_count == 33, 'usage count should be 33');

        let creator_stone_resource = get!(world, (creator_id, ResourceTypes::STONE), Resource);
        assert(creator_stone_resource.balance == 400 - (33 * 10), 'stone balance should be 70');
    }



    #[test]
    #[available_gas(3000000000000)]  
    #[should_panic(expected: ('creator id not owned by caller','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_not_creator() {
        let world = spawn_eternum();

        starknet::testing::set_contract_address(world.executor());
        let creator_id: u128 = 44;
        let start_coord = Coord { x: 20, y: 30};
        let end_coord = Coord { x: 40, y: 50};
        set!(world, ( 
            Owner { entity_id: creator_id, address: contract_address_const::<'creator'>()},
            Road {
                start_coord,
                end_coord,
                usage_count: 44
            })
        );

        // call as unknown address
        starknet::testing::set_contract_address(
            contract_address_const::<'some_unknown'>()
        );

        let mut calldata = array![];
        Serde::serialize(@creator_id, ref calldata);
        Serde::serialize(@end_coord, ref calldata); // end first because order should not matter
        Serde::serialize(@start_coord, ref calldata);
        Serde::serialize(@1, ref calldata);
        world.execute('CreateRoad', calldata);
    
    }




    #[test]
    #[available_gas(3000000000000)]  
    #[should_panic(expected: ('insufficient stone balance','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_insufficient_balance() {
        let world = spawn_eternum();

        let creator_id: u128 = 44;

        starknet::testing::set_contract_address(world.executor());
        set!(world, ( 
            Owner { entity_id: creator_id, address: contract_address_const::<'creator'>()},
            Resource {
                entity_id: creator_id,
                resource_type: ResourceTypes::STONE,
                balance: 400
            }
        ));

        let start_coord = Coord { x: 20, y: 30};
        let end_coord = Coord { x: 40, y: 50};

        starknet::testing::set_contract_address(contract_address_const::<'creator'>());

        let mut calldata = array![];
        Serde::serialize(@creator_id, ref calldata);
        Serde::serialize(@end_coord, ref calldata); 
        Serde::serialize(@start_coord, ref calldata);
        Serde::serialize(@50, ref calldata); // 50 * 10 > 400
        world.execute('CreateRoad', calldata);
    }





    #[test]
    #[available_gas(3000000000000)]  
    #[should_panic(expected: ('road already exists','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_already_exists() {
        let world = spawn_eternum();

        starknet::testing::set_contract_address(world.executor());
        let creator_id: u128 = 44;
        let start_coord = Coord { x: 20, y: 30};
        let end_coord = Coord { x: 40, y: 50};
        set!(world, ( 
            Owner { entity_id: creator_id, address: contract_address_const::<'creator'>()},
            Road {
                start_coord,
                end_coord,
                usage_count: 44
            })
        );

        starknet::testing::set_contract_address(contract_address_const::<'creator'>());

        let mut calldata = array![];
        Serde::serialize(@creator_id, ref calldata);
        Serde::serialize(@end_coord, ref calldata); // end first because order should not matter
        Serde::serialize(@start_coord, ref calldata);
        Serde::serialize(@1, ref calldata);
        world.execute('CreateRoad', calldata);
    
    }
}
