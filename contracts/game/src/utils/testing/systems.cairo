use dojo::model::ModelStorage;

use dojo::world::WorldStorage;
use dojo::world::WorldStorageTrait;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use dojo_cairo_test::deploy_contract;
use s1_eternum::systems::config::contracts::config_systems;

use s1_eternum::systems::{
    realm::contracts::{realm_systems, IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait},
    combat::contracts::battle_systems::{
        battle_systems, IBattleContractDispatcher, IBattleContractDispatcherTrait, battle_pillage_systems,
        IBattlePillageContractDispatcher, IBattlePillageContractDispatcherTrait
    },
    combat::contracts::troop_systems::{troop_systems, ITroopContractDispatcher, ITroopContractDispatcherTrait},
    hyperstructure::contracts::{
        hyperstructure_systems, IHyperstructureSystemsDispatcher, IHyperstructureSystemsDispatcherTrait
    },
    season::contracts::{season_systems, ISeasonSystemsDispatcher, ISeasonSystemsDispatcherTrait},
    map::contracts::{map_systems, IMapSystemsDispatcher, IMapSystemsDispatcherTrait},
    dev::contracts::resource::{dev_resource_systems, IResourceSystemsDispatcher, IResourceSystemsDispatcherTrait},
};
use starknet::{ContractAddress};


fn deploy_system(ref world: WorldStorage, name: ByteArray) -> ContractAddress {
    let (contract_address, _) = world.dns(@name).unwrap();
    contract_address
}

fn deploy_realm_systems(ref world: WorldStorage) -> IRealmSystemsDispatcher {
    let realm_systems_address = deploy_system(ref world, "realm_systems");
    let realm_systems_dispatcher = IRealmSystemsDispatcher { contract_address: realm_systems_address };

    realm_systems_dispatcher
}

fn deploy_hyperstructure_systems(ref world: WorldStorage) -> IHyperstructureSystemsDispatcher {
    let hyperstructure_systems_address = deploy_system(ref world, "hyperstructure_systems");
    let hyperstructure_systems_dispatcher = IHyperstructureSystemsDispatcher {
        contract_address: hyperstructure_systems_address
    };

    hyperstructure_systems_dispatcher
}

fn deploy_season_systems(ref world: WorldStorage) -> (ISeasonSystemsDispatcher, starknet::ContractAddress) {
    let season_systems_address = deploy_system(ref world, "season_systems");
    let season_systems_dispatcher = ISeasonSystemsDispatcher { contract_address: season_systems_address };

    (season_systems_dispatcher, season_systems_address)
}

fn deploy_troop_systems(ref world: WorldStorage) -> ITroopContractDispatcher {
    let troop_systems_address = deploy_system(ref world, "troop_systems");
    let troop_systems_dispatcher = ITroopContractDispatcher { contract_address: troop_systems_address };
    troop_systems_dispatcher
}


fn deploy_battle_systems(ref world: WorldStorage) -> IBattleContractDispatcher {
    let battle_systems_address = deploy_system(ref world, "battle_systems");
    let battle_systems_dispatcher = IBattleContractDispatcher { contract_address: battle_systems_address };
    battle_systems_dispatcher
}

fn deploy_battle_pillage_systems(ref world: WorldStorage) -> IBattlePillageContractDispatcher {
    let battle_pillage_systems_address = deploy_system(ref world, "battle_pillage_systems");
    let battle_pillage_systems_dispatcher = IBattlePillageContractDispatcher {
        contract_address: battle_pillage_systems_address
    };
    battle_pillage_systems_dispatcher
}

fn deploy_map_systems(ref world: WorldStorage) -> IMapSystemsDispatcher {
    let map_systems_address = deploy_system(ref world, "map_systems");
    let map_systems_dispatcher = IMapSystemsDispatcher { contract_address: map_systems_address };
    map_systems_dispatcher
}

fn deploy_dev_resource_systems(ref world: WorldStorage) -> IResourceSystemsDispatcher {
    let dev_resource_systems_address = deploy_system(ref world, "dev_resource_systems");
    let dev_resource_systems_dispatcher = IResourceSystemsDispatcher { contract_address: dev_resource_systems_address };
    dev_resource_systems_dispatcher
}
