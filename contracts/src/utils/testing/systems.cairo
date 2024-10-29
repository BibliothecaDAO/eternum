use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::systems::config::contracts::config_systems;

use eternum::systems::{
    realm::contracts::{realm_systems, IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait},
    combat::contracts::{combat_systems, ICombatContractDispatcher, ICombatContractDispatcherTrait},
    hyperstructure::contracts::{
        hyperstructure_systems, IHyperstructureSystemsDispatcher, IHyperstructureSystemsDispatcherTrait
    },
    map::contracts::{map_systems, IMapSystemsDispatcher, IMapSystemsDispatcherTrait},
    dev::contracts::resource::{dev_resource_systems, IResourceSystemsDispatcher, IResourceSystemsDispatcherTrait},
};
use starknet::{ContractAddress};

fn deploy_contract(contract_class_hash: felt252, calldata: Array<felt252>) -> ContractAddress {
    let (address, _) = starknet::deploy_syscall(contract_class_hash.try_into().unwrap(), 0, calldata.span(), false)
        .unwrap();
    address
}

fn deploy_system(world: IWorldDispatcher, class_hash_felt: felt252) -> ContractAddress {
    let contract_address = world.deploy_contract(class_hash_felt, class_hash_felt.try_into().unwrap());

    world.grant_writer(dojo::utils::bytearray_hash(@"eternum"), contract_address);

    contract_address
}

fn deploy_realm_systems(world: IWorldDispatcher) -> IRealmSystemsDispatcher {
    let realm_systems_address = deploy_system(world, realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher { contract_address: realm_systems_address };

    realm_systems_dispatcher
}

fn deploy_hyperstructure_systems(world: IWorldDispatcher) -> IHyperstructureSystemsDispatcher {
    let hyperstructure_systems_address = deploy_system(world, hyperstructure_systems::TEST_CLASS_HASH);
    let hyperstructure_systems_dispatcher = IHyperstructureSystemsDispatcher {
        contract_address: hyperstructure_systems_address
    };

    hyperstructure_systems_dispatcher
}

fn deploy_combat_systems(world: IWorldDispatcher) -> ICombatContractDispatcher {
    let combat_systems_address = deploy_system(world, combat_systems::TEST_CLASS_HASH);
    let combat_systems_dispatcher = ICombatContractDispatcher { contract_address: combat_systems_address };
    combat_systems_dispatcher
}

fn deploy_map_systems(world: IWorldDispatcher) -> IMapSystemsDispatcher {
    let map_systems_address = deploy_system(world, map_systems::TEST_CLASS_HASH);
    let map_systems_dispatcher = IMapSystemsDispatcher { contract_address: map_systems_address };
    map_systems_dispatcher
}

fn deploy_dev_resource_systems(world: IWorldDispatcher) -> IResourceSystemsDispatcher {
    let dev_resource_systems_address = deploy_system(world, dev_resource_systems::TEST_CLASS_HASH);
    let dev_resource_systems_dispatcher = IResourceSystemsDispatcher { contract_address: dev_resource_systems_address };
    dev_resource_systems_dispatcher
}
