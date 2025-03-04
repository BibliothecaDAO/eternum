use core::num::traits::zero::Zero;
use s1_eternum::constants::ErrorMessages;
use starknet::ContractAddress;

#[generate_trait]
pub impl OwnerAddressImpl of OwnerAddressTrait {
    fn assert_caller_owner(self: ContractAddress) {
        assert(self == starknet::get_caller_address(), ErrorMessages::NOT_OWNER);
    }
    fn assert_caller_not_owner(self: ContractAddress) {
        assert!(self != Zero::zero(), "owner is zero");
        assert(self != starknet::get_caller_address(), 'caller is owner');
    }

    fn assert_non_zero(self: ContractAddress) {
        assert!(self.is_non_zero(), "owner is zero");
    }
}

