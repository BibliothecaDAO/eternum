use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use starknet::ContractAddress;

#[starknet::interface]
trait ITestRealmMint<T> {
    fn mint(ref self: T, token_id: u256);
}

#[starknet::interface]
trait ILordsMint<T> {
    fn mint(ref self: T, token_id: u256);
}

#[starknet::interface]
trait ISeasonPassMint<T> {
    fn mint(ref self: T, recipient: ContractAddress, token_id: u256);
}

#[starknet::interface]
trait IERC721Approval<T> {
    fn approve(ref self: T, to: ContractAddress, token_id: u256);
}

#[starknet::interface]
trait IDevRealmSystems<T> {
    fn create(ref self: T, realm_id: ID, frontend: ContractAddress);
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

    use dojo::world::WorldStorage;
    use dojo::model::ModelStorage;
    use dojo::event(historical: true)::EventStorage;
    use eternum::constants::DEFAULT_NS;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    #[abi(embed_v0)]
    impl DevRealmSystemsImpl of super::IDevRealmSystems<ContractState> {
        /// A system that simplifies onboarding for test purpose
        /// in production, use realms_systems.create() directly
        ///
        fn create(ref self: ContractState, realm_id: ID, frontend: ContractAddress) {
            // mint test realm to this contract
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season: SeasonConfig = world.read_model(WORLD_CONFIG_ID);
            ITestRealmMintDispatcher { contract_address: season.realms_address }.mint(realm_id.into());

            // mint season pass to this contract
            ISeasonPassMintDispatcher { contract_address: season.season_pass_address }
                .mint(starknet::get_contract_address(), realm_id.into());

            // mint free lords attached to season pass
            ILordsMintDispatcher { contract_address: season.lords_address }.mint(realm_id.into());

            // approve realms systems contract to spend season passs
            let (realm_systems_address, _namespace_hash) =
                match world.dispatcher.resource(selector_from_tag!("eternum-realm_systems")) {
                dojo::world::Resource::Contract((contract_address, namespace_hash)) => (contract_address, namespace_hash),
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
