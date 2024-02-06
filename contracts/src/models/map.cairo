use eternum::utils::map::biomes::Biome;

#[derive(Model, Copy, Drop, Serde)]
struct ExploredMap {
    #[key]
    _col: u128,
    #[key]
    _row: u128,
    col: u128,
    row: u128,
    explored_by_id: u128,
    explored_at: u64,
    biome: Biome,
}