use core::poseidon::poseidon_hash_span;
use dojo::world::WorldStorage;
use crate::utils::cartridge::vrf::Source;

#[starknet::interface]
pub trait IRNGlibrary<T> {
    fn get_random_number(self: @T, game_id: u32, source: Source, world: WorldStorage) -> u256;
    fn get_random_in_range(self: @T, random_number_seed: u256, salt: u128, upper_bound: u128) -> u128;
    fn get_weighted_choice_bool(
        self: @T, population: Span<bool>, weights: Span<u128>, k: u128, r: bool, random_number_seed: u256,
    ) -> Span<bool>;
    fn get_weighted_choice_bool_simple(
        self: @T, success_weight: u128, fail_weight: u128, random_number_seed: u256,
    ) -> bool;
    fn get_weighted_choice_u8(
        self: @T, population: Span<u8>, weights: Span<u128>, k: u128, r: bool, random_number_seed: u256,
    ) -> Span<u8>;
    fn get_weighted_choice_u128(
        self: @T, population: Span<u128>, weights: Span<u128>, k: u128, r: bool, random_number_seed: u256,
    ) -> Span<u128>;
    fn get_weighted_choice_direction(
        self: @T,
        population: Span<crate::models::position::Direction>,
        weights: Span<u128>,
        k: u128,
        r: bool,
        random_number_seed: u256,
    ) -> Span<crate::models::position::Direction>;
    fn get_weighted_choice_trooptier(
        self: @T,
        population: Span<crate::models::troop::TroopTier>,
        weights: Span<u128>,
        k: u128,
        r: bool,
        random_number_seed: u256,
    ) -> Span<crate::models::troop::TroopTier>;
    fn get_weighted_choice_u8_u128_pair(
        self: @T, population: Span<(u8, u128)>, weights: Span<u128>, k: u128, r: bool, random_number_seed: u256,
    ) -> Span<(u8, u128)>;
}


fn scope_source_to_game(game_id: u32, game_seed: felt252, source: Source) -> Source {
    match source {
        Source::Nonce(address) => Source::Nonce(address),
        Source::Salt(salt) => { Source::Salt(poseidon_hash_span(array![game_id.into(), game_seed, salt].span())) },
    }
}

fn scope_randomness_to_game(raw_randomness: u256, game_id: u32, game_seed: felt252) -> u256 {
    poseidon_hash_span(array![raw_randomness.low.into(), raw_randomness.high.into(), game_id.into(), game_seed].span())
        .into()
}


#[dojo::library]
mod rng_library {
    use core::num::traits::Zero;
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use starknet::ContractAddress;
    use crate::models::config::WorldConfigUtilImpl;
    use crate::models::game::GameRegistryImpl;
    use crate::models::rng::{RNG, RNGImpl};
    use crate::utils::cartridge::vrf::Source;
    use crate::utils::random;
    use crate::utils::random::VRFImpl;
    use super::{scope_randomness_to_game, scope_source_to_game};

    /// RNG helpers centralizing VRF seeding and weighted choices.
    ///
    /// This is a library (not a system contract). It wraps existing
    /// utils in a simple, stable API to avoid duplicating RNG patterns.
    #[abi(embed_v0)]
    pub impl RngLibraryImpl of super::IRNGlibrary<ContractState> {
        /// Derive a VRF-based seed for a given owner using the configured provider.
        fn get_random_number(self: @ContractState, game_id: u32, source: Source, mut world: WorldStorage) -> u256 {
            let vrf_provider: ContractAddress = WorldConfigUtilImpl::get_member(
                world, game_id, selector!("vrf_provider_address"),
            );
            let game = GameRegistryImpl::get(world, game_id);
            let source = scope_source_to_game(game_id, game.seed, source);
            let tx_hash = starknet::get_tx_info().unbox().transaction_hash;
            let mut rng: RNG = world.read_model(tx_hash);
            if rng.seed.is_zero() {
                rng.seed = VRFImpl::seed(source, vrf_provider);
            }
            let raw_randomness = RNGImpl::ensure_unique_tx_seed(ref world, ref rng).seed;
            scope_randomness_to_game(raw_randomness, game_id, game.seed)
        }

