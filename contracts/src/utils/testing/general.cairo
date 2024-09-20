use core::array::{ArrayTrait, SpanTrait};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;

use eternum::constants::{MAX_REALMS_PER_ADDRESS};
use eternum::models::resources::{Resource, ResourceCustomImpl, ResourceCustomTrait};
use eternum::models::{map::Tile, position::{Position, Coord, CoordTrait}, combat::Troops};
use eternum::systems::{
    hyperstructure::contracts::{IHyperstructureSystemsDispatcher, IHyperstructureSystemsDispatcherTrait},
    realm::contracts::{IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait},
    combat::contracts::{combat_systems, ICombatContractDispatcher, ICombatContractDispatcherTrait},
};
use eternum::utils::map::biomes::Biome;

fn spawn_realm(world: IWorldDispatcher, realm_systems_dispatcher: IRealmSystemsDispatcher, position: Position) -> ID {
    let realm_entity_id = realm_systems_dispatcher
        .create(
            'Mysticora',
            1, // realm id
            0x20309, // resource_types_packed // 2,3,9 // stone, coal, gold
            3, // resource_types_count
            5, // cities
            5, // harbors
            5, // rivers
            5, // regions
            1, // wonder
            1, // order
        );

    set!(world, Position { entity_id: realm_entity_id, x: position.x, y: position.y });

    realm_entity_id
}

fn spawn_hyperstructure(
    world: IWorldDispatcher,
    hyperstructure_systems_dispatcher: IHyperstructureSystemsDispatcher,
    realm_entity_id: ID,
    coord: Coord
) -> ID {
    explore_tile(world, realm_entity_id, coord);

    let hyperstructure_entity_id = hyperstructure_systems_dispatcher.create(realm_entity_id, coord);

    hyperstructure_entity_id
}

fn create_army_with_troops(
    world: IWorldDispatcher,
    combat_systems_dispatcher: ICombatContractDispatcher,
    realm_entity_id: ID,
    troops: Troops,
    is_defender: bool
) -> ID {
    let realm_army_unit_id: ID = combat_systems_dispatcher.army_create(realm_entity_id, false);

    combat_systems_dispatcher.army_buy_troops(realm_army_unit_id, realm_entity_id, troops);
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

fn explore_tile(world: IWorldDispatcher, explorer_id: ID, coords: Coord) {
    set!(
        world, Tile { col: coords.x, row: coords.y, explored_by_id: explorer_id, explored_at: 0, biome: Biome::Beach }
    );
}


fn mint(world: IWorldDispatcher, entity: ID, mut resources: Span<(u8, u128)>) {
    loop {
        match resources.pop_back() {
            Option::Some((
                _type, amount
            )) => {
                let mut resource = ResourceCustomImpl::get(world, (entity, *_type));
                resource.add(*amount);
                resource.save(world);
            },
            Option::None => { break; }
        }
    };
}

fn teleport(world: IWorldDispatcher, entity_id: ID, coord: Coord) {
    set!(world, (Position { entity_id, x: coord.x, y: coord.y, }));
}
