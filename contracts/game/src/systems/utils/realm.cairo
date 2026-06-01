use dojo::model::ModelStorage;
use dojo::world::{IWorldDispatcherTrait, WorldStorage};
use starknet::ContractAddress;
use crate::alias::ID;
use crate::models::map::{Tile, TileImpl, TileOccupier};
use crate::models::map2::TileOpt;
use crate::models::position::{Coord, CoordTrait, Direction};
use crate::models::realm::{RealmNameAndAttrsDecodingImpl, RealmReferenceImpl};
use crate::models::resource::production::building::{
    BuildingCategory, BuildingImpl, StructureBuildingCategoryCountImpl, StructureBuildings,
};
use crate::models::resource::production::production::ProductionStrategyImpl;
use crate::models::structure::{
    StructureBase, StructureBaseStoreImpl, StructureBaseTrait, StructureCategory, StructureMetadata,
    StructureOwnerStoreImpl, Wonder,
};
use crate::system_libraries::structure_libraries::structure_creation_library::{
    IStructureCreationlibraryDispatcherTrait, structure_creation_library,
};
use crate::systems::utils::map::IMapImpl;
use crate::utils::map::biomes::{Biome, get_biome_from_world};

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
    fn create_realm_structure(
        ref world: WorldStorage,
        owner: ContractAddress,
        realm_id: ID,
        resources: Array<u8>,
        order: u8,
        wonder: u8,
        coord: Coord,
        explore_village_coord: bool,
    ) -> ID {
        // resolve whether this realm starts as a regular or wonder structure
        let has_wonder = RealmReferenceImpl::wonder_mapping(wonder.into()) != "None";
        let structure_id = world.dispatcher.uuid();
        let mut tile_occupier = TileOccupier::RealmRegularLevel1;
        if has_wonder {
            tile_occupier = TileOccupier::RealmWonderLevel1;
            world
                .write_model(
                    @Wonder { structure_id: structure_id, realm_id: realm_id.try_into().unwrap(), coord: coord },
                );
        }

        // create the realm structure without granting startup economy yet
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

        structure_id
    }

    fn grant_realm_starting_troops(ref world: WorldStorage, structure_id: ID) {
        let mut structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
        assert!(structure_base.category == StructureCategory::Realm.into(), "structure is not a realm");
        if structure_base.starting_troops_granted {
            return;
        }

        let structure_coord = structure_base.coord();
        structure_base.starting_troops_granted = true;
        StructureBaseStoreImpl::store(ref structure_base, ref world, structure_id);

        let structure_creation_library = structure_creation_library::get_dispatcher(@world);
        structure_creation_library
            .grant_starting_troop_resources(world, structure_id, StructureCategory::Realm, structure_coord);
    }

    fn provision_realm(ref world: WorldStorage, structure_id: ID) {
        let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
        assert!(structure_base.category == StructureCategory::Realm.into(), "structure is not a realm");
        let structure_coord = structure_base.coord();

        let structure_buildings: StructureBuildings = world.read_model(structure_id);
        assert!(
            structure_buildings.building_count(BuildingCategory::ResourceLabor) == 0, "realm is already provisioned",
        );

        Self::reveal_realm_surroundings(ref world, structure_coord);

        // ensure troop start exists before the rest of the realm economy turns on
        Self::grant_realm_starting_troops(ref world, structure_id);

        let structure_creation_library = structure_creation_library::get_dispatcher(@world);
        structure_creation_library
            .grant_starting_non_troop_resources(world, structure_id, StructureCategory::Realm, structure_coord);

        let owner = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
        BuildingImpl::create(
            ref world,
            owner,
            structure_id,
            StructureCategory::Realm.into(),
            structure_coord,
            BuildingCategory::ResourceLabor,
            BuildingImpl::center(),
        );

        ProductionStrategyImpl::seed_unbounded_structure_labor_output(ref world, structure_id);
    }

    fn reveal_realm_surroundings(ref world: WorldStorage, structure_coord: Coord) {
        let structure_surrounding = array![
            Direction::East, Direction::NorthEast, Direction::NorthWest, Direction::West, Direction::SouthWest,
            Direction::SouthEast,
        ];

        for direction in structure_surrounding {
            let neighbor_coord = structure_coord.neighbor(direction);
            let neighbor_tile_opt: TileOpt = world.read_model((neighbor_coord.alt, neighbor_coord.x, neighbor_coord.y));
            let mut neighbor_tile: Tile = neighbor_tile_opt.into();
            if neighbor_tile.discovered() {
                continue;
            }

            let biome: Biome = get_biome_from_world(
                world, neighbor_coord.alt, neighbor_coord.x.into(), neighbor_coord.y.into(),
            );
            IMapImpl::explore(ref world, ref neighbor_tile, biome);
        }
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
