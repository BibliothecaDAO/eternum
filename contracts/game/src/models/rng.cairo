use dojo::model::ModelStorage;
use dojo::world::WorldStorage;

pub const RNG_TX_SEED_INCREMENT: u256 = 1432;

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
    fn ensure_unique_tx_seed(ref world: WorldStorage, ref rng: RNG) -> RNG {
        rng.seed += RNG_TX_SEED_INCREMENT;
        world.write_model(@rng);
        rng
    }
}
