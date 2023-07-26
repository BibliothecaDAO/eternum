import { GraphQLClient } from 'graphql-request';
import * as Dom from 'graphql-request/dist/types.dom';
import { print } from 'graphql'
import gql from 'graphql-tag';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  ContractAddress: { input: any; output: any; }
  DateTime: { input: any; output: any; }
  bool: { input: any; output: any; }
  felt252: { input: any; output: any; }
  u8: { input: any; output: any; }
  u16: { input: any; output: any; }
  u32: { input: any; output: any; }
  u64: { input: any; output: any; }
  u128: { input: any; output: any; }
  u256: { input: any; output: any; }
  usize: { input: any; output: any; }
};

export type Age = {
  __typename?: 'Age';
  born_at: Scalars['u64']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
};

export type ArrivalTime = {
  __typename?: 'ArrivalTime';
  arrives_at: Scalars['u64']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
};

export type BuildingConfig = {
  __typename?: 'BuildingConfig';
  base_sqm: Scalars['u128']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  workhut_cost: Scalars['u128']['output'];
};

export type BuildingCost = {
  __typename?: 'BuildingCost';
  cost: Scalars['u128']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  resource_type: Scalars['felt252']['output'];
};

export type BuildingTypeConfig = {
  __typename?: 'BuildingTypeConfig';
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  id: Scalars['felt252']['output'];
  resource_types_count: Scalars['u8']['output'];
  resource_types_packed: Scalars['u256']['output'];
  sqm: Scalars['u128']['output'];
};

export type Capacity = {
  __typename?: 'Capacity';
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  weight_gram: Scalars['u128']['output'];
};

export type CapacityConfig = {
  __typename?: 'CapacityConfig';
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  entity_type: Scalars['u128']['output'];
  weight_gram: Scalars['u128']['output'];
};

export type Caravan = {
  __typename?: 'Caravan';
  caravan_id: Scalars['u128']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
};

export type CaravanMembers = {
  __typename?: 'CaravanMembers';
  count: Scalars['usize']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  key: Scalars['u128']['output'];
};

export type ComponentUnion = Age | ArrivalTime | BuildingConfig | BuildingCost | BuildingTypeConfig | Capacity | CapacityConfig | Caravan | CaravanMembers | ForeignKey | FungibleEntities | Labor | LaborConfig | LaborCostAmount | LaborCostResources | MetaData | Movable | OrderId | Owner | Position | Quantity | QuantityTracker | Realm | Resource | SpeedConfig | Status | Trade | TravelConfig | Vault | WeightConfig | WorldConfig;

