pub const UPGRADER_ROLE: felt252 = selector!("UPGRADER_ROLE");
pub const FEE_TO_MANAGER_ROLE: felt252 = selector!("FEE_TO_MANAGER_ROLE");
pub const POOL_CREATOR_ROLE: felt252 = selector!("POOL_CREATOR_ROLE");

#[starknet::contract]
pub mod RealmsSwapFactory {
    use ammv2::packages::core::components::factory::FactoryComponent;
    use ammv2::packages::core::interfaces::factory::IRealmsSwapFactory;
    use openzeppelin::access::accesscontrol::{AccessControlComponent, DEFAULT_ADMIN_ROLE};
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::upgrades::interface::IUpgradeable;
    use starknet::{ClassHash, ContractAddress};
    use super::{FEE_TO_MANAGER_ROLE, POOL_CREATOR_ROLE, UPGRADER_ROLE};

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
        self.accesscontrol._grant_role(POOL_CREATOR_ROLE, default_admin);
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
            self.accesscontrol.assert_only_role(POOL_CREATOR_ROLE);
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
}
