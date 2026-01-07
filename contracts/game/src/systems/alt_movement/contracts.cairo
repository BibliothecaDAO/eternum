use crate::alias::ID;
use crate::models::position::{Direction};

#[starknet::interface]
pub trait IAltMovementSystems<TContractState> {
    fn toggle_alternate(ref self: TContractState, explorer_id: ID, spire_direction: Direction);
}

#[dojo::contract]
pub mod alt_movement_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorageTrait;
    use crate::alias::ID;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::SeasonConfigImpl;
    use crate::models::events::{ExploreFind, ExplorerMoveStory, Story, StoryEvent};
    use crate::models::map::{Tile, TileImpl, TileOccupier};
    use crate::models::map2::TileOpt;
    use crate::models::position::{Coord, CoordTrait, Direction, TravelTrait};
    use crate::models::structure::StructureOwnerStoreImpl;
    use crate::models::troop::ExplorerTroops;
    use crate::systems::utils::map::IMapImpl;
    use crate::systems::utils::troop::iExplorerImpl;
    use starknet::ContractAddress;

    #[abi(embed_v0)]
    impl AltMovementSystemsImpl of super::IAltMovementSystems<ContractState> {
        fn toggle_alternate(ref self: ContractState, explorer_id: ID, spire_direction: Direction) {
            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns explorer
            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            explorer.assert_caller_structure_or_agent_owner(ref world);

            // ensure explorer is alive
            assert!(explorer.troops.count.is_non_zero(), "explorer is dead");

            // ensure current tile matches explorer
            let start_coord: Coord = explorer.coord;
            let current_tile_opt: TileOpt = world.read_model((start_coord.alt, start_coord.x, start_coord.y));
            let mut current_tile: Tile = current_tile_opt.into();
            assert!(current_tile.occupier_id == explorer_id, "tile occupier should be explorer");

            let spire_coord = start_coord.neighbor(spire_direction);
            let spire_tile_opt: TileOpt = world.read_model((
                start_coord.alt, spire_coord.x, spire_coord.y,
            ));
            let spire_tile: Tile = spire_tile_opt.into();
            assert!(
                spire_tile.occupier_type == TileOccupier::Spire.into(),
                "Eternum: explorer must be adjacent to spire"
            );
            assert!(explorer.coord.is_adjacent(spire_coord), "Eternum: explorer must be adjacent to spire");

            let destination_coord = Coord { alt: !start_coord.alt, x: start_coord.x, y: start_coord.y };
            let destination_tile_opt: TileOpt = world.read_model((
                destination_coord.alt, destination_coord.x, destination_coord.y,
            ));
            let mut destination_tile: Tile = destination_tile_opt.into();
            assert!(destination_tile.not_occupied(), "Eternum: destination tile is occupied");

            IMapImpl::occupy(ref world, ref current_tile, TileOccupier::None, 0);
            let tile_occupier = IMapImpl::get_troop_occupier(
                explorer.owner, explorer.troops.category, explorer.troops.tier,
            );
            IMapImpl::occupy(ref world, ref destination_tile, tile_occupier, explorer_id);

            explorer.coord = destination_coord;
            world.write_model(@explorer);

            let explorer_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, explorer.owner);
            let directions: Array<Direction> = array![];
            world
                .emit_event(
                    @StoryEvent {
                        owner: Option::Some(explorer_owner),
                        entity_id: Option::Some(explorer_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::ExplorerMoveStory(
                            ExplorerMoveStory {
                                explorer_owner,
                                explorer_id,
                                explorer_structure_id: explorer.owner,
                                start_coord,
                                end_coord: explorer.coord,
                                directions: directions.span(),
                                explore: false,
                                explore_find: ExploreFind::None,
                            },
                        ),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }
    }
}
