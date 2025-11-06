// use cubit::f128::types::fixed::{Fixed, FixedTrait};

// use dojo::model::{ModelStorage, ModelStorageTest, ModelValueStorage};

// use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
// use dojo::world::{WorldStorage, WorldStorageTrait};
// use dojo_cairo_test::{ContractDefTrait, NamespaceDef, TestResource};
// use crate::alias::ID;
// use crate::constants::{DONKEY_ENTITY_TYPE, ResourceTypes, WORLD_CONFIG_ID};

// use crate::models::bank::liquidity::{Liquidity};
// use crate::models::bank::market::{Market};

// use crate::models::config::{CapacityCategory, CapacityConfig};
// use crate::models::position::{Coord};
// use crate::models::resource::resource::{Resource, ResourceImpl};
// use crate::systems::bank::contracts::bank::{IBankSystemsDispatcher, IBankSystemsDispatcherTrait};
// use crate::systems::bank::contracts::bank::{bank_systems, bank_systems::InternalBankSystemsImpl};

// use crate::systems::bank::contracts::liquidity::liquidity_systems;
// use crate::systems::bank::contracts::liquidity::{ILiquiditySystemsDispatcher, ILiquiditySystemsDispatcherTrait};
// use crate::systems::bank::contracts::swap::swap_systems;
// use crate::systems::bank::contracts::swap::{ISwapSystemsDispatcher, ISwapSystemsDispatcherTrait};
// use crate::systems::config::contracts::config_systems;
// use crate::systems::config::contracts::{IBankConfigDispatcher, IBankConfigDispatcherTrait};
// use crate::utils::testing::{config::set_capacity_config, systems::deploy_system, world::spawn_eternum};

// use starknet::contract_address_const;

// use traits::Into;

// const INITIAL_RESOURCE_BALANCE: u128 = 100_000;
// const LIQUIDITY_AMOUNT: u128 = 10_000;
// const SWAP_AMOUNT: u128 = 1_000;
// const PLAYER_2_ID: ID = 420;
// const BANK_COORD_X: u32 = 30;
// const BANK_COORD_Y: u32 = 800;
// const BANK_ID: ID = 1;
// const DONKEY_CAPACITY: u128 = 10_000;

// fn setup(
//     owner_fee_num: u128, owner_fee_denom: u128, lp_fee_num: u128, lp_fee_denom: u128,
// ) -> (
//     WorldStorage,
//     ID,
//     ILiquiditySystemsDispatcher,
//     ISwapSystemsDispatcher,
//     IBankSystemsDispatcher,
//     IBankConfigDispatcher,
// ) {
//     let mut world = spawn_eternum();

//     // allows to start from entity_id 1
//     let _ = world.dispatcher.uuid();

//     let config_systems_address = deploy_system(ref world, "config_systems");
//     let bank_config_dispatcher = IBankConfigDispatcher { contract_address: config_systems_address };

//     bank_config_dispatcher.set_bank_config(0, lp_fee_num, lp_fee_denom);

//     set_capacity_config(config_systems_address);

//     let bank_systems_address = deploy_system(ref world, "bank_systems");
//     let bank_systems_dispatcher = IBankSystemsDispatcher { contract_address: bank_systems_address };

//     let bank_entity_id = InternalBankSystemsImpl::create_bank(
//         ref world, BANK_ID, Coord { x: BANK_COORD_X, y: BANK_COORD_Y }, owner_fee_num, owner_fee_denom, 0, 0,
//     );

//     let liquidity_systems_address = deploy_system(ref world, "liquidity_systems");
//     let liquidity_systems_dispatcher = ILiquiditySystemsDispatcher { contract_address: liquidity_systems_address };

//     let swap_systems_address = deploy_system(ref world, "swap_systems");
//     let swap_systems_dispatcher = ISwapSystemsDispatcher { contract_address: swap_systems_address };

//     // donkeys capcaity
//     world.write_model_test(@CapacityConfig { category: CapacityCategory::Donkey, weight_gram: DONKEY_CAPACITY });

//     // add some resources in the player balance
//     // wood, lords, donkeys
//     world
//         .write_model_test(
//             @Resource { entity_id: PLAYER_2_ID, resource_type: ResourceTypes::WOOD, balance: INITIAL_RESOURCE_BALANCE
//             },
//         );
//     world
//         .write_model_test(
//             @Resource {
//                 entity_id: PLAYER_2_ID, resource_type: ResourceTypes::LORDS, balance: INITIAL_RESOURCE_BALANCE,
//             },
//         );
//     world
//         .write_model_test(
//             @Resource {
//                 entity_id: PLAYER_2_ID, resource_type: ResourceTypes::DONKEY, balance: INITIAL_RESOURCE_BALANCE,
//             },
//         );

