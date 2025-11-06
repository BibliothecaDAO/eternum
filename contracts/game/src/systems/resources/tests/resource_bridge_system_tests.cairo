// mod resource_bridge_system_tests {
//     use core::option::OptionTrait;
//     use core::result::ResultTrait;
//     use core::traits::Into;
//     use dojo::model::{ModelStorage, ModelStorageTest, ModelValueStorage};
//     use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
//     use dojo::world::{WorldStorage, WorldStorageTrait};
//     use dojo_cairo_test::{ContractDefTrait, NamespaceDef, TestResource};
//     use crate::alias::ID;
//     use crate::constants::{ResourceTypes, WORLD_CONFIG_ID};
//     use crate::models::bank::{bank::Bank};
//     use crate::models::config::{CapacityCategory, WeightConfig};
//     use crate::models::config::{ResourceBridgeConfig, ResourceBridgeFeeSplitConfig,
//     ResourceBridgeWhitelistConfig};
//     use crate::models::owner::{EntityOwner, Owner};
//     use crate::models::position::{Coord, Position};
//     use crate::models::resource::resource::{RESOURCE_PRECISION, Resource};
//     use crate::models::structure::{Structure, StructureCategory};
//     use crate::systems::config::contracts::config_systems;
//     use crate::systems::resources::contracts::resource_bridge_systems::{
//         ERC20ABIDispatcher, ERC20ABIDispatcherTrait, IResourceBridgeSystemsDispatcher,
//         IResourceBridgeSystemsDispatcherTrait, resource_bridge_systems, resource_bridge_systems::InternalBridgeImpl,
//     };
//     use crate::utils::testing::mock::erc20mock::MockERC20;
//     use crate::utils::testing::{
//         config::set_capacity_config, systems::{deploy_contract, deploy_system}, world::spawn_eternum,
//     };
//     use starknet::testing::set_contract_address;
//     use starknet::{ContractAddress, contract_address_const};

//     fn REALM_ID() -> ID {
//         9899
//     }

//     fn REALM_COORD() -> Coord {
//         Coord { x: 100, y: 100 }
//     }

//     fn REALM_INITIAL_DONKEY_BALANCE() -> u128 {
//         100_000
//     }

//     fn BANK_ID() -> ID {
//         4844
//     }

//     fn BANK_COORD() -> Coord {
//         Coord { x: 400, y: 400 }
//     }

//     fn BANK_BRIDGE_FEE_DPT_PERCENT() -> u16 {
//         100 // 1% i.e 100/10_000
//     }

//     fn BANK_BRIDGE_FEE_WTDR_PERCENT() -> u16 {
//         300 // 3% i.e 300/10_000
//     }

//     fn TEST_ADDRESS() -> ContractAddress {
//         contract_address_const::<0>()
//     }

//     fn REALM_OWNER_ADDRESS() -> ContractAddress {
//         contract_address_const::<'realm_owner'>()
//     }

//     fn BANK_OWNER_ADDRESS() -> ContractAddress {
//         contract_address_const::<'bank_owner'>()
//     }

//     fn BRIDGER_WITHDRAW_ADDRESS() -> ContractAddress {
//         contract_address_const::<'bridger_withdraw'>()
//     }

//     fn VELORDS_ADDRESS() -> ContractAddress {
//         contract_address_const::<'velords'>()
//     }

//     fn SEASON_POOL_ADDRESS() -> ContractAddress {
//         contract_address_const::<'season_pool'>()
//     }

//     fn CLIENT_FEE_RECIPIENT_ADDRESS() -> ContractAddress {
//         contract_address_const::<'client_fee_recipient'>()
//     }

//     fn pow_10(n: u8) -> u128 {
//         let mut value: u128 = 1;
//         let mut i = 0;
//         loop {
//             if i == n {
//                 break;
//             }
//             value *= 10;
//             i += 1;
//         };
//         value
//     }

//     fn LORDS_ERC20_SUPPLY() -> u128 {
//         100_000 * pow_10(LORDS_ERC20_DECIMALS())
//     }

//     fn LORDS_ERC20_DECIMALS() -> u8 {
//         7 // using an ireegular decimal just because
//     }

//     #[generate_trait]
//     impl SetupImpl of SetupTrait {
//         fn setup() -> (WorldStorage, IResourceBridgeSystemsDispatcher, ERC20ABIDispatcher) {
//             let mut world = spawn_eternum();

//             // Deploy resource bridge systems
//             let resource_bridge_systems = Self::deploy_resource_bridge_systems(ref world);

//             // Deploy mock ERC20 token
//             let mock_erc20_address = Self::deploy_mock_erc20(ref world);

//             // Set up bridge configurations
//             Self::setup_bridge_config(ref world, mock_erc20_address);

//             // setup capacity config
//             Self::setup_capacity_config(ref world);

//             // setup weight config
//             Self::setup_donkey_weight_config(ref world);

//             (world, resource_bridge_systems, ERC20ABIDispatcher { contract_address: mock_erc20_address })
//         }

//         fn deploy_resource_bridge_systems(ref world: WorldStorage) -> IResourceBridgeSystemsDispatcher {
//             let resource_bridge_systems_address = deploy_system(ref world, "resource_bridge_systems");
//             IResourceBridgeSystemsDispatcher { contract_address: resource_bridge_systems_address }
//         }

//         fn deploy_mock_erc20(ref world: WorldStorage) -> ContractAddress {
//             set_contract_address(REALM_OWNER_ADDRESS());
//             let mock_erc20_calldata: Array<felt252> = array![
//                 LORDS_ERC20_SUPPLY().into(), 0, LORDS_ERC20_DECIMALS().into(),
//             ];
//             let mock_erc20_address = deploy_contract(MockERC20::TEST_CLASS_HASH, mock_erc20_calldata.span());
//             set_contract_address(TEST_ADDRESS());
//             mock_erc20_address
//         }

