use core::traits::TryInto;
use starknet::ContractAddress;

pub fn ADMIN() -> ContractAddress {
    101.try_into().unwrap()
}

pub fn UPGRADER() -> ContractAddress {
    102.try_into().unwrap()
}

pub fn ALICE() -> ContractAddress {
    201.try_into().unwrap()
}

pub fn BOB() -> ContractAddress {
    202.try_into().unwrap()
}

pub fn TOKEN_A() -> ContractAddress {
    301.try_into().unwrap()
}

pub fn TOKEN_B() -> ContractAddress {
    302.try_into().unwrap()
}

pub fn TOKEN_C() -> ContractAddress {
    303.try_into().unwrap()
}
