use eternum::constants::{BASE_POPULATION};
use eternum::models::buildings::{BuildingCategory};
use eternum::models::config::{PopulationConfig, PopulationConfigTrait};


#[derive(Model, Copy, Drop, Serde)]
struct Population {
    #[key]
    entity_id: u128,
    population: u32, // current population
    capacity: u32, // total population capacity
}

#[generate_trait]
impl PopulationImpl of PopulationTrait {
    fn increase_population(ref self: Population, amount: u32) -> u32 {
        self.population += amount;
        self.assert_within_capacity();
        self.population
    }
    fn decrease_population(ref self: Population, amount: u32) -> u32 {
        self.population -= amount;

        // sanity
        if (self.population < 0) {
            self.population = 0;
        }
        self.population
    }
    fn assert_within_capacity(ref self: Population) {
        assert(self.capacity + BASE_POPULATION >= self.population, 'Population exceeds capacity')
    }
    fn increase_capacity(ref self: Population, amount: u32) -> u32 {
        self.capacity += amount;
        self.capacity
    }
    fn decrease_capacity(ref self: Population, amount: u32) -> u32 {
        self.capacity -= amount;

        // sanity
        if (self.capacity < 0) {
            self.capacity = 0;
        }
        self.capacity
    }
}
