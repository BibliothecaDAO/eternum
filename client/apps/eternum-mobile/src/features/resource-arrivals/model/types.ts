import { ResourceArrivalInfo } from "@bibliothecadao/types";

export interface ResourceArrivalsState {
  structureEntityId: string | null;
  arrivals: ResourceArrivalInfo[];
  isLoading: boolean;
}

export interface ResourceArrivalSummary {
  readyArrivals: number;
  pendingArrivals: number;
  totalResources: number;
}

export interface ClaimResourcesParams {
  structureId: string;
  day: bigint;
  slot: bigint;
  resourceCount: number;
}
