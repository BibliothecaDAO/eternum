pub mod vrf {
    use starknet::ContractAddress;

    #[starknet::interface]
    pub trait IVrfProvider<TContractState> {
        fn request_random(self: @TContractState, caller: ContractAddress, source: Source);
        fn submit_random(ref self: TContractState, seed: felt252, proof: Proof);
        fn consume_random(ref self: TContractState, source: Source) -> felt252;
        fn assert_consumed(ref self: TContractState, seed: felt252);

        fn get_public_key(self: @TContractState) -> PublicKey;
        fn set_public_key(ref self: TContractState, new_pubkey: PublicKey);
    }

    #[derive(Drop, Copy, Clone, Serde)]
    pub enum Source {
        Nonce: ContractAddress,
        Salt: felt252,
    }

    #[derive(Drop, Copy, Clone, Serde, starknet::Store)]
    pub struct PublicKey {
        x: felt252,
        y: felt252,
    }

    #[derive(Copy, Drop, Serde)]
    pub struct Point {
        pub x: felt252,
        pub y: felt252,
    }

    #[derive(Clone, Drop, Serde)]
    pub struct Proof {
        gamma: Point,
        c: felt252,
        s: felt252,
        sqrt_ratio_hint: felt252,
    }
}
