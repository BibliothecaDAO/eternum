#[system]
mod CreateLaborAuction {

    use eternum::components::labor_auction::{LaborAuction, LaborAuctionTrait};

    use dojo::world::Context;

    fn execute(ctx: Context, resource_type: u8, zone: u8, target_price: u128, decay_constant: u128, per_time_unit: u128, realms_count: u128) {
        let start_time = starknet::get_block_timestamp();

        let auction = LaborAuction {
            resource_type,
            zone,
            target_price,
            decay_constant_mag: decay_constant,
            decay_constant_sign: false,
            per_time_unit,
            realms_count,
            start_time,
            bought: 0,
        };

        set!(ctx.world, (auction))
    }
}


// #[cfg(test)]
// mod tests {

// }