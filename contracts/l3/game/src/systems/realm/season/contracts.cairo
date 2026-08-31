use crate::alias::ID;

#[derive(Copy, Drop, Serde)]
pub struct RealmSettlement {
    pub side: u32,
    pub layer: u32,
    pub point: u32,
}

#[starknet::interface]
pub trait IRealmSystems<T> {
    fn create(
        ref self: T, game_id: u32, owner: starknet::ContractAddress, realm_id: ID, settlement: RealmSettlement,
    ) -> ID;
}

#[dojo::contract]
pub mod realm_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use starknet::{ContractAddress, TxInfo};
    use crate::alias::ID;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{
        RealmCountConfig, SeasonConfigImpl, SettlementConfig, SettlementConfigImpl, WorldConfigUtilImpl,
    };
    use crate::models::events::{RealmCreatedStory, Story, StoryEvent};
    use crate::models::ledger::LedgerRegistrationImpl;
    use crate::models::map::TileImpl;
    use crate::models::position::{Coord, CoordImpl};
    use crate::models::realm::{RealmNameAndAttrsDecodingImpl, RealmReferenceImpl};
    use crate::models::resource::production::building::BuildingImpl;
    use crate::models::resource::resource::{
        ResourceImpl, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use crate::models::structure::{
        StructureBaseStoreImpl, StructureImpl, StructureMetadataStoreImpl, StructureOwnerStoreImpl,
    };
    use crate::systems::realm::utils::contracts::{
        IRealmInternalSystemsDispatcher, IRealmInternalSystemsDispatcherTrait,
    };
    use crate::systems::utils::structure::iStructureImpl;
    use crate::utils::achievements::index::{AchievementTrait, Tasks};
    use super::RealmSettlement;


    #[derive(Introspect, Copy, Drop, Serde)]
    #[dojo::model]
    pub struct AntiBot {
        #[key]
        pub game_id: u32,
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
            ref self: ContractState, game_id: u32, owner: ContractAddress, realm_id: ID, settlement: RealmSettlement,
        ) -> ID {
            // check that season is still active
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world, game_id).assert_settling_started_and_not_over();

            // anti bot protection
            let tx_info: TxInfo = starknet::get_tx_info().unbox();
            let tx_hash: felt252 = tx_info.transaction_hash;

            let caller: ContractAddress = starknet::get_caller_address();

            // todo: use tx origin instead
            let mut anti_bot: AntiBot = world.read_model((game_id, caller, tx_hash));
            assert!(!anti_bot.used, "multicalls not allowed");
            anti_bot.used = true;
            world.write_model(@anti_bot);

            // ensure all spires have been settled before allowing new realms
            let mut settlement_config: SettlementConfig = WorldConfigUtilImpl::get_member(
                world, game_id, selector!("settlement_config"),
            );
            assert!(
                settlement_config.spires_max_count == settlement_config.spires_settled_count,
                "Eternum: All spires must be created before creating new realms",
            );

            let game = crate::models::game::GameRegistryImpl::get(world, game_id);
            let (realm_id, wonder, order, resources) = if game.dev_mode_on {
                (realm_id, 0, 0, array![])
            } else {
                let registration = LedgerRegistrationImpl::for_season_account(world, game_id, caller);
                let (encoded_metadata, _, _) = registration.metadata;
                let (_realm_name, _regions, _cities, _harbors, _rivers, wonder, order, resources) =
                    RealmNameAndAttrsDecodingImpl::decode(
                    encoded_metadata,
                );
                (registration.realm_id.try_into().expect('realm id exceeds felt252'), wonder, order, resources)
            };

            // update realm count
            let realm_count_selector: felt252 = selector!("realm_count_config");
            let mut realm_count: RealmCountConfig = WorldConfigUtilImpl::get_member(
                world, game_id, realm_count_selector,
            );
            realm_count.count += 1;
            WorldConfigUtilImpl::set_member(ref world, game_id, realm_count_selector, realm_count);

            // get realm coordinates
            let map_center: Coord = CoordImpl::center(ref world, game_id);
            let coord: Coord = settlement_config
                .generate_coord(false, settlement.side, settlement.layer, settlement.point, map_center);
            settlement_config.update_max_layer_and_spires(realm_count.count.into());
            WorldConfigUtilImpl::set_member(ref world, game_id, selector!("settlement_config"), settlement_config);

            // create the realm structure first, then provision its economy in the same tx
            let (realm_internal_systems_address, _) = world.dns(@"realm_internal_systems").unwrap();
            let realm_internal_systems = IRealmInternalSystemsDispatcher {
                contract_address: realm_internal_systems_address,
            };
            let structure_id = realm_internal_systems
                .create_internal(game_id, owner, realm_id, resources, order, wonder, coord, true, true);
            realm_internal_systems.provision_internal(game_id, structure_id);

            // emit realm settle event
            let now = starknet::get_block_timestamp();
            world
                .emit_event(
                    @StoryEvent {
                        game_id,
                        id: world.dispatcher.uuid(),
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
