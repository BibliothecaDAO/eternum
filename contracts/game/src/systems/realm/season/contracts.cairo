use s1_eternum::alias::ID;
use starknet::ContractAddress;

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
    use dojo::world::{WorldStorage, WorldStorageTrait};

    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS};
    use s1_eternum::models::config::{
        RealmCountConfig, SeasonAddressesConfig, SeasonConfigImpl, SettlementConfig, SettlementConfigImpl,
        WorldConfigUtilImpl,
    };
    use s1_eternum::models::map::{TileImpl};
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
    use s1_eternum::models::events::{RealmCreatedStory, Story, StoryEvent};
    use s1_eternum::systems::realm::utils::contracts::{
        IRealmInternalSystemsDispatcher, IRealmInternalSystemsDispatcherTrait,
    };
    use s1_eternum::systems::utils::realm::iRealmImpl;
    use s1_eternum::systems::utils::structure::iStructureImpl;
    use s1_eternum::utils::achievements::index::{AchievementTrait, Tasks};
    use starknet::ContractAddress;
    use starknet::TxInfo;
    use super::RealmSettlement;


    #[derive(Introspect, Copy, Drop, Serde)]
    #[dojo::model]
    pub struct AntiBot {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub tx_hash: felt252,
        used: bool,
    }


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

            // anti bot protection
            let tx_info: TxInfo = starknet::get_tx_info().unbox();
            let tx_hash: felt252 = tx_info.transaction_hash;
            let caller: ContractAddress = starknet::get_caller_address();

            let mut anti_bot: AntiBot = world.read_model((caller, tx_hash));
            assert!(!anti_bot.used, "multicalls not allowed");
            anti_bot.used = true;
            world.write_model(@anti_bot);

            // collect season pass
            let season_addresses_config: SeasonAddressesConfig = WorldConfigUtilImpl::get_member(
                world, selector!("season_addresses_config"),
            );

            iRealmImpl::collect_season_pass(ref world, season_addresses_config.season_pass_address, realm_id);

            // retrieve realm metadata
            let (_realm_name, _regions, _cities, _harbors, _rivers, wonder, order, resources) =
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
                .create_internal(owner, realm_id, resources, order, wonder, coord, true);

            // collect lords attached to season pass and bridge into the realm
            // let lords_amount_attached: u256 =
            // InternalRealmLogicImpl::collect_lords_from_season_pass(
            //     season_addresses_config.season_pass_address, realm_id,
            // );

            // // bridge attached lords into the realm
            // if lords_amount_attached.is_non_zero() {
            //     InternalRealmLogicImpl::bridge_lords_into_realm(
            //         ref world, season_addresses_config.lords_address, structure_id,
            //         lords_amount_attached, frontend,
            //     );
            // }

            // emit realm settle event
            let now = starknet::get_block_timestamp();
            world
                .emit_event(
                    @StoryEvent {
                        owner: Option::Some(owner),
                        entity_id: Option::Some(structure_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::RealmCreatedStory(RealmCreatedStory { coord }),
                        timestamp: now,
                    },
                );
            // emit achievement progression
            AchievementTrait::progress(
                world, owner.into(), Tasks::REALM_SETTLEMENT, 1, starknet::get_block_timestamp(),
            );

            structure_id.into()
        }
    }
}
