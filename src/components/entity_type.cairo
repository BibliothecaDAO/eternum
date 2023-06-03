// entity type allows to define the type of entity 
// some systems could use this to filter entities

#[derive(Component, Copy, Drop, Serde)]
struct EntityType {
    value: u128, 
}
