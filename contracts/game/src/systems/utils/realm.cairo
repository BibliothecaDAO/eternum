use core::num::traits::zero::Zero;
use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use s1_eternum::alias::ID;
use s1_eternum::models::config::{
    SeasonConfigImpl, SettlementConfigImpl, WonderProductionBonusConfig, WorldConfigUtilImpl,
};
use s1_eternum::models::map::{TileImpl, TileOccupier};
use s1_eternum::models::position::Coord;
use s1_eternum::models::realm::{RealmNameAndAttrsDecodingImpl, RealmReferenceImpl};
use s1_eternum::models::resource::production::building::{BuildingCategory, BuildingImpl};
use s1_eternum::models::resource::production::production::ProductionBoostBonus;
use s1_eternum::models::resource::resource::{
    ResourceImpl, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
};
use s1_eternum::models::structure::{
    StructureBaseStoreImpl, StructureCategory, StructureImpl, StructureMetadata, StructureMetadataStoreImpl,
    StructureOwnerStoreImpl, Wonder,
};
use s1_eternum::systems::utils::structure::iStructureImpl;
use starknet::ContractAddress;
use crate::system_libraries::structure_libraries::structure_creation_library::{
    IStructureCreationlibraryDispatcherTrait, structure_creation_library,
};

#[starknet::interface]
pub trait ISeasonPass<TState> {
    fn get_encoded_metadata(self: @TState, token_id: u16) -> (felt252, felt252, felt252);
    fn transfer_from(self: @TState, from: ContractAddress, to: ContractAddress, token_id: u256);
    fn approve(self: @TState, to: ContractAddress, token_id: u256);
    fn lords_balance(self: @TState, token_id: u256) -> u256;
    fn detach_lords(self: @TState, token_id: u256, amount: u256);
}


#[generate_trait]
pub impl iRealmImpl of iRealmTrait {
    fn create_realm(
        ref world: WorldStorage,
        owner: ContractAddress,
        realm_id: ID,
        resources: Array<u8>,
        order: u8,
        level: u8,
        wonder: u8,
        coord: Coord,
        explore_village_coord: bool,
    ) -> ID {
        // create structure
        let has_wonder = RealmReferenceImpl::wonder_mapping(wonder.into()) != "None";
        let structure_id = world.dispatcher.uuid();
        let mut tile_occupier = TileOccupier::RealmRegularLevel1;
        if has_wonder {
            tile_occupier = TileOccupier::RealmWonderLevel1;
            world
                .write_model(
                    @Wonder { structure_id: structure_id, realm_id: realm_id.try_into().unwrap(), coord: coord },
                );

            // grant wonder production bonus
            let wonder_production_bonus_config: WonderProductionBonusConfig = WorldConfigUtilImpl::get_member(
                world, selector!("wonder_production_bonus_config"),
            );
            let mut production_boost_bonus: ProductionBoostBonus = Zero::zero();
            production_boost_bonus.structure_id = structure_id;
            production_boost_bonus
                .wonder_incr_percent_num = wonder_production_bonus_config
                .bonus_percent_num
                .try_into()
                .unwrap();
            world.write_model(@production_boost_bonus);
        }

        // create structure
        let structure_creation_library = structure_creation_library::get_dispatcher(@world);
        structure_creation_library
            .make_structure(
                world,
                coord,
                owner,
                structure_id,
                StructureCategory::Realm,
                resources.span(),
                StructureMetadata {
                    realm_id: realm_id.try_into().unwrap(), order, has_wonder, villages_count: 0, village_realm: 0,
                },
                tile_occupier.into(),
                explore_village_coord,
            );

        // grant starting resources
        structure_creation_library.grant_starting_resources(world, structure_id, coord);

        // place castle building
        BuildingImpl::create(
            ref world,
            owner,
            structure_id,
            StructureCategory::Realm.into(),
            coord,
            BuildingCategory::ResourceLabor,
            BuildingImpl::center(),
        );

        structure_id
    }

    fn collect_season_pass(ref world: WorldStorage, season_pass_address: ContractAddress, realm_id: ID) {
        let caller = starknet::get_caller_address();
        let this = starknet::get_contract_address();
        let season_pass = ISeasonPassDispatcher { contract_address: season_pass_address };

        // transfer season pass from caller to this
        season_pass.transfer_from(caller, this, realm_id.into());
    }


    fn collect_season_pass_metadata(
        season_pass_address: ContractAddress, realm_id: ID,
    ) -> (felt252, u8, u8, u8, u8, u8, u8, Array<u8>) {
        let season_pass = ISeasonPassDispatcher { contract_address: season_pass_address };
        let (name_and_attrs, _urla, _urlb) = season_pass.get_encoded_metadata(realm_id.try_into().unwrap());
        RealmNameAndAttrsDecodingImpl::decode(name_and_attrs)
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
}