//     (
//         world,
//         bank_entity_id,
//         liquidity_systems_dispatcher,
//         swap_systems_dispatcher,
//         bank_systems_dispatcher,
//         bank_config_dispatcher,
//     )
// }

// #[test]
// fn bank_test_swap_buy_without_fees() {
//     let (
//         mut world,
//         bank_entity_id,
//         liquidity_systems_dispatcher,
//         swap_systems_dispatcher,
//         _bank_systems_dispatcher,
//         _bank_config_dispatcher,
//     ) =
//         setup(
//         0, 1, 0, 1,
//     );

//     let player = starknet::get_caller_address();

//     liquidity_systems_dispatcher
//         .add(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);
//     let donkey_id = swap_systems_dispatcher.buy(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, SWAP_AMOUNT);

//     // donkey resources
//     let donkey_wood = ResourceImpl::get(ref world, (donkey_id, ResourceTypes::WOOD));
//     let donkey_lords = ResourceImpl::get(ref world, (donkey_id, ResourceTypes::LORDS));
//     assert_eq!(donkey_wood.balance, SWAP_AMOUNT);
//     assert_eq!(donkey_lords.balance, 0);

//     // bank resources
//     let bank_wood = ResourceImpl::get(ref world, (bank_entity_id, ResourceTypes::WOOD));
//     let bank_lords = ResourceImpl::get(ref world, (bank_entity_id, ResourceTypes::LORDS));
//     assert(bank_wood.balance == 0, 'bank_wood.balance');
//     assert(bank_lords.balance == 0, 'bank_lords.balance');

//     // player resources
//     let wood = ResourceImpl::get(ref world, (PLAYER_2_ID, ResourceTypes::WOOD));
//     let lords = ResourceImpl::get(ref world, (PLAYER_2_ID, ResourceTypes::LORDS));
//     assert(wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'wood.balance');
//     // 90_000 - 1112 (lords cost)
//     assert_eq!(lords.balance, 88_888);

//     let market: Market = world.read_model((bank_entity_id, ResourceTypes::WOOD));
//     let liquidity: Liquidity = world.read_model((bank_entity_id, player, ResourceTypes::WOOD));

//     assert(market.lords_amount == 11_112, 'market.lords_amount');
//     assert(market.resource_amount == 9_000, 'market.resource_amount');
//     assert(liquidity.shares == FixedTrait::new_unscaled(10000, false), 'liquidity.shares');
// }

// #[test]
// fn bank_test_swap_buy_with_fees() {
//     let (
//         mut world,
//         bank_entity_id,
//         liquidity_systems_dispatcher,
//         swap_systems_dispatcher,
//         _bank_systems_dispatcher,
//         _bank_config_dispatcher,
//     ) =
//         setup(
//         1, 10, 1, 10,
//     );

//     let player = starknet::get_caller_address();

//     liquidity_systems_dispatcher
//         .add(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);
//     let donkey_id = swap_systems_dispatcher.buy(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, SWAP_AMOUNT);

//     // donkey resources
//     let donkey_wood = ResourceImpl::get(ref world, (donkey_id, ResourceTypes::WOOD));
//     let donkey_lords = ResourceImpl::get(ref world, (donkey_id, ResourceTypes::LORDS));
//     assert(donkey_wood.balance == SWAP_AMOUNT, 'donkey_wood.balance');
//     assert(donkey_lords.balance == 0, 'donkey_lords.balance');

//     // bank resources
//     let bank_wood = ResourceImpl::get(ref world, (bank_entity_id, ResourceTypes::WOOD));
//     let bank_lords = ResourceImpl::get(ref world, (bank_entity_id, ResourceTypes::LORDS));
//     assert(bank_wood.balance == 0, 'bank_wood.balance');
//     // 11 fees
//     assert_eq!(bank_lords.balance, 123);

//     // player resources
//     let wood = ResourceImpl::get(ref world, (PLAYER_2_ID, ResourceTypes::WOOD));
//     let lords = ResourceImpl::get(ref world, (PLAYER_2_ID, ResourceTypes::LORDS));
//     assert(wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'wood.balance');
//     // initial 90_000 - 1235 (lords cost) - 123 (bank fees)
//     assert_eq!(lords.balance, 88_642);

//     let market: Market = world.read_model((bank_entity_id, ResourceTypes::WOOD));
//     let liquidity: Liquidity = world.read_model((bank_entity_id, player, ResourceTypes::WOOD));

