#[derive(Model, Copy, Drop, Serde)]
struct Age {
    #[key]
    entity_id: u128,
    born_at: u64,
}

trait AgeTrait {
    fn get_age_difference(self: Age, timestamp: u64) -> u64;
    fn get_current_age(self: Age) -> u64;
}

impl AgeImpl of AgeTrait {
    fn get_age_difference(self: Age, timestamp: u64) -> u64 {
        if timestamp > self.born_at {
            timestamp - self.born_at
        } else {
            self.born_at - timestamp
        }
    }
    fn get_current_age(self: Age) -> u64 {
        self.get_age_difference(starknet::get_block_timestamp())
    }
}
// #[test]
// #[available_gas(30000000)]
// fn test_get_age_difference() {
//     let age = Age { born_at: 100,  };
//     let age_difference = age.get_age_difference(200);
//     assert(age_difference == 100, 'Age difference should be 100');
// }

// #[test]
// #[available_gas(30000000)]
// fn get_current_age() {
//     let age = Age { born_at: 100,  };
//     starknet::testing::set_block_timestamp(200);
//     let current_age = age.get_current_age();
//     assert(current_age == 100, 'Current age should be 100');
// }


