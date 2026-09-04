use ammv2::packages::core::interfaces::factory::{IRealmsSwapFactoryDispatcher, IRealmsSwapFactoryDispatcherTrait};
use ammv2::packages::core::interfaces::pair::{IRealmsSwapPairDispatcher, IRealmsSwapPairDispatcherTrait};
use ammv2::packages::core::interfaces::router::{IRealmsSwapRouterDispatcher, IRealmsSwapRouterDispatcherTrait};
use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use super::addresses::{ALICE, BOB};
use super::contracts::{
    approve_erc20, deploy_mock_erc20, deploy_realms_swap_factory, deploy_realms_swap_router, mint_mock_erc20,
};

pub const E18: u256 = 1_000_000_000_000_000_000;
pub const DEADLINE: u64 = 999_999_999_999;

#[derive(Copy, Drop)]
pub struct CoreSetup {
    pub factory: ContractAddress,
    pub router: ContractAddress,
    pub token0: ContractAddress,
    pub token1: ContractAddress,
    pub pair: ContractAddress,
}

#[derive(Copy, Drop)]
pub struct SeededPairSetup {
    pub core: CoreSetup,
    pub initial_liquidity: u256,
}

#[derive(Copy, Drop)]
pub struct TwoHopSetup {
    pub seeded: SeededPairSetup,
    pub token2: ContractAddress,
    pub pair12: ContractAddress,
}

pub fn deploy_core_without_pair() -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress) {
    let factory = deploy_realms_swap_factory();
    let router = deploy_realms_swap_router(factory);
    let token_a = deploy_mock_erc20("Token A", "TKA");
    let token_b = deploy_mock_erc20("Token B", "TKB");
    (factory, router, token_a, token_b)
}

pub fn deploy_core_with_pair() -> CoreSetup {
    let (factory, router, token_a, token_b) = deploy_core_without_pair();
    let pair = create_pair(factory, token_a, token_b);
    let (token0, token1) = sort_tokens(router, token_a, token_b);
    CoreSetup { factory, router, token0, token1, pair }
}

pub fn deploy_seeded_pair() -> SeededPairSetup {
    let core = deploy_core_with_pair();
    mint_mock_erc20(core.token0, ALICE(), 100 * E18);
    mint_mock_erc20(core.token1, ALICE(), 100 * E18);
    mint_mock_erc20(core.token0, BOB(), 100 * E18);
    mint_mock_erc20(core.token1, BOB(), 100 * E18);

    approve_erc20(core.token0, ALICE(), core.router, 20 * E18);
    approve_erc20(core.token1, ALICE(), core.router, 40 * E18);
    let (_, _, initial_liquidity) = add_liquidity(core.router, ALICE(), core.token0, core.token1, 20 * E18, 40 * E18);

    SeededPairSetup { core, initial_liquidity }
}

pub fn deploy_two_hop_route() -> TwoHopSetup {
    let seeded = deploy_seeded_pair();
    let token2 = deploy_mock_erc20("Token C", "TKC");
    let pair12 = create_pair(seeded.core.factory, seeded.core.token1, token2);

    mint_mock_erc20(token2, ALICE(), 100 * E18);
    mint_mock_erc20(token2, BOB(), 100 * E18);

    approve_erc20(seeded.core.token1, ALICE(), seeded.core.router, 20 * E18);
    approve_erc20(token2, ALICE(), seeded.core.router, 4 * E18);
    let _ = add_liquidity(seeded.core.router, ALICE(), seeded.core.token1, token2, 20 * E18, 4 * E18);

    TwoHopSetup { seeded, token2, pair12 }
}

pub fn create_pair(factory: ContractAddress, token_a: ContractAddress, token_b: ContractAddress) -> ContractAddress {
    start_cheat_caller_address(factory, super::addresses::ADMIN());
    let pair = IRealmsSwapFactoryDispatcher { contract_address: factory }.create_pair(token_a, token_b);
    stop_cheat_caller_address(factory);
    pair
}

pub fn sort_tokens(
    router: ContractAddress, token_a: ContractAddress, token_b: ContractAddress,
) -> (ContractAddress, ContractAddress) {
    IRealmsSwapRouterDispatcher { contract_address: router }.sort_tokens(token_a, token_b)
}

pub fn add_liquidity(
    router: ContractAddress,
    provider: ContractAddress,
    token0: ContractAddress,
    token1: ContractAddress,
    amount0: u256,
    amount1: u256,
) -> (u256, u256, u256) {
    start_cheat_caller_address(router, provider);
    let result = IRealmsSwapRouterDispatcher { contract_address: router }
        .add_liquidity(token0, token1, amount0, amount1, 1, 1, provider, DEADLINE);
    stop_cheat_caller_address(router);
    result
}

pub fn remove_liquidity(
    router: ContractAddress,
    provider: ContractAddress,
    token0: ContractAddress,
    token1: ContractAddress,
    liquidity: u256,
) -> (u256, u256) {
    start_cheat_caller_address(router, provider);
    let result = IRealmsSwapRouterDispatcher { contract_address: router }
        .remove_liquidity(token0, token1, liquidity, 1, 1, provider, DEADLINE);
    stop_cheat_caller_address(router);
    result
}

pub fn pair_reserves(pair: ContractAddress) -> (u256, u256, u64) {
    IRealmsSwapPairDispatcher { contract_address: pair }.get_reserves()
}

pub fn pair_reserves_for_tokens(
    router: ContractAddress, pair: ContractAddress, token_a: ContractAddress, token_b: ContractAddress,
) -> (u256, u256) {
    let (reserve0, reserve1, _) = pair_reserves(pair);
    let (token0, _) = sort_tokens(router, token_a, token_b);
    if token_a == token0 {
        (reserve0, reserve1)
    } else {
        (reserve1, reserve0)
    }
}

pub fn swap_exact_tokens_for_tokens(
    router: ContractAddress,
    trader: ContractAddress,
    amount_in: u256,
    amount_out_min: u256,
    path: Span<ContractAddress>,
    to: ContractAddress,
) -> Array<u256> {
    start_cheat_caller_address(router, trader);
    let result = IRealmsSwapRouterDispatcher { contract_address: router }
        .swap_exact_tokens_for_tokens(amount_in, amount_out_min, path, to, DEADLINE);
    stop_cheat_caller_address(router);
    result
}

pub fn swap_tokens_for_exact_tokens(
    router: ContractAddress,
    trader: ContractAddress,
    amount_out: u256,
    amount_in_max: u256,
    path: Span<ContractAddress>,
    to: ContractAddress,
) -> Array<u256> {
    start_cheat_caller_address(router, trader);
    let result = IRealmsSwapRouterDispatcher { contract_address: router }
        .swap_tokens_for_exact_tokens(amount_out, amount_in_max, path, to, DEADLINE);
    stop_cheat_caller_address(router);
    result
}
