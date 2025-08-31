use dojo::model::{Model, ModelStorage};
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::WORLD_CONFIG_ID;

//
// GLOBAL RECORDS
//

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct WorldRecord {
    #[key]
    pub world_id: ID,
    pub relic_record: RelicRecord,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct RelicRecord {
    pub last_discovered_at: u64,
}


#[generate_trait]
pub impl WorldRecordImpl of WorldRecordTrait {
    fn get_member<T, impl TSerde: Serde<T>>(world: WorldStorage, selector: felt252) -> T {
        world.read_member(Model::<WorldRecord>::ptr_from_keys(WORLD_CONFIG_ID), selector)
    }
    fn set_member<T, impl TSerde: Serde<T>, impl TDrop: Drop<T>>(ref world: WorldStorage, selector: felt252, value: T) {
        world.write_member(Model::<WorldRecord>::ptr_from_keys(WORLD_CONFIG_ID), selector, value)
    }
}
