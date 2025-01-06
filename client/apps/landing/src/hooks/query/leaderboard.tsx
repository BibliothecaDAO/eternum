import { graphql } from "../gql";

export const GET_GAME_WINNER = graphql(`
  query hasGameEnded {
    s0EternumGameEndedModels {
      edges {
        node {
          winner_address
        }
      }
    }
  }
`);

export const GET_PLAYER_HAS_REGISTRED = graphql(`
  query hasPlayerRegistered($accountAddress: ContractAddress!) {
    s0EternumOwnerModels(where: { address: $accountAddress }) {
      totalCount
    }
  }
`);

export const GET_PLAYER_HAS_CLAIMED = graphql(`
  query hasPlayerClaimed($accountAddress: ContractAddress!) {
    s0EternumLeaderboardRewardClaimedModels(where: { address: $accountAddress }) {
      totalCount
    }
  }
`);

export const GET_LEADERBOARD_ENTRY = graphql(`
  query getLeaderboardEntry($accountAddress: ContractAddress!) {
    s0EternumLeaderboardEntryModels(where: { address: $accountAddress }) {
      edges {
        node {
          address
          points
        }
      }
    }
  }
`);

export const GET_LEADERBOARD = graphql(`
  query getLeaderboard {
    s0EternumLeaderboardModels {
      edges {
        node {
          total_points
          registration_end_timestamp
          total_price_pool {
            Some
            option
          }
          distribution_started
        }
      }
    }
  }
`);

export const GET_PLAYER_HYPERSTRUCTURE_CONTRIBUTIONS = graphql(`
  query getHyperstructureContributions($accountAddress: ContractAddress!) {
    s0EternumContributionModels(where: { player_address: $accountAddress }, limit: 1000) {
      edges {
        node {
          hyperstructure_entity_id
          amount
        }
      }
    }
  }
`);

export const GET_HYPERSTRUCTURE_EPOCHS = graphql(`
  query getEpochs {
    s0EternumEpochModels(limit: 1000) {
      edges {
        node {
          owners {
            _0
            _1
          }
          start_timestamp
          hyperstructure_entity_id
          index
        }
      }
    }
  }
`);
