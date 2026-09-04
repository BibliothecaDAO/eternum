use collectibles_claim::utils::cartridge::vrf::Source;
use collectibles_claim::utils::cartridge::vrf::{IVrfProviderDispatcher, IVrfProviderDispatcherTrait};
use core::dict::Felt252Dict;
use core::poseidon::poseidon_hash_span;
use starknet::TxInfo;
use starknet::{ContractAddress};

#[generate_trait]
pub impl VRFImpl of VRFTrait {
    fn seed(player_id: ContractAddress, vrf_provider_address: ContractAddress) -> u256 {
        let tx_info: TxInfo = starknet::get_tx_info().unbox();

        if vrf_provider_address.is_zero() {
            // workaround for testnet
            assert!(
                tx_info.chain_id != 'SN_MAIN' && tx_info.chain_id != 'SN_SEPOLIA', "VRF provider address must be set",
            );

            return tx_info.transaction_hash.into();
        } else {
            let vrf_provider = IVrfProviderDispatcher { contract_address: vrf_provider_address };
            let random_value: felt252 = vrf_provider.consume_random(Source::Nonce(player_id));
            return random_value.into();
        }
    }
}

/// Generate a random value within a specified upper_bound.
///
/// Args:
///     seed: u256
///         random seed
///     salt: u128
///         to update the seed
///     upper_bound: u128
///         The upper_bound of possible values
///         i.e output will be from 0 to upper_bound - 1.
///
/// Returns:
///     u128
///         A random value within the specified upper_bound.
///
///
pub fn random(seed: u256, salt: u128, upper_bound: u128) -> u128 {
    let value: u256 = poseidon_hash_span(array![seed.low.into(), seed.high.into(), salt.into()].span()).into();
    let upper_bound: u256 = upper_bound.into();
    return (value % upper_bound).try_into().unwrap();
}


/// Return a k sized list of population elements chosen with replacement.
///
/// If the relative weights or cumulative weights are not specified,
/// the selections are made with equal probability.
///
/// Args:
///     population: Span<u128>
///         The population to sample from.
///     weights: Span<u128>
///         The relative weights of each population element.
///     cum_weights: Span<u128>
///         The cumulative weights of each population element.
///         This is to be used in place of weights to speed up calculations
///         if the sum of weights is already available.
///     k: u128
///         The number of elements to sample.
///
///     r: bool
///         Whether or not to choose with (r)eplacement.
/// Returns:
///     Span<u128>
///         A k sized list of population elements chosen with replacement.
///
/// See Also: https://docs.python.org/3/library/random.html#random.choices
///
pub fn choices<T, impl TCopy: Copy<T>, impl TDrop: Drop<T>>(
    population: Span<T>, weights: Span<u128>, mut cum_weights: Span<u128>, k: u128, r: bool, vrf_seed: u256,
) -> Span<T> {
    let mut n = population.len();
    let mut salt: u128 = starknet::get_block_timestamp().into();

    if cum_weights.len() == 0 {
        if weights.len() == 0 {
            let mut index = 0;
            let mut result = array![];
            loop {
                if index == k {
                    break;
                }
                result.append(*population.at(random(vrf_seed, index.into(), n.into()).try_into().unwrap()));
                index += 1;
            };
            return result.span();
        };

        // get cumulative sum of weights
        cum_weights = cum_sum(weights.clone());
    } else {
        if weights.len() != 0 {
            assert(false, 'cant specify both weight types');
        };
    };

    if cum_weights.len() != n {
        assert(false, 'weight length mismatch');
    };

    let total = *cum_weights[cum_weights.len() - 1];
    if total == 0 {
        assert(false, 'weights sum is zero');
    };

    let hi = n - 1;
    let mut index = 0;
    let mut result = array![];

    let mut chosen_index_map: Felt252Dict<u8> = Default::default();

    loop {
        if index == k {
            break;
        }

        // update salt by any number
        // just to make it different
        salt += 18;

        let chosen_index = bisect_right(cum_weights.clone(), random(vrf_seed, salt, total), 0, Option::Some(hi));

        if r == false {
            if chosen_index_map.get(chosen_index.into()) == 0 {
                chosen_index_map.insert(chosen_index.into(), 1);
                result.append(*population.at(chosen_index));
                index += 1;
            }
        } else {
            result.append(*population.at(chosen_index));
            index += 1;
        }
    };
    return result.span();
}


/// Given a list of values, return a list of the same length,
/// where each element is the sum of the previous values.
///
/// Args:
///     a: Span<u128>
///         The list of values to sum.
///
/// Returns:
///     Span<u128>
///         The list of sums.
///
/// Example:
///     >>> cum_sum([1, 2, 3, 4, 5])
///     [1, 3, 6, 10, 15]
///
fn cum_sum(a: Span<u128>) -> Span<u128> {
    let mut total = 0;
    let mut result = array![];
    let mut index = 0;
    loop {
        if index == a.len() {
            break;
        }
        total += *a[index];
        result.append(total);
        index += 1;
    };
    return result.span();
}


/// Return the index where to insert item x in list a, assuming a is sorted.
///
/// The return value i is such that all e in a[:i] have e <= x, and all e in
/// a[i:] have e > x.  So if x already appears in the list, i points just
/// beyond the rightmost x already there.
///
/// lo and hi (default len(a)) bound the slice of `a` to be searched.
///
/// Args:
///     a: Span<u128>
///         The list to be searched.
///     x: u128
///         The value to be searched for.
///     lo: u32
///         The lower bound of the slice of a to be searched.
///     hi: Option<u32>
///         The upper bound of the slice of a to be searched.
///
/// Returns:
///     u32
///         The index where to insert item x in list a, assuming a is sorted.
///
/// Example:
///     >>> bisect_right([10, 15, 17 , 20, 21], 16, 0, None)
///     2
///
/// See Also: https://docs.python.org/3/library/bisect.html#bisect.bisect_right
///
fn bisect_right(a: Span<u128>, x: u128, lo: u32, hi: Option<u32>) -> u32 {
    let mut hi = match hi {
        Option::Some(hi) => hi,
        Option::None => a.len().into(),
    };

    let mut lo = lo;
    loop {
        if lo >= hi {
            break;
        }
        let mid = (lo + hi) / 2;
        if x < *a.at(mid) {
            hi = mid;
        } else {
            lo = mid + 1;
        };
    };
    return lo;
}
