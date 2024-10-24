import { graphql } from "../gql";

export const GET_REALMS = graphql(`
  query getRealms($accountAddress: String!) {
    ercBalance(accountAddress: $accountAddress) {
      balance
      type
      tokenMetadata {
        tokenId
        contractAddress
      }
    }
  }
`);
