import { graphql } from "../gql";
 
export const GET_CAPACITY_SPEED_CONFIG = graphql(`
  query getCapacitySpeedConfig($category: Enum!, $entityType: u32!) {
    s0EternumCapacityConfigModels(where: {category: $category }) {
        edges{
          node {
           weight_gram
          }
        }
      }
      s0EternumSpeedConfigModels(where: {entity_type: $entityType }) {
        edges{
          node {
           sec_per_km
          }
        }
      }
  }
`);