        /// Get a random number in [0, upper_bound) derived from the provided seed and salt.
        fn get_random_in_range(self: @ContractState, random_number_seed: u256, salt: u128, upper_bound: u128) -> u128 {
            random::random(random_number_seed, salt, upper_bound)
        }

        fn get_weighted_choice_bool(
            self: @ContractState,
            population: Span<bool>,
            weights: Span<u128>,
            k: u128,
            r: bool,
            random_number_seed: u256,
        ) -> Span<bool> {
            random::choices(population, weights, array![].span(), k, r, random_number_seed)
        }

        fn get_weighted_choice_bool_simple(
            self: @ContractState, success_weight: u128, fail_weight: u128, random_number_seed: u256,
        ) -> bool {
            *random::choices(
                array![true, false].span(),
                array![success_weight, fail_weight].span(),
                array![].span(),
                1,
                true,
                random_number_seed,
            )[0]
        }


        fn get_weighted_choice_u8(
            self: @ContractState, population: Span<u8>, weights: Span<u128>, k: u128, r: bool, random_number_seed: u256,
        ) -> Span<u8> {
            random::choices(population, weights, array![].span(), k, r, random_number_seed)
        }


        fn get_weighted_choice_u128(
            self: @ContractState,
            population: Span<u128>,
            weights: Span<u128>,
            k: u128,
            r: bool,
            random_number_seed: u256,
        ) -> Span<u128> {
            random::choices(population, weights, array![].span(), k, r, random_number_seed)
        }

        fn get_weighted_choice_direction(
            self: @ContractState,
            population: Span<crate::models::position::Direction>,
            weights: Span<u128>,
            k: u128,
            r: bool,
            random_number_seed: u256,
        ) -> Span<crate::models::position::Direction> {
            random::choices(population, weights, array![].span(), k, r, random_number_seed)
        }

        fn get_weighted_choice_trooptier(
            self: @ContractState,
            population: Span<crate::models::troop::TroopTier>,
            weights: Span<u128>,
            k: u128,
            r: bool,
            random_number_seed: u256,
        ) -> Span<crate::models::troop::TroopTier> {
            random::choices(population, weights, array![].span(), k, r, random_number_seed)
        }

        fn get_weighted_choice_u8_u128_pair(
            self: @ContractState,
            population: Span<(u8, u128)>,
            weights: Span<u128>,
            k: u128,
            r: bool,
            random_number_seed: u256,
        ) -> Span<(u8, u128)> {
            random::choices(population, weights, array![].span(), k, r, random_number_seed)
        }
    }

    pub fn get_dispatcher(world: @WorldStorage) -> super::IRNGlibraryLibraryDispatcher {
        let (_, class_hash) = world.dns(@"rng_library_v0_1_16").expect('rng_library not found.');
        super::IRNGlibraryLibraryDispatcher { class_hash }
    }
}


#[cfg(test)]
mod tests {
    use starknet::ContractAddress;
    use crate::utils::cartridge::vrf::Source;
    use super::{scope_randomness_to_game, scope_source_to_game};

    #[test]
    fn nonce_source_keeps_per_transaction_provider_semantics() {
        let address: ContractAddress = 'player'.try_into().unwrap();
        match scope_source_to_game(1, 77, Source::Nonce(address)) {
            Source::Nonce(scoped_address) => assert!(scoped_address == address, "nonce owner changed"),
            Source::Salt(_) => panic!("nonce source became deterministic salt"),
        }
    }

    #[test]
    fn same_raw_randomness_diverges_between_games() {
        let raw_randomness: u256 = 123456789;
        let game_a = scope_randomness_to_game(raw_randomness, 1, 77);
        let game_b = scope_randomness_to_game(raw_randomness, 2, 77);
        assert!(game_a != game_b, "game-scoped randomness collided");
    }
}
