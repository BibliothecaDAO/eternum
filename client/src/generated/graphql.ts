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
  Address: { input: any; output: any; }
  ContractAddress: { input: any; output: any; }
  DateTime: { input: any; output: any; }
  TradeStatus: { input: any; output: any; }
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

export type Arrivaltime = {
  __typename?: 'Arrivaltime';
  arrives_at: Scalars['u64']['output'];
};

export type Authrole = {
  __typename?: 'Authrole';
  id: Scalars['felt252']['output'];
};

export type Authstatus = {
  __typename?: 'Authstatus';
  is_authorized: Scalars['bool']['output'];
};

export type Balance = {
  __typename?: 'Balance';
  value: Scalars['u128']['output'];
};

export type Buildingconfig = {
  __typename?: 'Buildingconfig';
  base_sqm: Scalars['u128']['output'];
  workhut_cost: Scalars['u128']['output'];
};

export type Buildingcost = {
  __typename?: 'Buildingcost';
  cost: Scalars['u128']['output'];
  resource_type: Scalars['felt252']['output'];
};

export type Buildingtypeconfig = {
  __typename?: 'Buildingtypeconfig';
  id: Scalars['felt252']['output'];
  resource_types_count: Scalars['u8']['output'];
  resource_types_packed: Scalars['u256']['output'];
  sqm: Scalars['u128']['output'];
};

export type Capacity = {
  __typename?: 'Capacity';
  weight_gram: Scalars['u128']['output'];
};

export type Capacityconfig = {
  __typename?: 'Capacityconfig';
  entity_type: Scalars['u128']['output'];
  weight_gram: Scalars['u128']['output'];
};

export type Caravan = {
  __typename?: 'Caravan';
  caravan_id: Scalars['ID']['output'];
};

export type Caravanmembers = {
  __typename?: 'Caravanmembers';
  count: Scalars['usize']['output'];
  key: Scalars['ID']['output'];
};

export type ComponentUnion = Age | Arrivaltime | Authrole | Authstatus | Balance | Buildingconfig | Buildingcost | Buildingtypeconfig | Capacity | Capacityconfig | Caravan | Caravanmembers | Foreignkey | Fungibleentities | Labor | Laborconfig | Laborcostamount | Laborcostresources | Metadata | Movable | Owner | Position | Quantity | Quantitytracker | Realm | Resource | Speedconfig | Status | Tokenapproval | Trade | Travelconfig | Vault | Weightconfig | Worldconfig;

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

export type Foreignkey = {
  __typename?: 'Foreignkey';
  entity_id: Scalars['ID']['output'];
};

export type Fungibleentities = {
  __typename?: 'Fungibleentities';
  count: Scalars['usize']['output'];
  key: Scalars['ID']['output'];
};

export type Labor = {
  __typename?: 'Labor';
  balance: Scalars['u128']['output'];
  last_harvest: Scalars['u128']['output'];
  multiplier: Scalars['u128']['output'];
};

export type Laborconfig = {
  __typename?: 'Laborconfig';
  base_labor_units: Scalars['u128']['output'];
  base_resources_per_cycle: Scalars['u128']['output'];
  vault_percentage: Scalars['u128']['output'];
};

export type Laborcostamount = {
  __typename?: 'Laborcostamount';
  resource_type_cost: Scalars['felt252']['output'];
  resource_type_labor: Scalars['felt252']['output'];
  value: Scalars['u128']['output'];
};

export type Laborcostresources = {
  __typename?: 'Laborcostresources';
  resource_type_labor: Scalars['felt252']['output'];
  resource_types_count: Scalars['u8']['output'];
  resource_types_packed: Scalars['u128']['output'];
};

export type Metadata = {
  __typename?: 'Metadata';
  entity_type: Scalars['u128']['output'];
};

