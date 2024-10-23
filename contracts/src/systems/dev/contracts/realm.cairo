use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use starknet::ContractAddress;

#[starknet::interface]
trait ITestRealmMint<TState> {
    fn mint(ref self: TState, token_id: u256);
}

#[starknet::interface]
trait ILordsMint<TState> {
    fn mint(ref self: TState, token_id: u256);
}

#[starknet::interface]
trait ISeasonPassMint<TState> {
    fn mint(ref self: TState, recipient: ContractAddress, token_id: u256);
}

#[starknet::interface]
trait IERC721Approval<TState> {
    fn approve(ref self: TState, to: ContractAddress, token_id: u256);
}

#[dojo::interface]
trait IDevRealmSystems {
    fn create(ref world: IWorldDispatcher, realm_id: ID, frontend: ContractAddress);
}

#[dojo::contract]
mod dev_realm_systems {
    use dojo::world::Resource;
    use eternum::alias::ID;
    use eternum::constants::WORLD_CONFIG_ID;
    use eternum::models::config::SeasonConfig;
    use eternum::systems::realm::contracts::{IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait};
    use starknet::ContractAddress;
    use super::{
        ILordsMintDispatcher, ILordsMintDispatcherTrait, ISeasonPassMintDispatcher, ISeasonPassMintDispatcherTrait,
        IERC721ApprovalDispatcher, IERC721ApprovalDispatcherTrait, ITestRealmMintDispatcher,
        ITestRealmMintDispatcherTrait
    };

    #[abi(embed_v0)]
    impl DevRealmSystemsImpl of super::IDevRealmSystems<ContractState> {
        /// A system that simplifies onboarding for test purpose
        /// in production, use realms_systems.create() directly
        ///
        fn create(ref world: IWorldDispatcher, realm_id: ID, frontend: ContractAddress) {
            // mint test realm to this contract
            let season: SeasonConfig = get!(world, WORLD_CONFIG_ID, SeasonConfig);
            ITestRealmMintDispatcher { contract_address: season.realms_address }.mint(realm_id.into());

            // mint season pass to this contract
            ISeasonPassMintDispatcher { contract_address: season.season_pass_address }
                .mint(starknet::get_caller_address(), realm_id.into());

            // mint free lords attached to season pass
            ILordsMintDispatcher { contract_address: season.lords_address }.mint(realm_id.into());

            // approve realms systems contract to spend season passs
            let (_realm_systems_class_hash, realm_systems_address) =
                match world.resource(selector_from_tag!("eternum-realm_systems")) {
                dojo::world::Resource::Contract((class_hash, contract_address)) => (class_hash, contract_address),
                _ => (Zeroable::zero(), Zeroable::zero())
            };
            assert!(realm_systems_address != Zeroable::zero(), "realms systems contract not found");

            IERC721ApprovalDispatcher { contract_address: season.season_pass_address }
                .approve(realm_systems_address, realm_id.into());

            // mint realm to the caller
            let caller = starknet::get_caller_address();
            IRealmSystemsDispatcher { contract_address: realm_systems_address }.create(caller, realm_id, frontend);
        }
    }
}