//         fn setup_donkey_weight_config(ref world: WorldStorage) {
//             world
//                 .write_model_test(
//                     @WeightConfig {
//                         config_id: WORLD_CONFIG_ID,
//                         weight_config_id: ResourceTypes::DONKEY.into(),
//                         entity_type: ResourceTypes::DONKEY.into(),
//                         weight_gram: 10,
//                     },
//                 );
//             world
//                 .write_model_test(
//                     @WeightConfig {
//                         config_id: WORLD_CONFIG_ID,
//                         weight_config_id: ResourceTypes::LORDS.into(),
//                         entity_type: ResourceTypes::LORDS.into(),
//                         weight_gram: 1,
//                     },
//                 );
//         }

//         fn setup_capacity_config(ref world: WorldStorage) {
//             let config_systems_address = deploy_system(ref world, "config_systems");
//             set_capacity_config(config_systems_address);
//         }

//         fn setup_bridge_config(ref world: WorldStorage, mock_erc20_address: ContractAddress) {
//             WorldConfigUtilImpl::set_member(
//                 ref world,
//                 selector!("resource_bridge_config"),
//                 ResourceBridgeConfig { deposit_paused: false, withdraw_paused: false },
//             );
//             world
//                 .write_model_test(
//                     @ResourceBridgeWhitelistConfig { token: mock_erc20_address, resource_type: ResourceTypes::LORDS
//                     },
//                 );
//             WorldConfigUtilImpl::set_member(
//                 ref world,
//                 selector!("res_bridge_fee_split_config"),
//                 ResourceBridgeFeeSplitConfig {
//                     velords_fee_recipient: VELORDS_ADDRESS(),
//                     season_pool_fee_recipient: SEASON_POOL_ADDRESS(),
//                     velords_fee_on_dpt_percent: 100, // 1% i.e 100/10_000
//                     season_pool_fee_on_dpt_percent: 50, // 0.5% i.e 50/10_000
//                     client_fee_on_dpt_percent: 50, // 0.5% i.e 50/10_000
//                     velords_fee_on_wtdr_percent: 200, // 2% i.e 200/10_000
//                     season_pool_fee_on_wtdr_percent: 100, // 1% i.e 100/10_000
//                     client_fee_on_wtdr_percent: 100, // 1% i.e 100/10_000
//                     realm_fee_dpt_percent: 500, // 5% i.e 500/10_000
//                     realm_fee_wtdr_percent: 600 // 6% i.e 600/10_000
//                 },
//             );
//         }

//         fn make_bank(ref world: WorldStorage, bank_id: ID) {
//             world
//                 .write_model_test(
//                     @CapacityCategory { entity_id: bank_id.into(), category: CapacityCategory::Structure },
//                 );
//             world
//                 .write_model_test(
//                     @Bank {
//                         entity_id: bank_id.into(),
//                         owner_fee_num: 1,
//                         owner_fee_denom: 1,
//                         owner_bridge_fee_dpt_percent: BANK_BRIDGE_FEE_DPT_PERCENT(),
//                         owner_bridge_fee_wtdr_percent: BANK_BRIDGE_FEE_WTDR_PERCENT(),
//                         exists: true,
//                     },
//                 );
//             world
//                 .write_model_test(
//                     @Structure { entity_id: bank_id.into(), category: StructureCategory::Bank, created_at: 1 },
//                 );
//             world.write_model_test(@Owner { entity_id: bank_id.into(), address: BANK_OWNER_ADDRESS() });
//             world.write_model_test(@EntityOwner { entity_id: bank_id.into(), entity_owner_id: bank_id.into() });
//             world.write_model_test(@Position { entity_id: bank_id.into(), x: BANK_COORD().x, y: BANK_COORD().y });
//         }

//         fn make_realm(ref world: WorldStorage, realm_id: ID) {
//             world
//                 .write_model_test(
//                     @CapacityCategory { entity_id: realm_id.into(), category: CapacityCategory::Structure },
//                 );
//             world
//                 .write_model_test(
//                     @Structure { entity_id: realm_id.into(), category: StructureCategory::Realm, created_at: 1 },
//                 );
//             world.write_model_test(@Owner { entity_id: realm_id.into(), address: REALM_OWNER_ADDRESS() });
//             world.write_model_test(@EntityOwner { entity_id: realm_id.into(), entity_owner_id: realm_id.into() });
//             world
//                 .write_model_test(
//                     @Resource {
//                         entity_id: realm_id.into(),
//                         resource_type: ResourceTypes::DONKEY,
//                         balance: REALM_INITIAL_DONKEY_BALANCE(),
//                     },
//                 );
//             world.write_model_test(@Position { entity_id: realm_id.into(), x: REALM_COORD().x, y: REALM_COORD().y });
//         }
//     }

//     #[test]
//     fn resource_bridge_test_deposit_success() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         // Perform deposit
//         let deposit_amount_no_decimals: u128 = 1_000;
//         let deposit_amount_token_precision: u256 = deposit_amount_no_decimals.into()
//             * pow_10(LORDS_ERC20_DECIMALS()).into();
//         token.approve(resource_bridge_systems.contract_address, deposit_amount_token_precision);
//         resource_bridge_systems
//             .deposit(
//                 token.contract_address,
//                 bank_id.into(),
//                 realm_id.into(),
//                 deposit_amount_token_precision,
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );

