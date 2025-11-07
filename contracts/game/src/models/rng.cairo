use core::num::traits::Zero;
use dojo::model::{ModelStorage};
use dojo::world::WorldStorage;

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct RNG {
    #[key]
    pub tx_hash: felt252,
    pub seed: u256,
}


#[generate_trait]
pub impl RNGImpl of RNGTrait {
    // We get random numbers this way to make sure that during multicalls, 
    // the same calls to the rng function returns different values.
    fn ensure_unique_tx_seed(ref world: WorldStorage, tx_hash: felt252, seed: u256) -> RNG {
        let mut rng: RNG = world.read_model(tx_hash);
        if rng.seed.is_zero() {
            rng.seed = seed;
        } else {
            rng.seed += 1431; // random number
        }
        world.write_model(@rng);
        rng
    }
}