use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::{EventSpy, EventSpyTrait, EventsFilterTrait, interact_with_state};
use starknet::ContractAddress;
use crate::resources::ResourceKey;
use crate::tests::state::StructureObservationTrait;
use crate::troops::Coord;

#[derive(Drop, Serde)]
pub struct Row {
    model: felt252,
    keys: Span<felt252>,
    values: Span<felt252>,
}

#[derive(Drop, Serde)]
pub struct Frame {
    events: Array<(Array<felt252>, Array<felt252>)>,
    rows: Array<Row>,
}

fn selected(model: felt252) -> bool {
    model == 'Structure'
        || model == 'ExplorerTroops'
        || model == 'TileOccupancy'
        || model == 'Building'
        || model == 'StructureBuildings'
}

fn row<T, +Serde<T>, +Drop<T>>(ref rows: Array<Row>, model: felt252, keys: Span<felt252>, value: T) {
    let mut values = array![];
    value.serialize(ref values);
    rows.append(Row { model, keys, values: values.span() });
}

fn observe(address: ContractAddress, game_id: u32, entities: Span<u32>, tiles: Span<Coord>) -> Array<Row> {
    let mut rows = array![];
    let views = crate::structures::IStructureOperationsDispatcher { contract_address: address };
    for entity_id in entities {
        let key = ResourceKey { game_id, entity_id: *entity_id };
        let keys = array![game_id.into(), (*entity_id).into()].span();
        if let Some(structure) = views.structure(key) {
            row(ref rows, 'Structure', keys, structure);
            row(ref rows, 'StructureBuildings', keys, views.structure_buildings(key));
            for inner_col in 10_u32..12 {
                let key = crate::buildings::BuildingKey { game_id, structure_id: *entity_id, inner_col, inner_row: 10 };
                if let Some(building) = views.building(key) {
                    let mut keys = array![];
                    key.serialize(ref keys);
                    row(ref rows, 'Building', keys.span(), building);
                }
            }
        }
        let army = interact_with_state(
            address, || crate::logic::troops::explorer(crate::troops::ExplorerKey { game_id, explorer_id: *entity_id }),
        );
        if let Some(army) = army {
            row(ref rows, 'ExplorerTroops', keys, crate::troops::ExplorerRecordTrait::into_record(army));
        }
    }
    for coord in tiles {
        let key = crate::geometry::tile_key(game_id, *coord);
        if let Some(occupancy) = interact_with_state(address, || crate::logic::map::occupancy(key)) {
            let mut keys = array![];
            key.serialize(ref keys);
            row(ref rows, 'TileOccupancy', keys.span(), occupancy);
        }
    }
    rows
}

// Seed the replay from contract readers, then use only successful command events.
pub fn initial(address: ContractAddress, game_id: u32, entities: Span<u32>, tiles: Span<Coord>) -> Frame {
    let rows = observe(address, game_id, entities, tiles);
    let mut events = array![];
    for row in rows.span() {
        let mut data = array![];
        row.keys.serialize(ref data);
        row.values.serialize(ref data);
        events.append((array![selector!("RowSet"), 1, *row.model], data));
    }
    Frame { events, rows }
}

pub fn capture(
    address: ContractAddress, game_id: u32, entities: Span<u32>, tiles: Span<Coord>, ref spy: EventSpy,
) -> Frame {
    let mut events = array![];
    for (_, event) in spy.get_events().emitted_by(address).events {
        for index in 0..event.keys.len() {
            let selector = *event.keys.at(index);
            if (selector == selector!("RowSet")
                || selector == selector!("RowMemberSet")
                || selector == selector!("RowDeleted"))
                && index
                + 2 < event.keys.len() && selected(*event.keys.at(index + 2)) {
                events.append((event.keys, event.data));
                break;
            }
        }
    }
    spy = snforge_std::spy_events();
    Frame { events, rows: observe(address, game_id, entities, tiles) }
}

pub fn compare(name: ByteArray, frames: Array<Frame>) {
    let mut serialized = array![];
    frames.serialize(ref serialized);
    let expected = read_txt(@FileTrait::new(format!("tests/fixtures/spatial-replay/{}.txt", name)));
    assert_eq!(serialized, expected);
}
