// import { graphql } from "../gql";

// export const GET_ENTITIES_RESOURCES = graphql(`
//   query getEntitiesResources($entityIds: [u32!]!) {
//     s1EternumResourceModels(where: { entity_idIN: $entityIds }, limit: 8000) {
//       edges {
//         node {
//           entity_id
//           STONE_BALANCE
//           COAL_BALANCE
//           WOOD_BALANCE
//           COPPER_BALANCE
//           IRONWOOD_BALANCE
//           OBSIDIAN_BALANCE
//           GOLD_BALANCE
//           SILVER_BALANCE
//           MITHRAL_BALANCE
//           ALCHEMICAL_SILVER_BALANCE
//           COLD_IRON_BALANCE
//           DEEP_CRYSTAL_BALANCE
//           RUBY_BALANCE
//           DIAMONDS_BALANCE
//           HARTWOOD_BALANCE
//           IGNIUM_BALANCE
//           TWILIGHT_QUARTZ_BALANCE
//           TRUE_ICE_BALANCE
//           ADAMANTINE_BALANCE
//           SAPPHIRE_BALANCE
//           ETHEREAL_SILICA_BALANCE
//           DRAGONHIDE_BALANCE
//           LABOR_BALANCE
//           EARTHEN_SHARD_BALANCE
//           DONKEY_BALANCE
//           KNIGHT_T1_BALANCE
//           KNIGHT_T2_BALANCE
//           KNIGHT_T3_BALANCE
//           CROSSBOWMAN_T1_BALANCE
//           CROSSBOWMAN_T2_BALANCE
//           CROSSBOWMAN_T3_BALANCE
//           PALADIN_T1_BALANCE
//           PALADIN_T2_BALANCE
//           PALADIN_T3_BALANCE
//           WHEAT_BALANCE
//           FISH_BALANCE
//           LORDS_BALANCE
//           STONE_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           COAL_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           WOOD_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           COPPER_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           IRONWOOD_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           OBSIDIAN_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           GOLD_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           SILVER_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           MITHRAL_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           ALCHEMICAL_SILVER_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           COLD_IRON_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           DEEP_CRYSTAL_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           RUBY_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           DIAMONDS_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           HARTWOOD_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           IGNIUM_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           TWILIGHT_QUARTZ_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           TRUE_ICE_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           ADAMANTINE_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           SAPPHIRE_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           ETHEREAL_SILICA_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           DRAGONHIDE_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           LABOR_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           EARTHEN_SHARD_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           DONKEY_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           KNIGHT_T1_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           KNIGHT_T2_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           KNIGHT_T3_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           CROSSBOWMAN_T1_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           CROSSBOWMAN_T2_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           CROSSBOWMAN_T3_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           PALADIN_T1_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           PALADIN_T2_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           PALADIN_T3_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           WHEAT_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           FISH_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//           LORDS_PRODUCTION {
//             building_count
//             production_rate
//             output_amount_left
//             last_updated_at
//           }
//         }
//       }
//     }
//   }
// `);
