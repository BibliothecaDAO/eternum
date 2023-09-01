import { GraphQLClient, gql } from "graphql-request";
import { createClient } from "graphql-ws";
import { Components } from "@latticexyz/recs";
import { setComponentFromEntity } from "../utils/utils";
import { BehaviorSubject, Observable, distinctUntilChanged } from "rxjs";

// DISCUSS: what is best number?
// const MAX_ENTITIES = 100;

type EntityUpdated = {
  id: string;
  keys: string[];
  componentNames: string;
};

type EntityQuery = {
  entity: Entity;
};

type Entity = {
  __typename?: "Entity";
  keys?: (string | null)[] | null | undefined;
  components?: any | null[];
};

type UpdatedEntity = {
  entityKeys: (string | null)[] | null | undefined;
  componentNames: string[];
};

// type GetLatestEntitiesQuery = {
//   entities: {
//     edges: {
//       node: Entity & { componentNames: string };
//     }[];
//   };
// };

export async function createEntitySubscription(
  contractComponents: Components,
): Promise<Observable<UpdatedEntity[]>> {
  const wsClient = createClient({ url: import.meta.env.VITE_TORII_WS });
  const client = new GraphQLClient(import.meta.env.VITE_TORII_URL!);

  /**
   * DISCUSS: good way to have initial data?
   * Current issue is => you can get latest trade entities but you won't have necessarily the OrderResources entities synced, so it looks like the resources are missing
   */

  // const componentNames = Object.keys(contractComponents);

  // const componentQueries = createComponentQueries(
  //   contractComponents,
  //   componentNames,
  // );

  // const rawIntitialData: GetLatestEntitiesQuery = await client.request(gql`
  //     query latestEntities {
  //       entities(first: ${MAX_ENTITIES}) {
  //         edges {
  //           node {
  //             __typename
  //             keys
  //             componentNames
  //             components {
  //               __typename
  //               ${componentQueries}
  //             }
  //           }
  //         }
  //       }
  //     }
  //   `);

  // const initialData = rawIntitialData.entities.edges
  //   .map((edge) => {
  //     let componentNames = edge.node.componentNames.split(",");
  //     for (const component of componentNames) {
  //       setComponentFromEntity(
  //         edge.node.components,
  //         component,
  //         contractComponents,
  //       );
  //     }
  //     if (isEntityUpdate(componentNames)) {
  //       return {
  //         entityKeys: edge.node.keys,
  //         componentNames: edge.node.componentNames.split(","),
  //       };
  //     }
  //   })
  //   .filter(Boolean) as UpdatedEntity[];

  // const lastUpdate$ = new BehaviorSubject<UpdatedEntity[]>(initialData);
  const lastUpdate$ = new BehaviorSubject<UpdatedEntity[]>([]);
  // only allow for distinct updates
  // const distinctUpdate$ = lastUpdate$.pipe(distinctUntilChanged());

  wsClient.subscribe(
    {
      query: gql`
        subscription {
          entityUpdated {
            id
            keys
            componentNames
          }
        }
      `,
    },
    {
      next: ({ data }) => {
        try {
          const entityUpdated = data?.entityUpdated as EntityUpdated;
          const componentNames = entityUpdated.componentNames.split(",");
          // make query to fetch component values (temporary, will be fixed soon in torii)
          const componentQueries = createComponentQueries(
            contractComponents,
            componentNames,
          );
          const query = gql`
                query {
                  entity(id: "${entityUpdated.id}") {
                    id
                    keys
                    __typename
                    components {
                    __typename
                    ${componentQueries}
                    }
                  }
                }
              `;
          client.request(query).then((data) => {
            let entity = data as EntityQuery;
            componentNames.forEach((componentName: string) => {
              setComponentFromEntity(
                entity.entity,
                componentName,
                contractComponents,
              );
            });
            // get last 10 updates
            const previousUpdate = lastUpdate$.getValue().slice(0, 15);
            if (isEntityUpdate(componentNames)) {
              lastUpdate$.next([
                { entityKeys: entity.entity.keys as string[], componentNames },
                ...previousUpdate,
              ]);
              // lastUpdate$.next({
              //   entityKeys: entity.entity.keys as string[],
              //   componentNames,
              // });
            }
          });
        } catch (error) {
          console.log({ error });
        }
      },
      error: (error) => console.log({ error }),
      complete: () => console.log("complete"),
    },
  );
  return lastUpdate$;
}

/**
 * Creates a graphql query for a list of components
 *
 * @param components
 * @param componentNames
 * @returns
 */
const createComponentQueries = (
  components: Components,
  componentNames: string[],
): string => {
  let componentQueries = "";
  for (const componentName of componentNames) {
    const component = components[componentName];
    componentQueries += `... on ${componentName} { ${Object.keys(
      component.values,
    ).join(",")} } `;
  }

  return componentQueries;
};

/**
 * Checks if an entity update is relevant for the UI
 *
 * @param componentNames
 * @returns
 */

const isEntityUpdate = (componentNames: string[]) => {
  // create realm
  if (
    ["Realm", "Owner", "MetaData", "Position"].every((element) =>
      componentNames.includes(element),
    )
  )
    return true;
  // create resource
  else if (componentNames.length === 1 && componentNames[0] === "Resource")
    return true;
  else if (
    ["Trade", "Status"].every((element) => componentNames.includes(element))
  )
    return true;
  else return false;
};
