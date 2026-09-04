#[starknet::interface]
pub trait ITestV2Surface<TState> {
    fn test_v2_contract(self: @TState) -> felt252;
}

#[starknet::contract]
pub mod RealmsSwapFactoryV2 {
    use ammv2::packages::core::components::factory::FactoryComponent;
    use ammv2::packages::core::contracts::factory::{FEE_TO_MANAGER_ROLE, UPGRADER_ROLE};
    use ammv2::packages::core::interfaces::factory::IRealmsSwapFactory;
    use openzeppelin::access::accesscontrol::{AccessControlComponent, DEFAULT_ADMIN_ROLE};
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::upgrades::interface::IUpgradeable;
    use starknet::{ClassHash, ContractAddress};

    component!(path: FactoryComponent, storage: factory, event: FactoryEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: accesscontrol, event: AccessControlEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    #[abi(embed_v0)]
    impl AccessControlMixinImpl = AccessControlComponent::AccessControlMixinImpl<ContractState>;
    impl FactoryInternalImpl = FactoryComponent::InternalImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        factory: FactoryComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        accesscontrol: AccessControlComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        FactoryEvent: FactoryComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, pair_class_hash: ClassHash, default_admin: ContractAddress, upgrader: ContractAddress,
    ) {
        self.accesscontrol.initializer();
        self.factory.initializer(pair_class_hash, default_admin, upgrader);

        self.accesscontrol._grant_role(DEFAULT_ADMIN_ROLE, default_admin);
        self.accesscontrol._grant_role(FEE_TO_MANAGER_ROLE, default_admin);
        self.accesscontrol._grant_role(UPGRADER_ROLE, upgrader);
    }

    #[abi(embed_v0)]
    impl FactoryImpl of IRealmsSwapFactory<ContractState> {
        fn get_pair(self: @ContractState, token0: ContractAddress, token1: ContractAddress) -> ContractAddress {
            self.factory.get_pair(token0, token1)
        }

        fn get_all_pairs(self: @ContractState) -> Array<ContractAddress> {
            self.factory.get_all_pairs()
        }

        fn get_num_of_pairs(self: @ContractState) -> u64 {
            self.factory.get_num_of_pairs()
        }

        fn get_fee_to(self: @ContractState) -> ContractAddress {
            self.factory.get_fee_to()
        }

        fn get_fee_amount(self: @ContractState) -> u256 {
            self.factory.get_fee_amount()
        }

        fn get_pair_default_admin(self: @ContractState) -> ContractAddress {
            self.factory.get_pair_default_admin()
        }

        fn get_pair_upgrader(self: @ContractState) -> ContractAddress {
            self.factory.get_pair_upgrader()
        }

        fn get_pair_contract_class_hash(self: @ContractState) -> ClassHash {
            self.factory.get_pair_contract_class_hash()
        }

        fn create_pair(ref self: ContractState, token_a: ContractAddress, token_b: ContractAddress) -> ContractAddress {
            self.factory.create_pair(token_a, token_b)
        }

        fn set_fee_to(ref self: ContractState, new_fee_to: ContractAddress) {
            self.accesscontrol.assert_only_role(FEE_TO_MANAGER_ROLE);
            self.factory.set_fee_to(new_fee_to);
        }

        fn set_fee_amount(ref self: ContractState, new_fee_amount: u256) {
            self.accesscontrol.assert_only_role(FEE_TO_MANAGER_ROLE);
            self.factory.set_fee_amount(new_fee_amount);
        }

        fn set_pair_default_admin(ref self: ContractState, new_pair_default_admin: ContractAddress) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            self.factory.set_pair_default_admin(new_pair_default_admin);
        }

        fn set_pair_upgrader(ref self: ContractState, new_pair_upgrader: ContractAddress) {
            self.accesscontrol.assert_only_role(DEFAULT_ADMIN_ROLE);
            self.factory.set_pair_upgrader(new_pair_upgrader);
        }
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.accesscontrol.assert_only_role(UPGRADER_ROLE);
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    #[abi(embed_v0)]
    impl TestV2SurfaceImpl of super::ITestV2Surface<ContractState> {
        fn test_v2_contract(self: @ContractState) -> felt252 {
            1
        }
    }
}

