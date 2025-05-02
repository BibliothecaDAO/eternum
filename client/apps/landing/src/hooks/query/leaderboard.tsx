// import { graphql } from "../gql";

// export const GET_GAME_WINNER = graphql(`
//   query hasGameEnded {
//     s1EternumGameEndedModels {
//       edges {
//         node {
//           winner_address
//         }
//       }
//     }
//   }
// `);

// export const GET_LEADERBOARD_ENTRY = graphql(`
//   query getLeaderboardEntry($accountAddress: ContractAddress!) {
//     s1EternumLeaderboardEntryModels(where: { address: $accountAddress }) {
//       edges {
//         node {
//           address
//           points
//         }
//       }
//     }
//   }
// `);

// export const GET_LEADERBOARD = graphql(`
//   query getLeaderboard {
//     s1EternumLeaderboardModels {
//       edges {
//         node {
//           total_points
//           registration_end_timestamp
//           total_price_pool {
//             Some
//             option
//           }
//           distribution_started
//         }
//       }
//     }
//   }
// `);

// export const GET_PLAYER_HYPERSTRUCTURE_CONTRIBUTIONS = graphql(`
//   query getHyperstructureContributions($accountAddress: ContractAddress!) {
//     s1EternumContributionModels(where: { player_address: $accountAddress }, limit: 1000) {
//       edges {
//         node {
//           hyperstructure_entity_id
//           amount
//         }
//       }
//     }
//   }
// `);

// export const GET_HYPERSTRUCTURE_EPOCHS = graphql(`
//   query getEpochs {
//     s1EternumEpochModels(limit: 1000) {
//       edges {
//         node {
//           owners {
//             _0
//             _1
//           }
//           start_timestamp
//           hyperstructure_entity_id
//           index
//         }
//       }
//     }
//   }
// `);