//         // check that lords were transferred from the caller to the bridge
//         assert_eq!(
//             token.balance_of(REALM_OWNER_ADDRESS()),
//             LORDS_ERC20_SUPPLY().into() - deposit_amount_token_precision,
//             "Incorrect bridger lords balance after deposit",
//         );

//         // check that the bridge is holding the collected lords amount minus the fees
//         // which is 98% of the deposit amount because 1% goes to velords and 0.5% goes
//         // to season pool and 0.5% goes to client fee recipient.
//         //
//         // 1% also goes to bank but as an in game resource so we dont count that
//         let expected_bridge_lords_balance = deposit_amount_token_precision * 98 / 100;
//         assert_eq!(
//             token.balance_of(resource_bridge_systems.contract_address),
//             expected_bridge_lords_balance,
//             "Incorrect bridge lords balance after deposit",
//         );

//         // check that the velords address received the correct amount of velords fees
//         let velords_fee_amount = (deposit_amount_token_precision * 1) / 100; // 1% velords fee
//         assert_eq!(token.balance_of(VELORDS_ADDRESS()), velords_fee_amount, "Incorrect velords fee amount");

//         // check that the season pool address received the correct amount of season pool fees
//         let season_pool_fee_amount = (deposit_amount_token_precision * 5) / 1000; // 0.5% season pool fee
//         assert_eq!(token.balance_of(SEASON_POOL_ADDRESS()), season_pool_fee_amount, "Incorrect season pool fee
//         amount");

//         // check that the client fee recipient received the correct amount of client fees
//         let client_fee_amount = (deposit_amount_token_precision * 5) / 1000; // 0.5% client fee
//         assert_eq!(token.balance_of(CLIENT_FEE_RECIPIENT_ADDRESS()), client_fee_amount, "Incorrect client fee
//         amount");

//         // check that bank received the correct amount of bridge fees
//         let bank_lords_resource: Resource = world.read_model((bank_id, ResourceTypes::LORDS));
//         let deposit_amount_resource_precision: u128 = deposit_amount_no_decimals * RESOURCE_PRECISION;
//         let expected_bank_lords_balance = deposit_amount_resource_precision * 1 / 100; // 1% bank fee
//         assert_eq!(
//             bank_lords_resource.balance, expected_bank_lords_balance, "Incorrect bank resource balance after
//             deposit",
//         );

//         // check that the bank received the correct in game lords resource amount
//         let realm_donkey_id = 1;
//         let realm_transport_lords_resource: Resource = world.read_model((realm_donkey_id, ResourceTypes::LORDS));
//         let expected_realm_transport_lords_balance = (deposit_amount_resource_precision * 97)
//             / 100; // 3% total fees so 97% goes to realm
//         assert_eq!(
//             realm_transport_lords_resource.balance,
//             expected_realm_transport_lords_balance,
//             "Incorrect realm resource balance after deposit",
//         );

//         // ensure realm donkey location is correct
//         let realm_transport_position: Position = world.read_model(realm_donkey_id);
//         assert_eq!(realm_transport_position.x, REALM_COORD().x, "Realm donkey location is incorrect");
//         assert_eq!(realm_transport_position.y, REALM_COORD().y, "Realm donkey location is incorrect");

//         // check that realm donkey balance decreased
//         let realm_donkey_resource: Resource = world.read_model((realm_id, ResourceTypes::DONKEY));
//         assert_lt!(
//             realm_donkey_resource.balance, REALM_INITIAL_DONKEY_BALANCE(), "Realm donkey balance did not decrease",
//         );
//     }

//     #[test]
//     fn resource_bridge_test_deposit_success_bank_owner_no_fees() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // Set the bank owner as the owner of the realm as well
//         world.write_model_test(@Owner { entity_id: realm_id.into(), address: BANK_OWNER_ADDRESS() });

//         // Make bank owner the caller
//         set_contract_address(BANK_OWNER_ADDRESS());

//         // Perform deposit
//         let deposit_amount_no_decimals: u128 = 1_000;
//         let deposit_amount_token_precision: u256 = deposit_amount_no_decimals.into()
//             * pow_10(LORDS_ERC20_DECIMALS()).into();

//         // Transfer LORDS to bank owner for the deposit
//         set_contract_address(REALM_OWNER_ADDRESS());
//         token.transfer(BANK_OWNER_ADDRESS(), deposit_amount_token_precision);

//         // make bank owner the caller
//         set_contract_address(BANK_OWNER_ADDRESS());
//         token.approve(resource_bridge_systems.contract_address, deposit_amount_token_precision);
//         resource_bridge_systems
//             .deposit(
//                 token.contract_address,
//                 bank_id.into(),
//                 realm_id.into(),
//                 deposit_amount_token_precision,
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );

//         // Check that lords were transferred from the caller to the bridge
//         assert_eq!(token.balance_of(BANK_OWNER_ADDRESS()), 0, "Incorrect bank owner lords balance after deposit");

//         // Check that the bridge is holding the collected lords amount minus the non-bank fees
//         // which is 98% of the deposit amount because 1% goes to velords and 0.5% goes
//         // to season pool and 0.5% goes to client fee recipient.
//         let expected_bridge_lords_balance = deposit_amount_token_precision * 98 / 100;
//         assert_eq!(
//             token.balance_of(resource_bridge_systems.contract_address),
//             expected_bridge_lords_balance,
//             "Incorrect bridge lords balance after deposit",
//         );

//         // Check that the velords address received the correct amount of velords fees
//         let velords_fee_amount = (deposit_amount_token_precision * 1) / 100; // 1% velords fee
//         assert_eq!(token.balance_of(VELORDS_ADDRESS()), velords_fee_amount, "Incorrect velords fee amount");

