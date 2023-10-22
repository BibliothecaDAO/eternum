#[derive(Model, Copy, Drop, Serde)]
struct LastSpawned {
    #[key]
    realm_id: felt252,
    last_spawned_ts: u128,
}


#[generate_trait]
impl ShouldSpawnImpl of ShouldSpawn {
  fn should_spawn(self: LastSpawned, spawn_delay: u128) -> bool {
   let current: u128 = starknet::get_block_timestamp().into();
   if (current - self.last_spawned_ts < spawn_delay) {
       false
    } else {
        true
    }
                                
  }
}