//     // 10_000 (reserve) + 11_235 (lords cost)
//     assert(market.lords_amount == 11_235, 'market.lords_amount');
//     // 10000 (reserve) - 1000 (result)
//     assert(market.resource_amount == 9000, 'market.resource_amount');
//     assert(liquidity.shares == FixedTrait::new_unscaled(10000, false), 'liquidity.shares');
// }

// #[test]
// fn bank_test_swap_sell_without_fees() {
//     let (
//         mut world,
//         bank_entity_id,
//         liquidity_systems_dispatcher,
//         swap_systems_dispatcher,
//         _bank_systems_dispatcher,
//         _bank_config_dispatcher,
//     ) =
//         setup(
//         0, 1, 0, 1,
//     );

//     let player = starknet::get_caller_address();

//     liquidity_systems_dispatcher
//         .add(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);
//     let donkey_id = swap_systems_dispatcher.sell(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, SWAP_AMOUNT);

//     // donkey resources
//     let donkey_wood = ResourceImpl::get(ref world, (donkey_id, ResourceTypes::WOOD));
//     let donkey_lords = ResourceImpl::get(ref world, (donkey_id, ResourceTypes::LORDS));
//     assert(donkey_wood.balance == 0, 'donkey_wood.balance');
//     assert_eq!(donkey_lords.balance, 909);

//     // bank resources
//     let bank_wood = ResourceImpl::get(ref world, (bank_entity_id, ResourceTypes::WOOD));
//     let bank_lords = ResourceImpl::get(ref world, (bank_entity_id, ResourceTypes::LORDS));
//     assert(bank_wood.balance == 0, 'bank_wood.balance');
//     assert(bank_lords.balance == 0, 'bank_lords.balance');

//     // player resources
//     let wood = ResourceImpl::get(ref world, (PLAYER_2_ID, ResourceTypes::WOOD));
//     let lords = ResourceImpl::get(ref world, (PLAYER_2_ID, ResourceTypes::LORDS));
//     assert(wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT - SWAP_AMOUNT, 'wood.balance');
//     assert(lords.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'lords.balance');

//     let market: Market = world.read_model((bank_entity_id, ResourceTypes::WOOD));
//     let liquidity: Liquidity = world.read_model((bank_entity_id, player, ResourceTypes::WOOD));

//     assert_eq!(market.lords_amount, 9091);
//     assert_eq!(market.resource_amount, 11000);

//     assert(liquidity.shares == FixedTrait::new_unscaled(10000, false), 'liquidity.shares');
// }

// #[test]
// fn bank_test_swap_sell_with_fees() {
//     let (
//         mut world,
//         bank_entity_id,
//         liquidity_systems_dispatcher,
//         swap_systems_dispatcher,
//         _bank_systems_dispatcher,
//         _bank_config_dispatcher,
//     ) =
//         setup(
//         1, 10, 1, 10,
//     );

//     let player = starknet::get_caller_address();

//     liquidity_systems_dispatcher
//         .add(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);
//     let donkey_id = swap_systems_dispatcher.sell(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, SWAP_AMOUNT);

//     // donkey resources
//     let donkey_wood = ResourceImpl::get(ref world, (donkey_id, ResourceTypes::WOOD));
//     let donkey_lords = ResourceImpl::get(ref world, (donkey_id, ResourceTypes::LORDS));
//     assert(donkey_wood.balance == 0, 'donkey_wood.balance');
//     assert_eq!(donkey_lords.balance, 743);

//     // bank resources
//     let bank_wood = ResourceImpl::get(ref world, (bank_entity_id, ResourceTypes::WOOD));
//     let bank_lords = ResourceImpl::get(ref world, (bank_entity_id, ResourceTypes::LORDS));
//     assert_eq!(bank_wood.balance, 0);
//     assert_eq!(bank_lords.balance, 82);

//     // player resources
//     let wood = ResourceImpl::get(ref world, (PLAYER_2_ID, ResourceTypes::WOOD));
//     let lords = ResourceImpl::get(ref world, (PLAYER_2_ID, ResourceTypes::LORDS));
//     assert(wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT - SWAP_AMOUNT, 'wood.balance');
//     assert(lords.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'lords.balance');

//     let market: Market = world.read_model((bank_entity_id, ResourceTypes::WOOD));
//     let liquidity: Liquidity = world.read_model((bank_entity_id, player, ResourceTypes::WOOD));

//     // payout for wood = 825 lords so 10,000 - 825
//     assert_eq!(market.lords_amount, 9175);
//     // reserve wood increase by 1_000
//     assert_eq!(market.resource_amount, 11_000);
//     assert(liquidity.shares == FixedTrait::new_unscaled(10000, false), 'liquidity.shares');
// }
