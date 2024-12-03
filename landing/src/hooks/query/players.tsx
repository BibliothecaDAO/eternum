import { graphql } from "../gql";

/* Not currently in World Contract*/
export const GET_USERS = graphql(`
  query totalPlayers {
    eternumOwnerModels {
      totalCount
    }
  }
`);