//         // Check that the season pool address received the correct amount of season pool fees
//         let season_pool_fee_amount = (deposit_amount_token_precision * 5) / 1000; // 0.5% season pool fee
//         assert_eq!(token.balance_of(SEASON_POOL_ADDRESS()), season_pool_fee_amount, "Incorrect season pool fee
//         amount");

//         // Check that the client fee recipient received the correct amount of client fees
//         let client_fee_amount = (deposit_amount_token_precision * 5) / 1000; // 0.5% client fee
//         assert_eq!(token.balance_of(CLIENT_FEE_RECIPIENT_ADDRESS()), client_fee_amount, "Incorrect client fee
//         amount");

//         // Check that bank did not receive any bridge fees
//         let bank_lords_resource: Resource = world.read_model((bank_id, ResourceTypes::LORDS));
//         assert_eq!(bank_lords_resource.balance, 0, "Bank should not receive fees for owner's deposit");

//         // Check that the realm received the correct in-game lords resource amount
//         let realm_donkey_id = 1;
//         let realm_transport_lords_resource: Resource = world.read_model((realm_donkey_id, ResourceTypes::LORDS));
//         let expected_realm_transport_lords_balance = (deposit_amount_no_decimals * RESOURCE_PRECISION * 98)
//             / 100; // 2% total fees so 98% goes to realm
//         assert_eq!(
//             realm_transport_lords_resource.balance,
//             expected_realm_transport_lords_balance,
//             "Incorrect realm resource balance after deposit",
//         );

//         // Ensure realm donkey location is correct
//         let realm_transport_position: Position = world.read_model(realm_donkey_id);
//         assert_eq!(realm_transport_position.x, REALM_COORD().x, "Realm donkey location is incorrect");
//         assert_eq!(realm_transport_position.y, REALM_COORD().y, "Realm donkey location is incorrect");

//         // Check that realm donkey balance decreased
//         let realm_donkey_resource: Resource = world.read_model((realm_id, ResourceTypes::DONKEY));
//         assert_lt!(
//             realm_donkey_resource.balance, REALM_INITIAL_DONKEY_BALANCE(), "Realm donkey balance did not decrease",
//         );
//     }

//     #[test]
//     #[should_panic(expected: ("ERC20: Insufficient balance", 'ENTRYPOINT_FAILED', 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_deposit_insufficient_balance() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         // transfer all lords out of bridger
//         let lords_balance = token.balance_of(REALM_OWNER_ADDRESS());
//         token.transfer(VELORDS_ADDRESS(), lords_balance);

//         // Perform deposit
//         let deposit_amount_no_decimals: u128 = 1_000;
//         let deposit_amount_token_precision: u256 = deposit_amount_no_decimals.into()
//             * pow_10(LORDS_ERC20_DECIMALS()).into();
//         token.approve(resource_bridge_systems.contract_address, deposit_amount_token_precision);
//         resource_bridge_systems
//             .deposit(
//                 token.contract_address,
//                 bank_id.into(),
//                 realm_id.into(),
//                 deposit_amount_token_precision,
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );
//     }

//     #[test]
//     #[should_panic(expected: ("ERC20: Insufficient allowance", 'ENTRYPOINT_FAILED', 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_deposit_insufficient_allowance() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         let deposit_amount_no_decimals: u128 = 1_000;
//         let deposit_amount_token_precision: u256 = deposit_amount_no_decimals.into()
//             * pow_10(LORDS_ERC20_DECIMALS()).into();
//         // DONT APPROVE
//         // token.approve(resource_bridge_systems.contract_address, deposit_amount_token_precision);
//         resource_bridge_systems
//             .deposit(
//                 token.contract_address,
//                 bank_id.into(),
//                 realm_id.into(),
//                 deposit_amount_token_precision,
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );
//     }

//     #[test]
//     #[should_panic(expected: ("Bridge: deposit amount too small to take fees", 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_deposit_amount_too_small() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         // Perform deposit of 0.00001 lords
//         let deposit_amount_token_precision: u256 = 1.into() * pow_10(LORDS_ERC20_DECIMALS() - 5).into();
//         token.approve(resource_bridge_systems.contract_address, deposit_amount_token_precision);
//         resource_bridge_systems
//             .deposit(
//                 token.contract_address,
//                 bank_id.into(),
//                 realm_id.into(),
//                 deposit_amount_token_precision,
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );
//     }

//     #[test]
//     #[should_panic(expected: ("through bank is not a bank", 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_deposit_not_bank() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let not_bank_id: ID = 1;
//         let realm_id: ID = REALM_ID();
//         world
//             .write_model_test(
//                 @Structure { entity_id: not_bank_id.into(), category: StructureCategory::Realm, created_at: 1 },
//             );
//         SetupImpl::make_realm(ref world, realm_id);

//         // make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         let deposit_amount_no_decimals: u128 = 1_000;
//         let deposit_amount_token_precision: u256 = deposit_amount_no_decimals.into()
//             * pow_10(LORDS_ERC20_DECIMALS()).into();
//         token.approve(resource_bridge_systems.contract_address, deposit_amount_token_precision);
//         resource_bridge_systems
//             .deposit(
//                 token.contract_address,
//                 not_bank_id.into(),
//                 realm_id.into(),
//                 deposit_amount_token_precision,
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );
//     }

//     #[test]
//     #[should_panic(expected: ("recipient structure is not a realm", 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_deposit_recipient_not_realm() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let not_realm_id: ID = 1234;
//         SetupImpl::make_bank(ref world, bank_id);

