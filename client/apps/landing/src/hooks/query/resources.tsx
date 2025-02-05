import { graphql } from "../gql";

export const GET_ENTITIES_RESOURCES = graphql(`
  query getEntitiesResources($entityIds: [u32!]!) {
    s1EternumResourceModels(where: { entity_idIN: $entityIds }, limit: 8000) {
      edges {
        node {
          entity_id
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
