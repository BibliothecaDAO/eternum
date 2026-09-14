use crate::troops::Coord;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BuildingKey {
    pub game_id: u32,
    pub alt: bool,
    pub outer_col: u32,
    pub outer_row: u32,
    pub inner_col: u32,
    pub inner_row: u32,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct Building {
    pub category: u8,
    pub bonus_percent: u32,
    pub entity_id: u32,
    pub outer_entity_id: u32,
    pub paused: bool,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct Population {
    pub current: u32,
    pub max: u32,
}
#[derive(Copy, Drop, Serde, Default, Debug, PartialEq, starknet::Store)]
pub struct StructureBuildings {
    pub packed_counts_1: u128,
    pub packed_counts_2: u128,
    pub packed_counts_3: u128,
    pub population: Population,
    pub coord: Coord,
}
#[starknet::component]
pub mod BuildingState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use super::{Building, BuildingKey, StructureBuildings};
    #[storage]
    pub struct Storage {
        pub buildings: Map<(u32, bool, u32, u32, u32, u32), Building>,
        pub building_exists: Map<(u32, bool, u32, u32, u32, u32), bool>,
        pub structure_buildings: Map<(u32, u32), StructureBuildings>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn building(self: @ComponentState<TContractState>, key: BuildingKey) -> Option<Building> {
            let storage_key = (key.game_id, key.alt, key.outer_col, key.outer_row, key.inner_col, key.inner_row);
            if self.building_exists.read(storage_key) {
                Some(self.buildings.read(storage_key))
            } else {
                None
            }
        }
        fn create(
            ref self: ComponentState<TContractState>,
            key: BuildingKey,
            building: Building,
            population_cost: u8,
            capacity_grant: u8,
            base_population: u32,
        ) {
            assert!(self.building(key).is_none(), "building location occupied");
            assert!(building.category > 0 && building.category <= 40, "invalid production building");
            let storage_key = (key.game_id, key.alt, key.outer_col, key.outer_row, key.inner_col, key.inner_row);
            self.buildings.write(storage_key, building);
            self.building_exists.write(storage_key, true);
            let mut keys = array![];
            key.serialize(ref keys);
            let mut values = array![];
            building.serialize(ref values);
            self.emit(RowSet { version: 1, model: 'Building', keys: keys.span(), values: values.span() });
            let mut counts = self.structure_buildings.read((key.game_id, building.outer_entity_id));
            let index = (building.category - 1) / 16;
            let shift = ((building.category - 1) % 16) * 8;
            let mut increment: u128 = 1;
            for _ in 0..shift {
                increment *= 2;
            }
            match index {
                0 => { counts.packed_counts_1 += increment; },
                1 => { counts.packed_counts_2 += increment; },
                2 => { counts.packed_counts_3 += increment; },
                _ => panic!("invalid building category"),
            }
            counts.population.current += population_cost.into();
            counts.population.max += capacity_grant.into();
            assert!(
                counts.population.current <= counts.population.max + base_population, "population exceeds capacity",
            );
            counts.coord = crate::troops::Coord { alt: key.alt, x: key.outer_col, y: key.outer_row };
            self.structure_buildings.write((key.game_id, building.outer_entity_id), counts);
            let mut values = array![];
            counts.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'StructureBuildings',
                        keys: array![key.game_id.into(), building.outer_entity_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
    }
}
