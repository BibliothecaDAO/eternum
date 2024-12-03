use core::array::{ArrayTrait, SpanTrait};

use dojo::model::{ModelStorage, ModelValueStorage, ModelStorageTest};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use dojo::world::{WorldStorage, WorldStorageTrait};
use dojo_cairo_test::{NamespaceDef, TestResource, ContractDefTrait};
use s0_eternum::alias::ID;

use s0_eternum::constants::{MAX_REALMS_PER_ADDRESS};
use s0_eternum::models::resources::{Resource, ResourceImpl, ResourceTrait};
use s0_eternum::models::{map::Tile, position::{Position, Coord, CoordTrait}, combat::Troops};
use s0_eternum::systems::{
    hyperstructure::contracts::{IHyperstructureSystemsDispatcher, IHyperstructureSystemsDispatcherTrait},
    realm::contracts::realm_systems::InternalRealmLogicImpl,
    combat::contracts::battle_systems::{battle_systems, IBattleContractDispatcher, IBattleContractDispatcherTrait},
    combat::contracts::troop_systems::{troop_systems, ITroopContractDispatcher, ITroopContractDispatcherTrait},
};
use s0_eternum::utils::map::biomes::Biome;


fn spawn_realm(ref world: WorldStorage, realm_id: ID, coord: Coord) -> ID {
    let owner = starknet::get_contract_address();
    let realm_id = 1;
    let produced_resources = array![];
    let order = 1;
    let (realm_entity_id, _realm_produced_resources_packed) = InternalRealmLogicImpl::create_realm(
        ref world, owner, realm_id, produced_resources, order, 0, 1, coord.into()
    );

    realm_entity_id
}

fn spawn_hyperstructure(
    ref world: WorldStorage,
    hyperstructure_systems_dispatcher: IHyperstructureSystemsDispatcher,
    realm_entity_id: ID,
    coord: Coord
) -> ID {
    explore_tile(ref world, realm_entity_id, coord);

    let hyperstructure_entity_id = hyperstructure_systems_dispatcher.create(realm_entity_id, coord);

    hyperstructure_entity_id
}

fn create_army_with_troops(
    ref world: WorldStorage,
    troop_systems_dispatcher: ITroopContractDispatcher,
    realm_entity_id: ID,
    troops: Troops,
    is_defender: bool
) -> ID {
    let realm_army_unit_id: ID = troop_systems_dispatcher.army_create(realm_entity_id, false);

    troop_systems_dispatcher.army_buy_troops(realm_army_unit_id, realm_entity_id, troops);
    realm_army_unit_id
}

fn get_default_realm_pos() -> Position {
    Position { entity_id: 1, x: 100, y: 100 }
}

fn generate_realm_positions() -> Array<Position> {
    let mut positions = ArrayTrait::<Position>::new();
    let start_pos = get_default_realm_pos();

    let mut count = 0;
    while (count < MAX_REALMS_PER_ADDRESS + 1) {
        positions
            .append(
                Position {
                    x: start_pos.x + count.into(),
                    y: start_pos.y + count.into(),
                    entity_id: start_pos.entity_id + count.into()
                }
            );
        count += 1;
    };

    positions
}

fn get_default_hyperstructure_coord() -> Coord {
    Coord { x: 0, y: 0 }
}

fn explore_tile(ref world: WorldStorage, explorer_id: ID, coords: Coord) {
    world
        .write_model_test(
            @Tile { col: coords.x, row: coords.y, explored_by_id: explorer_id, explored_at: 1, biome: Biome::Beach }
        );
}


fn mint(ref world: WorldStorage, entity: ID, mut resources: Span<(u8, u128)>) {
    loop {
        match resources.pop_back() {
            Option::Some((
                _type, amount
            )) => {
                let mut resource = ResourceImpl::get(ref world, (entity, *_type));
                resource.add(*amount);
                resource.save(ref world);
            },
            Option::None => { break; }
        }
    };
}

fn teleport(ref world: WorldStorage, entity_id: ID, coord: Coord) {
    world.write_model_test(@Position { entity_id, x: coord.x, y: coord.y, });
}
