// Used as helper struct throughout the world
#[derive(Model, Copy, Drop, Serde)]
struct Resource {
    // This is compound key of entity_id and resource_type
    #[key]
    entity_id: u128,
    #[key]
    resource_type: u8,
    balance: u128,
}

#[derive(Model, Copy, Drop, Serde)]
struct ResourceAllowance {
    #[key]
    owner_entity_id: u128,
    #[key]
    approved_entity_id: u128,
    #[key]
    resource_type: u8,
    amount: u128,
}

#[derive(Model, Copy, Drop, Serde)]
struct ResourceCost {
    #[key]
    entity_id: u128,
    #[key]
    index: u32,
    resource_type: u8,
    amount: u128
}

// a burden is a bundle of resources
//
// It can be a free burden (i.e a burden with no depositor_id) or not.
// When it is a free burden, no resources can be withdrawn from it as no 
// deposit has been made to it. It's just a shadow of the resources that'll
// be in it when a deposit is made. E.gin trade,  it's to hold items that
// a buyer would need to provide before they can accept a trade
#[derive(Model, Copy, Drop, Serde)]
struct Burden {
    #[key]
    burden_id: u128,
    depositor_id: u128,
    resources_count: u32,
    resources_weight: u128
}

#[derive(Model, Copy, Drop, Serde)]
struct BurdenResource {
    #[key]
    burden_id: u128,
    #[key]
    index: u32,
    resource_type: u8,
    resource_amount: u128
}
