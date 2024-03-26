use starknet::get_block_timestamp;

// This exists a model per realm per resource

// This is a model that represents the production of a resource

// Whenever this resource is used on a realm, update() is called.

// Whenever a resource is used on a realm we use the balance of the resource to determine how much of it is left, which is a computed value, not a fixed value. This allows us to have a dynamic balance that changes over time, and not rely on claiming of the resource. We use the computed value + the stored value to determine the total balance of the resource.

#[derive(Model, Copy, Drop, Serde)]
struct Production {
    quantity: u64, // this needs to be the entities balance
    resource_id: u64,
    production_rate: u64, // per tick
    consumed_rate: u64, // per tick
    last_updated: u64,
    active: bool,
}

// We could make this a nice JS Class with a constructor and everything
// Then maintaining logic in client will be easy
#[generate_trait]
impl ProductionRateImpl of ProductionRateTrait {
    fn start_production(ref self: Production) {
        self.update();
        self.active = true;
    }
    fn stop_production(ref self: Production) {
        self.update();
        self.active = false;
    }
    fn update(ref self: Production) {
        self.quantity += self.generated() - self.consumed();
        self.last_updated = get_block_timestamp();
    }
    fn until_depleted(self: Production) -> u64 {
        self.balance() / self.net_rate()
    }
    fn balance(self: Production) -> u64 {
        self.generated() - self.consumed()
    }
    fn generated(self: Production) -> u64 {
        self.production_rate * self.since_last_update()
    }
    fn consumed(self: Production) -> u64 {
        self.consumed_rate * self.since_last_update()
    }
    fn net_rate(self: Production) -> u64 {
        self.production_rate - self.consumed_rate
    }
    fn since_last_update(self: Production) -> u64 {
        get_block_timestamp() - self.last_updated
    }
}
