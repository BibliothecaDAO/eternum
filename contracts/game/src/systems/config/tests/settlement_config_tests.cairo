// #[cfg(test)]
// mod tests {
//     use debug::PrintTrait;
//     use dojo::model::ModelStorage;
//     use dojo::world::WorldStorage;
//     use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
//     use crate::models::config::{SettlementConfig, SettlementConfigImpl};
//     use crate::models::position::{Coord};
//     use crate::models::structure::{StructureCount};
//     use crate::systems::realm::contracts::realm_systems::InternalRealmLogicImpl;

//     use crate::utils::testing::{config::set_settlement_config, systems::deploy_system, world::spawn_eternum};

//     #[test]
//     fn config_test_get_next_settlement_coord() {
//         // starting values
//         let mut settlement_config = SettlementConfig {
//             config_id: 0,
//             center: 2147483646,
//             base_distance: 10,
//             min_first_layer_distance: 30,
//             points_placed: 0,
//             current_layer: 1,
//             current_side: 1,
//             current_point_on_side: 0,
//         };
//         let coords = SettlementConfigImpl::get_next_settlement_coord(ref settlement_config);
//         assert(coords.x == 2147483646, 'x coord');
//         assert(coords.y == 2147483671, 'y coord');

//         let coords = SettlementConfigImpl::get_next_settlement_coord(ref settlement_config);
//         assert(coords.x == 2147483623, 'x coord');
//         assert(coords.y == 2147483658, 'y coord');

//         let coords = SettlementConfigImpl::get_next_settlement_coord(ref settlement_config);
//         assert(coords.x == 2147483623, 'x coord');
//         assert(coords.y == 2147483633, 'y coord');
//     }

//     #[test]
//     fn config_test_settle_on_coords_with_structure() {
//         let mut world = spawn_eternum();
//         let config_systems_address = deploy_system(ref world, "config_systems");
//         set_settlement_config(config_systems_address);

//         let structure_coords = Coord { x: 2147483646, y: 2147483671 };

//         let mut structure_count: StructureCount = world.read_model(structure_coords);
//         structure_count.count = 1;

//         world.write_model(@structure_count);

//         // if there's already a structure on the coords, the next settlement should be placed on the next available
//         let coords = InternalRealmLogicImpl::get_new_location(ref world);

//         assert(coords.x == 2147483623, 'x coord');
//         assert(coords.y == 2147483658, 'y coord');
//     }
// }
