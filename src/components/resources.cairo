// Used as helper struct throughout the world
#[derive(Component)]
struct Resource {
    id: felt252,
    balance: u128,
}

#[derive(Component)]
struct Vault {
    balance: u128, 
}
// trait ResourcesTrait {
//     // population
//     fn labor_balance(self: Resources, resource_id: felt252) -> felt252; 
// }

// impl ResourcesImpl of ResourcesTrait {
//     fn labor_balance(self: Resources) -> felt252 {
//         // get value by key
//     }
// }