//         // Create a structure that is not a realm
//         world
//             .write_model_test(
//                 @Structure {
//                     entity_id: not_realm_id.into(),
//                     category: StructureCategory::Bank, // Using Bank instead of Realm
//                     created_at: 1,
//                 },
//             );

//         // make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         let deposit_amount_no_decimals: u128 = 1_000;
//         let deposit_amount_token_precision: u256 = deposit_amount_no_decimals.into()
//             * pow_10(LORDS_ERC20_DECIMALS()).into();
//         token.approve(resource_bridge_systems.contract_address, deposit_amount_token_precision);

//         // Attempt to deposit to a non-realm structure
//         resource_bridge_systems
//             .deposit(
//                 token.contract_address,
//                 bank_id.into(),
//                 not_realm_id.into(),
//                 deposit_amount_token_precision,
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );
//     }

//     #[test]
//     #[should_panic(expected: ("resource bridge deposit is paused", 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_deposit_paused() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         world
//             .write_model_test(
//                 @ResourceBridgeConfig { config_id: WORLD_CONFIG_ID, deposit_paused: true, withdraw_paused: false },
//             );

//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         let deposit_amount_no_decimals: u128 = 1_000;
//         let deposit_amount_token_precision: u256 = deposit_amount_no_decimals.into()
//             * pow_10(LORDS_ERC20_DECIMALS()).into();
//         token.approve(resource_bridge_systems.contract_address, deposit_amount_token_precision);
//         resource_bridge_systems
//             .deposit(
//                 token.contract_address,
//                 bank_id.into(),
//                 realm_id.into(),
//                 deposit_amount_token_precision,
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );
//     }

//     #[test]
//     #[should_panic(expected: ("resource id not whitelisted", 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_deposit_token_not_whitelisted() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         let non_whitelisted_token = contract_address_const::<'non_whitelisted'>();
//         let deposit_amount_no_decimals: u128 = 1_000;
//         let deposit_amount_token_precision: u256 = deposit_amount_no_decimals.into()
//             * pow_10(LORDS_ERC20_DECIMALS()).into();
//         token.approve(resource_bridge_systems.contract_address, deposit_amount_token_precision);
//         resource_bridge_systems
//             .deposit(
//                 non_whitelisted_token,
//                 bank_id.into(),
//                 realm_id.into(),
//                 deposit_amount_token_precision,
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );
//     }

//     #[test]
//     fn resource_bridge_test_start_withdraw_success() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // Set initial LORDS balance for the realm
//         let initial_lords_balance: u128 = 1000 * RESOURCE_PRECISION;
//         world
//             .write_model_test(
//                 @Resource {
//                     entity_id: realm_id.into(), resource_type: ResourceTypes::LORDS, balance: initial_lords_balance,
//                 },
//             );

//         // Make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         // Perform withdrawal
//         let withdraw_amount: u128 = 500 * RESOURCE_PRECISION;
//         resource_bridge_systems
//             .start_withdraw(bank_id.into(), realm_id.into(), token.contract_address, withdraw_amount);

//         // Check that LORDS were transferred from the realm to the bank
//         let realm_lords_resource: Resource = world.read_model((realm_id, ResourceTypes::LORDS));
//         assert_eq!(
//             realm_lords_resource.balance,
//             initial_lords_balance - withdraw_amount,
//             "Incorrect realm LORDS balance after withdrawal",
//         );
//         let realm_donkey_id: u32 = 1; // Assuming this is the first donkey created
//         let realm_donkey_lords_resource: Resource = world.read_model((realm_donkey_id, ResourceTypes::LORDS));
//         assert_eq!(
//             realm_donkey_lords_resource.balance, withdraw_amount, "Incorrect bank LORDS balance after withdrawal",
//         );

//         // Check that a donkey was created and is at the bank's location
//         let donkey_position: Position = world.read_model(realm_donkey_id);
//         let bank_position: Position = world.read_model(bank_id);
//         assert_eq!(donkey_position.x, bank_position.x, "Donkey is not at the bank's location");
//         assert_eq!(donkey_position.y, bank_position.y, "Donkey is not at the bank's location");

//         // Check that the donkey belongs to the realm
//         let donkey_owner: EntityOwner = world.read_model(realm_donkey_id);
//         assert_eq!(donkey_owner.entity_owner_id, realm_id.into(), "Donkey does not belong to the realm");
//     }

//     #[test]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_start_withdraw_not_owner() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // Set caller to a non-owner address
//         set_contract_address(BANK_OWNER_ADDRESS());

//         // Attempt withdrawal
//         let withdraw_amount: u128 = 500 * RESOURCE_PRECISION;
//         resource_bridge_systems
//             .start_withdraw(bank_id.into(), realm_id.into(), token.contract_address, withdraw_amount);
//     }

//     #[test]
//     #[should_panic(expected: ("through bank is not a bank", 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_start_withdraw_invalid_bank() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let not_bank_id: ID = 1234;
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_realm(ref world, realm_id);

//         // Create a structure that is not a bank
//         world
//             .write_model_test(
//                 @Structure { entity_id: not_bank_id.into(), category: StructureCategory::Realm, created_at: 1 },
//             );

//         // Make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         // Attempt withdrawal
//         let withdraw_amount: u128 = 500 * RESOURCE_PRECISION;
//         resource_bridge_systems
//             .start_withdraw(not_bank_id.into(), realm_id.into(), token.contract_address, withdraw_amount);
//     }

//     #[test]
//     #[should_panic(expected: ("from structure is not a realm", 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_start_withdraw_invalid_realm() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let not_realm_id: ID = 1234;
//         SetupImpl::make_bank(ref world, bank_id);

