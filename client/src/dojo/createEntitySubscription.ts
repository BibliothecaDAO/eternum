import { GraphQLClient, gql } from "graphql-request";
import { createClient } from "graphql-ws";
import { Components  } from "@latticexyz/recs";
import { Entity, setComponentFromEntity } from "../utils/utils";
import { BehaviorSubject, Observable, distinctUntilChanged } from "rxjs"; 

type EntityUpdated = {
  id: string;
  keys: string[];
  componentNames: string;
}

type EntityQuery = {
  entity: Entity;
};

type UpdatedEntity = {
  entityKeys: string[];
  componentNames: string[];
}


export function createEntitySubscription(contractComponents: Components): Observable<UpdatedEntity> {

    const wsClient = createClient({ url: "ws://localhost:8080/ws" });
    const client = new GraphQLClient(import.meta.env.VITE_TORII_URL!);

    // TODO: add an initial query to show latest 10 things that happened? 
    const lastUpdate$ = new BehaviorSubject({entityKeys: ["0x0"], componentNames: ["nothing"]});
    const distinctUpdate$ = lastUpdate$.pipe(distinctUntilChanged());

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
              let componentQueries = "";
              for (const componentName of componentNames) {
                const component = contractComponents[componentName];
                componentQueries += `... on ${componentName} { ${Object.keys(component.values).join(",")} } `;
              }
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
                entity.entity.components.forEach((component: Entity) => {
                  setComponentFromEntity(component, component.__typename!, contractComponents);
                });
                lastUpdate$.next({entityKeys: entityUpdated.keys, componentNames});
                });
            
            } catch (error) {
              console.log({ error })
            }
          },
          error: (error) => console.log({ error }),
          complete: () => console.log("complete"),
        },
      );
      return distinctUpdate$;
}