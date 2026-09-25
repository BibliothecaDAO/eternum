use starknet::storage::Map;

#[starknet::storage_node]
pub struct BuildingStateStorage<TBuilding, TStructureBuildings> {
    pub buildings: Map<(u32, u32, u32, u32), TBuilding>,
    pub structure_buildings: Map<(u32, u32), TStructureBuildings>,
}
