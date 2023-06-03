use eternum::alias::ID;

#[derive(Component, Copy, Drop, Serde)]
struct Quantity {
    value: u128, 
}


// attach it to an entity + entity_type to count the quantity of an entity type
#[derive(Component, Copy, Drop, Serde)]
struct QuantityTracker {
    count: u128, 
}
// DISCUSS: how do you keep track of the quantity of non fungible entites?


