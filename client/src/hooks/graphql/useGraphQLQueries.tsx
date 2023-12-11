import { useMemo, useState } from "react";
import { GraphQLClient } from "graphql-request";
import { useDojo } from "../../DojoContext";
import { setComponentsFromEntity } from "../../utils/utils";
import { Components } from "@latticexyz/recs";

const client = new GraphQLClient(import.meta.env.VITE_TORII_URL!);

type Entity = {
  __typename?: "Entity";
  keys?: string | null | undefined;
  models?: any | null[];
};

type getEntitiesQuery = {
  entities: {
    total_count: number;
    edges: {
      cursor: string;
      node: Entity;
    }[];
  };
};

const OFFSET = 100;

export const useSyncWorld = (): { loading: boolean; progress: number } => {
  // Added async since await is used inside
  const {
    setup: { components },
  } = useDojo();

  const component_interval = Object.keys(components).length;

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useMemo((): any => {
    const syncData = async () => {
      try {
        let componentNames = Object.keys(components);
        for (let i = 0; i < componentNames.length; i += component_interval) {
          let loops = 0;
          if (componentNames.slice(i, i + component_interval).length === 0) {
            break;
          }
          let modelsQueryBuilder = "";
          for (const componentName of componentNames.slice(i, i + component_interval)) {
            let component = (components as Components)[componentName];
            let fields = Object.keys(component.schema).join(",");
            modelsQueryBuilder += `... on ${componentName} {
              __typename
              ${fields}
            }`;
          }
          let shouldContinue = true;

          let cursor: string | undefined;
          while (shouldContinue) {
            const queryBuilder = `
              query SyncWorld {
                entities: entities(keys:["*"] ${cursor ? `after: "${cursor}"` : ""} first: ${OFFSET}) {
                  total_count
                  edges {
                    cursor
                    node {
                      keys
                      id
                      models {
                        ${modelsQueryBuilder}
                      }
                    }
                  }
                }
              }`;

            const { entities }: getEntitiesQuery = await client.request(queryBuilder);

            // Update the progress
            const processedCount = OFFSET * loops; // OFFSET multiplied by how many loops so far
            const newProgress = Math.min((processedCount / entities.total_count) * 100, 100); // Convert it to percentage
            setProgress(newProgress);

            if (entities.edges.length < OFFSET) {
              shouldContinue = false;
            } else {
              cursor = entities.edges[entities.edges.length - 1].cursor;
            }

            entities.edges.forEach((edge) => {
              setComponentsFromEntity(edge.node, components);
            });

            loops += 1;
          }
        }
      } catch (error) {
        console.log({ syncError: error });
      } finally {
        setLoading(false);
      }
    };
    syncData();
  }, []);

  return {
    loading,
    progress,
  };
};

export const fetchAddressName = async (address: string): Promise<string | undefined> => {
  const queryBuilder = `
      query addressName {
        entities(keys: ["${address}"]) {
          edges {
            node {
              models {
                ... on AddressName {
                  __typename
                  name
                }
              }
            }
          }
        }
      }`;

  const { entities }: getEntitiesQuery = await client.request(queryBuilder);

  if (entities.edges.length === 1) {
    return entities.edges[0].node.models.find((model: any) => model.__typename === "AddressName")?.name;
  }
};
