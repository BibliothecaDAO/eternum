#[derive(Component)]
struct LaborConf {
    id: felt252,
    quantity: usize,
}

#[derive(Component)]
struct Labor {
    balance: u128,
    last_harvest: u128,
    multiplier: u128,
}

trait LaborTrait {
    fn get_labor_generated(self: Labor, ts: u128) -> (u128, bool, u128);
    fn get_new_labor_balance(self: Labor, additionnal_labor: u128, ts: u128) -> u128;
    fn get_last_harvest(self: Labor, ts: u128) -> u128;
}

impl LaborImpl of LaborTrait {
    fn get_labor_generated(self: Labor, ts: u128) -> (u128, bool, u128) {
        let mut last_harvest = 0;
        if self.last_harvest == 0 {
            last_harvest = ts;
        } else {
            last_harvest = self.last_harvest;
        }
        if self.balance <= ts {
            // if complete only take until balance
            return ((self.balance - last_harvest) * self.multiplier, false, self.balance - ts);
        } else {
            // if not complete, take everyting until timestamp
            return ((ts - last_harvest) * self.multiplier, true, 0);
        }
    }

    fn get_new_labor_balance(self: Labor, additionnal_labor: u128, ts: u128) -> u128 {
        if self.balance == 0 {
            return ts + additionnal_labor;
        } else {
            return self.balance + additionnal_labor;
        }
    }

    fn get_last_harvest(self: Labor, ts: u128) -> u128 {
        if self.last_harvest == 0 {
            return ts;
        } else {
            return self.last_harvest;
        }
    }
}

#[test]
fn get_labor_generated_is_complete() {
    let labor = Labor { balance: 100, last_harvest: 0, multiplier: 1,  };
    let (labor_generated, is_complete, new_balance) = labor.get_labor_generated(50);
    assert(labor_generated == 50, 'labor_generated is not 50');
    assert(is_complete == false, 'is_complete is not false');
    assert(new_balance == 50, 'new_balance is not 50');
}

#[test]
fn get_labor_generated_is_not_complete() {
    let labor = Labor { balance: 100, last_harvest: 0, multiplier: 1,  };
    let (labor_generated, is_complete, new_balance) = labor.get_labor_generated(150);
    assert(labor_generated == 100, 'labor_generated is not 100');
    assert(is_complete == true, 'is_complete is not true');
    assert(new_balance == 0, 'new_balance is not 0');
}
