import { graphql } from "../gql";

export const GET_USERS = graphql(`
  query totalPlayers {
    eternumOwnerModels {
      totalCount
    }
  }
`);

export const GET_USER_REALMS = graphql(`
  query userRealms($address: String!) {
    eternumOwnerModels(where: { owner: $address }) {
      realm
    }
  }
`);
