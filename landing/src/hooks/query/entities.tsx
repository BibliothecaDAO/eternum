import { graphql } from "../gql";

export const GET_ETERNUM_OWNER_REALM_IDS = graphql(`
  query getEternumOwnerRealmIds($accountAddress: ContractAddress!) {
    s0EternumOwnerModels(where: { address: $accountAddress }) {
      edges {
        node {
          address
          entity_id
          entity {
            models {
            __typename
              ... on s0_eternum_Realm {
                realm_id
              }
            }
          }
        }
      }
    }
  }
`);
