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
