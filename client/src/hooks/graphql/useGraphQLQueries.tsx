import { useMemo, useState } from "react";
import { GraphQLClient } from "graphql-request";
import { useDojo } from "../../DojoContext";
import { setComponentsFromEntity } from "../../utils/utils";
import { Components } from "@latticexyz/recs";

export enum FetchStatus {
  Idle = "idle",
  Loading = "loading",
  Success = "success",
  Error = "error",
}

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

export interface PositionInterface {
  x: number;
  y: number;
}

export interface MyOfferInterface {
  tradeId: string;
  makerOrderId: string;
  takerOrderId: string;
  expiresAt: number;
  status: string;
}

export interface CounterPartyOrderIdInterface {
  counterpartyOrderId: number;
}

export interface RealmInterface {
  realmId: number;
  cities: number;
  rivers: number;
  wonder: number;
  harbors: number;
  regions: number;
  resource_types_count: number;
  resource_types_packed: number;
  order: number;
  position: PositionInterface;
  owner: string;
}

export interface RealmLaborInterface {
  [resourceId: number]: LaborInterface;
}

export interface LaborInterface {
  lastHarvest: number;
  balance: number;
  multiplier: number;
}
export interface IncomingOrderInterface {
  tradeId: number;
  orderId?: number | undefined;
  counterPartyOrderId: number | undefined;
  claimed: boolean | undefined;
  arrivalTime: number | undefined;
  origin: PositionInterface | undefined;
  position: PositionInterface | undefined;
}

export interface IncomingOrdersInterface {
  incomingOrders: IncomingOrderInterface[];
}

export interface CaravanInterface {
  caravanId: number;
  orderId: number | undefined;
  blocked: boolean | undefined;
  arrivalTime: number | undefined;
  capacity: number | undefined;
  destination: PositionInterface | undefined;
  owner: string | undefined;
  isMine: boolean;
}

export interface ResourceInterface {
  resourceId: number;
  amount: number;
}

const OFFSET = 100;
const COMPONENT_INTERVAL = 37;

export const useSyncWorld = (): { loading: boolean; progress: number } => {
  // Added async since await is used inside
  const {
    setup: { components },
  } = useDojo();

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useMemo((): any => {
    const syncData = async () => {
      try {
        let componentNames = Object.keys(components);
        for (let i = 0; i < componentNames.length; i += COMPONENT_INTERVAL) {
          let loops = 0;
          if (componentNames.slice(i, i + COMPONENT_INTERVAL).length === 0) {
            break;
          }
          let modelsQueryBuilder = "";
          for (const componentName of componentNames.slice(i, i + COMPONENT_INTERVAL)) {
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
                entities: entities(keys:["%"] ${cursor ? `after: "${cursor}"` : ""} first: ${OFFSET}) {
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
