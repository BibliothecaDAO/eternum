use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct Trade {
    #[key]
    pub trade_id: ID,
    pub maker_id: ID,
    pub taker_id: ID,
    pub expires_at: u32,
    pub maker_gives_resource_type: u8,
    pub taker_pays_resource_type: u8,
    pub maker_gives_min_resource_amount: u64,
    pub taker_pays_min_resource_amount: u64,
    pub maker_gives_max_count: u64,
}


#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct TradeCount {
    #[key]
    pub structure_id: ID,
    pub count: u8,
}

#[generate_trait]
pub impl TradeCountImpl of TradeCountTrait {
    fn decrease(ref self: TradeCount, ref world: WorldStorage) {
        self.count -= 1;
        if self.count == 0 {
            world.erase_model(@self);
        } else {
            world.write_model(@self);
        }
    }
}
