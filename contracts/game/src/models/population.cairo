use s1_eternum::alias::ID;
use s1_eternum::models::resource::production::building::{BuildingCategory};


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Population {
    #[key]
    entity_id: ID,
    population: u32, // current population
    capacity: u32, // total population capacity
}

#[generate_trait]
impl PopulationImpl of PopulationTrait {
    fn increase_population(ref self: Population, amount: u32, base_population: u32) -> u32 {
        self.population += amount;
        self.assert_within_capacity(base_population);
        self.population
    }
    fn decrease_population(ref self: Population, amount: u32) -> u32 {
        if amount > self.population {
            self.population = 0;
        } else {
            self.population -= amount;
        }

        self.population
    }
    fn assert_within_capacity(ref self: Population, base_population: u32) {
        assert(self.capacity + base_population >= self.population, 'Population exceeds capacity')
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
