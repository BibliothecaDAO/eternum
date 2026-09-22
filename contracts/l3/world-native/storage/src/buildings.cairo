use starknet::storage::Map;

#[starknet::storage_node]
pub struct BuildingStateStorage<
    TBuilding, TStructureBuildings, TBoardTerms, TNeighborBonus, TBuildingTerms, TResourceAmount,
> {
    pub buildings: Map<(u32, bool, u32, u32, u32, u32), TBuilding>,
    pub structure_buildings: Map<(u32, u32), TStructureBuildings>,
    pub configured: Map<u32, bool>,
    pub board_terms: Map<u32, Option<TBoardTerms>>,
    pub board_neighbors: Map<(u32, u8), TNeighborBonus>,
    pub terms: Map<(u32, u8), TBuildingTerms>,
    pub costs: Map<(u32, u8, bool, u8), TResourceAmount>,
}
