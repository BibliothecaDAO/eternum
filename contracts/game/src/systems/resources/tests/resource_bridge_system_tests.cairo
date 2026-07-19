#[cfg(test)]
mod tests {
    use dojo::model::ModelStorageTest;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use dojo_snf_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world,
    };
    use snforge_std::{
        ContractClassTrait, DeclareResultTrait, start_cheat_block_timestamp_global, start_cheat_caller_address,
        stop_cheat_caller_address,
    };
    use starknet::{ContractAddress, contract_address_const};
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, RESOURCE_PRECISION, ResourceTypes};
    use crate::models::config::{
        ResourceBridgeConfig, ResourceBridgeFeeSplitConfig, ResourceBridgeWtlConfig, SeasonConfig, TickConfig,
        WeightConfig, WorldConfigUtilImpl,
    };
    use crate::models::resource::arrivals::ResourceArrivalImpl;
    use crate::models::resource::resource::ResourceImpl;
    use crate::models::stamina::Stamina;
    use crate::models::structure::{
        Structure, StructureBase, StructureBaseStoreImpl, StructureCategory, StructureMetadata,
        StructureMetadataStoreImpl,
    };
    use crate::models::troop::{GuardTroops, TroopTier, TroopType, Troops};
    use crate::models::weight::Weight;
    use crate::systems::resources::contracts::resource_bridge_systems::{
        IResourceBridgeSystemsDispatcher, IResourceBridgeSystemsDispatcherTrait,
    };
    use crate::systems::utils::erc20::{ERC20ABIDispatcher, ERC20ABIDispatcherTrait};

    const TOKEN_DECIMALS: u8 = 7;
    const INITIAL_TOKEN_SUPPLY: u128 = 100_000 * 10_000_000;
    const DEPOSIT_TOKENS: u128 = 1_000;

    fn realm_owner() -> ContractAddress {
        contract_address_const::<'realm_owner'>()
    }

    fn velords_recipient() -> ContractAddress {
        contract_address_const::<'velords'>()
    }

    fn season_pool_recipient() -> ContractAddress {
        contract_address_const::<'season_pool'>()
    }

    fn client_fee_recipient() -> ContractAddress {
        contract_address_const::<'client_fee'>()
    }

    fn attacker() -> ContractAddress {
        contract_address_const::<'attacker'>()
    }

    fn withdrawal_recipient() -> ContractAddress {
        contract_address_const::<'withdrawal_recipient'>()
    }

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                TestResource::Model("WorldConfig"), TestResource::Model("WeightConfig"),
                TestResource::Model("ResourceBridgeWtlConfig"), TestResource::Model("ResourceRevBridgeWtlConfig"),
                TestResource::Model("Structure"), TestResource::Model("StructureOwnerStats"),
                TestResource::Model("Resource"), TestResource::Model("ResourceArrival"),
                TestResource::Model("HyperstructureGlobals"), TestResource::Event("StoryEvent"),
                TestResource::Event("TrophyProgression"), TestResource::Contract("resource_bridge_systems"),
                TestResource::Contract("liquidity_systems"),
            ]
                .span(),
        }
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(DEFAULT_NS(), @"resource_bridge_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"liquidity_systems"),
        ]
            .span()
    }

    fn active_season() -> SeasonConfig {
        SeasonConfig {
            start_settling_at: 0,
            start_main_at: 100,
            end_at: 100_000,
            end_grace_seconds: 3_600,
            registration_grace_seconds: 3_600,
            dev_mode_on: false,
        }
    }

    fn fee_split() -> ResourceBridgeFeeSplitConfig {
        ResourceBridgeFeeSplitConfig {
            velords_fee_on_dpt_percent: 100,
            velords_fee_on_wtdr_percent: 200,
            season_pool_fee_on_dpt_percent: 50,
            season_pool_fee_on_wtdr_percent: 100,
            client_fee_on_dpt_percent: 50,
            client_fee_on_wtdr_percent: 100,
            realm_fee_dpt_percent: 500,
            realm_fee_wtdr_percent: 600,
            velords_fee_recipient: velords_recipient(),
            season_pool_fee_recipient: season_pool_recipient(),
        }
    }

    fn setup_world() -> WorldStorage {
        start_cheat_block_timestamp_global(200);
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        world.dispatcher.uuid();

        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), active_season());
        WorldConfigUtilImpl::set_member(
            ref world,
            selector!("resource_bridge_config"),
            ResourceBridgeConfig { deposit_paused: false, withdraw_paused: false },
        );
        WorldConfigUtilImpl::set_member(ref world, selector!("res_bridge_fee_split_config"), fee_split());
        WorldConfigUtilImpl::set_member(
            ref world,
            selector!("tick_config"),
            TickConfig { armies_tick_in_seconds: 60, delivery_tick_in_seconds: 60, bitcoin_phase_in_seconds: 600 },
        );
        world.write_model_test(@WeightConfig { resource_type: ResourceTypes::LORDS, weight_gram: 1 });
        world
    }

    fn deploy_token() -> ERC20ABIDispatcher {
        let initial_supply: u256 = INITIAL_TOKEN_SUPPLY.into();
        let constructor_calldata = array![initial_supply.low.into(), initial_supply.high.into(), TOKEN_DECIMALS.into()];
        let contract = snforge_std::declare("MockERC20").unwrap().contract_class();
        let (token_address, _) = contract.deploy(@constructor_calldata).unwrap();
        let token = ERC20ABIDispatcher { contract_address: token_address };
        assert!(token.transfer(realm_owner(), initial_supply), "test token transfer failed");
        token
    }

    fn spawn_realm(ref world: WorldStorage) -> ID {
        let realm_id = world.dispatcher.uuid();
        let empty_troops = Troops {
            category: TroopType::Knight,
            tier: TroopTier::T1,
            count: 0,
            stamina: Stamina { amount: 0, updated_tick: 0 },
            battle_cooldown_end: 0,
            boosts: Default::default(),
        };
        world
            .write_model_test(
                @Structure {
                    entity_id: realm_id,
                    owner: realm_owner(),
                    base: StructureBase {
                        troop_guard_count: 0,
                        troop_explorer_count: 0,
                        troop_max_guard_count: 4,
                        troop_max_explorer_count: 20,
                        created_at: 1,
                        category: StructureCategory::Realm.into(),
                        coord_x: 100,
                        coord_y: 100,
                        level: 1,
                        starting_troops_granted: false,
                    },
                    troop_guards: GuardTroops {
                        delta: empty_troops,
                        charlie: empty_troops,
                        bravo: empty_troops,
                        alpha: empty_troops,
                        delta_destroyed_tick: 0,
                        charlie_destroyed_tick: 0,
                        bravo_destroyed_tick: 0,
                        alpha_destroyed_tick: 0,
                    },
                    troop_explorers: array![].span(),
                    resources_packed: 0,
                    metadata: StructureMetadata {
                        realm_id: 1, order: 1, has_wonder: false, villages_count: 0, village_realm: 0,
                    },
                    category: StructureCategory::Realm.into(),
                },
            );
        ResourceImpl::initialize(ref world, realm_id);
        ResourceImpl::write_weight(ref world, realm_id, Weight { capacity: 1_000_000 * RESOURCE_PRECISION, weight: 0 });
        realm_id
    }

    fn spawn_village(ref world: WorldStorage, realm_id: ID) -> ID {
        let village_id = spawn_realm(ref world);
        let mut base = StructureBaseStoreImpl::retrieve(ref world, village_id);
        base.category = StructureCategory::Village.into();
        base.store(ref world, village_id);
        let mut metadata = StructureMetadataStoreImpl::retrieve(ref world, village_id);
        metadata.village_realm = realm_id;
        metadata.store(ref world, village_id);
        village_id
    }

    fn bridge_dispatcher(ref world: WorldStorage) -> IResourceBridgeSystemsDispatcher {
        let (bridge_address, _) = world.dns(@"resource_bridge_systems").unwrap();
        IResourceBridgeSystemsDispatcher { contract_address: bridge_address }
    }

    fn liquidity_address(ref world: WorldStorage) -> ContractAddress {
        let (address, _) = world.dns(@"liquidity_systems").unwrap();
        address
    }

    #[test]
    fn realm_owner_deposit_pays_exact_platform_fees_and_creates_net_arrival() {
        let mut world = setup_world();
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::LORDS },
            );

        let deposit_amount: u256 = (DEPOSIT_TOKENS * 10_000_000).into();
        start_cheat_caller_address(token.contract_address, realm_owner());
        token.approve(bridge.contract_address, deposit_amount);
        stop_cheat_caller_address(token.contract_address);

        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge.deposit(token.contract_address, realm_id, deposit_amount, client_fee_recipient());
        stop_cheat_caller_address(bridge.contract_address);

        let initial_supply: u256 = INITIAL_TOKEN_SUPPLY.into();
        assert_eq!(token.balance_of(realm_owner()), initial_supply - deposit_amount, "owner token balance");
        assert_eq!(token.balance_of(velords_recipient()), deposit_amount / 100, "velords fee");
        assert_eq!(token.balance_of(season_pool_recipient()), deposit_amount / 200, "season pool fee");
        assert_eq!(token.balance_of(client_fee_recipient()), deposit_amount / 200, "client fee");
        assert_eq!(token.balance_of(bridge.contract_address), deposit_amount * 98 / 100, "bridge custody");

        let (arrival_day, arrival_slot) = ResourceArrivalImpl::previous_arrival_slot(ref world);
        let arrival = ResourceArrivalImpl::read_slot(ref world, realm_id, arrival_day, arrival_slot);
        assert_eq!(arrival.len(), 1, "arrival resource count");
        assert_eq!(*arrival.at(0), (ResourceTypes::LORDS, 980 * RESOURCE_PRECISION), "net resource arrival");
    }

    #[test]
    #[should_panic(expected: "ERC20: Insufficient allowance")]
    fn deposit_rejects_insufficient_allowance() {
        let mut world = setup_world();
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::LORDS },
            );

        let deposit_amount: u256 = (DEPOSIT_TOKENS * 10_000_000).into();
        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge.deposit(token.contract_address, realm_id, deposit_amount, client_fee_recipient());
    }

    #[test]
    #[should_panic(expected: "ERC20: Insufficient balance")]
    fn deposit_rejects_insufficient_token_balance() {
        let mut world = setup_world();
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::LORDS },
            );

        let deposit_amount: u256 = (DEPOSIT_TOKENS * 10_000_000).into();
        let initial_supply: u256 = INITIAL_TOKEN_SUPPLY.into();
        start_cheat_caller_address(token.contract_address, realm_owner());
        token.approve(bridge.contract_address, deposit_amount);
        token.transfer(velords_recipient(), initial_supply);
        stop_cheat_caller_address(token.contract_address);

        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge.deposit(token.contract_address, realm_id, deposit_amount, client_fee_recipient());
    }

    #[test]
    #[should_panic(expected: "Bridge: deposit amount too small to take fees")]
    fn deposit_rejects_amount_that_rounds_a_platform_fee_to_zero() {
        let mut world = setup_world();
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::LORDS },
            );

        let deposit_amount: u256 = 100;
        start_cheat_caller_address(token.contract_address, realm_owner());
        token.approve(bridge.contract_address, deposit_amount);
        stop_cheat_caller_address(token.contract_address);

        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge.deposit(token.contract_address, realm_id, deposit_amount, client_fee_recipient());
    }

    #[test]
    #[should_panic(expected: "recipient structure is not a realm or village")]
    fn deposit_rejects_non_realm_non_village_recipient() {
        let mut world = setup_world();
        let token = deploy_token();
        let structure_id = spawn_realm(ref world);
        let mut structure_base = StructureBaseStoreImpl::retrieve(ref world, structure_id);
        structure_base.category = StructureCategory::Bank.into();
        structure_base.store(ref world, structure_id);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::LORDS },
            );

        let deposit_amount: u256 = (DEPOSIT_TOKENS * 10_000_000).into();
        start_cheat_caller_address(token.contract_address, realm_owner());
        token.approve(bridge.contract_address, deposit_amount);
        stop_cheat_caller_address(token.contract_address);

        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge.deposit(token.contract_address, structure_id, deposit_amount, client_fee_recipient());
    }

    #[test]
    #[should_panic(expected: "resource bridge deposit is paused")]
    fn deposit_rejects_paused_bridge() {
        let mut world = setup_world();
        WorldConfigUtilImpl::set_member(
            ref world,
            selector!("resource_bridge_config"),
            ResourceBridgeConfig { deposit_paused: true, withdraw_paused: false },
        );
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::LORDS },
            );

        let deposit_amount: u256 = (DEPOSIT_TOKENS * 10_000_000).into();
        start_cheat_caller_address(token.contract_address, realm_owner());
        token.approve(bridge.contract_address, deposit_amount);
        stop_cheat_caller_address(token.contract_address);

        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge.deposit(token.contract_address, realm_id, deposit_amount, client_fee_recipient());
    }

    #[test]
    #[should_panic(expected: "resource id not whitelisted")]
    fn deposit_rejects_non_whitelisted_token() {
        let mut world = setup_world();
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);
        let deposit_amount: u256 = (DEPOSIT_TOKENS * 10_000_000).into();

        start_cheat_caller_address(token.contract_address, realm_owner());
        token.approve(bridge.contract_address, deposit_amount);
        stop_cheat_caller_address(token.contract_address);

        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge.deposit(token.contract_address, realm_id, deposit_amount, client_fee_recipient());
    }

    #[test]
    #[should_panic(expected: 'Not Owner')]
    fn deposit_rejects_non_owner() {
        let mut world = setup_world();
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::LORDS },
            );

        let deposit_amount: u256 = (DEPOSIT_TOKENS * 10_000_000).into();
        start_cheat_caller_address(bridge.contract_address, attacker());
        bridge.deposit(token.contract_address, realm_id, deposit_amount, client_fee_recipient());
    }

    #[test]
    fn village_deposit_splits_realm_fee_from_net_village_arrival() {
        let mut world = setup_world();
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let village_id = spawn_village(ref world, realm_id);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::LORDS },
            );

        let deposit_amount: u256 = (DEPOSIT_TOKENS * 10_000_000).into();
        start_cheat_caller_address(token.contract_address, realm_owner());
        token.approve(bridge.contract_address, deposit_amount);
        stop_cheat_caller_address(token.contract_address);
        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge.deposit(token.contract_address, village_id, deposit_amount, client_fee_recipient());
        stop_cheat_caller_address(bridge.contract_address);

        let (arrival_day, arrival_slot) = ResourceArrivalImpl::previous_arrival_slot(ref world);
        let village_arrival = ResourceArrivalImpl::read_slot(ref world, village_id, arrival_day, arrival_slot);
        let realm_arrival = ResourceArrivalImpl::read_slot(ref world, realm_id, arrival_day, arrival_slot);
        assert_eq!(*village_arrival.at(0), (ResourceTypes::LORDS, 930 * RESOURCE_PRECISION), "village net");
        assert_eq!(*realm_arrival.at(0), (ResourceTypes::LORDS, 50 * RESOURCE_PRECISION), "realm fee");
        assert_eq!(token.balance_of(bridge.contract_address), deposit_amount * 98 / 100, "bridge custody");
    }

    #[test]
    fn zero_client_recipient_redirects_client_deposit_fee_to_velords() {
        let mut world = setup_world();
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::LORDS },
            );

        let deposit_amount: u256 = (DEPOSIT_TOKENS * 10_000_000).into();
        start_cheat_caller_address(token.contract_address, realm_owner());
        token.approve(bridge.contract_address, deposit_amount);
        stop_cheat_caller_address(token.contract_address);
        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge.deposit(token.contract_address, realm_id, deposit_amount, 0.try_into().unwrap());
        stop_cheat_caller_address(bridge.contract_address);

        assert_eq!(token.balance_of(velords_recipient()), deposit_amount * 15 / 1_000, "redirected fee");
        assert_eq!(token.balance_of(client_fee_recipient()), 0, "client remains empty");
        assert_eq!(token.balance_of(bridge.contract_address), deposit_amount * 98 / 100, "bridge custody");
    }

    #[test]
    fn non_troop_deposit_applies_current_inefficiency_before_platform_fees() {
        let mut world = setup_world();
        world.write_model_test(@WeightConfig { resource_type: ResourceTypes::STONE, weight_gram: 1 });
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::STONE },
            );

        let deposit_amount: u256 = (DEPOSIT_TOKENS * 10_000_000).into();
        start_cheat_caller_address(token.contract_address, realm_owner());
        token.approve(bridge.contract_address, deposit_amount);
        stop_cheat_caller_address(token.contract_address);
        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge.deposit(token.contract_address, realm_id, deposit_amount, client_fee_recipient());
        stop_cheat_caller_address(bridge.contract_address);

        let (arrival_day, arrival_slot) = ResourceArrivalImpl::previous_arrival_slot(ref world);
        let arrival = ResourceArrivalImpl::read_slot(ref world, realm_id, arrival_day, arrival_slot);
        assert_eq!(*arrival.at(0), (ResourceTypes::STONE, 245 * RESOURCE_PRECISION), "net inefficient arrival");
        assert_eq!(token.balance_of(bridge.contract_address), deposit_amount * 995 / 1_000, "bridge custody");
    }

    #[test]
    #[should_panic(expected: "Troops can't be bridged into villages")]
    fn troop_deposit_rejects_village_recipient() {
        let mut world = setup_world();
        world.write_model_test(@WeightConfig { resource_type: ResourceTypes::KNIGHT_T1, weight_gram: 1 });
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let village_id = spawn_village(ref world, realm_id);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::KNIGHT_T1 },
            );

        let deposit_amount: u256 = (DEPOSIT_TOKENS * 10_000_000).into();
        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge.deposit(token.contract_address, village_id, deposit_amount, client_fee_recipient());
    }

    #[test]
    fn realm_withdrawal_burns_resources_and_pays_exact_token_fees() {
        let mut world = setup_world();
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::LORDS },
            );
        ResourceImpl::write_balance(ref world, realm_id, ResourceTypes::LORDS, 1_000 * RESOURCE_PRECISION);
        ResourceImpl::write_weight(
            ref world,
            realm_id,
            Weight { capacity: 1_000_000 * RESOURCE_PRECISION, weight: 1_000 * RESOURCE_PRECISION },
        );

        let bridge_prefund: u256 = (1_000_u128 * 10_000_000).into();
        start_cheat_caller_address(token.contract_address, realm_owner());
        token.transfer(bridge.contract_address, bridge_prefund);
        stop_cheat_caller_address(token.contract_address);

        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge
            .withdraw(
                realm_id,
                withdrawal_recipient(),
                token.contract_address,
                500 * RESOURCE_PRECISION,
                client_fee_recipient(),
            );
        stop_cheat_caller_address(bridge.contract_address);

        assert_eq!(
            ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::LORDS),
            500 * RESOURCE_PRECISION,
            "remaining resources",
        );
        assert_eq!(token.balance_of(withdrawal_recipient()), 480_u256 * 10_000_000, "withdrawal net");
        assert_eq!(token.balance_of(velords_recipient()), 10_u256 * 10_000_000, "velords fee");
        assert_eq!(token.balance_of(season_pool_recipient()), 5_u256 * 10_000_000, "season fee");
        assert_eq!(token.balance_of(client_fee_recipient()), 5_u256 * 10_000_000, "client fee");
    }

    #[test]
    #[should_panic(expected: 'Not Owner')]
    fn withdrawal_rejects_non_owner() {
        let mut world = setup_world();
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);

        start_cheat_caller_address(bridge.contract_address, attacker());
        bridge
            .withdraw(
                realm_id,
                withdrawal_recipient(),
                token.contract_address,
                500 * RESOURCE_PRECISION,
                client_fee_recipient(),
            );
    }

    #[test]
    #[should_panic(expected: "from structure is not a realm or village")]
    fn withdrawal_rejects_non_realm_non_village_source() {
        let mut world = setup_world();
        let token = deploy_token();
        let structure_id = spawn_realm(ref world);
        let mut structure_base = StructureBaseStoreImpl::retrieve(ref world, structure_id);
        structure_base.category = StructureCategory::Bank.into();
        structure_base.store(ref world, structure_id);
        let bridge = bridge_dispatcher(ref world);

        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge
            .withdraw(
                structure_id,
                withdrawal_recipient(),
                token.contract_address,
                500 * RESOURCE_PRECISION,
                client_fee_recipient(),
            );
    }

    #[test]
    #[should_panic(expected: "resource bridge withdrawal is paused")]
    fn withdrawal_rejects_paused_bridge() {
        let mut world = setup_world();
        WorldConfigUtilImpl::set_member(
            ref world,
            selector!("resource_bridge_config"),
            ResourceBridgeConfig { deposit_paused: false, withdraw_paused: true },
        );
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);

        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge
            .withdraw(
                realm_id,
                withdrawal_recipient(),
                token.contract_address,
                500 * RESOURCE_PRECISION,
                client_fee_recipient(),
            );
    }

    #[test]
    #[should_panic(expected: "resource id not whitelisted")]
    fn withdrawal_rejects_non_whitelisted_token() {
        let mut world = setup_world();
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);

        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge
            .withdraw(
                realm_id,
                withdrawal_recipient(),
                token.contract_address,
                500 * RESOURCE_PRECISION,
                client_fee_recipient(),
            );
    }

    #[test]
    #[should_panic(expected: "Insufficient Balance: LORDS")]
    fn withdrawal_rejects_insufficient_resource_balance() {
        let mut world = setup_world();
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::LORDS },
            );

        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge
            .withdraw(
                realm_id,
                withdrawal_recipient(),
                token.contract_address,
                500 * RESOURCE_PRECISION,
                client_fee_recipient(),
            );
    }

    #[test]
    #[should_panic(expected: "Bridge: deposit amount too small to take fees")]
    fn withdrawal_rejects_amount_that_rounds_a_platform_fee_to_zero() {
        let mut world = setup_world();
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::LORDS },
            );
        let small_amount = 9 * RESOURCE_PRECISION / 1_000_000;
        ResourceImpl::write_balance(ref world, realm_id, ResourceTypes::LORDS, small_amount);
        ResourceImpl::write_weight(
            ref world, realm_id, Weight { capacity: 1_000_000 * RESOURCE_PRECISION, weight: small_amount },
        );

        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge.withdraw(realm_id, withdrawal_recipient(), token.contract_address, small_amount, client_fee_recipient());
    }

    #[test]
    fn non_troop_withdrawal_applies_current_inefficiency_before_platform_fees() {
        let mut world = setup_world();
        world.write_model_test(@WeightConfig { resource_type: ResourceTypes::STONE, weight_gram: 1 });
        let token = deploy_token();
        let realm_id = spawn_realm(ref world);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::STONE },
            );
        ResourceImpl::write_balance(ref world, realm_id, ResourceTypes::STONE, 1_000 * RESOURCE_PRECISION);
        ResourceImpl::write_weight(
            ref world,
            realm_id,
            Weight { capacity: 1_000_000 * RESOURCE_PRECISION, weight: 1_000 * RESOURCE_PRECISION },
        );

        let bridge_prefund: u256 = (1_000_u128 * 10_000_000).into();
        start_cheat_caller_address(token.contract_address, realm_owner());
        token.transfer(bridge.contract_address, bridge_prefund);
        stop_cheat_caller_address(token.contract_address);
        start_cheat_caller_address(bridge.contract_address, realm_owner());
        bridge
            .withdraw(
                realm_id,
                withdrawal_recipient(),
                token.contract_address,
                1_000 * RESOURCE_PRECISION,
                client_fee_recipient(),
            );
        stop_cheat_caller_address(bridge.contract_address);

        assert_eq!(ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::STONE), 0, "resource balance burned");
        assert_eq!(token.balance_of(withdrawal_recipient()), 240_u256 * 10_000_000, "withdrawal net");
        assert_eq!(token.balance_of(bridge.contract_address), 750_u256 * 10_000_000, "inefficiency custody");
    }

    #[test]
    #[should_panic(expected: "Bridge: caller is not liquidity systems")]
    fn lp_withdrawal_rejects_non_liquidity_caller() {
        let mut world = setup_world();
        let bridge = bridge_dispatcher(ref world);

        start_cheat_caller_address(bridge.contract_address, attacker());
        bridge.lp_withdraw(withdrawal_recipient(), 1, ResourceTypes::LORDS, 500 * RESOURCE_PRECISION);
    }

    #[test]
    fn lp_withdrawal_pays_bank_and_platform_fees_before_recipient() {
        let mut world = setup_world();
        let token = deploy_token();
        let bank_id = spawn_realm(ref world);
        let mut bank_base = StructureBaseStoreImpl::retrieve(ref world, bank_id);
        bank_base.category = StructureCategory::Bank.into();
        bank_base.store(ref world, bank_id);
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @ResourceBridgeWtlConfig { token: token.contract_address, resource_type: ResourceTypes::LORDS },
            );
        world
            .write_model_test(
                @crate::models::config::ResourceRevBridgeWtlConfig {
                    resource_type: ResourceTypes::LORDS, token: token.contract_address,
                },
            );

        let bridge_prefund: u256 = (500_u128 * 10_000_000).into();
        start_cheat_caller_address(token.contract_address, realm_owner());
        token.transfer(bridge.contract_address, bridge_prefund);
        stop_cheat_caller_address(token.contract_address);
        start_cheat_caller_address(bridge.contract_address, liquidity_address(ref world));
        bridge.lp_withdraw(withdrawal_recipient(), bank_id, ResourceTypes::LORDS, 500 * RESOURCE_PRECISION);
        stop_cheat_caller_address(bridge.contract_address);

        let (arrival_day, arrival_slot) = ResourceArrivalImpl::previous_arrival_slot(ref world);
        let bank_arrival = ResourceArrivalImpl::read_slot(ref world, bank_id, arrival_day, arrival_slot);
        assert_eq!(*bank_arrival.at(0), (ResourceTypes::LORDS, 30 * RESOURCE_PRECISION), "bank fee");
        assert_eq!(token.balance_of(withdrawal_recipient()), 450_u256 * 10_000_000, "withdrawal net");
        assert_eq!(token.balance_of(velords_recipient()), 15_u256 * 10_000_000, "redirected velords fee");
        assert_eq!(token.balance_of(season_pool_recipient()), 5_u256 * 10_000_000, "season fee");
        assert_eq!(token.balance_of(bridge.contract_address), 30_u256 * 10_000_000, "bank custody");
    }

    #[test]
    fn velords_claim_sweeps_bridge_lords_after_the_withdrawal_grace_period() {
        let mut world = setup_world();
        WorldConfigUtilImpl::set_member(
            ref world,
            selector!("season_config"),
            SeasonConfig {
                start_settling_at: 0,
                start_main_at: 100,
                end_at: 150,
                end_grace_seconds: 25,
                registration_grace_seconds: 25,
                dev_mode_on: false,
            },
        );
        let token = deploy_token();
        let bridge = bridge_dispatcher(ref world);
        world
            .write_model_test(
                @crate::models::config::ResourceRevBridgeWtlConfig {
                    resource_type: ResourceTypes::LORDS, token: token.contract_address,
                },
            );

        let bridge_balance: u256 = (500_u128 * 10_000_000).into();
        start_cheat_caller_address(token.contract_address, realm_owner());
        token.transfer(bridge.contract_address, bridge_balance);
        stop_cheat_caller_address(token.contract_address);

        bridge.velords_claim();

        assert_eq!(token.balance_of(bridge.contract_address), 0, "bridge swept");
        assert_eq!(token.balance_of(velords_recipient()), bridge_balance, "velords receives sweep");
    }
}