#[starknet::contract]
pub mod RealmsSwapRouterV2 {
    use ammv2::packages::core::components::router::RouterComponent;
    use ammv2::packages::core::contracts::router::UPGRADER_ROLE;
    use openzeppelin::access::accesscontrol::{AccessControlComponent, DEFAULT_ADMIN_ROLE};
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::upgrades::interface::IUpgradeable;
    use starknet::{ClassHash, ContractAddress};

    component!(path: RouterComponent, storage: router, event: RouterEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: accesscontrol, event: AccessControlEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    #[abi(embed_v0)]
    impl RouterImpl = RouterComponent::RouterImpl<ContractState>;
    #[abi(embed_v0)]
    impl AccessControlMixinImpl = AccessControlComponent::AccessControlMixinImpl<ContractState>;
    impl RouterInternalImpl = RouterComponent::InternalImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        router: RouterComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        accesscontrol: AccessControlComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        RouterEvent: RouterComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, factory: ContractAddress, default_admin: ContractAddress, upgrader: ContractAddress,
    ) {
        self.accesscontrol.initializer();
        self.router.initializer(factory);
        self.accesscontrol._grant_role(DEFAULT_ADMIN_ROLE, default_admin);
        self.accesscontrol._grant_role(UPGRADER_ROLE, upgrader);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.accesscontrol.assert_only_role(UPGRADER_ROLE);
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    #[abi(embed_v0)]
    impl TestV2SurfaceImpl of super::ITestV2Surface<ContractState> {
        fn test_v2_contract(self: @ContractState) -> felt252 {
            1
        }
    }
}

#[starknet::contract]
pub mod RealmsSwapPairV2 {
    use ammv2::packages::core::components::pair::PairComponent;
    use ammv2::packages::core::contracts::pair::UPGRADER_ROLE;
    use openzeppelin::access::accesscontrol::{AccessControlComponent, DEFAULT_ADMIN_ROLE};
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::security::reentrancyguard::ReentrancyGuardComponent;
    use openzeppelin::token::erc20::ERC20Component;
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::upgrades::interface::IUpgradeable;
    use starknet::{ClassHash, ContractAddress};

    component!(path: PairComponent, storage: pair, event: PairEvent);
    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: accesscontrol, event: AccessControlEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    #[abi(embed_v0)]
    impl PairImpl = PairComponent::PairImpl<ContractState>;
    #[abi(embed_v0)]
    impl ERC20MixinImpl = ERC20Component::ERC20MixinImpl<ContractState>;
    #[abi(embed_v0)]
    impl AccessControlMixinImpl = AccessControlComponent::AccessControlMixinImpl<ContractState>;
    impl PairInternalImpl = PairComponent::InternalImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    impl ERC20HooksImpl of ERC20Component::ERC20HooksTrait<ContractState> {}

    #[storage]
    struct Storage {
        #[substorage(v0)]
        pair: PairComponent::Storage,
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        reentrancy_guard: ReentrancyGuardComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        accesscontrol: AccessControlComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        PairEvent: PairComponent::Event,
        #[flat]
        ERC20Event: ERC20Component::Event,
        #[flat]
        ReentrancyGuardEvent: ReentrancyGuardComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        token0: ContractAddress,
        token1: ContractAddress,
        factory: ContractAddress,
        default_admin: ContractAddress,
        upgrader: ContractAddress,
    ) {
        self.erc20.initializer("RealmsSwap Pair", "REALMS-P");
        self.accesscontrol.initializer();
        self.pair.initializer(token0, token1, factory);

        self.accesscontrol._grant_role(DEFAULT_ADMIN_ROLE, default_admin);
        self.accesscontrol._grant_role(UPGRADER_ROLE, upgrader);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.accesscontrol.assert_only_role(UPGRADER_ROLE);
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    #[abi(embed_v0)]
    impl TestV2SurfaceImpl of super::ITestV2Surface<ContractState> {
        fn test_v2_contract(self: @ContractState) -> felt252 {
            1
        }
    }
}
