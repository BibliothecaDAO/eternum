use core::num::traits::Zero;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use crate::constants::blitz_target_open_settlement_count;
use crate::models::config::{BlitzSettlementConfig, BlitzSettlementConfigImpl, BlitzSettlementPosition};
use crate::models::position::{Coord, CoordImpl};
use crate::system_libraries::rng_library::{IRNGlibraryDispatcherTrait, rng_library};

#[generate_trait]
pub impl SettlementPoolImpl of SettlementPoolTrait {
    fn target_open_settlement_count(
        settled_player_count: u16, settlement_count_max: u16, two_player_mode: bool,
    ) -> u16 {
        blitz_target_open_settlement_count(settled_player_count, settlement_count_max, two_player_mode)
    }

    fn open_next_settlement(
        ref world: WorldStorage,
        game_id: u32,
        ref blitz_settlement_config: BlitzSettlementConfig,
        map_center: Coord,
        reward_profile_id: u8,
    ) {
        let settlement_coords = blitz_settlement_config.generate_coords(map_center, reward_profile_id);
        let settlement_number = blitz_settlement_config.open_settlement_count + 1;

        world.write_model(@BlitzSettlementPosition { game_id, settlement_number, coords: settlement_coords.span() });

        blitz_settlement_config.next();
        blitz_settlement_config.open_settlement_count += 1;
    }

    fn fill_open_settlement_pool(
        ref world: WorldStorage,
        game_id: u32,
        ref blitz_settlement_config: BlitzSettlementConfig,
        reward_profile_id: u8,
        target_open_settlement_count: u16,
    ) {
        let map_center = CoordImpl::center(ref world, game_id);
        while blitz_settlement_config.open_settlement_count < target_open_settlement_count {
            Self::open_next_settlement(ref world, game_id, ref blitz_settlement_config, map_center, reward_profile_id);
        }
    }

    fn claim_open_settlement(
        ref world: WorldStorage, game_id: u32, ref blitz_settlement_config: BlitzSettlementConfig, vrf_seed: u256,
    ) -> Span<Coord> {
        let open_settlement_count = blitz_settlement_config.open_settlement_count;
        assert!(open_settlement_count.is_non_zero(), "Eternum: No open settlements available");

        let rng_library_dispatcher = rng_library::get_dispatcher(@world);
        let settlement_number: u16 = 1
            + rng_library_dispatcher
                .get_random_in_range(vrf_seed, 98139, open_settlement_count.into())
                .try_into()
                .unwrap();

        let open_settlement: BlitzSettlementPosition = world.read_model((game_id, settlement_number));
        if settlement_number != open_settlement_count {
            let last_open_settlement: BlitzSettlementPosition = world.read_model((game_id, open_settlement_count));
            world
                .write_model(
                    @BlitzSettlementPosition { game_id, settlement_number, coords: last_open_settlement.coords },
                );
        }

        blitz_settlement_config.open_settlement_count -= 1;
        open_settlement.coords
    }
}
