// Used as helper struct throughout the world
#[derive(Component, Copy, Drop, Serde)]
struct Resource {
    resource_type: u8,
    balance: u128,
}

// TODO: need to change the whole vault logic
#[derive(Component, Copy, Drop, Serde)]
struct Vault {
    balance: u128, 
}
