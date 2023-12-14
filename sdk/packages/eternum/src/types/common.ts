/// COMBAT
export enum Winner {
  Attacker = "Attacker",
  Target = "Target",
}

export interface CombatResultInterface {
  attackerRealmEntityId: number;
  targetRealmEntityId: number;
  attackingEntityIds: number[];
  winner: Winner;
  stolenResources: Resource[];
  damage: number;
  attackTimestamp: number;
}

export interface CombatInfo {
  entityId: number;
  health: number;
  quantity: number;
  attack: number;
  defence: number;
  sec_per_km: number;
  blocked?: boolean | undefined;
  capacity?: number | undefined;
  arrivalTime?: number | undefined;
  position?: Position | undefined;
  homePosition?: Position | undefined;
  entityOwnerId?: number | undefined;
  locationRealmEntityId?: number | undefined;
  originRealmId?: number | undefined;
  hyperstructureId: number | undefined;
}

/// TRADING
export interface MarketInterface {
  tradeId: number;
  makerId: number;
  takerId: number;
  // brillance, reflection, ...
  makerOrder: number;
  expiresAt: number;
  resourcesGet: Resource[];
  resourcesGive: Resource[];
  canAccept?: boolean;
  ratio: number;
  distance: number;
  hasRoad: boolean | undefined;
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

/// RESOURCES
export interface Resources {
  trait: string;
  value: number;
  colour: string;
  colourClass: string;
  id: number;
  description: string;
  img: string;
}

export interface Resource {
  resourceId: number;
  amount: number;
}

/// TRAVEL

export interface RoadInterface {
  startRealmName: string;
  startRealmOrder: number | undefined;
  destinationEntityId: number;
  destinationRealmName: string;
  destinationRealmOrder: number | undefined;
  usageLeft: number;
}

export interface CaravanInterface {
  caravanId: number;
  resourcesChestId: number | undefined;
  blocked: boolean | undefined;
  arrivalTime: number | undefined;
  pickupArrivalTime: number | undefined;
  capacity: number | undefined;
  destination: Position | undefined;
  owner: string | undefined;
  isMine: boolean;
}

/// REALMS
export interface SelectableRealmInterface {
  entityId: number;
  realmId: bigint;
  name: string;
  order: string;
  distance: number;
  defence?: CombatInfo;
  level?: number;
}

export interface RealmInterface {
  realmId: bigint;
  name: string;
  cities: number;
  rivers: number;
  wonder: number;
  harbors: number;
  regions: number;
  resourceTypesCount: number;
  resourceTypesPacked: number;
  order: number;
  position: Position;
  owner?: string;
}

/// LABOR

/// BANK
export interface AuctionInterface {
  start_time: number;
  per_time_unit: number;
  sold: number;
  price_update_interval: number;
}

export interface BankStaticInterface {
  name: string;
  uiPosition: UIPosition;
  position: Position;
  distance: number | undefined;
}

export interface BankInterface {
  name: string;
  wheatPrice: number;
  fishPrice: number;
  bankId: number;
  uiPosition: UIPosition;
  position: Position;
  wheatAuction: AuctionInterface | undefined;
  fishAuction: AuctionInterface | undefined;
  distance: number | undefined;
}

/// POSITION
export interface Position {
  x: number;
  y: number;
}

export interface UIPosition {
  x: number;
  y: number;
  z: number;
}

/// HYPESTRUCTURE
export interface HyperStructureInterface {
  hyperstructureId: number;
  orderId: number;
  progress: number;
  hyperstructureResources: {
    resourceId: number;
    currentAmount: number;
    completeAmount: number;
  }[];
  completed: boolean;
  position: Position;
  uiPosition: UIPosition;
  level: number;
}
