import { useMemo, useState } from "react";
import { GraphQLClient } from "graphql-request";
import { useDojo } from "../../DojoContext";
import { setComponentFromEntity } from "../../utils/utils";
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
    edges: {
      cursor: string;
      node: {
        entity: Entity;
      };
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

export const useSyncWorld = (): { loading: boolean } => {
  // Added async since await is used inside
  const {
    setup: { components },
  } = useDojo();

  const [loading, setLoading] = useState(true);

  useMemo(() => {
    const syncData = async () => {
      try {
        for (const componentName of Object.keys(components)) {
          let shouldContinue = true; // Renamed from continue to avoid reserved keyword
          let component = (components as Components)[componentName];
          let fields = Object.keys(component.schema).join(",");
          let cursor: string | undefined;
          while (shouldContinue) {
            // TODO: the first: 300 is only temp fix for now, need to do better pagination with new 0.3 features
            const queryBuilder = `
              query SyncWorld {
                entities: ${componentName.toLowerCase()}Models(${cursor ? `after: "${cursor}"` : ""} first: ${OFFSET}) {
                  edges {
                    cursor
                    node {
                      entity {
                        keys
                        id
                        models {
                          ... on ${componentName} {
                            __typename
                            ${fields}
                          }
                        }
                      }
                    }
                  }
                }
              }`;

            const { entities }: getEntitiesQuery = await client.request(queryBuilder); // Assumed queryBuilder should be passed here
            if (entities.edges.length === OFFSET) {
              cursor = entities.edges[entities.edges.length - 1].cursor;
            } else {
              shouldContinue = false;
            }

            entities.edges.forEach((edge) => {
              setComponentFromEntity(edge.node.entity, componentName, components);
            });
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
  };
};