//         // Create a structure that is not a realm
//         world
//             .write_model_test(
//                 @Structure { entity_id: not_realm_id.into(), category: StructureCategory::Bank, created_at: 1 },
//             );
//         world.write_model_test(@EntityOwner { entity_id: not_realm_id.into(), entity_owner_id: not_realm_id.into()
//         });
//         world.write_model_test(@Owner { entity_id: not_realm_id.into(), address: REALM_OWNER_ADDRESS() });

//         // Make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         // Attempt withdrawal
//         let withdraw_amount: u128 = 500 * RESOURCE_PRECISION;
//         resource_bridge_systems
//             .start_withdraw(bank_id.into(), not_realm_id.into(), token.contract_address, withdraw_amount);
//     }

//     #[test]
//     #[should_panic(expected: ("resource bridge withdrawal is paused", 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_start_withdraw_paused() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // Pause withdrawals
//         world
//             .write_model_test(
//                 @ResourceBridgeConfig { config_id: WORLD_CONFIG_ID, deposit_paused: false, withdraw_paused: true },
//             );

//         // Make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         // Attempt withdrawal
//         let withdraw_amount: u128 = 500 * RESOURCE_PRECISION;
//         resource_bridge_systems
//             .start_withdraw(bank_id.into(), realm_id.into(), token.contract_address, withdraw_amount);
//     }

//     #[test]
//     #[should_panic(expected: ("resource id not whitelisted", 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_start_withdraw_non_whitelisted_token() {
//         let (mut world, resource_bridge_systems, _) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // Make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         // Attempt withdrawal with a non-whitelisted token
//         let non_whitelisted_token = contract_address_const::<'non_whitelisted'>();
//         let withdraw_amount: u128 = 500 * RESOURCE_PRECISION;
//         resource_bridge_systems.start_withdraw(bank_id.into(), realm_id.into(), non_whitelisted_token,
//         withdraw_amount);
//     }

//     #[test]
//     #[should_panic(
//         expected: (
//             "not enough resources, Resource (entity id: 9899, resource type: LORDS, balance: 100000). deduction:
//             500000", 'ENTRYPOINT_FAILED',
//         ),
//     )]
//     fn resource_bridge_test_start_withdraw_insufficient_balance() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // Set initial LORDS balance for the realm
//         let initial_lords_balance: u128 = 100 * RESOURCE_PRECISION;
//         world
//             .write_model_test(
//                 @Resource {
//                     entity_id: realm_id.into(), resource_type: ResourceTypes::LORDS, balance: initial_lords_balance,
//                 },
//             );

//         // Make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         // Attempt withdrawal with an amount greater than the balance
//         let withdraw_amount: u128 = 500 * RESOURCE_PRECISION;
//         resource_bridge_systems
//             .start_withdraw(bank_id.into(), realm_id.into(), token.contract_address, withdraw_amount);
//     }

//     #[test]
//     fn resource_bridge_test_finish_withdraw_success() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // transfer lords to bridge
//         set_contract_address(REALM_OWNER_ADDRESS());
//         let lords_amount: u256 = 1000 * pow_10(LORDS_ERC20_DECIMALS()).into();
//         token.transfer(resource_bridge_systems.contract_address, lords_amount);

//         // Set initial LORDS balance for the realm's donkey at the bank
//         let donkey_id: u32 = 1;
//         let initial_lords_balance: u128 = 1000 * RESOURCE_PRECISION;
//         world
//             .write_model_test(
//                 @Resource {
//                     entity_id: donkey_id.into(), resource_type: ResourceTypes::LORDS, balance: initial_lords_balance,
//                 },
//             );
//         world.write_model_test(@Position { entity_id: donkey_id.into(), x: BANK_COORD().x, y: BANK_COORD().y });
//         world.write_model_test(@EntityOwner { entity_id: donkey_id.into(), entity_owner_id: realm_id });

//         // Make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         // Perform withdrawal
//         resource_bridge_systems
//             .finish_withdraw(
//                 bank_id, donkey_id, token.contract_address, BRIDGER_WITHDRAW_ADDRESS(),
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );

//         // Check that LORDS were transferred from the donkey to the bridge
//         let donkey_lords_resource: Resource = world.read_model((donkey_id, ResourceTypes::LORDS));
//         assert_eq!(donkey_lords_resource.balance, 0, "Donkey LORDS balance should be zero after withdrawal");

//         // Check that the bridge transferred the correct amount to the recipient
//         let expected_withdraw_amount = InternalBridgeImpl::resource_amount_to_token_amount(
//             token.contract_address, initial_lords_balance,
//         );
//         let fee_split_config: ResourceBridgeFeeSplitConfig = WorldConfigUtilImpl::get_member(
//             world, selector!("res_bridge_fee_split_config"),
//         );
//         let total_fee_percent = fee_split_config.velords_fee_on_wtdr_percent
//             + fee_split_config.season_pool_fee_on_wtdr_percent
//             + fee_split_config.client_fee_on_wtdr_percent
//             + BANK_BRIDGE_FEE_WTDR_PERCENT();
//         let expected_recipient_amount = expected_withdraw_amount
//             - ((expected_withdraw_amount * total_fee_percent.into()) / 10_000);

//         assert_eq!(
//             token.balance_of(BRIDGER_WITHDRAW_ADDRESS()),
//             expected_recipient_amount,
//             "Incorrect recipient LORDS balance after withdrawal",
//         );
//         // Check that fees were distributed correctly
//         let velords_fee_amount = (expected_withdraw_amount * fee_split_config.velords_fee_on_wtdr_percent.into())
//             / 10000;
//         let season_pool_fee_amount = (expected_withdraw_amount
//             * fee_split_config.season_pool_fee_on_wtdr_percent.into())
//             / 10000;
//         let client_fee_amount = (expected_withdraw_amount * fee_split_config.client_fee_on_wtdr_percent.into()) /
//         10000;

