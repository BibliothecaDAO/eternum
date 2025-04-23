use s1_eternum::alias::ID;
use starknet::ContractAddress;

#[starknet::interface]
pub trait ISeasonPass<TState> {
    fn get_encoded_metadata(self: @TState, token_id: u16) -> (felt252, felt252, felt252);
    fn transfer_from(self: @TState, from: ContractAddress, to: ContractAddress, token_id: u256);
    fn lords_balance(self: @TState, token_id: u256) -> u256;
    fn detach_lords(self: @TState, token_id: u256, amount: u256);
}

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

#[dojo::contract]
pub mod realm_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait};
    use dojo::world::{WorldStorage};

    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS};
    use s1_eternum::models::config::{
        RealmCountConfig, SeasonAddressesConfig, SeasonConfigImpl, SettlementConfig, SettlementConfigImpl,
        WonderProductionBonusConfig, WorldConfigUtilImpl,
    };
    use s1_eternum::models::event::{EventType, SettleRealmData};
    use s1_eternum::models::map::{TileImpl, TileOccupier};
    use s1_eternum::models::name::{AddressName};
    use s1_eternum::models::position::{Coord};
    use s1_eternum::models::realm::{RealmNameAndAttrsDecodingImpl, RealmReferenceImpl};
    use s1_eternum::models::resource::production::building::{BuildingCategory, BuildingImpl};
    use s1_eternum::models::resource::production::production::{ProductionWonderBonus};
    use s1_eternum::models::resource::resource::{ResourceImpl};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::structure::{
        StructureBaseStoreImpl, StructureCategory, StructureImpl, StructureMetadata, StructureMetadataStoreImpl,
        StructureOwnerStoreImpl, Wonder,
    };
    use s1_eternum::systems::utils::structure::iStructureImpl;
    use starknet::ContractAddress;
    use super::RealmSettlement;
    use super::{ISeasonPassDispatcher, ISeasonPassDispatcherTrait};


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
            InternalRealmLogicImpl::collect_season_pass(season_addresses_config.season_pass_address, realm_id);

            // retrieve realm metadata
            let (realm_name, regions, cities, harbors, rivers, wonder, order, resources) =
                InternalRealmLogicImpl::retrieve_metadata_from_season_pass(
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
            let structure_id = InternalRealmLogicImpl::create_realm(
                ref world, owner, realm_id, resources, order, 0, wonder, coord,
            );

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


    #[generate_trait]
    pub impl InternalRealmLogicImpl of InternalRealmLogicTrait {
        fn create_realm(
            ref world: WorldStorage,
            owner: ContractAddress,
            realm_id: ID,
            resources: Array<u8>,
            order: u8,
            level: u8,
            wonder: u8,
            coord: Coord,
        ) -> ID {
            // create structure
            let has_wonder = RealmReferenceImpl::wonder_mapping(wonder.into()) != "None";
            let structure_id = world.dispatcher.uuid();
            let mut tile_occupier = TileOccupier::RealmRegularLevel1;
            if has_wonder {
                tile_occupier = TileOccupier::RealmWonderLevel1;
                world.write_model(@Wonder { structure_id: structure_id, realm_id: realm_id.try_into().unwrap(), coord: coord });

                // grant wonder production bonus
                let wonder_production_bonus_config: WonderProductionBonusConfig = WorldConfigUtilImpl::get_member(
                    world, selector!("wonder_production_bonus_config"),
                );
                let production_wonder_bonus = ProductionWonderBonus {
                    structure_id: structure_id, bonus_percent_num: wonder_production_bonus_config.bonus_percent_num,
                };
                world.write_model(@production_wonder_bonus);
            }

            // create structure
            iStructureImpl::create(
                ref world,
                coord,
                owner,
                structure_id,
                StructureCategory::Realm,
                resources.span(),
                StructureMetadata {
                    realm_id: realm_id.try_into().unwrap(), order, has_wonder, villages_count: 0, village_realm: 0,
                },
                tile_occupier.into(),
            );

            // grant starting resources
            iStructureImpl::grant_starting_resources(ref world, structure_id);

            // place castle building
            BuildingImpl::create(
                ref world,
                structure_id,
                StructureCategory::Realm.into(),
                coord,
                BuildingCategory::ResourceLabor,
                BuildingImpl::center(),
            );

            structure_id
        }

        fn collect_season_pass(season_pass_address: ContractAddress, realm_id: ID) {
            let caller = starknet::get_caller_address();
            let this = starknet::get_contract_address();
            let season_pass = ISeasonPassDispatcher { contract_address: season_pass_address };

            // transfer season pass from caller to this
            season_pass.transfer_from(caller, this, realm_id.into());
        }

        // fn collect_lords_from_season_pass(season_pass_address: ContractAddress, realm_id: ID) -> u256 {
        //     // detach lords from season pass
        //     let season_pass = ISeasonPassDispatcher { contract_address: season_pass_address };
        //     let token_lords_balance: u256 = season_pass.lords_balance(realm_id.into());
        //     season_pass.detach_lords(realm_id.into(), token_lords_balance);
        //     assert!(season_pass.lords_balance(realm_id.into()).is_zero(), "lords amount attached to realm should be
        //     0");

        //     // at this point, this contract's lords balance must have increased by
        //     // `token_lords_balance`
        //     token_lords_balance
        // }

        // fn bridge_lords_into_realm(
        //     ref world: WorldStorage,
        //     lords_address: ContractAddress,
        //     realm_structure_id: ID,
        //     amount: u256,
        //     frontend: ContractAddress,
        // ) {
        //     // get bridge systems address
        //     let (bridge_systems_address, _) = world.dns(@"resource_bridge_systems").unwrap();
        //     // approve bridge to spend lords
        //     IERC20Dispatcher { contract_address: lords_address }.approve(bridge_systems_address, amount);

        //     // deposit lords
        //     IResourceBridgeSystemsDispatcher { contract_address: bridge_systems_address }
        //         .deposit(lords_address, realm_structure_id, amount, frontend);
        // }

        fn retrieve_metadata_from_season_pass(
            season_pass_address: ContractAddress, realm_id: ID,
        ) -> (felt252, u8, u8, u8, u8, u8, u8, Array<u8>) {
            let season_pass = ISeasonPassDispatcher { contract_address: season_pass_address };
            let (name_and_attrs, _urla, _urlb) = season_pass.get_encoded_metadata(realm_id.try_into().unwrap());
            RealmNameAndAttrsDecodingImpl::decode(name_and_attrs)
        }
    }
}
