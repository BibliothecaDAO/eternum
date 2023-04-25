//
// ---------- Buildings
// NB: Have left this open and not specifcially tied to only Realms. Barbarians could share the same buildings.
use array::ArrayTrait;

#[derive(Component)]
struct Buildings {
    id: felt252,
    quantity: u128,
    population: u128,
    integrity: u128,
}

trait BuildingsTrait {
    // decayed or not
    fn is_decayed(self: Buildings) -> bool;
    fn is_empty(self: Buildings) -> bool;
}

impl BuildingsImpl of BuildingsTrait {
    fn is_decayed(self: Buildings) -> bool {
        if self.integrity == 0 {
            return bool::True(());
        } else {
            return bool::False(());
        }
    }
    fn is_empty(self: Buildings) -> bool {
        if self.population == 0 {
            return bool::True(());
        } else {
            return bool::False(());
        }
    }
}