export type Movable = {
  __typename?: 'Movable';
  blocked: Scalars['bool']['output'];
  sec_per_km: Scalars['u16']['output'];
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

export type Quantitytracker = {
  __typename?: 'Quantitytracker';
  count: Scalars['u128']['output'];
};

export type Query = {
  __typename?: 'Query';
  ageComponents?: Maybe<Array<Maybe<Age>>>;
  arrivaltimeComponents?: Maybe<Array<Maybe<Arrivaltime>>>;
  authroleComponents?: Maybe<Array<Maybe<Authrole>>>;
  authstatusComponents?: Maybe<Array<Maybe<Authstatus>>>;
  balanceComponents?: Maybe<Array<Maybe<Balance>>>;
  buildingconfigComponents?: Maybe<Array<Maybe<Buildingconfig>>>;
  buildingcostComponents?: Maybe<Array<Maybe<Buildingcost>>>;
  buildingtypeconfigComponents?: Maybe<Array<Maybe<Buildingtypeconfig>>>;
  capacityComponents?: Maybe<Array<Maybe<Capacity>>>;
  capacityconfigComponents?: Maybe<Array<Maybe<Capacityconfig>>>;
  caravanComponents?: Maybe<Array<Maybe<Caravan>>>;
  caravanmembersComponents?: Maybe<Array<Maybe<Caravanmembers>>>;
  entities?: Maybe<Array<Maybe<Entity>>>;
  entity: Entity;
  event: Event;
  events?: Maybe<Array<Maybe<Event>>>;
  foreignkeyComponents?: Maybe<Array<Maybe<Foreignkey>>>;
  fungibleentitiesComponents?: Maybe<Array<Maybe<Fungibleentities>>>;
  laborComponents?: Maybe<Array<Maybe<Labor>>>;
  laborconfigComponents?: Maybe<Array<Maybe<Laborconfig>>>;
  laborcostamountComponents?: Maybe<Array<Maybe<Laborcostamount>>>;
  laborcostresourcesComponents?: Maybe<Array<Maybe<Laborcostresources>>>;
  metadataComponents?: Maybe<Array<Maybe<Metadata>>>;
  movableComponents?: Maybe<Array<Maybe<Movable>>>;
  ownerComponents?: Maybe<Array<Maybe<Owner>>>;
  positionComponents?: Maybe<Array<Maybe<Position>>>;
  quantityComponents?: Maybe<Array<Maybe<Quantity>>>;
  quantitytrackerComponents?: Maybe<Array<Maybe<Quantitytracker>>>;
  realmComponents?: Maybe<Array<Maybe<Realm>>>;
  resourceComponents?: Maybe<Array<Maybe<Resource>>>;
  speedconfigComponents?: Maybe<Array<Maybe<Speedconfig>>>;
  statusComponents?: Maybe<Array<Maybe<Status>>>;
  system: System;
  systemCall: SystemCall;
  systemCalls?: Maybe<Array<Maybe<SystemCall>>>;
  systems?: Maybe<Array<Maybe<System>>>;
  tokenapprovalComponents?: Maybe<Array<Maybe<Tokenapproval>>>;
  tradeComponents?: Maybe<Array<Maybe<Trade>>>;
  travelconfigComponents?: Maybe<Array<Maybe<Travelconfig>>>;
  vaultComponents?: Maybe<Array<Maybe<Vault>>>;
  weightconfigComponents?: Maybe<Array<Maybe<Weightconfig>>>;
  worldconfigComponents?: Maybe<Array<Maybe<Worldconfig>>>;
};


export type QueryAgeComponentsArgs = {
  born_at?: InputMaybe<Scalars['u64']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryArrivaltimeComponentsArgs = {
  arrives_at?: InputMaybe<Scalars['u64']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryAuthroleComponentsArgs = {
  id?: InputMaybe<Scalars['felt252']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryAuthstatusComponentsArgs = {
  is_authorized?: InputMaybe<Scalars['bool']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryBalanceComponentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  value?: InputMaybe<Scalars['u128']['input']>;
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
  caravan_id?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryCaravanmembersComponentsArgs = {
  count?: InputMaybe<Scalars['usize']['input']>;
  key?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryEntitiesArgs = {
  componentName?: InputMaybe<Scalars['String']['input']>;
  keys?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
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
  entity_id?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryFungibleentitiesComponentsArgs = {
  count?: InputMaybe<Scalars['usize']['input']>;
  key?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryLaborComponentsArgs = {
  balance?: InputMaybe<Scalars['u128']['input']>;
  last_harvest?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  multiplier?: InputMaybe<Scalars['u128']['input']>;
};


export type QueryLaborconfigComponentsArgs = {
  base_labor_units?: InputMaybe<Scalars['u128']['input']>;
  base_resources_per_cycle?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  vault_percentage?: InputMaybe<Scalars['u128']['input']>;
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
  realm_id?: InputMaybe<Scalars['ID']['input']>;
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
  value?: InputMaybe<Scalars['TradeStatus']['input']>;
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


export type QueryTokenapprovalComponentsArgs = {
  address?: InputMaybe<Scalars['ContractAddress']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryTradeComponentsArgs = {
  claimed_by_maker?: InputMaybe<Scalars['bool']['input']>;
  claimed_by_taker?: InputMaybe<Scalars['bool']['input']>;
  expires_at?: InputMaybe<Scalars['u64']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  maker_id?: InputMaybe<Scalars['ID']['input']>;
  maker_order_id?: InputMaybe<Scalars['ID']['input']>;
  taker_id?: InputMaybe<Scalars['ID']['input']>;
  taker_needs_caravan?: InputMaybe<Scalars['bool']['input']>;
  taker_order_id?: InputMaybe<Scalars['ID']['input']>;
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
  base_resources_per_day?: InputMaybe<Scalars['u128']['input']>;
  day_time?: InputMaybe<Scalars['u128']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  lords_per_day?: InputMaybe<Scalars['u128']['input']>;
  realm_l2_contract?: InputMaybe<Scalars['ContractAddress']['input']>;
  tick_time?: InputMaybe<Scalars['u128']['input']>;
  vault_bp?: InputMaybe<Scalars['u128']['input']>;
  vault_time?: InputMaybe<Scalars['u128']['input']>;
};

export type Realm = {
  __typename?: 'Realm';
  cities: Scalars['u8']['output'];
  harbors: Scalars['u8']['output'];
  order: Scalars['u8']['output'];
  realm_id: Scalars['ID']['output'];
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

export type Speedconfig = {
  __typename?: 'Speedconfig';
  entity_type: Scalars['u128']['output'];
  sec_per_km: Scalars['u16']['output'];
};

export type Status = {
  __typename?: 'Status';
  value: Scalars['TradeStatus']['output'];
};

export type System = {
  __typename?: 'System';
  address: Scalars['Address']['output'];
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

export type Tokenapproval = {
  __typename?: 'Tokenapproval';
  address: Scalars['ContractAddress']['output'];
};

export type Trade = {
  __typename?: 'Trade';
  claimed_by_maker: Scalars['bool']['output'];
  claimed_by_taker: Scalars['bool']['output'];
  expires_at: Scalars['u64']['output'];
  maker_id: Scalars['ID']['output'];
  maker_order_id: Scalars['ID']['output'];
  taker_id: Scalars['ID']['output'];
  taker_needs_caravan: Scalars['bool']['output'];
  taker_order_id: Scalars['ID']['output'];
};

export type Travelconfig = {
  __typename?: 'Travelconfig';
  free_transport_per_city: Scalars['u128']['output'];
};

export type Vault = {
  __typename?: 'Vault';
  balance: Scalars['u128']['output'];
};

export type Weightconfig = {
  __typename?: 'Weightconfig';
  entity_type: Scalars['u128']['output'];
  weight_gram: Scalars['u128']['output'];
};

export type Worldconfig = {
  __typename?: 'Worldconfig';
  base_resources_per_day: Scalars['u128']['output'];
  day_time: Scalars['u128']['output'];
  lords_per_day: Scalars['u128']['output'];
  realm_l2_contract: Scalars['ContractAddress']['output'];
  tick_time: Scalars['u128']['output'];
  vault_bp: Scalars['u128']['output'];
  vault_time: Scalars['u128']['output'];
};

export type GetCaravansQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCaravansQuery = { __typename?: 'Query', entities?: Array<{ __typename?: 'Entity', keys: string } | null> | null };

export type GetTradesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetTradesQuery = { __typename?: 'Query', entities?: Array<{ __typename?: 'Entity', keys: string } | null> | null };


export const GetCaravansDocument = gql`
    query getCaravans {
  entities(keys: ["%"], componentName: "CaravanMembers") {
    keys
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
const GetCaravansDocumentString = print(GetCaravansDocument);
const GetTradesDocumentString = print(GetTradesDocument);
export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    getCaravans(variables?: GetCaravansQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetCaravansQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetCaravansQuery>(GetCaravansDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getCaravans', 'query');
    },
    getTrades(variables?: GetTradesQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<{ data: GetTradesQuery; extensions?: any; headers: Dom.Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetTradesQuery>(GetTradesDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getTrades', 'query');
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;