export type Entity = {
  __typename?: 'Entity';
  componentNames: Scalars['String']['output'];
  components?: Maybe<Array<Maybe<ComponentUnion>>>;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  keys: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type Event = {
  __typename?: 'Event';
  createdAt: Scalars['DateTime']['output'];
  data: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  keys: Scalars['String']['output'];
  systemCall: SystemCall;
  systemCallId: Scalars['Int']['output'];
};

export type ForeignKey = {
  __typename?: 'ForeignKey';
  entity?: Maybe<Entity>;
  entity_id: Scalars['u128']['output'];
};

export type FungibleEntities = {
  __typename?: 'FungibleEntities';
  count: Scalars['usize']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  key: Scalars['u128']['output'];
};

export type Labor = {
  __typename?: 'Labor';
  balance: Scalars['u64']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  last_harvest: Scalars['u64']['output'];
  multiplier: Scalars['u64']['output'];
};

export type LaborConfig = {
  __typename?: 'LaborConfig';
  base_food_per_cycle: Scalars['u128']['output'];
  base_labor_units: Scalars['u64']['output'];
  base_resources_per_cycle: Scalars['u128']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
};

export type LaborCostAmount = {
  __typename?: 'LaborCostAmount';
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  resource_type_cost: Scalars['felt252']['output'];
  resource_type_labor: Scalars['felt252']['output'];
  value: Scalars['u128']['output'];
};

export type LaborCostResources = {
  __typename?: 'LaborCostResources';
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  resource_type_labor: Scalars['felt252']['output'];
  resource_types_count: Scalars['u8']['output'];
  resource_types_packed: Scalars['u128']['output'];
};

export type MetaData = {
  __typename?: 'MetaData';
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  entity_type: Scalars['u128']['output'];
};

export type Movable = {
  __typename?: 'Movable';
  blocked: Scalars['bool']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  sec_per_km: Scalars['u16']['output'];
};

export type OrderId = {
  __typename?: 'OrderId';
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  id: Scalars['u128']['output'];
};

export type Owner = {
  __typename?: 'Owner';
  address: Scalars['ContractAddress']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
};

export type Position = {
  __typename?: 'Position';
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  x: Scalars['u32']['output'];
  y: Scalars['u32']['output'];
};

export type Quantity = {
  __typename?: 'Quantity';
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  value: Scalars['u128']['output'];
};

export type QuantityTracker = {
  __typename?: 'QuantityTracker';
  count: Scalars['u128']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
};

export type Query = {
  __typename?: 'Query';
  ageComponents?: Maybe<Array<Maybe<Age>>>;
  arrivaltimeComponents?: Maybe<Array<Maybe<ArrivalTime>>>;
  buildingconfigComponents?: Maybe<Array<Maybe<BuildingConfig>>>;
  buildingcostComponents?: Maybe<Array<Maybe<BuildingCost>>>;
  buildingtypeconfigComponents?: Maybe<Array<Maybe<BuildingTypeConfig>>>;
  capacityComponents?: Maybe<Array<Maybe<Capacity>>>;
  capacityconfigComponents?: Maybe<Array<Maybe<CapacityConfig>>>;
  caravanComponents?: Maybe<Array<Maybe<Caravan>>>;
  caravanmembersComponents?: Maybe<Array<Maybe<CaravanMembers>>>;
  entities?: Maybe<Array<Maybe<Entity>>>;
  entity: Entity;
  event: Event;
  events?: Maybe<Array<Maybe<Event>>>;
  foreignkeyComponents?: Maybe<Array<Maybe<ForeignKey>>>;
  fungibleentitiesComponents?: Maybe<Array<Maybe<FungibleEntities>>>;
  laborComponents?: Maybe<Array<Maybe<Labor>>>;
  laborconfigComponents?: Maybe<Array<Maybe<LaborConfig>>>;
  laborcostamountComponents?: Maybe<Array<Maybe<LaborCostAmount>>>;
  laborcostresourcesComponents?: Maybe<Array<Maybe<LaborCostResources>>>;
  metadataComponents?: Maybe<Array<Maybe<MetaData>>>;
  movableComponents?: Maybe<Array<Maybe<Movable>>>;
  orderidComponents?: Maybe<Array<Maybe<OrderId>>>;
  ownerComponents?: Maybe<Array<Maybe<Owner>>>;
  positionComponents?: Maybe<Array<Maybe<Position>>>;
  quantityComponents?: Maybe<Array<Maybe<Quantity>>>;
  quantitytrackerComponents?: Maybe<Array<Maybe<QuantityTracker>>>;
  realmComponents?: Maybe<Array<Maybe<Realm>>>;
  resourceComponents?: Maybe<Array<Maybe<Resource>>>;
  speedconfigComponents?: Maybe<Array<Maybe<SpeedConfig>>>;
  statusComponents?: Maybe<Array<Maybe<Status>>>;
  system: System;
  systemCall: SystemCall;
  systemCalls?: Maybe<Array<Maybe<SystemCall>>>;
  systems?: Maybe<Array<Maybe<System>>>;
  tradeComponents?: Maybe<Array<Maybe<Trade>>>;
  travelconfigComponents?: Maybe<Array<Maybe<TravelConfig>>>;
  vaultComponents?: Maybe<Array<Maybe<Vault>>>;
  weightconfigComponents?: Maybe<Array<Maybe<WeightConfig>>>;
  worldconfigComponents?: Maybe<Array<Maybe<WorldConfig>>>;
};


export type QueryAgeComponentsArgs = {
  born_at?: InputMaybe<Scalars['u64']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryArrivaltimeComponentsArgs = {
  arrives_at?: InputMaybe<Scalars['u64']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryBuildingconfigComponentsArgs = {
  base_sqm?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  workhut_cost?: InputMaybe<Scalars['u128']['input']>;
};


export type QueryBuildingcostComponentsArgs = {
  cost?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  resource_type?: InputMaybe<Scalars['felt252']['input']>;
};


export type QueryBuildingtypeconfigComponentsArgs = {
  id?: InputMaybe<Scalars['felt252']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  resource_types_count?: InputMaybe<Scalars['u8']['input']>;
  resource_types_packed?: InputMaybe<Scalars['u256']['input']>;
  sqm?: InputMaybe<Scalars['u128']['input']>;
};


export type QueryCapacityComponentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  weight_gram?: InputMaybe<Scalars['u128']['input']>;
};


export type QueryCapacityconfigComponentsArgs = {
  entity_type?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  weight_gram?: InputMaybe<Scalars['u128']['input']>;
};


export type QueryCaravanComponentsArgs = {
  caravan_id?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryCaravanmembersComponentsArgs = {
  count?: InputMaybe<Scalars['usize']['input']>;
  key?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryEntitiesArgs = {
  componentName?: InputMaybe<Scalars['String']['input']>;
  keys: Array<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryEntityArgs = {
  id: Scalars['ID']['input'];
};


export type QueryEventArgs = {
  id: Scalars['ID']['input'];
};


export type QueryEventsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryForeignkeyComponentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryFungibleentitiesComponentsArgs = {
  count?: InputMaybe<Scalars['usize']['input']>;
  key?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryLaborComponentsArgs = {
  balance?: InputMaybe<Scalars['u64']['input']>;
  last_harvest?: InputMaybe<Scalars['u64']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  multiplier?: InputMaybe<Scalars['u64']['input']>;
};


export type QueryLaborconfigComponentsArgs = {
  base_food_per_cycle?: InputMaybe<Scalars['u128']['input']>;
  base_labor_units?: InputMaybe<Scalars['u64']['input']>;
  base_resources_per_cycle?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryLaborcostamountComponentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  resource_type_cost?: InputMaybe<Scalars['felt252']['input']>;
  resource_type_labor?: InputMaybe<Scalars['felt252']['input']>;
  value?: InputMaybe<Scalars['u128']['input']>;
};


export type QueryLaborcostresourcesComponentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  resource_type_labor?: InputMaybe<Scalars['felt252']['input']>;
  resource_types_count?: InputMaybe<Scalars['u8']['input']>;
  resource_types_packed?: InputMaybe<Scalars['u128']['input']>;
};


export type QueryMetadataComponentsArgs = {
  entity_type?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMovableComponentsArgs = {
  blocked?: InputMaybe<Scalars['bool']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  sec_per_km?: InputMaybe<Scalars['u16']['input']>;
};


export type QueryOrderidComponentsArgs = {
  id?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryOwnerComponentsArgs = {
  address?: InputMaybe<Scalars['ContractAddress']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryPositionComponentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  x?: InputMaybe<Scalars['u32']['input']>;
  y?: InputMaybe<Scalars['u32']['input']>;
};


export type QueryQuantityComponentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  value?: InputMaybe<Scalars['u128']['input']>;
};


export type QueryQuantitytrackerComponentsArgs = {
  count?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryRealmComponentsArgs = {
  cities?: InputMaybe<Scalars['u8']['input']>;
  harbors?: InputMaybe<Scalars['u8']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<Scalars['u8']['input']>;
  realm_id?: InputMaybe<Scalars['u128']['input']>;
  regions?: InputMaybe<Scalars['u8']['input']>;
  resource_types_count?: InputMaybe<Scalars['u8']['input']>;
  resource_types_packed?: InputMaybe<Scalars['u128']['input']>;
  rivers?: InputMaybe<Scalars['u8']['input']>;
  wonder?: InputMaybe<Scalars['u8']['input']>;
};


export type QueryResourceComponentsArgs = {
  balance?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  resource_type?: InputMaybe<Scalars['u8']['input']>;
};


export type QuerySpeedconfigComponentsArgs = {
  entity_type?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  sec_per_km?: InputMaybe<Scalars['u16']['input']>;
};


export type QueryStatusComponentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  value?: InputMaybe<Scalars['u128']['input']>;
};


export type QuerySystemArgs = {
  id: Scalars['ID']['input'];
};


export type QuerySystemCallArgs = {
  id: Scalars['Int']['input'];
};


export type QuerySystemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryTradeComponentsArgs = {
  claimed_by_maker?: InputMaybe<Scalars['bool']['input']>;
  claimed_by_taker?: InputMaybe<Scalars['bool']['input']>;
  expires_at?: InputMaybe<Scalars['u64']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  maker_id?: InputMaybe<Scalars['u128']['input']>;
  maker_order_id?: InputMaybe<Scalars['u128']['input']>;
  taker_id?: InputMaybe<Scalars['u128']['input']>;
  taker_needs_caravan?: InputMaybe<Scalars['bool']['input']>;
  taker_order_id?: InputMaybe<Scalars['u128']['input']>;
  trade_id?: InputMaybe<Scalars['u128']['input']>;
};


export type QueryTravelconfigComponentsArgs = {
  free_transport_per_city?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryVaultComponentsArgs = {
  balance?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryWeightconfigComponentsArgs = {
  entity_type?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  weight_gram?: InputMaybe<Scalars['u128']['input']>;
};


export type QueryWorldconfigComponentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  realm_l2_contract?: InputMaybe<Scalars['ContractAddress']['input']>;
};

export type Realm = {
  __typename?: 'Realm';
  cities: Scalars['u8']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  harbors: Scalars['u8']['output'];
  order: Scalars['u8']['output'];
  realm_id: Scalars['u128']['output'];
  regions: Scalars['u8']['output'];
  resource_types_count: Scalars['u8']['output'];
  resource_types_packed: Scalars['u128']['output'];
  rivers: Scalars['u8']['output'];
  wonder: Scalars['u8']['output'];
};

export type Resource = {
  __typename?: 'Resource';
  balance: Scalars['u128']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  resource_type: Scalars['u8']['output'];
};

export type SpeedConfig = {
  __typename?: 'SpeedConfig';
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  entity_type: Scalars['u128']['output'];
  sec_per_km: Scalars['u16']['output'];
};

export type Status = {
  __typename?: 'Status';
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  value: Scalars['u128']['output'];
};

export type System = {
  __typename?: 'System';
  address: Scalars['ContractAddress']['output'];
  classHash: Scalars['felt252']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  systemCalls: Array<SystemCall>;
  transactionHash: Scalars['felt252']['output'];
};

export type SystemCall = {
  __typename?: 'SystemCall';
  createdAt: Scalars['DateTime']['output'];
  data: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  system: System;
  systemId: Scalars['ID']['output'];
  transactionHash: Scalars['String']['output'];
};

export type Trade = {
  __typename?: 'Trade';
  claimed_by_maker: Scalars['bool']['output'];
  claimed_by_taker: Scalars['bool']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  expires_at: Scalars['u64']['output'];
  maker_id: Scalars['u128']['output'];
  maker_order_id: Scalars['u128']['output'];
  taker_id: Scalars['u128']['output'];
  taker_needs_caravan: Scalars['bool']['output'];
  taker_order_id: Scalars['u128']['output'];
  trade_id: Scalars['u128']['output'];
};

export type TravelConfig = {
  __typename?: 'TravelConfig';
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  free_transport_per_city: Scalars['u128']['output'];
};

export type Vault = {
  __typename?: 'Vault';
  balance: Scalars['u128']['output'];
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
};

export type WeightConfig = {
  __typename?: 'WeightConfig';
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  entity_type: Scalars['u128']['output'];
  weight_gram: Scalars['u128']['output'];
};

export type WorldConfig = {
  __typename?: 'WorldConfig';
  entity?: Maybe<Entity>;
  entity_id: Scalars['ID']['output'];
  realm_l2_contract: Scalars['ContractAddress']['output'];
};

export type GetCaravanInfoQueryVariables = Exact<{
  caravanId: Scalars['String']['input'];
  orderId: Scalars['String']['input'];
  counterpartyOrderId: Scalars['String']['input'];
}>;


export type GetCaravanInfoQuery = { __typename?: 'Query', caravan?: Array<{ __typename?: 'Entity', keys: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime', arrives_at: any } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity', weight_gram: any } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable', blocked: any, sec_per_km: any } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null, destination?: Array<{ __typename?: 'Entity', components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position', x: any, y: any } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null, resourcesGive?: Array<{ __typename?: 'Entity', keys: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource', resource_type: any, balance: any } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null, resourcesGet?: Array<{ __typename?: 'Entity', keys: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource', resource_type: any, balance: any } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null };

export type GetCaravansQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCaravansQuery = { __typename?: 'Query', entities?: Array<{ __typename?: 'Entity', keys: string } | null> | null };

export type GetCounterpartyOrderIdQueryVariables = Exact<{
  orderId?: InputMaybe<Scalars['u128']['input']>;
}>;


export type GetCounterpartyOrderIdQuery = { __typename?: 'Query', makerTradeComponents?: Array<{ __typename: 'Trade', maker_order_id: any, claimed_by_maker: any, taker_id: any, taker_order_id: any } | null> | null, takerTradeComponents?: Array<{ __typename: 'Trade', maker_order_id: any, claimed_by_maker: any, maker_id: any, taker_order_id: any } | null> | null };

export type GetIncomingOrderInfoQueryVariables = Exact<{
  orderId: Scalars['String']['input'];
  counterPartyOrderId: Scalars['String']['input'];
}>;


export type GetIncomingOrderInfoQuery = { __typename?: 'Query', resources?: Array<{ __typename?: 'Entity', keys: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource', resource_type: any, balance: any } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null, arrivalTime?: Array<{ __typename?: 'Entity', keys: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime', arrives_at: any } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null, origin?: Array<{ __typename?: 'Entity', keys: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position', x: any, y: any } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null };

export type GetIncomingOrdersQueryVariables = Exact<{
  realmEntityId?: InputMaybe<Scalars['u128']['input']>;
}>;


export type GetIncomingOrdersQuery = { __typename?: 'Query', makerTradeComponents?: Array<{ __typename: 'Trade', maker_order_id: any, claimed_by_maker: any, taker_id: any, taker_order_id: any, trade_id: any } | null> | null, takerTradeComponents?: Array<{ __typename: 'Trade', maker_order_id: any, claimed_by_maker: any, maker_id: any, taker_order_id: any, trade_id: any } | null> | null };

export type GetMarketQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMarketQuery = { __typename?: 'Query', tradeComponents?: Array<{ __typename?: 'Trade', entity?: { __typename?: 'Entity', keys: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status', value: any } | { __typename: 'Trade', trade_id: any, maker_id: any, maker_order_id: any, taker_order_id: any } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null> | null };

export type GetMyOffersQueryVariables = Exact<{
  makerId: Scalars['u128']['input'];
}>;


export type GetMyOffersQuery = { __typename?: 'Query', tradeComponents?: Array<{ __typename?: 'Trade', trade_id: any, maker_order_id: any, taker_order_id: any } | null> | null };

export type GetOrdersQueryVariables = Exact<{ [key: string]: never; }>;


export type GetOrdersQuery = { __typename?: 'Query', entities?: Array<{ __typename?: 'Entity', keys: string } | null> | null };

export type GetRealmQueryVariables = Exact<{
  realmEntityId: Scalars['String']['input'];
}>;


export type GetRealmQuery = { __typename?: 'Query', entities?: Array<{ __typename?: 'Entity', keys: string, id: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner', address: any } | { __typename: 'Position', x: any, y: any } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm', realm_id: any, cities: any, rivers: any, wonder: any, harbors: any, regions: any, resource_types_count: any, resource_types_packed: any, order: any } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null };

export type GetRealmsCaravansQueryVariables = Exact<{
  x?: InputMaybe<Scalars['u32']['input']>;
  y?: InputMaybe<Scalars['u32']['input']>;
}>;


export type GetRealmsCaravansQuery = { __typename?: 'Query', positionComponents?: Array<{ __typename?: 'Position', entity?: { __typename?: 'Entity', keys: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId', id: any } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null> | null };

export type GetRealmIdsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetRealmIdsQuery = { __typename?: 'Query', entities?: Array<{ __typename?: 'Entity', components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm', realm_id: any } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null };

export type GetTradeResourcesQueryVariables = Exact<{
  makerOrderId: Scalars['String']['input'];
  takerOrderId: Scalars['String']['input'];
}>;


export type GetTradeResourcesQuery = { __typename?: 'Query', resourcesGive?: Array<{ __typename?: 'Entity', keys: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource', resource_type: any, balance: any } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null, resourcesGet?: Array<{ __typename?: 'Entity', keys: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource', resource_type: any, balance: any } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null };

export type GetTradeStatusQueryVariables = Exact<{
  tradeId: Scalars['String']['input'];
}>;


export type GetTradeStatusQuery = { __typename?: 'Query', entities?: Array<{ __typename?: 'Entity', keys: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status', value: any } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null };

export type GetTradesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetTradesQuery = { __typename?: 'Query', entities?: Array<{ __typename?: 'Entity', keys: string } | null> | null };


export const GetCaravanInfoDocument = gql`
    query getCaravanInfo($caravanId: String!, $orderId: String!, $counterpartyOrderId: String!) {
  caravan: entities(keys: [$caravanId], componentName: "CaravanMembers") {
    keys
    components {
      __typename
      ... on ArrivalTime {
        arrives_at
      }
      ... on Movable {
        blocked
        sec_per_km
      }
      ... on Capacity {
        weight_gram
      }
    }
  }
  destination: entities(
    keys: [$counterpartyOrderId]
    limit: 1
    componentName: "ArrivalTime"
  ) {
    components {
      __typename
      ... on Position {
        x
        y
      }
    }
  }
  resourcesGive: entities(keys: [$orderId], limit: 100, componentName: "Resource") {
    keys
    components {
      __typename
      ... on Resource {
        resource_type
        balance
      }
    }
  }
  resourcesGet: entities(
    keys: [$counterpartyOrderId]
    limit: 100
    componentName: "Resource"
  ) {
    keys
    components {
      __typename
      ... on Resource {
        resource_type
        balance
      }
    }
  }
}
    `;
export const GetCaravansDocument = gql`
    query getCaravans {
  entities(keys: ["%"], componentName: "CaravanMembers") {
    keys
  }
}
    `;
export const GetCounterpartyOrderIdDocument = gql`
    query getCounterpartyOrderId($orderId: u128) {
  makerTradeComponents: tradeComponents(maker_order_id: $orderId) {
    __typename
    ... on Trade {
      maker_order_id
      claimed_by_maker
      taker_id
      taker_order_id
    }
  }
  takerTradeComponents: tradeComponents(taker_order_id: $orderId) {
    __typename
    ... on Trade {
      maker_order_id
      claimed_by_maker
      maker_id
      taker_order_id
    }
  }
}
    `;
export const GetIncomingOrderInfoDocument = gql`
    query getIncomingOrderInfo($orderId: String!, $counterPartyOrderId: String!) {
  resources: entities(
    keys: [$counterPartyOrderId]
    limit: 100
    componentName: "Resource"
  ) {
    keys
    components {
      __typename
      ... on Resource {
        resource_type
        balance
      }
    }
  }
  arrivalTime: entities(
    keys: [$counterPartyOrderId]
    limit: 100
    componentName: "ArrivalTime"
  ) {
    keys
    components {
      __typename
      ... on ArrivalTime {
        arrives_at
      }
    }
  }
  origin: entities(keys: [$orderId], limit: 100, componentName: "Position") {
    keys
    components {
      __typename
      ... on Position {
        x
        y
      }
    }
  }
}
    `;
export const GetIncomingOrdersDocument = gql`
    query getIncomingOrders($realmEntityId: u128) {
  makerTradeComponents: tradeComponents(
    maker_id: $realmEntityId
    claimed_by_maker: 0
  ) {
    __typename
    ... on Trade {
      maker_order_id
      claimed_by_maker
      taker_id
      taker_order_id
      trade_id
    }
  }
  takerTradeComponents: tradeComponents(
    taker_id: $realmEntityId
    claimed_by_taker: 0
  ) {
    __typename
    ... on Trade {
      maker_order_id
      claimed_by_maker
      maker_id
      taker_order_id
      trade_id
    }
  }
}
    `;
export const GetMarketDocument = gql`
    query getMarket {
  tradeComponents(claimed_by_maker: 0, claimed_by_taker: 0) {
    entity {
      ... on Entity {
        keys
        components {
          __typename
          ... on Status {
            value
          }
          ... on Trade {
            trade_id
            maker_id
            maker_order_id
            taker_order_id
          }
        }
      }
    }
  }
}
    `;
export const GetMyOffersDocument = gql`
    query getMyOffers($makerId: u128!) {
  tradeComponents(maker_id: $makerId, claimed_by_maker: 0, claimed_by_taker: 0) {
    trade_id
    maker_order_id
    taker_order_id
  }
}
    `;
export const GetOrdersDocument = gql`
    query getOrders {
  entities(keys: ["%"], componentName: "Caravan") {
    keys
  }
}
    `;
export const GetRealmDocument = gql`
    query getRealm($realmEntityId: String!) {
  entities(keys: [$realmEntityId], componentName: "Realm") {
    keys
    id
    components {
      __typename
      ... on Realm {
        realm_id
        cities
        rivers
        wonder
        harbors
        regions
        resource_types_count
        resource_types_packed
        order
      }
      ... on Position {
        x
        y
      }
      ... on Owner {
        address
      }
    }
  }
}
    `;
export const GetRealmsCaravansDocument = gql`
    query getRealmsCaravans($x: u32, $y: u32) {
  positionComponents(x: $x, y: $y, limit: 100) {
    entity {
      keys
      components {
        __typename
        ... on OrderId {
          id
        }
      }
    }
  }
}
    `;
export const GetRealmIdsDocument = gql`
    query getRealmIds {
  entities(keys: ["%"], limit: 30, componentName: "Realm") {
    components {
      __typename
      ... on Realm {
        realm_id
      }
    }
  }
}
    `;
export const GetTradeResourcesDocument = gql`
    query getTradeResources($makerOrderId: String!, $takerOrderId: String!) {
  resourcesGive: entities(
    keys: [$makerOrderId]
    limit: 100
    componentName: "Resource"
  ) {
    keys
    components {
      __typename
      ... on Resource {
        resource_type
        balance
      }
    }
  }
  resourcesGet: entities(
    keys: [$takerOrderId]
    limit: 100
    componentName: "Resource"
  ) {
    keys
    components {
      __typename
      ... on Resource {
        resource_type
        balance
      }
    }
  }
}
    `;
export const GetTradeStatusDocument = gql`
    query getTradeStatus($tradeId: String!) {
  entities(keys: [$tradeId], componentName: "Status") {
    keys
    components {
      __typename
      ... on Status {
        value
      }
    }
  }
}
    `;
export const GetTradesDocument = gql`
    query getTrades {
  entities(keys: ["%"], componentName: "Trade") {
    keys
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType) => action();
const GetCaravanInfoDocumentString = print(GetCaravanInfoDocument);
const GetCaravansDocumentString = print(GetCaravansDocument);
const GetCounterpartyOrderIdDocumentString = print(GetCounterpartyOrderIdDocument);
const GetIncomingOrderInfoDocumentString = print(GetIncomingOrderInfoDocument);
const GetIncomingOrdersDocumentString = print(GetIncomingOrdersDocument);
const GetMarketDocumentString = print(GetMarketDocument);
const GetMyOffersDocumentString = print(GetMyOffersDocument);
const GetOrdersDocumentString = print(GetOrdersDocument);
const GetRealmDocumentString = print(GetRealmDocument);
const GetRealmsCaravansDocumentString = print(GetRealmsCaravansDocument);
const GetRealmIdsDocumentString = print(GetRealmIdsDocument);
const GetTradeResourcesDocumentString = print(GetTradeResourcesDocument);
const GetTradeStatusDocumentString = print(GetTradeStatusDocument);
const GetTradesDocumentString = print(GetTradesDocument);
export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    getCaravanInfo(variables: GetCaravanInfoQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetCaravanInfoQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetCaravanInfoQuery>(GetCaravanInfoDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getCaravanInfo', 'query');
    },
    getCaravans(variables?: GetCaravansQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetCaravansQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetCaravansQuery>(GetCaravansDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getCaravans', 'query');
    },
    getCounterpartyOrderId(variables?: GetCounterpartyOrderIdQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetCounterpartyOrderIdQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetCounterpartyOrderIdQuery>(GetCounterpartyOrderIdDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getCounterpartyOrderId', 'query');
    },
    getIncomingOrderInfo(variables: GetIncomingOrderInfoQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetIncomingOrderInfoQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetIncomingOrderInfoQuery>(GetIncomingOrderInfoDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getIncomingOrderInfo', 'query');
    },
    getIncomingOrders(variables?: GetIncomingOrdersQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetIncomingOrdersQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetIncomingOrdersQuery>(GetIncomingOrdersDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getIncomingOrders', 'query');
    },
    getMarket(variables?: GetMarketQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetMarketQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetMarketQuery>(GetMarketDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getMarket', 'query');
    },
    getMyOffers(variables: GetMyOffersQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetMyOffersQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetMyOffersQuery>(GetMyOffersDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getMyOffers', 'query');
    },
    getOrders(variables?: GetOrdersQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetOrdersQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetOrdersQuery>(GetOrdersDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getOrders', 'query');
    },
    getRealm(variables: GetRealmQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetRealmQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetRealmQuery>(GetRealmDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getRealm', 'query');
    },
    getRealmsCaravans(variables?: GetRealmsCaravansQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetRealmsCaravansQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetRealmsCaravansQuery>(GetRealmsCaravansDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getRealmsCaravans', 'query');
    },
    getRealmIds(variables?: GetRealmIdsQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetRealmIdsQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetRealmIdsQuery>(GetRealmIdsDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getRealmIds', 'query');
    },
    getTradeResources(variables: GetTradeResourcesQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetTradeResourcesQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetTradeResourcesQuery>(GetTradeResourcesDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getTradeResources', 'query');
    },
    getTradeStatus(variables: GetTradeStatusQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetTradeStatusQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetTradeStatusQuery>(GetTradeStatusDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getTradeStatus', 'query');
    },
    getTrades(variables?: GetTradesQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetTradesQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetTradesQuery>(GetTradesDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getTrades', 'query');
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;