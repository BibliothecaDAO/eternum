use dojo::model::{Model, ModelStorage};
use dojo::storage::dojo_store::DojoStore;
use dojo::world::WorldStorage;
use crate::alias::ID;
use crate::constants::WORLD_CONFIG_ID;
use crate::utils::math::{PercentageImpl, PercentageValueImpl};

//
// GLOBAL RECORDS
//

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct WorldRecord {
    #[key]
    pub world_id: ID,
    pub relic_record: RelicRecord,
    pub blitz_fee_split_record: BlitzFeeSplitRecord,
}

#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct RelicRecord {
    pub last_discovered_at: u64,
}


#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct BlitzFeeSplitRecord {
    pub creator_receives_amount: u128,
    pub players_receive_amount: u128,
}

#[generate_trait]
pub impl BlitzFeeSplitRecordImpl of BlitzFeeSplitRecordTrait {

    fn creator_fee_percent() -> u64 {
        PercentageValueImpl::_15()
    }
    
    fn velords_fee_percent() -> u64 {
        PercentageValueImpl::_15()
    }

    fn already_split_fees(ref self: BlitzFeeSplitRecord) -> bool {
        return self.creator_receives_amount > 0 || self.players_receive_amount > 0;
    }

    fn split_fees(ref self: BlitzFeeSplitRecord, total_reg_fees: u128, total_bonus_amount: u128) {
        assert!(total_reg_fees > 0, "Eternum: No prize to distribute");
        assert!(self.creator_receives_amount == 0, "Eternum: creator_receives_amount already set");
        assert!(self.players_receive_amount == 0, "Eternum: players_receive_amount already set");

        let creator_fee = PercentageImpl::get(total_reg_fees, Self::creator_fee_percent());
        let velords_fee = PercentageImpl::get(total_reg_fees, Self::velords_fee_percent());
        let players_fee = total_reg_fees - creator_fee - velords_fee + total_bonus_amount;

        assert!(creator_fee > 0, "Eternum: creator_fee is zero");
        assert!(players_fee > 0, "Eternum: players_fee is zero");

        // todo: add velords amount here 
        self.creator_receives_amount = creator_fee;
        self.players_receive_amount = players_fee;
    }
}

#[generate_trait]
pub impl WorldRecordImpl of WorldRecordTrait {
    fn get_member<T, impl TSerde: Serde<T>, impl TDojoStore: DojoStore<T>>(
        world: WorldStorage, selector: felt252,
    ) -> T {
        world.read_member(Model::<WorldRecord>::ptr_from_keys(WORLD_CONFIG_ID), selector)
    }
    fn set_member<T, impl TSerde: Serde<T>, impl TDrop: Drop<T>, impl TDojoStore: DojoStore<T>>(
        ref world: WorldStorage, selector: felt252, value: T,
    ) {
        world.write_member(Model::<WorldRecord>::ptr_from_keys(WORLD_CONFIG_ID), selector, value)
    }
}
