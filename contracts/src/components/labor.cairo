#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Labor {
    #[key]
    entity_id: u128,
    balance: u64,
    last_harvest: u64,
    multiplier: u64,
}

trait LaborTrait {
    fn get_labor_generated(self: Labor, ts: u64) -> (u64, bool, u64);
}

impl LaborImpl of LaborTrait {
    fn get_labor_generated(self: Labor, ts: u64) -> (u64, bool, u64) {
        if self.balance <= ts {
            // if complete only take until balance
            return (self.balance - self.last_harvest, true, 0);
        } else {
            // if not complete, take everyting until timestamp
            return (ts - self.last_harvest, false, self.balance - ts);
        }
    }
}
// #[test]
// fn get_labor_generated_is_complete() {
//     let labor = Labor { balance: 100, last_harvest: 0, multiplier: 1,  };
//     let (labor_generated, is_complete, new_balance) = labor.get_labor_generated(50);
//     assert(labor_generated == 50, 'labor_generated is not 50');
//     assert(is_complete == false, 'is_complete is not false');
//     assert(new_balance == 50, 'new_balance is not 50');
// }

// #[test]
// fn get_labor_generated_is_complete_with_mutiplier() {
//     let labor = Labor { balance: 100, last_harvest: 0, multiplier: 3,  };
//     let (labor_generated, is_complete, new_balance) = labor.get_labor_generated(50);
//     assert(labor_generated == 150, 'labor_generated is not 150');
//     assert(is_complete == false, 'is_complete is not false');
//     assert(new_balance == 50, 'new_balance is not 50');
// }

// #[test]
// fn get_labor_generated_is_complete_with_last_harvest() {
//     let labor = Labor { balance: 100, last_harvest: 30, multiplier: 3,  };
//     let (labor_generated, is_complete, new_balance) = labor.get_labor_generated(50);
//     assert(labor_generated == 60, 'labor_generated is not 60');
//     assert(is_complete == false, 'is_complete is not false');
//     assert(new_balance == 50, 'new_balance is not 50');
// }

// #[test]
// fn get_labor_generated_is_not_complete() {
//     let labor = Labor { balance: 100, last_harvest: 0, multiplier: 1,  };
//     let (labor_generated, is_complete, new_balance) = labor.get_labor_generated(150);
//     assert(labor_generated == 100, 'labor_generated is not 100');
//     assert(is_complete == true, 'is_complete is not true');
//     assert(new_balance == 0, 'new_balance is not 0');
// }

// #[test]
// fn get_labor_generated_is_not_complete_with_multiplier() {
//     let labor = Labor { balance: 100, last_harvest: 0, multiplier: 3,  };
//     let (labor_generated, is_complete, new_balance) = labor.get_labor_generated(150);
//     assert(labor_generated == 300, 'labor_generated is not 300');
//     assert(is_complete == true, 'is_complete is not true');
//     assert(new_balance == 0, 'new_balance is not 0');
// }

// #[test]
// fn get_labor_generated_is_not_complete_with_last_harvest() {
//     let labor = Labor { balance: 100, last_harvest: 30, multiplier: 3,  };
//     let (labor_generated, is_complete, new_balance) = labor.get_labor_generated(150);
//     assert(labor_generated == 210, 'labor_generated is not 210');
//     assert(is_complete == true, 'is_complete is not true');
//     assert(new_balance == 0, 'new_balance is not 0');
// }


