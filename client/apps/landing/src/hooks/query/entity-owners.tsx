import { graphql } from "../gql";

export const GET_ETERNUM_ENTITY_OWNERS = graphql(`
  query getEternumEntityOwner($entityOwnerIds: [u32!]!) {
    s1EternumEntityOwnerModels(where: { entity_owner_idIN: $entityOwnerIds }, limit: 10000) {
      edges {
        node {
          entity_id
          entity_owner_id
          entity {
            models {
              __typename
              ... on s1_eternum_OwnedResourcesTracker {
                resource_types
              }
              ... on s1_eternum_Position {
                x
                y
              }
              ... on s1_eternum_ArrivalTime {
                arrives_at
              }
              ... on s1_eternum_Weight {
                value
              }
            }
          }
        }
      }
    }
  }
`);
