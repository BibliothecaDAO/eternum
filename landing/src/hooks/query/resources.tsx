import { graphql } from "../gql";

export const GET_ENTITY_RESOURCES = graphql(`
  query getEntityResources($entityId: u32!) {
    s0EternumResourceModels(where: { entity_id: $entityId }) {
      edges {
        node {
          resource_type
          balance
          entity {
            __typename
          }
        }
      }
    }
  }
`);
