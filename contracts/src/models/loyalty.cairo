use array::SpanTrait;
use eternum::alias::ID;
use eternum::constants::{LOYALTY_MAX_VALUE, LOYALTY_PER_TICK_INTERVAL, LOYALTY_TICK_INTERVAL};
use eternum::models::config::{TickConfig, TickImpl};

use eternum::utils::math::min;
use eternum::utils::unpack::unpack_resource_types;
use starknet::ContractAddress;
use traits::Into;


#[derive(Model, Copy, Drop, Serde)]
struct Loyalty {
    #[key]
    entity_id: u128,
    last_updated_tick: u64
}


#[generate_trait]
impl LoyaltyImpl of LoyaltyTrait {
    fn value(self: Loyalty, tick: TickConfig) -> u64 {
        if self.last_updated_tick == 0 {
            return 0;
        }

        let ticks_passed: u64 = tick.current() - self.last_updated_tick;
        let value: u64 = (ticks_passed / LOYALTY_TICK_INTERVAL) * LOYALTY_PER_TICK_INTERVAL;
        return min(value, LOYALTY_MAX_VALUE);
    }
}
