use s1_eternum::alias::ID;
use s1_eternum::models::position::Coord;
use starknet::ContractAddress;


#[starknet::interface]
pub trait IERC20<TState> {
    fn approve(ref self: TState, spender: ContractAddress, amount: u256) -> bool;
}

#[derive(Copy, Drop, Serde)]
pub struct RealmSettlement {
    pub side: u32,
    pub layer: u32,
    pub point: u32,
}

#[starknet::interface]
pub trait IRealmSystems<T> {
    fn create(
        ref self: T,
        owner: starknet::ContractAddress,
        realm_id: ID,
        frontend: ContractAddress,
        settlement: RealmSettlement,
    ) -> ID;
}

#[starknet::interface]
pub trait IRealmInternalSystems<T> {
    fn create_internal(
        ref self: T,
        owner: starknet::ContractAddress,
        realm_id: ID,
        resources: Array<u8>,
        order: u8,
        wonder: u8,
        coord: Coord,
    ) -> ID;
}


#[dojo::contract]
pub mod realm_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait};
    use dojo::world::{WorldStorage, WorldStorageTrait};

    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS};
    use s1_eternum::models::config::{
        RealmCountConfig, SeasonAddressesConfig, SeasonConfigImpl, SettlementConfig, SettlementConfigImpl,
        WorldConfigUtilImpl,
    };
    use s1_eternum::models::event::{EventType, SettleRealmData};
    use s1_eternum::models::map::{TileImpl};
    use s1_eternum::models::name::{AddressName};
    use s1_eternum::models::position::{Coord};
    use s1_eternum::models::realm::{RealmNameAndAttrsDecodingImpl, RealmReferenceImpl};
    use s1_eternum::models::resource::production::building::{BuildingImpl};
    use s1_eternum::models::resource::resource::{ResourceImpl};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::structure::{
        StructureBaseStoreImpl, StructureImpl, StructureMetadataStoreImpl, StructureOwnerStoreImpl,
    };
    use s1_eternum::systems::utils::realm::iRealmImpl;
    use s1_eternum::systems::utils::structure::iStructureImpl;
    use starknet::ContractAddress;
    use super::RealmSettlement;
    use super::{IRealmInternalSystemsDispatcher, IRealmInternalSystemsDispatcherTrait};


    #[abi(embed_v0)]
    impl RealmSystemsImpl of super::IRealmSystems<ContractState> {
        /// Create a new realm
        /// @param owner the address that'll own the realm in the game
        /// @param realm_id The ID of the realm
        /// @param frontend: address to pay client fees to
        /// @return The realm's entity ID
        ///
        /// @note This function is only callable by the season pass owner
        /// and the season pass owner must approve this contract to
        /// spend their season pass NFT
        ///
        fn create(
            ref self: ContractState,
            owner: ContractAddress,
            realm_id: ID,
            frontend: ContractAddress,
            settlement: RealmSettlement,
        ) -> ID {
            // check that season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_settling_started_and_not_over();

            // collect season pass
            let season_addresses_config: SeasonAddressesConfig = WorldConfigUtilImpl::get_member(
                world, selector!("season_addresses_config"),
            );

            iRealmImpl::collect_season_pass(
                ref world,
                season_addresses_config.season_pass_address,
                realm_id,
            );

            // retrieve realm metadata
            let (realm_name, regions, cities, harbors, rivers, wonder, order, resources) =
                iRealmImpl::collect_season_pass_metadata(
                season_addresses_config.season_pass_address, realm_id,
            );

            // update realm count
            let realm_count_selector: felt252 = selector!("realm_count_config");
            let mut realm_count: RealmCountConfig = WorldConfigUtilImpl::get_member(world, realm_count_selector);
            realm_count.count += 1;
            WorldConfigUtilImpl::set_member(ref world, realm_count_selector, realm_count);

            // get realm coordinates
            let settlement_config: SettlementConfig = WorldConfigUtilImpl::get_member(
                world, selector!("settlement_config"),
            );
            let settlement_max_layer: u32 = SettlementConfigImpl::max_layer(realm_count.count.into());
            let coord: Coord = settlement_config
                .generate_coord(settlement_max_layer, settlement.side, settlement.layer, settlement.point);

            // create realm
            let (realm_internal_systems_address, _) = world.dns(@"realm_internal_systems").unwrap();
            let structure_id = IRealmInternalSystemsDispatcher { contract_address: realm_internal_systems_address }
                .create_internal(owner, realm_id, resources, order, wonder, coord);

            // collect lords attached to season pass and bridge into the realm
            // let lords_amount_attached: u256 = InternalRealmLogicImpl::collect_lords_from_season_pass(
            //     season_addresses_config.season_pass_address, realm_id,
            // );

            // // bridge attached lords into the realm
            // if lords_amount_attached.is_non_zero() {
            //     InternalRealmLogicImpl::bridge_lords_into_realm(
            //         ref world, season_addresses_config.lords_address, structure_id, lords_amount_attached, frontend,
            //     );
            // }

            // emit realm settle event
            let address_name: AddressName = world.read_model(owner);
            world
                .emit_event(
                    @SettleRealmData {
                        id: world.dispatcher.uuid(),
                        event_id: EventType::SettleRealm,
                        entity_id: structure_id,
                        owner_address: owner,
                        owner_name: address_name.name,
                        realm_name: realm_name,
                        produced_resources: 0, // why?
                        cities,
                        harbors,
                        rivers,
                        regions,
                        wonder,
                        order,
                        x: coord.x,
                        y: coord.y,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            structure_id.into()
        }
    }
}


#[dojo::contract]
pub mod realm_internal_systems {
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS};
    use s1_eternum::models::position::Coord;
    use s1_eternum::systems::utils::realm::iRealmImpl;
    use starknet::ContractAddress;

    #[abi(embed_v0)]
    impl RealmInternalSystemsImpl of super::IRealmInternalSystems<ContractState> {
        fn create_internal(
            ref self: ContractState,
            owner: ContractAddress,
            realm_id: ID,
            resources: Array<u8>,
            order: u8,
            wonder: u8,
            coord: Coord,
        ) -> ID {

            
            // ensure caller is the realm systems
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let (realm_systems, _) = world.dns(@"realm_systems").unwrap();
            assert!(starknet::get_caller_address() == realm_systems, "caller must be the realm_systems");

            // create realm
            let structure_id = iRealmImpl::create_realm(
                ref world, owner, realm_id, resources, order, 0, wonder, coord);
            structure_id.into()
        }
    }
}
