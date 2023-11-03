#[derive(Model, Copy, Drop, Serde)]
struct Labor {
    #[key]
    entity_id: u128,
    #[key]
    resource_type: u8,
    balance: u64,
    last_harvest: u64,
    multiplier: u64,
}


#[generate_trait]
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

    fn harvest_unharvested(ref self: Labor, unharvested_amount: u64, ts: u64) {
        // if unharvested has been harvested, remove it from the labor balance
        self.balance -= unharvested_amount;
        // if unharvested has been harvested, update last_harvest
        self.last_harvest = ts;
    }

    fn compute_new_labor(self: Labor, additional_labor: u64, ts: u64, new_multiplier: u64) -> Labor {
        let mut new_balance: u64 = self.balance;
        let mut new_last_harvest: u64 = self.last_harvest;
        if self.balance <= ts {
            new_last_harvest += ts - self.balance;
            new_balance = ts + additional_labor;
        } else {
            new_balance += additional_labor;
        };

        Labor {
            entity_id: self.entity_id,
            resource_type: self.resource_type,
            balance: new_balance,
            last_harvest: new_last_harvest,
            multiplier: new_multiplier,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Labor, LaborTrait};

    #[test]
    fn test_get_labor_generated_is_complete() {
        let labor = Labor { entity_id: 0, resource_type: 0, balance: 100, last_harvest: 0, multiplier: 1,  };
        let (labor_generated, is_complete, new_balance) = labor.get_labor_generated(50);
        assert(labor_generated == 50, 'labor_generated is not 50');
        assert(is_complete == false, 'is_complete is not false');
        assert(new_balance == 50, 'new_balance is not 50');
    }

    #[test]
    fn test_get_labor_generated_is_not_complete() {
        let labor = Labor { entity_id: 0, resource_type: 0, balance: 100, last_harvest: 0, multiplier: 1,  };
        let (labor_generated, is_complete, new_balance) = labor.get_labor_generated(150);
        assert(labor_generated == 100, 'labor_generated is not 100');
        assert(is_complete == true, 'is_complete is not true');
        assert(new_balance == 0, 'new_balance is not 0');
    }


    #[test]
    fn test_get_labor_generated_is_not_complete_with_last_harvest() {
        let labor = Labor { entity_id: 0, resource_type: 0, balance: 100, last_harvest: 30, multiplier: 1,  };
        let (labor_generated, is_complete, new_balance) = labor.get_labor_generated(150);
        assert(labor_generated == 70, 'labor_generated is not 210');
        assert(is_complete == true, 'is_complete is not true');
        assert(new_balance == 0, 'new_balance is not 0');
    }

    #[test]
    fn test_compute_new_labor_is_complete() {
        let mut labor = Labor { entity_id: 0, resource_type: 0, balance: 100, last_harvest: 0, multiplier: 1,  };
        let new_labor = labor.compute_new_labor(60, 150, 1);

        assert(new_labor.last_harvest == 50, 'last_harvest is not 50');
        assert(new_labor.balance == 210, 'balance is not 210');
        assert(new_labor.multiplier == 1, 'multiplier not 1');
    }

    #[test]
    fn test_compute_new_labor_not_complete() {
        let mut labor = Labor { entity_id: 0, resource_type: 0, balance: 200, last_harvest: 0, multiplier: 1,  };
        let new_labor = labor.compute_new_labor(60, 150, 1);

        assert(new_labor.last_harvest == 0, 'last_harvest is not 0');
        assert(new_labor.balance == 260, 'balance is not 260');
        assert(new_labor.multiplier == 1, 'multiplier not 1');
    }
}