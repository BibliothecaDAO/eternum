use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
#[starknet::interface]
trait IChallengeSystems<TContractState> {
    fn generate_infantry(
        self: @TContractState, 
        world: IWorldDispatcher, 
        realm_id: u128,
        amount: u128
    );

    fn generate_cavalry(
        self: @TContractState, 
        world: IWorldDispatcher, 
        realm_id: u128,
        amount: u128
    );

    fn generate_mage(
        self: @TContractState, 
        world: IWorldDispatcher, 
        realm_id: u128,
        amount: u128
    );

    fn issue_challenge(
        self: @TContractState, 
        world: IWorldDispatcher, 
        realm_id: u128, 
        target_realm_id: u128,
        offer_resources_type: u8,
        offer_resources_amount: u128,
        target_resources_type: u8,
        target_resources_amount: u128,
    ) -> ID;

    fn accept_challenge(
        self: @TContractState, 
        world: IWorldDispatcher, 
        realm_id: u128,
        challenge_id: u128
    );

    fn reject_challenge(
        self: @TContractState, 
        world: IWorldDispatcher, 
        realm_id: u128,
        challenge_id: u128
    );
}