//         assert_eq!(token.balance_of(VELORDS_ADDRESS()), velords_fee_amount, "Incorrect velords fee amount");
//         assert_eq!(token.balance_of(SEASON_POOL_ADDRESS()), season_pool_fee_amount, "Incorrect season pool fee
//         amount");
//         assert_eq!(token.balance_of(CLIENT_FEE_RECIPIENT_ADDRESS()), client_fee_amount, "Incorrect client fee
//         amount");

//         // Check that bank received the correct amount of bridge fees
//         let bank_lords_resource: Resource = world.read_model((bank_id, ResourceTypes::LORDS));
//         let expected_bank_fee = (initial_lords_balance * BANK_BRIDGE_FEE_WTDR_PERCENT().into()) / 10000;
//         assert_eq!(bank_lords_resource.balance, expected_bank_fee, "Incorrect bank resource balance after
//         withdrawal");
//     }

//     #[test]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_finish_withdraw_not_donkey_owner() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, bank_id);

//         // Set initial LORDS balance for the realm's donkey at the bank
//         let donkey_id: u32 = 1;
//         let initial_lords_balance: u128 = 1000 * RESOURCE_PRECISION;
//         world
//             .write_model_test(
//                 @Resource {
//                     entity_id: donkey_id.into(), resource_type: ResourceTypes::LORDS, balance: initial_lords_balance,
//                 },
//             );
//         world.write_model_test(@Position { entity_id: donkey_id.into(), x: BANK_COORD().x, y: BANK_COORD().y });
//         world.write_model_test(@EntityOwner { entity_id: donkey_id.into(), entity_owner_id: realm_id });

//         // Set caller to a non-owner address
//         set_contract_address(BANK_OWNER_ADDRESS());

//         // Attempt withdrawal
//         resource_bridge_systems
//             .finish_withdraw(
//                 bank_id, donkey_id, token.contract_address, BRIDGER_WITHDRAW_ADDRESS(),
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );
//     }

//     #[test]
//     #[should_panic(expected: ("through bank is not a bank", 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_finish_withdraw_invalid_bank() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let not_bank_id: ID = 1234;
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_realm(ref world, realm_id);

//         // Create a structure that is not a bank
//         world
//             .write_model_test(
//                 @Structure { entity_id: not_bank_id.into(), category: StructureCategory::Realm, created_at: 1 },
//             );

//         // Set initial LORDS balance for the realm's donkey at the non-bank location
//         let donkey_id: u32 = 1;
//         let initial_lords_balance: u128 = 1000 * RESOURCE_PRECISION;
//         world
//             .write_model_test(
//                 @Resource {
//                     entity_id: donkey_id.into(), resource_type: ResourceTypes::LORDS, balance: initial_lords_balance,
//                 },
//             );
//         world.write_model_test(@Position { entity_id: donkey_id.into(), x: 0, y: 0 });
//         world.write_model_test(@EntityOwner { entity_id: donkey_id.into(), entity_owner_id: realm_id });

//         // Make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         // Attempt withdrawal
//         resource_bridge_systems
//             .finish_withdraw(
//                 not_bank_id,
//                 donkey_id,
//                 token.contract_address,
//                 BRIDGER_WITHDRAW_ADDRESS(),
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );
//     }

//     #[test]
//     #[should_panic(expected: ("from entity and bank are not at the same location", 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_finish_withdraw_donkey_not_at_bank() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // Set initial LORDS balance for the realm's donkey at a different location
//         let donkey_id: u32 = 1;
//         let initial_lords_balance: u128 = 1000 * RESOURCE_PRECISION;
//         world
//             .write_model_test(
//                 @Resource {
//                     entity_id: donkey_id.into(), resource_type: ResourceTypes::LORDS, balance: initial_lords_balance,
//                 },
//             );
//         world.write_model_test(@Position { entity_id: donkey_id.into(), x: 0, y: 0 });
//         world.write_model_test(@EntityOwner { entity_id: donkey_id.into(), entity_owner_id: realm_id });

//         // Make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         // Attempt withdrawal
//         resource_bridge_systems
//             .finish_withdraw(
//                 bank_id, donkey_id, token.contract_address, BRIDGER_WITHDRAW_ADDRESS(),
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );
//     }

//     #[test]
//     #[should_panic(expected: ("resource bridge withdrawal is paused", 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_finish_withdraw_paused() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // Set initial LORDS balance for the realm's donkey at the bank
//         let donkey_id: u32 = 1;
//         let initial_lords_balance: u128 = 1000 * RESOURCE_PRECISION;
//         world
//             .write_model_test(
//                 @Resource {
//                     entity_id: donkey_id.into(), resource_type: ResourceTypes::LORDS, balance: initial_lords_balance,
//                 },
//             );
//         world.write_model_test(@Position { entity_id: donkey_id.into(), x: BANK_COORD().x, y: BANK_COORD().y });
//         world.write_model_test(@EntityOwner { entity_id: donkey_id.into(), entity_owner_id: realm_id });

//         // Pause withdrawals
//         world
//             .write_model_test(
//                 @ResourceBridgeConfig { config_id: WORLD_CONFIG_ID, deposit_paused: false, withdraw_paused: true },
//             );

//         // Make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         // Attempt withdrawal
//         resource_bridge_systems
//             .finish_withdraw(
//                 bank_id, donkey_id, token.contract_address, BRIDGER_WITHDRAW_ADDRESS(),
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );
//     }

