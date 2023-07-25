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
};

export type ArrivalTime = {
  __typename?: 'ArrivalTime';
  arrives_at: Scalars['u64']['output'];
};

export type BuildingConfig = {
  __typename?: 'BuildingConfig';
  base_sqm: Scalars['u128']['output'];
  workhut_cost: Scalars['u128']['output'];
};

export type BuildingCost = {
  __typename?: 'BuildingCost';
  cost: Scalars['u128']['output'];
  resource_type: Scalars['felt252']['output'];
};

export type BuildingTypeConfig = {
  __typename?: 'BuildingTypeConfig';
  id: Scalars['felt252']['output'];
  resource_types_count: Scalars['u8']['output'];
  resource_types_packed: Scalars['u256']['output'];
  sqm: Scalars['u128']['output'];
};

export type Capacity = {
  __typename?: 'Capacity';
  weight_gram: Scalars['u128']['output'];
};

export type CapacityConfig = {
  __typename?: 'CapacityConfig';
  entity_type: Scalars['u128']['output'];
  weight_gram: Scalars['u128']['output'];
};

export type Caravan = {
  __typename?: 'Caravan';
  caravan_id: Scalars['u128']['output'];
};

export type CaravanMembers = {
  __typename?: 'CaravanMembers';
  count: Scalars['usize']['output'];
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
  entity_id: Scalars['u128']['output'];
};

export type FungibleEntities = {
  __typename?: 'FungibleEntities';
  count: Scalars['usize']['output'];
  key: Scalars['u128']['output'];
};

export type Labor = {
  __typename?: 'Labor';
  balance: Scalars['u64']['output'];
  last_harvest: Scalars['u64']['output'];
  multiplier: Scalars['u64']['output'];
};

export type LaborConfig = {
  __typename?: 'LaborConfig';
  base_food_per_cycle: Scalars['u128']['output'];
  base_labor_units: Scalars['u64']['output'];
  base_resources_per_cycle: Scalars['u128']['output'];
};

export type LaborCostAmount = {
  __typename?: 'LaborCostAmount';
  resource_type_cost: Scalars['felt252']['output'];
  resource_type_labor: Scalars['felt252']['output'];
  value: Scalars['u128']['output'];
};

export type LaborCostResources = {
  __typename?: 'LaborCostResources';
  resource_type_labor: Scalars['felt252']['output'];
  resource_types_count: Scalars['u8']['output'];
  resource_types_packed: Scalars['u128']['output'];
};

export type MetaData = {
  __typename?: 'MetaData';
  entity_type: Scalars['u128']['output'];
};

export type Movable = {
  __typename?: 'Movable';
  blocked: Scalars['bool']['output'];
  sec_per_km: Scalars['u16']['output'];
};

export type OrderId = {
  __typename?: 'OrderId';
  id: Scalars['u128']['output'];
};

export type Owner = {
  __typename?: 'Owner';
  address: Scalars['ContractAddress']['output'];
};

export type Position = {
  __typename?: 'Position';
  x: Scalars['u32']['output'];
  y: Scalars['u32']['output'];
};

export type Quantity = {
  __typename?: 'Quantity';
  value: Scalars['u128']['output'];
};

export type QuantityTracker = {
  __typename?: 'QuantityTracker';
  count: Scalars['u128']['output'];
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
  entity_id?: InputMaybe<Scalars['u128']['input']>;
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
  resource_type: Scalars['u8']['output'];
};

export type SpeedConfig = {
  __typename?: 'SpeedConfig';
  entity_type: Scalars['u128']['output'];
  sec_per_km: Scalars['u16']['output'];
};

export type Status = {
  __typename?: 'Status';
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
  free_transport_per_city: Scalars['u128']['output'];
};

export type Vault = {
  __typename?: 'Vault';
  balance: Scalars['u128']['output'];
};

export type WeightConfig = {
  __typename?: 'WeightConfig';
  entity_type: Scalars['u128']['output'];
  weight_gram: Scalars['u128']['output'];
};

export type WorldConfig = {
  __typename?: 'WorldConfig';
  realm_l2_contract: Scalars['ContractAddress']['output'];
};

