use dojo::world::WorldStorage;
use starknet::ContractAddress;

#[starknet::interface]
pub trait IRNGlibrary<T> {
    fn get_random_number(self: @T, player: ContractAddress, world: WorldStorage) -> u256;
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


#[dojo::library]
mod rng_library {
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use starknet::ContractAddress;
    use crate::models::config::WorldConfigUtilImpl;
    use crate::utils::random;
    use crate::utils::random::VRFImpl;

    /// RNG helpers centralizing VRF seeding and weighted choices.
    ///
    /// This is a library (not a system contract). It wraps existing
    /// utils in a simple, stable API to avoid duplicating RNG patterns.
    #[abi(embed_v0)]
    pub impl RngLibraryImpl of super::IRNGlibrary<ContractState> {
        /// Derive a VRF-based seed for a given owner using the configured provider.
        fn get_random_number(self: @ContractState, player: ContractAddress, world: WorldStorage) -> u256 {
            let vrf_provider: ContractAddress = WorldConfigUtilImpl::get_member(
                world, selector!("vrf_provider_address"),
            );
            VRFImpl::seed(player, vrf_provider)
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
        let (_, class_hash) = world.dns(@"rng_library_v0_1_0").expect('rng_library not found');
        super::IRNGlibraryLibraryDispatcher { class_hash }
    }
}