//     #[test]
//     #[should_panic(expected: ("resource id not whitelisted", 'ENTRYPOINT_FAILED'))]
//     fn resource_bridge_test_finish_withdraw_non_whitelisted_token() {
//         let (mut world, resource_bridge_systems, _) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // Set initial LORDS balance for the realm's donkey at the bank
//         let donkey_id: u32 = 1;
//         let initial_lords_balance: u128 = 1000 * RESOURCE_PRECISION;
//         world
//             .write_model_test(
//                 @Resource {
//                     entity_id: donkey_id.into(), resource_type: ResourceTypes::LORDS, balance: initial_lords_balance,
//                 },
//             );
//         world.write_model_test(@Position { entity_id: donkey_id.into(), x: BANK_COORD().x, y: BANK_COORD().y });
//         world.write_model_test(@EntityOwner { entity_id: donkey_id.into(), entity_owner_id: realm_id });

//         // Make realm owner the caller
//         set_contract_address(REALM_OWNER_ADDRESS());

//         // Attempt withdrawal with a non-whitelisted token
//         let non_whitelisted_token = contract_address_const::<'non_whitelisted'>();
//         resource_bridge_systems
//             .finish_withdraw(
//                 bank_id, donkey_id, non_whitelisted_token, BRIDGER_WITHDRAW_ADDRESS(),
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );
//     }

//     #[test]
//     fn resource_bridge_test_finish_withdraw_bank_owner_no_fees() {
//         let (mut world, resource_bridge_systems, token) = SetupImpl::setup();
//         let bank_id: ID = BANK_ID();
//         let realm_id: ID = REALM_ID();
//         SetupImpl::make_bank(ref world, bank_id);
//         SetupImpl::make_realm(ref world, realm_id);

//         // transfer lords to bridge
//         set_contract_address(REALM_OWNER_ADDRESS());
//         let lords_amount: u256 = 1000 * pow_10(LORDS_ERC20_DECIMALS()).into();
//         token.transfer(resource_bridge_systems.contract_address, lords_amount);

//         // Set the bank owner as the owner of the realm as well
//         world.write_model_test(@Owner { entity_id: realm_id, address: BANK_OWNER_ADDRESS() });

//         // Set initial LORDS balance for the realm's donkey at the bank
//         let donkey_id: u32 = 1;
//         let initial_lords_balance: u128 = 1000 * RESOURCE_PRECISION;
//         world
//             .write_model_test(
//                 @Resource {
//                     entity_id: donkey_id.into(), resource_type: ResourceTypes::LORDS, balance: initial_lords_balance,
//                 },
//             );
//         world.write_model_test(@Position { entity_id: donkey_id.into(), x: BANK_COORD().x, y: BANK_COORD().y });
//         world.write_model_test(@EntityOwner { entity_id: donkey_id.into(), entity_owner_id: realm_id });

//         // Make bank owner the caller
//         set_contract_address(BANK_OWNER_ADDRESS());

//         // Perform withdrawal
//         resource_bridge_systems
//             .finish_withdraw(
//                 bank_id, donkey_id, token.contract_address, BRIDGER_WITHDRAW_ADDRESS(),
//                 CLIENT_FEE_RECIPIENT_ADDRESS(),
//             );

//         // Check that LORDS were transferred from the donkey to the bridge
//         let donkey_lords_resource: Resource = world.read_model((donkey_id, ResourceTypes::LORDS));
//         assert_eq!(donkey_lords_resource.balance, 0, "Donkey LORDS balance should be zero after withdrawal");

//         // Check that the bridge transferred the correct amount to the recipient
//         let expected_withdraw_amount = InternalBridgeImpl::resource_amount_to_token_amount(
//             token.contract_address, initial_lords_balance,
//         );
//         let fee_split_config: ResourceBridgeFeeSplitConfig = WorldConfigUtilImpl::get_member(
//             world, selector!("res_bridge_fee_split_config"),
//         );
//         let total_fee_percent = fee_split_config.velords_fee_on_wtdr_percent
//             + fee_split_config.season_pool_fee_on_wtdr_percent
//             + fee_split_config.client_fee_on_wtdr_percent;
//         let expected_recipient_amount = expected_withdraw_amount
//             - (expected_withdraw_amount * total_fee_percent.into()) / 10000;

//         assert_eq!(
//             token.balance_of(BRIDGER_WITHDRAW_ADDRESS()),
//             expected_recipient_amount,
//             "Incorrect recipient LORDS balance after withdrawal",
//         );

//         // Check that fees were distributed correctly
//         let velords_fee_amount = (expected_withdraw_amount * fee_split_config.velords_fee_on_wtdr_percent.into())
//             / 10000;
//         let season_pool_fee_amount = (expected_withdraw_amount
//             * fee_split_config.season_pool_fee_on_wtdr_percent.into())
//             / 10000;
//         let client_fee_amount = (expected_withdraw_amount * fee_split_config.client_fee_on_wtdr_percent.into()) /
//         10000;

//         assert_eq!(token.balance_of(VELORDS_ADDRESS()), velords_fee_amount, "Incorrect velords fee amount");
//         assert_eq!(token.balance_of(SEASON_POOL_ADDRESS()), season_pool_fee_amount, "Incorrect season pool fee
//         amount");
//         assert_eq!(token.balance_of(CLIENT_FEE_RECIPIENT_ADDRESS()), client_fee_amount, "Incorrect client fee
//         amount");

//         // Check that bank did not receive any fees
//         let bank_lords_resource: Resource = world.read_model((bank_id, ResourceTypes::LORDS));
//         assert_eq!(bank_lords_resource.balance, 0, "Bank should not receive fees for owner's withdrawal");
//     }
// }