export type GetCaravansQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCaravansQuery = { __typename?: 'Query', entities?: Array<{ __typename?: 'Entity', keys: string } | null> | null };

export type GetOrdersQueryVariables = Exact<{ [key: string]: never; }>;


export type GetOrdersQuery = { __typename?: 'Query', entities?: Array<{ __typename?: 'Entity', keys: string } | null> | null };

export type GetRealmIdsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetRealmIdsQuery = { __typename?: 'Query', entities?: Array<{ __typename?: 'Entity', components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm', realm_id: any } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null };

export type GetTradesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetTradesQuery = { __typename?: 'Query', entities?: Array<{ __typename?: 'Entity', keys: string } | null> | null };

export type GetMyOffersQueryVariables = Exact<{
  makerId: Scalars['u128']['input'];
}>;


export type GetMyOffersQuery = { __typename?: 'Query', tradeComponents?: Array<{ __typename?: 'Trade', trade_id: any, maker_order_id: any, taker_order_id: any, maker_id: any, taker_id: any, claimed_by_maker: any, claimed_by_taker: any } | null> | null };

export type GetTradeResourcesQueryVariables = Exact<{
  makerOrderId: Scalars['String']['input'];
  takerOrderId: Scalars['String']['input'];
}>;


export type GetTradeResourcesQuery = { __typename?: 'Query', resourcesGive?: Array<{ __typename?: 'Entity', keys: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource', resource_type: any, balance: any } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null, resourcesGet?: Array<{ __typename?: 'Entity', keys: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource', resource_type: any, balance: any } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null };

export type GetTradeStatusQueryVariables = Exact<{
  tradeId: Scalars['String']['input'];
}>;


export type GetTradeStatusQuery = { __typename?: 'Query', entities?: Array<{ __typename?: 'Entity', keys: string, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status', value: any } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null> | null };


export const GetCaravansDocument = gql`
    query getCaravans {
  entities(keys: ["%"], componentName: "CaravanMembers") {
    keys
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
export const GetTradesDocument = gql`
    query getTrades {
  entities(keys: ["%"], componentName: "Trade") {
    keys
  }
}
    `;
export const GetMyOffersDocument = gql`
    query getMyOffers($makerId: u128!) {
  tradeComponents(maker_id: $makerId, claimed_by_maker: 0, claimed_by_taker: 0) {
    trade_id
    maker_order_id
    taker_order_id
    maker_id
    taker_id
    claimed_by_maker
    claimed_by_taker
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

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType) => action();
const GetCaravansDocumentString = print(GetCaravansDocument);
const GetOrdersDocumentString = print(GetOrdersDocument);
const GetRealmIdsDocumentString = print(GetRealmIdsDocument);
const GetTradesDocumentString = print(GetTradesDocument);
const GetMyOffersDocumentString = print(GetMyOffersDocument);
const GetTradeResourcesDocumentString = print(GetTradeResourcesDocument);
const GetTradeStatusDocumentString = print(GetTradeStatusDocument);
export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    getCaravans(variables?: GetCaravansQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetCaravansQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetCaravansQuery>(GetCaravansDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getCaravans', 'query');
    },
    getOrders(variables?: GetOrdersQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetOrdersQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetOrdersQuery>(GetOrdersDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getOrders', 'query');
    },
    getRealmIds(variables?: GetRealmIdsQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetRealmIdsQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetRealmIdsQuery>(GetRealmIdsDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getRealmIds', 'query');
    },
    getTrades(variables?: GetTradesQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetTradesQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetTradesQuery>(GetTradesDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getTrades', 'query');
    },
    getMyOffers(variables: GetMyOffersQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetMyOffersQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetMyOffersQuery>(GetMyOffersDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getMyOffers', 'query');
    },
    getTradeResources(variables: GetTradeResourcesQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetTradeResourcesQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetTradeResourcesQuery>(GetTradeResourcesDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getTradeResources', 'query');
    },
    getTradeStatus(variables: GetTradeStatusQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetTradeStatusQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetTradeStatusQuery>(GetTradeStatusDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getTradeStatus', 'query');
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;