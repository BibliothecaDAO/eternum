import { graphql } from "../gql";

export const GET_ENTITY_DISTANCE = graphql(`
  query getEntityPosition($entityIds: [u32!]!) {
    s0EternumPositionModels(where: { entity_idIN: $entityIds }) {
      edges {
        node {
          x
          y
          entity_id
          entity {
            __typename
          }
        }
      }
    }
  }
`);
