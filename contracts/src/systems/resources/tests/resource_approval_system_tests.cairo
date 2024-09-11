mod resource_approval_system_tests {
    use core::num::traits::Bounded;

    use core::traits::Into;

    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use eternum::alias::ID;

    use eternum::constants::ResourceTypes;
    use eternum::constants::WORLD_CONFIG_ID;
    use eternum::models::config::WeightConfig;
    use eternum::models::owner::{Owner, EntityOwner};
    use eternum::models::position::Position;
    use eternum::models::quantity::Quantity;
    use eternum::models::resources::{Resource, ResourceAllowance};

    use eternum::systems::resources::contracts::{
        resource_systems, IResourceSystemsDispatcher, IResourceSystemsDispatcherTrait
    };

    use eternum::utils::testing::{world::spawn_eternum, systems::deploy_system};
    use starknet::contract_address_const;


    fn setup() -> (IWorldDispatcher, IResourceSystemsDispatcher) {
        let world = spawn_eternum();

        let resource_systems_address = deploy_system(world, resource_systems::TEST_CLASS_HASH);

        let resource_systems_dispatcher = IResourceSystemsDispatcher { contract_address: resource_systems_address };

        (world, resource_systems_dispatcher)
    }


    fn make_owner_and_receiver(world: IWorldDispatcher, owner_entity_id: ID, receiver_entity_id: ID) {
        let owner_entity_position = Position { x: 100_000, y: 200_000, entity_id: owner_entity_id.into() };

        set!(world, (owner_entity_position));
        set!(
            world,
            (
                Owner { address: contract_address_const::<'owner_entity'>(), entity_id: owner_entity_id.into() },
                EntityOwner { entity_id: owner_entity_id.into(), entity_owner_id: owner_entity_id.into() },
                Resource { entity_id: owner_entity_id.into(), resource_type: ResourceTypes::STONE, balance: 1000 },
                Resource { entity_id: owner_entity_id.into(), resource_type: ResourceTypes::WOOD, balance: 1000 }
            )
        );

        let receiver_entity_position = Position { x: 100_000, y: 200_000, entity_id: receiver_entity_id.into() };
        set!(world, (receiver_entity_position));
        set!(
            world,
            (
                Resource { entity_id: receiver_entity_id.into(), resource_type: ResourceTypes::STONE, balance: 1000 },
                Resource { entity_id: receiver_entity_id.into(), resource_type: ResourceTypes::WOOD, balance: 1000 }
            )
        );
    }


    #[test]
    #[available_gas(30000000000000)]
    fn test_approve() {
        let (world, resource_systems_dispatcher) = setup();

        let owner_entity_id: ID = 11;
        let receiver_entity_id: ID = 12;
        make_owner_and_receiver(world, owner_entity_id, receiver_entity_id);

        let approved_entity_id: ID = 13;

        set!(
            world,
            (
                Owner { address: contract_address_const::<'approved_entity'>(), entity_id: approved_entity_id.into() },
                EntityOwner { entity_id: approved_entity_id.into(), entity_owner_id: approved_entity_id.into() }
            )
        );

        // owner approves approved
        starknet::testing::set_contract_address(contract_address_const::<'owner_entity'>());
        resource_systems_dispatcher
            .approve(
                owner_entity_id.into(),
                approved_entity_id.into(),
                array![(ResourceTypes::STONE, 600), (ResourceTypes::WOOD, 800),].span()
            );

        // check approval balance
        let approved_entity_stone_allowance = get!(
            world, (owner_entity_id, approved_entity_id, ResourceTypes::STONE), ResourceAllowance
        );
        let approved_entity_wood_allowance = get!(
            world, (owner_entity_id, approved_entity_id, ResourceTypes::WOOD), ResourceAllowance
        );
        assert(approved_entity_stone_allowance.amount == 600, 'stone allowance mismatch');
        assert(approved_entity_wood_allowance.amount == 800, 'wood allowance mismatch');
    }


    #[test]
    #[available_gas(30000000000000)]
    fn test_approve__infinite_approval() {
        let (world, resource_systems_dispatcher) = setup();

        let owner_entity_id: ID = 11;
        let receiver_entity_id: ID = 12;
        make_owner_and_receiver(world, owner_entity_id, receiver_entity_id);

        let approved_entity_id: ID = 13;

        set!(
            world,
            (
                Owner { address: contract_address_const::<'approved_entity'>(), entity_id: approved_entity_id.into() },
                EntityOwner { entity_id: approved_entity_id.into(), entity_owner_id: approved_entity_id.into() }
            )
        );

        // owner approves approved
        starknet::testing::set_contract_address(contract_address_const::<'owner_entity'>());
        resource_systems_dispatcher
            .approve(
                owner_entity_id.into(),
                approved_entity_id.into(),
                array![(ResourceTypes::STONE, Bounded::MAX), (ResourceTypes::WOOD, Bounded::MAX),].span()
            );

        // check approval balance
        let approved_entity_stone_allowance = get!(
            world, (owner_entity_id, approved_entity_id, ResourceTypes::STONE), ResourceAllowance
        );
        let approved_entity_wood_allowance = get!(
            world, (owner_entity_id, approved_entity_id, ResourceTypes::WOOD), ResourceAllowance
        );
        assert(approved_entity_stone_allowance.amount == Bounded::MAX, 'stone allowance mismatch');
        assert(approved_entity_wood_allowance.amount == Bounded::MAX, 'wood allowance mismatch');
    }


    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn test_approve__not_owner() {
        let (world, resource_systems_dispatcher) = setup();

        let owner_entity_id: ID = 11;
        let receiver_entity_id: ID = 12;
        make_owner_and_receiver(world, owner_entity_id, receiver_entity_id);

        let approved_entity_id: ID = 13;

        set!(
            world,
            (Owner { address: contract_address_const::<'approved_entity'>(), entity_id: approved_entity_id.into() })
        );

        // some unknown entity calls approve
        starknet::testing::set_contract_address(contract_address_const::<'unknown_entity'>());
        resource_systems_dispatcher
            .approve(
                owner_entity_id.into(),
                approved_entity_id.into(),
                array![(ResourceTypes::STONE, 600), (ResourceTypes::WOOD, 800),].span()
            );
    }
}
