export enum Entity {
  Realm = "Realm",
  Army = "Army",
}

export interface Realm {
  realm_id: number;
  name: string;
  resource_types_packed: number;
  resource_types_count: number;
  cities: number;
  harbors: number;
  rivers: number;
  regions: number;
  wonder: number;
  order: number;
}

export interface LaborConfig {
  base_labor_units: number;
  base_resources_per_cycle: number;
  base_food_per_cycle: number;
}

export interface Labor {
  balance: number;
  last_harvest: number;
  multiplier: number;
}

export interface CaravanMember {
  capacity: Capacity;
  quantity: Quantity;
}

export interface Quantity {
  value: number;
}

export interface Capacity {
  weight_gram: number;
}

export interface Trade {
  maker_id: number;
  taker_id: number;
  maker_order_id: number;
  taker_order_id: number;
  expires_at: number;
  claimed_by_maker: boolean;
  claimed_by_taker: boolean;
  taker_needs_caravan: boolean;
}

export interface Resource {
  resourceId: number;
  amount: number;
}

export interface Order {
  entityId: number;
  arrivalTime: number;
  position: Position;
  resourcesGive: ResourcesOffer[];
  resourcesGet: ResourcesOffer[];
}

export interface ResourcesOffer {
  resourceId: number;
  amount: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface UIPosition {
  x: number;
  y: number;
  z: number;
}

export interface EntityData {
  entityId: number;
  entityType: Entity;
}

export interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: any;
}
