#[derive(Model, Copy, Drop, Serde)]
struct Caravan {
    #[key]
    entity_id: u128,
    burden_count: u128,
    burden_weight: u128,
}


#[derive(Model, Copy, Drop, Serde)]
struct CaravanBurden {
    #[key]
    entity_id: u128,
    #[key]
    index: u128,
    burden_id: u128
}

#[generate_trait]
impl CaravanBurdenImpl of CaravanBurdenTrait {
    fn has_been_delivered(self: CaravanBurden) -> bool {
        // todo@credence check burden's arrival time
        false
    }
}

#[derive(Model, Copy, Drop, Serde)]
struct CaravanMembers {
    #[key]
    entity_id: u128,
    key: u128,
    count: u32,
}