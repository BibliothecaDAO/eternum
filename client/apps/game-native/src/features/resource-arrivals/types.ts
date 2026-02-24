export interface ResourceArrival {
  entityId: number;
  arrivesAt: number; // Unix timestamp seconds
  resources: {resourceId: number; amount: number}[];
}

export interface ResourceArrivalSummary {
  readyArrivals: number;
  pendingArrivals: number;
  totalResources: number;
}
