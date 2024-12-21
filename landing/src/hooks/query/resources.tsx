import { graphql } from "../gql";

export const GET_ENTITIES_RESOURCES = graphql(`
  query getEntitiesResources($entityIds: [u32!]!) {
    s0EternumResourceModels(
      where: { 
        entity_idIN: $entityIds
      }
      limit: 100
    ) {
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
