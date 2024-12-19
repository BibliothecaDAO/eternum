import { graphql } from "../gql";

export const GET_ENTITY_DISTANCE = graphql(`
  query getEntityPosition($fromEntityId: u32!, $toEntityId: u32!) {
    s0EternumPositionModels(where: { entity_idIN: [$fromEntityId, $toEntityId] }) {
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
