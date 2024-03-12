#[derive(Model, Copy, Drop, Serde)]
struct LastSpawned {
    #[key]
    realm_entity_id: u128,
    last_spawned_ts: u64,
}

#[generate_trait]
impl ShouldSpawnImpl of ShouldSpawn {
    fn can_spawn(self: LastSpawned, spawn_delay: u64) -> bool {
        if (starknet::get_block_timestamp() - self.last_spawned_ts < spawn_delay) {
            false
        } else {
            true
        }
    }
}
