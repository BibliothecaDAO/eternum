import { ResourcesIds } from "../constants";

export enum Winner {
  Attacker = "Attacker",
  Target = "Target",
}

export enum TickIds {
  Default,
  Armies,
}

export enum TravelTypes {
  Explore,
  Travel,
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

/// TRADING
export interface MarketInterface {
  makerName: string;
  originName: string;
  tradeId: ID;
  makerId: ID;
  takerId: ID;
  // brillance, reflection, ...
  makerOrder: number;
  expiresAt: number;
  takerGets: Resource[];
  makerGets: Resource[];
  ratio: number;
  perLords: number;
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
  resourceId: ResourcesIds;
  amount: number;
}

/// TRAVEL

// export interface RoadInterface {
//   startRealmName: string;
//   startRealmOrder: number | undefined;
//   destinationEntityId: ID;
//   destinationRealmName: string;
//   destinationRealmOrder: number | undefined;
//   usageLeft: number;
// }

// export interface EntityInterface {
//   entityId: ID;
//   blocked: boolean | undefined;
//   arrivalTime: number | undefined;
//   capacity: number | undefined;
//   intermediateDestination: Position | undefined;
//   owner: ID | undefined;
//   isMine: boolean;
//   isRoundTrip: boolean;
//   position: Position | undefined;
//   homePosition: Position | undefined;
//   resources: Resource[];
//   entityType: EntityType;
// }

/// REALMS
// export interface SelectableRealmInterface {
//   entityId: ID;
//   realmId: ID;
//   name: string;
//   order: string;
//   distance: number;
//   defence?: CombatInfo;
//   level?: number;
//   addressName: string;
// }

interface CombatInfo {
  entityId: ID;
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
  entityOwnerId?: ID | undefined;
  owner?: ID | undefined;
  locationEntityId?: ID | undefined;
  locationType?: DestinationType;
  originRealmId?: ID | undefined;
  order: number;
  troops: {
    knightCount: number;
    paladinCount: number;
    crossbowmanCount: number;
  };
  battleEntityId: ID;
  battleSide: number;
}

export interface SelectableLocationInterface {
  entityId: ID;
  home: boolean;
  realmId: ID;
  name: string;
  order: string;
  distance: number;
  defence?: CombatInfo;
  level?: number;
  addressName: string;
}
export interface RealmInterface {
  realmId: ID;
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
  owner?: ContractAddress;
}

/// BANK
export interface AuctionInterface {
  start_time: number;
  per_time_unit: bigint;
  sold: bigint;
  price_update_interval: bigint;
}

export interface BankStaticInterface {
  name: string;
  position: Position;
  distance: number | undefined;
}

export interface BankInterface {
  name: string;
  wheatPrice: number;
  fishPrice: number;
  bankId: ID;
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

export interface IOrder {
  orderId: number;
  orderName: string;
  fullOrderName: string;
}

export type ID = number;
export type ContractAddress = bigint;

export function ID(id: number | string): ID {
  return Number(id);
}

export function ContractAddress(address: string | bigint): ContractAddress {
  return BigInt(address);
}

export interface ResourceInputs {
  [key: number]: { resource: ResourcesIds; amount: number }[];
}

export interface ResourceOutputs {
  [key: number]: number;
}
