use starknet::ContractAddress;
use crate::commands::ExecutionContext;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct MarketKey {
    pub game_id: u32,
    pub resource_type: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct LiquidityKey {
    pub game_id: u32,
    pub owner: ContractAddress,
    pub resource_type: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, Default, starknet::Store)]
pub struct Market {
    pub lords: u128,
    pub resource: u128,
    pub shares: u128,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct BankRules {
    pub lp_fee_num: u32,
    pub lp_fee_denom: u32,
    pub owner_fee_num: u32,
    pub owner_fee_denom: u32,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BankPlacement {
    pub name: felt252,
    pub coord: crate::troops::Coord,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Swap {
    pub bank_id: u32,
    pub structure_id: u32,
    pub resource_type: u8,
    pub amount: u128,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AddLiquidity {
    pub bank_id: u32,
    pub structure_id: u32,
    pub resource_type: u8,
    pub resource_amount: u128,
    pub lords_amount: u128,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RemoveLiquidity {
    pub bank_id: u32,
    pub structure_id: u32,
    pub resource_type: u8,
    pub shares: u128,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SwapStory {
    pub bank_id: u32,
    pub structure_id: u32,
    pub resource_type: u8,
    pub lords_amount: u128,
    pub resource_amount: u128,
    pub owner_fee: u128,
    pub lp_fee: u128,
    pub resource_price: u128,
    pub buy: bool,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct LiquidityStory {
    pub bank_id: u32,
    pub structure_id: u32,
    pub resource_type: u8,
    pub lords_amount: u128,
    pub resource_amount: u128,
    pub shares: u128,
    pub resource_price: u128,
    pub add: bool,
}
#[starknet::interface]
pub trait IBank<T> {
    fn configure_banks(ref self: T, game_id: u32, rules: BankRules);
    fn bank_rules(self: @T, game_id: u32) -> BankRules;
    fn bank_name(self: @T, key: crate::resources::ResourceKey) -> felt252;
    fn market(self: @T, key: MarketKey) -> Market;
    fn liquidity(self: @T, key: LiquidityKey) -> u128;
    fn create_banks(
        ref self: T, game_id: u32, actor: ContractAddress, banks: Span<BankPlacement>, context: ExecutionContext,
    );
    fn buy_from_bank(ref self: T, game_id: u32, actor: ContractAddress, command: Swap, context: ExecutionContext);
    fn sell_to_bank(ref self: T, game_id: u32, actor: ContractAddress, command: Swap, context: ExecutionContext);
    fn add_bank_liquidity(
        ref self: T, game_id: u32, actor: ContractAddress, command: AddLiquidity, context: ExecutionContext,
    );
    fn remove_bank_liquidity(
        ref self: T, game_id: u32, actor: ContractAddress, command: RemoveLiquidity, context: ExecutionContext,
    );
}
#[starknet::interface]
pub trait IBankCreation<T> {
    fn create_bank(
        ref self: T,
        key: crate::resources::ResourceKey,
        owner: ContractAddress,
        coord: crate::troops::Coord,
        timestamp: u64,
    );
}

#[derive(Copy, Drop)]
pub struct SwapQuote {
    pub market: Market,
    pub input: u128,
    pub output: u128,
    pub owner_fee: u128,
    pub lp_fee: u128,
}
pub fn quote_swap(mut market: Market, fees: BankRules, amount: u128, buy: bool) -> SwapQuote {
    if buy {
        let cost = output_price(
            market.lords, market.resource, amount, fees.lp_fee_num.into(), fees.lp_fee_denom.into(),
        );
        let lp_fee = cost - output_price(market.lords, market.resource, amount, 0, 1);
        let owner_fee = cost * fees.owner_fee_num.into() / fees.owner_fee_denom.into();
        market.lords += cost;
        market.resource -= amount;
        SwapQuote { market, input: cost + owner_fee, output: amount, owner_fee, lp_fee }
    } else {
        let gross = input_price(
            market.resource, market.lords, amount, fees.lp_fee_num.into(), fees.lp_fee_denom.into(),
        );
        let lp_fee = input_price(market.resource, market.lords, amount, 0, 1) - gross;
        let owner_fee = gross * fees.owner_fee_num.into() / fees.owner_fee_denom.into();
        market.resource += amount;
        market.lords -= gross;
        SwapQuote { market, input: amount, output: gross - owner_fee, owner_fee, lp_fee }
    }
}

// These operations retain the pinned u128 arithmetic and rounding order.
pub fn output_price(input_reserve: u128, output_reserve: u128, output: u128, fee_num: u128, fee_denom: u128) -> u128 {
    assert!(input_reserve > 0 && output_reserve > 0, "empty market reserves");
    assert!(output < output_reserve, "output amount exceeds reserve");
    input_reserve * output * fee_denom / ((output_reserve - output) * (fee_denom - fee_num)) + 1
}
pub fn input_price(input_reserve: u128, output_reserve: u128, input: u128, fee_num: u128, fee_denom: u128) -> u128 {
    assert!(input_reserve > 0 && output_reserve > 0, "empty market reserves");
    let after_fee = input * (fee_denom - fee_num) / fee_denom;
    after_fee * output_reserve / (input_reserve + after_fee)
}
pub fn liquidity_cost(market: Market, lords: u128, resource: u128) -> (u128, u128, u128) {
    assert!(lords > 0 && resource > 0, "zero liquidity amount");
    if market.shares == 0 {
        return (lords, resource, lords);
    }
    let optimal = market.resource * lords / market.lords;
    let (lords, resource) = if optimal <= resource {
        (lords, optimal)
    } else {
        (market.lords * resource / market.resource, resource)
    };
    let shares = lords * market.shares / market.lords;
    assert!(shares > 0, "liquidity mints zero shares");
    (lords, resource, shares)
}
pub fn liquidity_payout(market: Market, shares: u128) -> (u128, u128) {
    assert!(shares <= market.shares && market.shares != 0, "insufficient liquidity");
    (shares * market.lords / market.shares, shares * market.resource / market.shares)
}
pub fn resource_price(market: Market) -> u128 {
    if market.shares == 0 {
        0
    } else {
        market.lords * crate::rules::RESOURCE_PRECISION / market.resource
    }
}

#[starknet::component]
pub mod MarketState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowDeleted, RowSet};
    use super::{BankRules, LiquidityKey, Market, MarketKey};
    #[storage]
    pub struct Storage {
        pub markets: Map<(u32, u8), Market>,
        pub liquidity: Map<(u32, starknet::ContractAddress, u8), u128>,
        pub bank_names: Map<(u32, u32), felt252>,
        pub bank_rules: Map<u32, BankRules>,
        pub bank_rules_configured: Map<u32, bool>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowDeleted: RowDeleted,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn configure(ref self: ComponentState<TContractState>, game_id: u32, rules: BankRules) {
            assert!(!self.bank_rules_configured.read(game_id), "bank rules already configured");
            assert!(
                rules.lp_fee_num < rules.lp_fee_denom
                    && rules.owner_fee_num <= rules.owner_fee_denom
                    && rules.owner_fee_denom != 0,
                "invalid bank fee ratio",
            );
            self.bank_rules_configured.write(game_id, true);
            self.bank_rules.write(game_id, rules);
            let mut values = array![];
            rules.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'BankRules', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
        }
        fn rules(self: @ComponentState<TContractState>, game_id: u32) -> BankRules {
            assert!(self.bank_rules_configured.read(game_id), "missing bank rules");
            self.bank_rules.read(game_id)
        }
        fn market(self: @ComponentState<TContractState>, key: MarketKey) -> Market {
            self.markets.read((key.game_id, key.resource_type))
        }
        fn write_market(ref self: ComponentState<TContractState>, key: MarketKey, market: Market) {
            self.markets.write((key.game_id, key.resource_type), market);
            let mut values = array![];
            market.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'Market',
                        keys: array![key.game_id.into(), key.resource_type.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn shares(self: @ComponentState<TContractState>, key: LiquidityKey) -> u128 {
            self.liquidity.read((key.game_id, key.owner, key.resource_type))
        }
        fn write_shares(ref self: ComponentState<TContractState>, key: LiquidityKey, shares: u128) {
            self.liquidity.write((key.game_id, key.owner, key.resource_type), shares);
            let mut keys = array![];
            key.serialize(ref keys);
            if shares == 0 {
                self.emit(RowDeleted { version: 1, model: 'Liquidity', keys: keys.span() });
            } else {
                self
                    .emit(
                        RowSet {
                            version: 1, model: 'Liquidity', keys: keys.span(), values: array![shares.into()].span(),
                        },
                    );
            }
        }
        fn name_bank(ref self: ComponentState<TContractState>, key: crate::resources::ResourceKey, name: felt252) {
            self.bank_names.write((key.game_id, key.entity_id), name);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'BankName',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        values: array![name].span(),
                    },
                );
        }
    }
}
