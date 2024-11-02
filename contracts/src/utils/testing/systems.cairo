use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::systems::config::contracts::config_systems;

use eternum::systems::{
    realm::contracts::{realm_systems, IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait},
    combat::contracts::battle_systems::{
        battle_systems, IBattleContractDispatcher, IBattleContractDispatcherTrait, battle_pillage_systems,
        IBattlePillageContractDispatcher, IBattlePillageContractDispatcherTrait
    },
    combat::contracts::troop_systems::{troop_systems, ITroopContractDispatcher, ITroopContractDispatcherTrait},
    hyperstructure::contracts::{
        hyperstructure_systems, IHyperstructureSystemsDispatcher, IHyperstructureSystemsDispatcherTrait
    },
    map::contracts::{map_systems, IMapSystemsDispatcher, IMapSystemsDispatcherTrait},
    dev::contracts::resource::{dev_resource_systems, IResourceSystemsDispatcher, IResourceSystemsDispatcherTrait},
};
use starknet::{ContractAddress};

use dojo::world::WorldStorage;
use dojo::model::ModelStorage;
use dojo_cairo_test::deploy_contract;



fn deploy_system(world: WorldStorage, class_hash_felt: felt252) -> ContractAddress {
    let contract_address = deploy_contract(class_hash_felt, array![].span());
    contract_address
}

fn deploy_realm_systems(world: WorldStorage) -> IRealmSystemsDispatcher {
    let realm_systems_address = deploy_system(world, realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher { contract_address: realm_systems_address };

    realm_systems_dispatcher
}

fn deploy_hyperstructure_systems(world: WorldStorage) -> IHyperstructureSystemsDispatcher {
    let hyperstructure_systems_address = deploy_system(world, hyperstructure_systems::TEST_CLASS_HASH);
    let hyperstructure_systems_dispatcher = IHyperstructureSystemsDispatcher {
        contract_address: hyperstructure_systems_address
    };

    hyperstructure_systems_dispatcher
}

fn deploy_troop_systems(world: WorldStorage) -> ITroopContractDispatcher {
    let troop_systems_address = deploy_system(world, troop_systems::TEST_CLASS_HASH);
    let troop_systems_dispatcher = ITroopContractDispatcher { contract_address: troop_systems_address };
    troop_systems_dispatcher
}


fn deploy_battle_systems(world: WorldStorage) -> IBattleContractDispatcher {
    let battle_systems_address = deploy_system(world, battle_systems::TEST_CLASS_HASH);
    let battle_systems_dispatcher = IBattleContractDispatcher { contract_address: battle_systems_address };
    battle_systems_dispatcher
}

fn deploy_battle_pillage_systems(world: WorldStorage) -> IBattlePillageContractDispatcher {
    let battle_pillage_systems_address = deploy_system(world, battle_pillage_systems::TEST_CLASS_HASH);
    let battle_pillage_systems_dispatcher = IBattlePillageContractDispatcher {
        contract_address: battle_pillage_systems_address
    };
    battle_pillage_systems_dispatcher
}

fn deploy_map_systems(world: WorldStorage) -> IMapSystemsDispatcher {
    let map_systems_address = deploy_system(world, map_systems::TEST_CLASS_HASH);
    let map_systems_dispatcher = IMapSystemsDispatcher { contract_address: map_systems_address };
    map_systems_dispatcher
}

fn deploy_dev_resource_systems(world: WorldStorage) -> IResourceSystemsDispatcher {
    let dev_resource_systems_address = deploy_system(world, dev_resource_systems::TEST_CLASS_HASH);
    let dev_resource_systems_dispatcher = IResourceSystemsDispatcher { contract_address: dev_resource_systems_address };
    dev_resource_systems_dispatcher
}
