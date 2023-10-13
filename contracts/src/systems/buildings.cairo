// TODO for a later milestone
// #[dojo::contract]
// mod BuildBuilding {
//     use array::ArrayTrait;
//     use traits::Into;

//     use eternum::models::config::WorldConfig;
//     use eternum::models::realm::Realm;
//     use eternum::models::tick::Tick;
//     use eternum::models::resources::Resource;
//     use eternum::models::buildings::Building;

//     use eternum::constants::Resources;
//     use eternum::constants::BuildingTypes;
//     use eternum::constants::BUILDING_CONFIG_ID;

//     use eternum::utils::math::u128_div_remainder;
//     use eternum::utils::math::get_percentage_by_bp;

//     use eternum::alias::ID;

//     use dojo::world::Context;

//     #[external]
//     fn execute(ctx: Context, realm_id: u128, building_type: felt252, quantity: felt252) {
//         let player_id: felt252 = starknet::get_caller_address().into();
//         let realm: Realm = get!(ctx.world, realm_id.into(), Realm);

//         // TODO: use Owner component
//         assert(realm.owner == player_id, 'Realm does not belong to player');

//         // Get Config
//         let building_config: BuildingConfig = get !(ctx.world,
//             BUILDING_CONFIG_ID.into(), BuildingConfig
//         );
//         // check if player can build building
//         let can_build_ = can_build(building_id, quantity, realm.regions, realm.cities);
//         assert(can_build_, 'Player cannot build building');
//         // get current building quantity for that building type
//         // TODO: what if not found?
//         let building = get !(ctx.world, (realm_id, (building_type)).into(), Building);

//         // build building and set state
//         set !(
//             ctx.world,
//             (realm_id, (building_type)).into(),
//             Building {
//                 quantity: building.quantity + quantity,
//                 building_type,
//                 population: building.population,
//                 integrity: building.integrity,
//             }
//         );

//         // get resource ids of realm
//         let resource_types = Array::<u8>::new();
//         let resource_costs = Array::<felt252>::new();
//         unpack_resource_types(
//             realm.resource_types_packed, resource_types, realm.resource_types_count, 0
//         );

//         let building_cost_resource_types = Array::<u8>::new();

//         // else get building cost
//         // if building is a house, it's a fixed cost
//         if building_type == BuildingTypes.HOUSE {
//             get_workhut_costs(resource_types, resource_costs, quantity);
//         } else {
//             get_building_costs(building_type, resource_types, resource_costs, quantity);
//         }
//     // decrease only resources that are on the realm ?
//     // for (resource_type, i) in resource_types {
//     //     let (resources) = commands::<Resource>::entities((realm_id, (resource_type)).into());

//     //     set !(
//     //         ctx.world,
//     //         (realm_id, (resource_type)).into(),
//     //         Resource {
//     //             quantity: resources.quantity - resource_costs[i],
//     //         }
//     //     );
//     // }
//     }

//     fn can_build(building_id: felt252, quantity: felt252, regions: felt252, cities: felt252) {
//         let (total_buildable_area) = get_realm_buildable_area(cities, regions);
//         let (built_area) = get_realm_built_area(regions, cities);
//         let buildable_area = total_buildable_area - built_area;
//         if (buildable_units < quantity) {
//             return false;
//         } else {
//             return true;
//         }
//     }

//     fn get_realm_buildable_area(
//         cities: felt252, regions: felt252, build_config: BuildConfig
//     ) -> (felt252) {
//         let quotient = regions / 2_felt252;
//         return (cities * quotient + build_config.base_sqm);
//     }

//     fn get_realm_built_area(build_config: BuildConfig) -> (felt252) {
//         let buildings = commands::<Building>::entities(realm_id.into());

//         let built_area = 0_felt252;
//         // TODO: when for loop is implemented
//         // for building in buildings {
//         //     built_area += building.sqm;
//         // }

//         return (built_area);
//     }

//     fn get_workhut_costs(
//         resource_costs: Array<felt252>, resource_types: Array<u8>, quantity: felt252
//     ) {
//         let building_config: BuildingConfig = get !(ctx.world,
//             BUILDING_CONFIG_ID.into(), BuildingConfig
//         );
//         let realm: Realm = get !(ctx.world, realm_id.into(), Realm);

//         let workhut_cost = (building_config.workhut_cost * 10 * *18) * quantity;
//         // // TODO: do recursion?
//         // for resource_type in resource_types {
//         //     resource_cost.append(workhut_cost); 
//         // }

//         return (realm.resource_types, resource_cost);
//     }

//     fn get_building_costs(
//         building_id: felt252,
//         resource_costs: Array<felt252>,
//         resource_types: Array<u8>,
//         quantity: felt252
//     ) {
//         let building_config: BuildingConfig = get !(ctx.world,
//             BUILDING_CONFIG_ID.into(), BuildingConfig
//         );

//         // get list of resource ids needed for that building id
//         let resource_types_packed = building_config.resource_types_packed;
//         let resource_types_count = building_config.resource_types_count;
//         unpack_resource_types(resource_types_packed, resource_types, resource_types_count, 0)

//         // // TODO: do recursion?
//         // for resource_type in resource_types {
//         //     let cost = building_config.costs[building_id, resource_type] * quantity;
//         //     resource_costs.append(cost);
//         // }

//         return ();
//     }

//     fn unpack_data(data: felt252, index: Array<u8>, mask_size: u8) -> u8 {
//         let (power) = 2 * *index;
//         let mask = mask_size * power;

//         // 2. Apply mask using bitwise operation: mask AND data.
//         let (masked) = bitwise_and(mask, data);

//         // 3. Shift element right by dividing by the order of the mask.
//         let result = masked / power;

//         return result;
//     }
// }

