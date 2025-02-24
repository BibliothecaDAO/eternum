use s1_eternum::alias::ID;

// not all entities are just a single object, some can be multiple.
// e.g. a group of free transport units can be a single entity with
// a quantity component to show how many there are.
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Quantity {
    #[key]
    pub entity_id: ID,
    pub value: u128,
}

// attach it to an entity + entity_type to count the quantity of an entity type
// a way to track how many of a certain entity type there are.
// e.g. for free transport units, we only allow realms to have a maximum of them
// at the same time. Thus if this component exists for a realm and free transport units
// we need to update it everytime a free transport unit is created of destroyed.
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct QuantityTracker {
    #[key]
    pub entity_id: felt252,
    pub count: u128,
}

pub mod QuantityTrackerType {
    const ARMY_COUNT: felt252 = 'army_quantity';
    const REALM_COUNT: felt252 = 'realm_quantity';
}
