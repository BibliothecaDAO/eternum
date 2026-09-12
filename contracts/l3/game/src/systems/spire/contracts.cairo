#[derive(Copy, Drop, Serde)]
pub struct SpireSettlement {
    pub side: u32,
    pub layer: u32,
    pub point: u32,
}

#[starknet::interface]
pub trait ISpireSystems<T> {
    /// Create spires at the specified positions.
    ///
    /// Callable by anyone during the settling period. All spires must be created
    /// before realms can be settled.
    ///
    /// The client calculates positions and passes them as SpireSettlement structs.
    /// Use `is_center: true` for the first spire (at map center).
    fn create_spires(ref self: T, game_id: u32, is_center: bool, settlements: Span<SpireSettlement>);
}

#[dojo::contract]
pub mod spire_systems {
    use dojo::world::WorldStorage;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{SeasonConfigImpl, SettlementConfig, SettlementConfigImpl, WorldConfigUtilImpl};
    use crate::models::position::{Coord, CoordImpl};
    use crate::systems::spire::creation::create_spire_at_coord;
    use super::SpireSettlement;

    #[abi(embed_v0)]
    impl SpireSystemsImpl of super::ISpireSystems<ContractState> {
        fn create_spires(ref self: ContractState, game_id: u32, is_center: bool, settlements: Span<SpireSettlement>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world, game_id).assert_settling_started_and_not_over();

            let map_center: Coord = CoordImpl::center(ref world, game_id);
            let mut settlement_config: SettlementConfig = WorldConfigUtilImpl::get_member(
                world, game_id, selector!("settlement_config"),
            );

            // Handle center spire if requested
            if is_center {
                assert!(settlement_config.spires_settled_count == 0, "Eternum: Center spire already created");
                assert!(
                    settlement_config.spires_settled_count < settlement_config.spires_max_count,
                    "Eternum: All spires have been created",
                );
                create_spire_at_coord(ref world, game_id, map_center);
                settlement_config.spires_settled_count += 1;
            }

            // Handle remaining settlements
            for settlement in settlements {
                let settlement = *settlement;
                assert!(
                    settlement_config.spires_settled_count < settlement_config.spires_max_count,
                    "Eternum: All spires have been created",
                );

                let coord: Coord = settlement_config
                    .generate_coord(true, settlement.side, settlement.layer, settlement.point, map_center);

                create_spire_at_coord(ref world, game_id, coord);
                settlement_config.spires_settled_count += 1;
            }

            WorldConfigUtilImpl::set_member(ref world, game_id, selector!("settlement_config"), settlement_config);
        }
    }
}
