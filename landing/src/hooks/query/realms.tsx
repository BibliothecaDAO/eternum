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

export const GET_REALM_MINTS = graphql(`
  query getRealmMints {
    ercTransfer(accountAddress: "0x0", limit: 8000) {
      tokenMetadata {
        tokenId
        contractAddress
      }
    }
  }
`);
