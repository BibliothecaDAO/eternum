use dojo::model::{Model, ModelStorage};
use dojo::storage::dojo_store::DojoStore;
use dojo::world::WorldStorage;

//
// GLOBAL RECORDS
//

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct WorldRecord {
    #[key]
    pub game_id: u32,
    pub relic_record: RelicRecord,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct RelicRecord {
    pub last_discovered_at: u64,
}


#[generate_trait]
pub impl WorldRecordImpl of WorldRecordTrait {
    fn get_member<T, impl TSerde: Serde<T>, impl TDojoStore: DojoStore<T>>(
        world: WorldStorage, game_id: u32, selector: felt252,
    ) -> T {
        world.read_member(Model::<WorldRecord>::ptr_from_keys(game_id), selector)
    }
    fn set_member<T, impl TSerde: Serde<T>, impl TDrop: Drop<T>, impl TDojoStore: DojoStore<T>>(
        ref world: WorldStorage, game_id: u32, selector: felt252, value: T,
    ) {
        world.write_member(Model::<WorldRecord>::ptr_from_keys(game_id), selector, value)
    }
}
