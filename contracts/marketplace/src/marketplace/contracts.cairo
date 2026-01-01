#[starknet::interface]
pub trait IMarketplaceSystems<T> {
    fn create(ref self: T, token_id: u16, collection_id: u16, price: u128, expiration: u32) -> u64;
    fn accept(ref self: T, order_id: u64);
    fn cancel(ref self: T, order_id: u64);
    fn edit(ref self: T, order_id: u64, new_price: u128);
    fn admin_whitelist_collection(ref self: T, collection_address: starknet::ContractAddress);
    fn admin_update_market_fee(
        ref self: T,
        fee_recipient: starknet::ContractAddress,
        fee_token: starknet::ContractAddress,
        fee_numerator: u64,
        fee_denominator: u64,
    );
    fn admin_update_market_owner_address(ref self: T, new_address: starknet::ContractAddress);
    fn admin_pause(ref self: T);
    fn admin_unpause(ref self: T);
}

#[dojo::contract]
pub mod marketplace_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use marketplace::alias::ID;
    use marketplace::constants::{DEFAULT_NS};
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin::token::erc721::interface::{IERC721Dispatcher, IERC721DispatcherTrait};
    use starknet::{get_block_timestamp, get_caller_address, get_contract_address};

    // Types

    #[derive(IntrospectPacked, Copy, Drop, Serde)]
    pub struct MarketOrder {
        active: bool,
        expiration: u32, // Timestamp
        token_id: u64,
        collection_id: u16,
        price: u128,
        owner: starknet::ContractAddress,
    }


    #[derive(Introspect, Drop, Copy, Serde)]
    enum MarketOrderState {
        Created,
        Edited,
        Cancelled,
        Accepted,
    }

    // Events
    #[derive(Introspect, Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct MarketOrderEvent {
        #[key]
        order_id: u64,
        #[key]
        state: MarketOrderState,
        market_order: MarketOrder,
    }


    // Models

    #[derive(IntrospectPacked, Copy, Drop, Serde)]
    #[dojo::model]
    pub struct MarketOrderModel2 {
        #[key]
        order_id: u64,
        order: MarketOrder,
    }

    #[derive(IntrospectPacked, Copy, Drop, Serde)]
    #[dojo::model]
    pub struct MarketTokenOrderModel2 {
        #[key]
        token_id: u64,
        #[key]
        collection_address: starknet::ContractAddress,
        order_id: u64,
    }

    #[derive(IntrospectPacked, Copy, Drop, Serde)]
    #[dojo::model]
    pub struct MarketWhitelistModel {
        #[key]
        collection_id: u32,
        collection_address: starknet::ContractAddress,
    }


    #[derive(IntrospectPacked, Copy, Drop, Serde)]
    #[dojo::model]
    pub struct MarketGlobalModel {
        #[key]
        id: ID,
        order_count: u64,
        collection_count: u32,
        paused: bool,
        owner: starknet::ContractAddress,
    }


    #[derive(IntrospectPacked, Copy, Drop, Serde)]
    #[dojo::model]
    pub struct MarketFeeModel {
        #[key]
        id: ID,
        fee_recipient: starknet::ContractAddress,
        fee_token: starknet::ContractAddress,
        fee_numerator: u64,
        fee_denominator: u64,
    }


    // Constants
    const MARKET_GLOBAL_ID: ID = 1;
    const ONE_DAY: u32 = 86400;


    #[abi(embed_v0)]
    impl MarketplaceSystemsImpl of super::IMarketplaceSystems<ContractState> {
        /// Creates a new market order.
        /// This function checks if the collection is whitelisted, checks market is approved and then
        /// increments the order count, sets the market order in state, and emits an OrderEvent.
        /// # Arguments
        /// * `market_order` - The market order to be created.
        fn create(ref self: ContractState, token_id: u16, collection_id: u16, price: u128, expiration: u32) -> u64 {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // assert price is greater than 0
            assert!(price > 0, "Market: sale price is zero");

            // assert market is not paused
            let mut market_global: MarketGlobalModel = world.read_model(MARKET_GLOBAL_ID);
            assert!(!market_global.paused, "Market: Paused");

            let caller = get_caller_address();
            let market_order = MarketOrder { owner: caller, token_id: token_id.into(), collection_id, price, expiration, active: true };

            // ensure the collection is whitelisted
            let collection_whitelisted: MarketWhitelistModel = world.read_model(collection_id);
            let collection_address = collection_whitelisted.collection_address;
            assert!(collection_address.is_non_zero(), "Market: Collection not whitelisted");

            // ensure the token cant be listed more than once
            let token_order: MarketTokenOrderModel2 = world.read_model((token_id, collection_address));
            assert!(token_order.order_id.is_zero(), "Market: Token already listed");

            // ensure the market is approved to spend the nft
            let collection_dispatcher = IERC721Dispatcher {
                contract_address: collection_whitelisted.collection_address,
            };
            assert!(collection_dispatcher.is_approved_for_all(caller, get_contract_address()), "Market: Not approved");

            // assert expiration is in the future and at least 1 day
            assert!(
                market_order.expiration > get_block_timestamp().try_into().unwrap() + ONE_DAY, "Market: Not in future",
            );

            // ensure caller is owner of the nft
            assert!(collection_dispatcher.owner_of(market_order.token_id.into()) == caller, "Market: Not owner");

            // increment the order count
            market_global.order_count += 1;
            world.write_model(@market_global);

            // write the market order
            world.write_model(@MarketOrderModel2 { order_id: market_global.order_count, order: market_order });

            // write the token order
            world
                .write_model(
                    @MarketTokenOrderModel2 { token_id: token_id.into(), collection_address, order_id: market_global.order_count },
                );

            // emit event
            world
                .emit_event(
                    @MarketOrderEvent {
                        order_id: market_global.order_count,
                        state: MarketOrderState::Created,
                        market_order: market_order,
                    },
                );

            // return the order id
            return market_global.order_count;
        }


        /// Accepts a market order.
        /// Retrieves the order, transfers the required tokens and NFTs, sets the order to inactive, and emits an
        /// OrderEvent.
        /// # Arguments
        /// * `order_id` - The identifier of the order to accept.
        fn accept(ref self: ContractState, order_id: u64) {
            // assert not paused
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let market_global: MarketGlobalModel = world.read_model(MARKET_GLOBAL_ID);
            assert!(!market_global.paused, "Market: Paused");

            // ensure order has not expired
            let mut market_order_model: MarketOrderModel2 = world.read_model(order_id);
            assert!(
                market_order_model.order.expiration > get_block_timestamp().try_into().unwrap(),
                "Market: Order expired",
            );

            // ensure the collection is whitelisted
            let collection_id = market_order_model.order.collection_id;
            let collection_whitelisted: MarketWhitelistModel = world.read_model(collection_id);
            let collection_address = collection_whitelisted.collection_address;
            assert!(collection_address.is_non_zero(), "Market: Collection not whitelisted");

            // ensure the market order creator still owns the nft
            let collection_dispatcher = IERC721Dispatcher { contract_address: collection_address };
            let nft_owner = collection_dispatcher.owner_of(market_order_model.order.token_id.into());
            assert!(nft_owner == market_order_model.order.owner, "Market: Order creator no longer owns NFT");

            // assert active
            assert!(market_order_model.order.active, "Market: Order not active");

            let cost = market_order_model.order.price.into();
            let market_fee: MarketFeeModel = world.read_model(MARKET_GLOBAL_ID);
            let fee: u256 = (cost * market_fee.fee_numerator.into()) / market_fee.fee_denominator.into();

            // transfer fee to fee recipient
            let caller = get_caller_address();
            let fee_token = IERC20Dispatcher { contract_address: market_fee.fee_token };
            fee_token.transfer_from(caller, market_fee.fee_recipient, fee.into());

            // transfer cost less fee from buyer to seller
            fee_token.transfer_from(caller, nft_owner, (cost.into() - fee).into());

            // transfer nft from seller to buyer
            collection_dispatcher.transfer_from(nft_owner, caller, market_order_model.order.token_id.into());

            // make order inactive
            market_order_model.order.active = false;
            world.write_model(@market_order_model);

            // make token order inactive
            world
                .write_model(
                    @MarketTokenOrderModel2 {
                        token_id: market_order_model.order.token_id, collection_address, order_id: 0,
                    },
                );

            // emit event
            world
                .emit_event(
                    @MarketOrderEvent {
                        order_id, state: MarketOrderState::Accepted, market_order: market_order_model.order,
                    },
                );
        }


        /// Cancels a market order.
        /// Checks if the order is active and if the caller is the order owner, revokes approval, sets the order to
        /// inactive, and emits an OrderEvent.
        /// # Arguments
        /// * `order_id` - The identifier of the order to cancel.
        fn cancel(ref self: ContractState, order_id: u64) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // ensure order is active
            let mut market_order_model: MarketOrderModel2 = world.read_model(order_id);
            assert!(market_order_model.order.active, "Market: Order not active");

            // ensure the collection is whitelisted
            let collection_id = market_order_model.order.collection_id;
            let collection_whitelisted: MarketWhitelistModel = world.read_model(collection_id);
            let collection_address = collection_whitelisted.collection_address;
            assert!(collection_address.is_non_zero(), "Market: Collection not whitelisted");

            // ensure caller owns the nft but not necessarily the order
            let collection_dispatcher = IERC721Dispatcher { contract_address: collection_address };
            assert!(
                collection_dispatcher.owner_of(market_order_model.order.token_id.into()) == get_caller_address(),
                "Market: Caller not owner of NFT",
            );

            // set inactive
            market_order_model.order.active = false;
            world.write_model(@market_order_model);

            // make token order inactive
            world
                .write_model(
                    @MarketTokenOrderModel2 {
                        token_id: market_order_model.order.token_id, collection_address, order_id: 0,
                    },
                );

            // emit event
            world
                .emit_event(
                    @MarketOrderEvent {
                        order_id, state: MarketOrderState::Cancelled, market_order: market_order_model.order,
                    },
                );
        }


        /// Edits an existing market order.
        /// Checks if the order is active and if the caller is the order owner, then updates the order in state and
        /// emits an OrderEvent.
        /// # Arguments
        /// * `order_id` - The identifier of the order to edit.
        fn edit(ref self: ContractState, order_id: u64, new_price: u128) {
            // ensure order is active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut market_order_model: MarketOrderModel2 = world.read_model(order_id);
            assert!(market_order_model.order.active, "Market: Order not active");

            // ensure the collection is whitelisted
            let collection_id = market_order_model.order.collection_id;
            let collection_whitelisted: MarketWhitelistModel = world.read_model(collection_id);
            let collection_address = collection_whitelisted.collection_address;
            assert!(collection_address.is_non_zero(), "Market: Collection not whitelisted");

            // ensure caller owns the nft but not necessarily the order
            let collection_dispatcher = IERC721Dispatcher { contract_address: collection_address };
            assert!(
                collection_dispatcher.owner_of(market_order_model.order.token_id.into()) == get_caller_address(),
                "Market: Caller not owner of NFT",
            );

            // update price
            market_order_model.order.price = new_price;
            world.write_model(@market_order_model);

            // emit event
            world
                .emit_event(
                    @MarketOrderEvent {
                        order_id, state: MarketOrderState::Edited, market_order: market_order_model.order,
                    },
                );
        }

        // Whitelists a collection. Can only be called by the DAO multisig.
        /// # Arguments
        /// * `collection_address` - The address of the collection to whitelist.
        fn admin_whitelist_collection(ref self: ContractState, collection_address: starknet::ContractAddress) {
            // ensure collection address is not zero
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert!(collection_address.is_non_zero(), "Market: Collection address is zero");

            // ensure caller is admin
            let mut market_global: MarketGlobalModel = world.read_model(MARKET_GLOBAL_ID);
            assert!(market_global.owner == get_caller_address(), "Market: Not market owner");

            // increment collection count
            let collection_id = market_global.collection_count + 1;
            market_global.collection_count = collection_id;
            world.write_model(@market_global);

            // set the whitelist
            world.write_model(@MarketWhitelistModel { collection_id, collection_address });
        }

        /// Updates the DAO fee. Can only be called by the DAO multisig.
        /// # Arguments
        /// * `fee` - The new fee.
        fn admin_update_market_fee(
            ref self: ContractState,
            fee_recipient: starknet::ContractAddress,
            fee_token: starknet::ContractAddress,
            fee_numerator: u64,
            fee_denominator: u64,
        ) {
            // ensure caller is admin
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut market_global: MarketGlobalModel = world.read_model(MARKET_GLOBAL_ID);
            assert!(market_global.owner == get_caller_address(), "Market: Not market owner");

            // update fee
            let mut market_fee: MarketFeeModel = world.read_model(MARKET_GLOBAL_ID);
            market_fee.fee_recipient = fee_recipient;
            market_fee.fee_token = fee_token;
            market_fee.fee_numerator = fee_numerator;
            market_fee.fee_denominator = fee_denominator;
            world.write_model(@market_fee);
        }

        /// Updates the DAO address. Can only be called by the DAO multisig.
        /// # Arguments
        /// * `new_address` - The new DAO address.
        fn admin_update_market_owner_address(ref self: ContractState, new_address: starknet::ContractAddress) {
            // ensure new address is not zero
            assert!(new_address.is_non_zero(), "Market: New address is zero");

            // ensure caller is admin
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut market_global: MarketGlobalModel = world.read_model(MARKET_GLOBAL_ID);
            if market_global.owner.is_non_zero() {
                assert!(market_global.owner == get_caller_address(), "Market: Not market owner");
            }

            // update owner
            market_global.owner = new_address;
            world.write_model(@market_global);
        }

        /// Pauses the contract. Can only be called by the DAO multisig
        fn admin_pause(ref self: ContractState) {
            // ensure caller is admin
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut market_global: MarketGlobalModel = world.read_model(MARKET_GLOBAL_ID);
            assert!(market_global.owner == get_caller_address(), "Market: Not market owner");

            // pause
            market_global.paused = true;
            world.write_model(@market_global);
        }

        /// Unpauses the contract. Can only be called by the DAO multisig
        fn admin_unpause(ref self: ContractState) {
            // ensure caller is admin
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut market_global: MarketGlobalModel = world.read_model(MARKET_GLOBAL_ID);
            assert!(market_global.owner == get_caller_address(), "Market: Not market owner");

            // unpause
            market_global.paused = false;
            world.write_model(@market_global);
        }
    }
}
