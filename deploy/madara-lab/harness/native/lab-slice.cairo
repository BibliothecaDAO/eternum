use starknet::ContractAddress;
use crate::models::position::Coord;

#[starknet::interface]
pub trait ILabSlice<T> {
    fn prepare_root(ref self: T, game_id: u32, raw_root: u256);
    fn producer(ref self: T, game_id: u32, id: u32, output: u128);
    fn claim(ref self: T, game_id: u32, id: u32);
    fn spire(ref self: T, game_id: u32, coord: Coord) -> u32;
    fn bootstrap(ref self: T, game_id: u32, actor: ContractAddress, coord: Coord, grants: Span<(u8, u128)>) -> u32;
}
#[dojo::contract]
pub mod lab_slice_systems {
    use dojo::model::ModelStorage;
    use dojo::world::IWorldDispatcherTrait;
    use starknet::ContractAddress;
    use crate::constants::DEFAULT_NS;
    use crate::models::map::{Tile, TileOccupier};
    use crate::models::map2::TileOpt;
    use crate::models::position::{Coord, CoordTrait};
    use crate::models::resource::production::building::{BuildingCategory, BuildingImpl};
    use crate::models::resource::resource::{
        ResourceWeightImpl, SingleResourceStoreImpl, SingleResourceTrait, WeightStoreImpl,
    };
    use crate::models::structure::{Structure, StructureCategory, StructureOwnerStoreImpl};
    use crate::system_libraries::biome_library::{IBiomeLibraryDispatcherTrait, biome_library};
    use crate::system_libraries::structure_libraries::structure_creation_library::{
        IStructureCreationlibraryDispatcherTrait, structure_creation_library,
    };
    use crate::systems::utils::map::IMapImpl;
    #[abi(embed_v0)]
    impl Bootstrap of super::ILabSlice<ContractState> {
        fn prepare_root(ref self: ContractState, game_id: u32, raw_root: u256) {
            let mut world = self.world(DEFAULT_NS());
            assert_lab_game(@world, game_id);
            assert!(raw_root != 0, "lab raw root must be nonzero");
            world
                .write_model(
                    @crate::models::rng::RNG {
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash, seed: raw_root,
                    },
                );
        }
        fn producer(ref self: ContractState, game_id: u32, id: u32, output: u128) {
            let mut world = self.world(DEFAULT_NS());
            assert_lab_game(@world, game_id);
            let structure: Structure = world.read_model((game_id, id));
            let mut weight = WeightStoreImpl::retrieve(ref world, game_id, id);
            let unit_weight = ResourceWeightImpl::grams(ref world, game_id, 24);
            let mut resource = SingleResourceStoreImpl::retrieve(
                ref world, game_id, id, 24, ref weight, unit_weight, true,
            );
            resource.production.output_amount_left += output;
            resource.store(ref world);
            weight.store(ref world, game_id, id);
            BuildingImpl::create(
                ref world,
                game_id,
                structure.owner,
                id,
                structure.category.into(),
                Coord { alt: false, x: structure.base.coord_x, y: structure.base.coord_y },
                BuildingCategory::ResourceEarthenShard,
                BuildingImpl::center(),
            );
        }
        fn claim(ref self: ContractState, game_id: u32, id: u32) {
            let mut world = self.world(DEFAULT_NS());
            assert_lab_game(@world, game_id);
            assert!(
                starknet::get_caller_address() == StructureOwnerStoreImpl::retrieve(ref world, game_id, id),
                "actor does not own structure",
            );
            let mut weight = WeightStoreImpl::retrieve(ref world, game_id, id);
            for resource_type in 1_u8..59 {
                if resource_type < 39 || resource_type > 56 {
                    let unit_weight = ResourceWeightImpl::grams(ref world, game_id, resource_type);
                    SingleResourceStoreImpl::retrieve(
                        ref world, game_id, id, resource_type, ref weight, unit_weight, true,
                    );
                }
            }
        }
        fn spire(ref self: ContractState, game_id: u32, coord: Coord) -> u32 {
            let mut world = self.world(DEFAULT_NS());
            assert_lab_game(@world, game_id);
            let id = world.dispatcher.uuid();
            for alt in array![false, true] {
                let layer = Coord { alt, ..coord };
                seed_tile(ref world, game_id, layer, id);
                for direction in crate::models::position::DirectionTrait::all() {
                    seed_tile(ref world, game_id, layer.spire_neighbor(direction), 0);
                }
            }
            id
        }
        fn bootstrap(
            ref self: ContractState, game_id: u32, actor: ContractAddress, coord: Coord, grants: Span<(u8, u128)>,
        ) -> u32 {
            let mut world = self.world(DEFAULT_NS());
            assert_lab_game(@world, game_id);
            let id = world.dispatcher.uuid();
            structure_creation_library::get_dispatcher(@world)
                .make_structure(
                    world,
                    game_id,
                    coord,
                    actor,
                    id,
                    StructureCategory::Realm,
                    array![].span(),
                    Default::default(),
                    TileOccupier::RealmRegularLevel1,
                    false,
                );
            let mut weight = WeightStoreImpl::retrieve(ref world, game_id, id);
            for (resource_type, amount) in grants {
                let grams = ResourceWeightImpl::grams(ref world, game_id, *resource_type);
                let mut resource = SingleResourceStoreImpl::retrieve(
                    ref world, game_id, id, *resource_type, ref weight, grams, true,
                );
                resource.add(*amount, ref weight, grams);
                resource.store(ref world);
            }
            weight.store(ref world, game_id, id);
            world
                .write_model(
                    @crate::models::config::BlitzSettlement {
                        game_id, player: actor, structure_ids: array![id].span(),
                    },
                );
            id
        }
    }
    fn assert_lab_game(world: @dojo::world::WorldStorage, game_id: u32) {
        let game: crate::models::game::GameRegistry = world.read_model(game_id);
        assert!(game.dev_mode_on, "lab fixture requires a dev game");
        assert!(starknet::get_tx_info().unbox().chain_id != 'SN_MAIN', "lab fixture only");
        assert!(starknet::get_tx_info().unbox().chain_id != 'SN_SEPOLIA', "lab fixture only");
    }
    fn seed_tile(ref world: dojo::world::WorldStorage, game_id: u32, coord: Coord, spire_id: u32) {
        let opt: TileOpt = world.read_model((game_id, coord.alt, coord.x, coord.y));
        let mut tile: Tile = opt.into();
        let biome = biome_library::get_dispatcher(@world)
            .get_biome(world, game_id, coord.alt, coord.x.into(), coord.y.into());
        IMapImpl::explore(ref world, ref tile, biome);
        if spire_id != 0 {
            IMapImpl::occupy(ref world, ref tile, TileOccupier::Spire, spire_id);
        }
    }
}
