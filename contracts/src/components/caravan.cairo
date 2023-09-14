#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Caravan {
    #[key]
    entity_id: felt252,
    caravan_id: u128,
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct CaravanMembers {
    #[key]
    entity_id: u128,
    key: u128,
    count: usize,
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct CaravanAttachment {
    #[key]
    caravan_id: u128,
    cargo_id: u128
}




#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Cargo {
    #[key]
    cargo_id: u128, 
    caravan_id: u128,
    weight: u128,
    count: usize 
}

trait CargoTrait {
    fn is_attached_to_caravan( self: Cargo ) -> bool;
    fn is_empty( self: Cargo ) -> bool;
}

impl CargoImpl of CargoTrait {
    #[inline(always)]
    fn is_attached_to_caravan( self: Cargo ) -> bool {
        return self.caravan_id != 0;
    }

    #[inline(always)]
    fn is_empty( self: Cargo ) -> bool {
        return self.count == 0;
    }
}



#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct CargoItem {
    #[key]
    cargo_id: u128,
    #[key]
    index: usize,
    resource_type: u8,
    amount: u128
}