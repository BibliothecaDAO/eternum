export enum Winner {
  Attacker = "Attacker",
  Target = "Target",
}

export enum TickIds {
  Default,
  Armies,
}

export enum DestinationType {
  Home,
  Hyperstructure,
  Realm,
  Bank,
}

export enum EntityType {
  DONKEY,
  TROOP,
  UNKNOWN,
}

export enum BattleSide {
  None,
  Attack,
  Defence,
}

export interface CombatResultInterface {
  attackerRealmEntityId: bigint;
  targetRealmEntityId: bigint;
  attackingEntityIds: bigint[];
  winner: Winner;
  stolenResources: Resource[];
  damage: number;
  attackTimestamp: number;
  stolenChestsIds: bigint[];
}

export interface CombatInfo {
  entityId: bigint;
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
  entityOwnerId?: bigint | undefined;
  owner?: bigint | undefined;
  locationEntityId?: bigint | undefined;
  locationType?: DestinationType;
  originRealmId?: bigint | undefined;
  order: number;
  troops: {
    knightCount: number;
    paladinCount: number;
    crossbowmanCount: number;
  };
  battleId: bigint;
  battleSide: number;
}

/// TRADING
export interface MarketInterface {
  tradeId: bigint;
  makerId: bigint;
  takerId: bigint;
  // brillance, reflection, ...
  makerOrder: number;
  expiresAt: number;
  takerGets: Resource[];
  makerGets: Resource[];
  ratio: number;
  perLords: number;
}

export interface Trade {
  maker_id: bigint;
  taker_id: bigint;
  maker_order_id: bigint;
  taker_order_id: bigint;
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
  id: number;
  description: string;
  img: string;
  ticker: string;
}

export interface Resource {
  resourceId: number;
  amount: number;
}

/// TRAVEL

export interface RoadInterface {
  startRealmName: string;
  startRealmOrder: number | undefined;
  destinationEntityId: bigint;
  destinationRealmName: string;
  destinationRealmOrder: number | undefined;
  usageLeft: number;
}

export interface EntityInterface {
  entityId: bigint;
  blocked: boolean | undefined;
  arrivalTime: number | undefined;
  capacity: number | undefined;
  intermediateDestination: Position | undefined;
  owner: bigint | undefined;
  isMine: boolean;
  isRoundTrip: boolean;
  position: Position | undefined;
  homePosition: Position | undefined;
  resources: Resource[];
  entityType: EntityType;
}

/// REALMS
export interface SelectableRealmInterface {
  entityId: bigint;
  realmId: bigint;
  name: string;
  order: string;
  distance: number;
  defence?: CombatInfo;
  level?: number;
  addressName: string;
}

export interface SelectableLocationInterface {
  entityId: bigint;
  home: boolean;
  realmId: bigint;
  name: string;
  order: string;
  distance: number;
  defence?: CombatInfo;
  level?: number;
  addressName: string;
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
  resourceTypesPacked: bigint;
  order: number;
  position: Position;
  owner?: bigint;
}

/// LABOR

/// BANK
export interface AuctionInterface {
  start_time: number;
  per_time_unit: bigint;
  sold: bigint;
  price_update_interval: bigint;
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
  bankId: bigint;
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

export interface IOrder {
  orderId: number;
  orderName: string;
  fullOrderName: string;
}
