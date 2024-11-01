import { graphql } from "../gql";

export const GET_USERS = graphql(`
  query totalPlayers {
    eternumOwnerModels {
      totalCount
    }
  }
`);
