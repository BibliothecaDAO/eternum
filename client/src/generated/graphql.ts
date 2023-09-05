import { GraphQLClient } from 'graphql-request';
import { GraphQLClientRequestHeaders } from 'graphql-request/build/cjs/types';
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
  ID: { input: string | number; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  ContractAddress: { input: any; output: any; }
  Cursor: { input: any; output: any; }
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
  born_at?: Maybe<Scalars['u64']['output']>;
  entity?: Maybe<Entity>;
};

export type AgeConnection = {
  __typename?: 'AgeConnection';
  edges?: Maybe<Array<Maybe<AgeEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type AgeEdge = {
  __typename?: 'AgeEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Age>;
};

export type AgeOrder = {
  direction: Direction;
  field: AgeOrderOrderField;
};

export enum AgeOrderOrderField {
  BornAt = 'BORN_AT'
}

export type AgeWhereInput = {
  born_at?: InputMaybe<Scalars['Int']['input']>;
  born_atGT?: InputMaybe<Scalars['Int']['input']>;
  born_atGTE?: InputMaybe<Scalars['Int']['input']>;
  born_atLT?: InputMaybe<Scalars['Int']['input']>;
  born_atLTE?: InputMaybe<Scalars['Int']['input']>;
  born_atNEQ?: InputMaybe<Scalars['Int']['input']>;
};

export type ArrivalTime = {
  __typename?: 'ArrivalTime';
  arrives_at?: Maybe<Scalars['u64']['output']>;
  entity?: Maybe<Entity>;
};

export type ArrivalTimeConnection = {
  __typename?: 'ArrivalTimeConnection';
  edges?: Maybe<Array<Maybe<ArrivalTimeEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type ArrivalTimeEdge = {
  __typename?: 'ArrivalTimeEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<ArrivalTime>;
};

export type ArrivalTimeOrder = {
  direction: Direction;
  field: ArrivalTimeOrderOrderField;
};

export enum ArrivalTimeOrderOrderField {
  ArrivesAt = 'ARRIVES_AT'
}

export type ArrivalTimeWhereInput = {
  arrives_at?: InputMaybe<Scalars['Int']['input']>;
  arrives_atGT?: InputMaybe<Scalars['Int']['input']>;
  arrives_atGTE?: InputMaybe<Scalars['Int']['input']>;
  arrives_atLT?: InputMaybe<Scalars['Int']['input']>;
  arrives_atLTE?: InputMaybe<Scalars['Int']['input']>;
  arrives_atNEQ?: InputMaybe<Scalars['Int']['input']>;
};

export type BuildingConfig = {
  __typename?: 'BuildingConfig';
  base_sqm?: Maybe<Scalars['u128']['output']>;
  entity?: Maybe<Entity>;
  workhut_cost?: Maybe<Scalars['u128']['output']>;
};

export type BuildingConfigConnection = {
  __typename?: 'BuildingConfigConnection';
  edges?: Maybe<Array<Maybe<BuildingConfigEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type BuildingConfigEdge = {
  __typename?: 'BuildingConfigEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<BuildingConfig>;
};

export type BuildingConfigOrder = {
  direction: Direction;
  field: BuildingConfigOrderOrderField;
};

export enum BuildingConfigOrderOrderField {
  BaseSqm = 'BASE_SQM',
  WorkhutCost = 'WORKHUT_COST'
}

export type BuildingConfigWhereInput = {
  base_sqm?: InputMaybe<Scalars['String']['input']>;
  base_sqmGT?: InputMaybe<Scalars['String']['input']>;
  base_sqmGTE?: InputMaybe<Scalars['String']['input']>;
  base_sqmLT?: InputMaybe<Scalars['String']['input']>;
  base_sqmLTE?: InputMaybe<Scalars['String']['input']>;
  base_sqmNEQ?: InputMaybe<Scalars['String']['input']>;
  workhut_cost?: InputMaybe<Scalars['String']['input']>;
  workhut_costGT?: InputMaybe<Scalars['String']['input']>;
  workhut_costGTE?: InputMaybe<Scalars['String']['input']>;
  workhut_costLT?: InputMaybe<Scalars['String']['input']>;
  workhut_costLTE?: InputMaybe<Scalars['String']['input']>;
  workhut_costNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type BuildingCost = {
  __typename?: 'BuildingCost';
  cost?: Maybe<Scalars['u128']['output']>;
  entity?: Maybe<Entity>;
  resource_type?: Maybe<Scalars['felt252']['output']>;
};

export type BuildingCostConnection = {
  __typename?: 'BuildingCostConnection';
  edges?: Maybe<Array<Maybe<BuildingCostEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type BuildingCostEdge = {
  __typename?: 'BuildingCostEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<BuildingCost>;
};

export type BuildingCostOrder = {
  direction: Direction;
  field: BuildingCostOrderOrderField;
};

export enum BuildingCostOrderOrderField {
  Cost = 'COST',
  ResourceType = 'RESOURCE_TYPE'
}

export type BuildingCostWhereInput = {
  cost?: InputMaybe<Scalars['String']['input']>;
  costGT?: InputMaybe<Scalars['String']['input']>;
  costGTE?: InputMaybe<Scalars['String']['input']>;
  costLT?: InputMaybe<Scalars['String']['input']>;
  costLTE?: InputMaybe<Scalars['String']['input']>;
  costNEQ?: InputMaybe<Scalars['String']['input']>;
  resource_type?: InputMaybe<Scalars['String']['input']>;
  resource_typeGT?: InputMaybe<Scalars['String']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['String']['input']>;
  resource_typeLT?: InputMaybe<Scalars['String']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['String']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type BuildingTypeConfig = {
  __typename?: 'BuildingTypeConfig';
  entity?: Maybe<Entity>;
  id?: Maybe<Scalars['felt252']['output']>;
  resource_types_count?: Maybe<Scalars['u8']['output']>;
  resource_types_packed?: Maybe<Scalars['u256']['output']>;
  sqm?: Maybe<Scalars['u128']['output']>;
};

export type BuildingTypeConfigConnection = {
  __typename?: 'BuildingTypeConfigConnection';
  edges?: Maybe<Array<Maybe<BuildingTypeConfigEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type BuildingTypeConfigEdge = {
  __typename?: 'BuildingTypeConfigEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<BuildingTypeConfig>;
};

export type BuildingTypeConfigOrder = {
  direction: Direction;
  field: BuildingTypeConfigOrderOrderField;
};

export enum BuildingTypeConfigOrderOrderField {
  Id = 'ID',
  ResourceTypesCount = 'RESOURCE_TYPES_COUNT',
  ResourceTypesPacked = 'RESOURCE_TYPES_PACKED',
  Sqm = 'SQM'
}

export type BuildingTypeConfigWhereInput = {
  id?: InputMaybe<Scalars['String']['input']>;
  idGT?: InputMaybe<Scalars['String']['input']>;
  idGTE?: InputMaybe<Scalars['String']['input']>;
  idLT?: InputMaybe<Scalars['String']['input']>;
  idLTE?: InputMaybe<Scalars['String']['input']>;
  idNEQ?: InputMaybe<Scalars['String']['input']>;
  resource_types_count?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countGT?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countGTE?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countLT?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countLTE?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countNEQ?: InputMaybe<Scalars['Int']['input']>;
  resource_types_packed?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedGT?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedGTE?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedLT?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedLTE?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedNEQ?: InputMaybe<Scalars['String']['input']>;
  sqm?: InputMaybe<Scalars['String']['input']>;
  sqmGT?: InputMaybe<Scalars['String']['input']>;
  sqmGTE?: InputMaybe<Scalars['String']['input']>;
  sqmLT?: InputMaybe<Scalars['String']['input']>;
  sqmLTE?: InputMaybe<Scalars['String']['input']>;
  sqmNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type Capacity = {
  __typename?: 'Capacity';
  entity?: Maybe<Entity>;
  weight_gram?: Maybe<Scalars['u128']['output']>;
};

export type CapacityConfig = {
  __typename?: 'CapacityConfig';
  entity?: Maybe<Entity>;
  entity_type?: Maybe<Scalars['u128']['output']>;
  weight_gram?: Maybe<Scalars['u128']['output']>;
};

export type CapacityConfigConnection = {
  __typename?: 'CapacityConfigConnection';
  edges?: Maybe<Array<Maybe<CapacityConfigEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type CapacityConfigEdge = {
  __typename?: 'CapacityConfigEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<CapacityConfig>;
};

export type CapacityConfigOrder = {
  direction: Direction;
  field: CapacityConfigOrderOrderField;
};

export enum CapacityConfigOrderOrderField {
  EntityType = 'ENTITY_TYPE',
  WeightGram = 'WEIGHT_GRAM'
}

export type CapacityConfigWhereInput = {
  entity_type?: InputMaybe<Scalars['String']['input']>;
  entity_typeGT?: InputMaybe<Scalars['String']['input']>;
  entity_typeGTE?: InputMaybe<Scalars['String']['input']>;
  entity_typeLT?: InputMaybe<Scalars['String']['input']>;
  entity_typeLTE?: InputMaybe<Scalars['String']['input']>;
  entity_typeNEQ?: InputMaybe<Scalars['String']['input']>;
  weight_gram?: InputMaybe<Scalars['String']['input']>;
  weight_gramGT?: InputMaybe<Scalars['String']['input']>;
  weight_gramGTE?: InputMaybe<Scalars['String']['input']>;
  weight_gramLT?: InputMaybe<Scalars['String']['input']>;
  weight_gramLTE?: InputMaybe<Scalars['String']['input']>;
  weight_gramNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type CapacityConnection = {
  __typename?: 'CapacityConnection';
  edges?: Maybe<Array<Maybe<CapacityEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type CapacityEdge = {
  __typename?: 'CapacityEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Capacity>;
};

export type CapacityOrder = {
  direction: Direction;
  field: CapacityOrderOrderField;
};

export enum CapacityOrderOrderField {
  WeightGram = 'WEIGHT_GRAM'
}

export type CapacityWhereInput = {
  weight_gram?: InputMaybe<Scalars['String']['input']>;
  weight_gramGT?: InputMaybe<Scalars['String']['input']>;
  weight_gramGTE?: InputMaybe<Scalars['String']['input']>;
  weight_gramLT?: InputMaybe<Scalars['String']['input']>;
  weight_gramLTE?: InputMaybe<Scalars['String']['input']>;
  weight_gramNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type Caravan = {
  __typename?: 'Caravan';
  caravan_id?: Maybe<Scalars['u128']['output']>;
  entity?: Maybe<Entity>;
};

export type CaravanConnection = {
  __typename?: 'CaravanConnection';
  edges?: Maybe<Array<Maybe<CaravanEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type CaravanEdge = {
  __typename?: 'CaravanEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Caravan>;
};

export type CaravanMembers = {
  __typename?: 'CaravanMembers';
  count?: Maybe<Scalars['usize']['output']>;
  entity?: Maybe<Entity>;
  key?: Maybe<Scalars['u128']['output']>;
};

export type CaravanMembersConnection = {
  __typename?: 'CaravanMembersConnection';
  edges?: Maybe<Array<Maybe<CaravanMembersEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type CaravanMembersEdge = {
  __typename?: 'CaravanMembersEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<CaravanMembers>;
};

export type CaravanMembersOrder = {
  direction: Direction;
  field: CaravanMembersOrderOrderField;
};

export enum CaravanMembersOrderOrderField {
  Count = 'COUNT',
  Key = 'KEY'
}

export type CaravanMembersWhereInput = {
  count?: InputMaybe<Scalars['Int']['input']>;
  countGT?: InputMaybe<Scalars['Int']['input']>;
  countGTE?: InputMaybe<Scalars['Int']['input']>;
  countLT?: InputMaybe<Scalars['Int']['input']>;
  countLTE?: InputMaybe<Scalars['Int']['input']>;
  countNEQ?: InputMaybe<Scalars['Int']['input']>;
  key?: InputMaybe<Scalars['String']['input']>;
  keyGT?: InputMaybe<Scalars['String']['input']>;
  keyGTE?: InputMaybe<Scalars['String']['input']>;
  keyLT?: InputMaybe<Scalars['String']['input']>;
  keyLTE?: InputMaybe<Scalars['String']['input']>;
  keyNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type CaravanOrder = {
  direction: Direction;
  field: CaravanOrderOrderField;
};

export enum CaravanOrderOrderField {
  CaravanId = 'CARAVAN_ID'
}

export type CaravanWhereInput = {
  caravan_id?: InputMaybe<Scalars['String']['input']>;
  caravan_idGT?: InputMaybe<Scalars['String']['input']>;
  caravan_idGTE?: InputMaybe<Scalars['String']['input']>;
  caravan_idLT?: InputMaybe<Scalars['String']['input']>;
  caravan_idLTE?: InputMaybe<Scalars['String']['input']>;
  caravan_idNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type Component = {
  __typename?: 'Component';
  classHash?: Maybe<Scalars['felt252']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  transactionHash?: Maybe<Scalars['felt252']['output']>;
};

export type ComponentConnection = {
  __typename?: 'ComponentConnection';
  edges?: Maybe<Array<Maybe<ComponentEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type ComponentEdge = {
  __typename?: 'ComponentEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Component>;
};

export type ComponentUnion = Age | ArrivalTime | BuildingConfig | BuildingCost | BuildingTypeConfig | Capacity | CapacityConfig | Caravan | CaravanMembers | ForeignKey | FungibleEntities | Labor | LaborConfig | LaborCostAmount | LaborCostResources | MetaData | Movable | OrderId | OrderResource | Owner | Position | Quantity | QuantityTracker | Realm | Resource | SpeedConfig | Status | Trade | TravelConfig | Vault | WeightConfig | WorldConfig;

export enum Direction {
  Asc = 'ASC',
  Desc = 'DESC'
}

export type Entity = {
  __typename?: 'Entity';
  componentNames?: Maybe<Scalars['String']['output']>;
  components?: Maybe<Array<Maybe<ComponentUnion>>>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  keys?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type EntityConnection = {
  __typename?: 'EntityConnection';
  edges?: Maybe<Array<Maybe<EntityEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type EntityEdge = {
  __typename?: 'EntityEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Entity>;
};

export type Event = {
  __typename?: 'Event';
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  data?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  keys?: Maybe<Scalars['String']['output']>;
  systemCall: SystemCall;
  systemCallId?: Maybe<Scalars['Int']['output']>;
};

export type EventConnection = {
  __typename?: 'EventConnection';
  edges?: Maybe<Array<Maybe<EventEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type EventEdge = {
  __typename?: 'EventEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Event>;
};

export type ForeignKey = {
  __typename?: 'ForeignKey';
  entity?: Maybe<Entity>;
  entity_id?: Maybe<Scalars['u128']['output']>;
};

export type ForeignKeyConnection = {
  __typename?: 'ForeignKeyConnection';
  edges?: Maybe<Array<Maybe<ForeignKeyEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type ForeignKeyEdge = {
  __typename?: 'ForeignKeyEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<ForeignKey>;
};

export type ForeignKeyOrder = {
  direction: Direction;
  field: ForeignKeyOrderOrderField;
};

export enum ForeignKeyOrderOrderField {
  EntityId = 'ENTITY_ID'
}

export type ForeignKeyWhereInput = {
  entity_id?: InputMaybe<Scalars['String']['input']>;
  entity_idGT?: InputMaybe<Scalars['String']['input']>;
  entity_idGTE?: InputMaybe<Scalars['String']['input']>;
  entity_idLT?: InputMaybe<Scalars['String']['input']>;
  entity_idLTE?: InputMaybe<Scalars['String']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type FungibleEntities = {
  __typename?: 'FungibleEntities';
  count?: Maybe<Scalars['usize']['output']>;
  entity?: Maybe<Entity>;
  key?: Maybe<Scalars['u128']['output']>;
};

export type FungibleEntitiesConnection = {
  __typename?: 'FungibleEntitiesConnection';
  edges?: Maybe<Array<Maybe<FungibleEntitiesEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type FungibleEntitiesEdge = {
  __typename?: 'FungibleEntitiesEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<FungibleEntities>;
};

export type FungibleEntitiesOrder = {
  direction: Direction;
  field: FungibleEntitiesOrderOrderField;
};

export enum FungibleEntitiesOrderOrderField {
  Count = 'COUNT',
  Key = 'KEY'
}

export type FungibleEntitiesWhereInput = {
  count?: InputMaybe<Scalars['Int']['input']>;
  countGT?: InputMaybe<Scalars['Int']['input']>;
  countGTE?: InputMaybe<Scalars['Int']['input']>;
  countLT?: InputMaybe<Scalars['Int']['input']>;
  countLTE?: InputMaybe<Scalars['Int']['input']>;
  countNEQ?: InputMaybe<Scalars['Int']['input']>;
  key?: InputMaybe<Scalars['String']['input']>;
  keyGT?: InputMaybe<Scalars['String']['input']>;
  keyGTE?: InputMaybe<Scalars['String']['input']>;
  keyLT?: InputMaybe<Scalars['String']['input']>;
  keyLTE?: InputMaybe<Scalars['String']['input']>;
  keyNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type Labor = {
  __typename?: 'Labor';
  balance?: Maybe<Scalars['u64']['output']>;
  entity?: Maybe<Entity>;
  last_harvest?: Maybe<Scalars['u64']['output']>;
  multiplier?: Maybe<Scalars['u64']['output']>;
};

export type LaborConfig = {
  __typename?: 'LaborConfig';
  base_food_per_cycle?: Maybe<Scalars['u128']['output']>;
  base_labor_units?: Maybe<Scalars['u64']['output']>;
  base_resources_per_cycle?: Maybe<Scalars['u128']['output']>;
  entity?: Maybe<Entity>;
};

export type LaborConfigConnection = {
  __typename?: 'LaborConfigConnection';
  edges?: Maybe<Array<Maybe<LaborConfigEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type LaborConfigEdge = {
  __typename?: 'LaborConfigEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<LaborConfig>;
};

export type LaborConfigOrder = {
  direction: Direction;
  field: LaborConfigOrderOrderField;
};

export enum LaborConfigOrderOrderField {
  BaseFoodPerCycle = 'BASE_FOOD_PER_CYCLE',
  BaseLaborUnits = 'BASE_LABOR_UNITS',
  BaseResourcesPerCycle = 'BASE_RESOURCES_PER_CYCLE'
}

export type LaborConfigWhereInput = {
  base_food_per_cycle?: InputMaybe<Scalars['String']['input']>;
  base_food_per_cycleGT?: InputMaybe<Scalars['String']['input']>;
  base_food_per_cycleGTE?: InputMaybe<Scalars['String']['input']>;
  base_food_per_cycleLT?: InputMaybe<Scalars['String']['input']>;
  base_food_per_cycleLTE?: InputMaybe<Scalars['String']['input']>;
  base_food_per_cycleNEQ?: InputMaybe<Scalars['String']['input']>;
  base_labor_units?: InputMaybe<Scalars['Int']['input']>;
  base_labor_unitsGT?: InputMaybe<Scalars['Int']['input']>;
  base_labor_unitsGTE?: InputMaybe<Scalars['Int']['input']>;
  base_labor_unitsLT?: InputMaybe<Scalars['Int']['input']>;
  base_labor_unitsLTE?: InputMaybe<Scalars['Int']['input']>;
  base_labor_unitsNEQ?: InputMaybe<Scalars['Int']['input']>;
  base_resources_per_cycle?: InputMaybe<Scalars['String']['input']>;
  base_resources_per_cycleGT?: InputMaybe<Scalars['String']['input']>;
  base_resources_per_cycleGTE?: InputMaybe<Scalars['String']['input']>;
  base_resources_per_cycleLT?: InputMaybe<Scalars['String']['input']>;
  base_resources_per_cycleLTE?: InputMaybe<Scalars['String']['input']>;
  base_resources_per_cycleNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type LaborConnection = {
  __typename?: 'LaborConnection';
  edges?: Maybe<Array<Maybe<LaborEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type LaborCostAmount = {
  __typename?: 'LaborCostAmount';
  entity?: Maybe<Entity>;
  value?: Maybe<Scalars['u128']['output']>;
};

export type LaborCostAmountConnection = {
  __typename?: 'LaborCostAmountConnection';
  edges?: Maybe<Array<Maybe<LaborCostAmountEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type LaborCostAmountEdge = {
  __typename?: 'LaborCostAmountEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<LaborCostAmount>;
};

export type LaborCostAmountOrder = {
  direction: Direction;
  field: LaborCostAmountOrderOrderField;
};

export enum LaborCostAmountOrderOrderField {
  Value = 'VALUE'
}

export type LaborCostAmountWhereInput = {
  value?: InputMaybe<Scalars['String']['input']>;
  valueGT?: InputMaybe<Scalars['String']['input']>;
  valueGTE?: InputMaybe<Scalars['String']['input']>;
  valueLT?: InputMaybe<Scalars['String']['input']>;
  valueLTE?: InputMaybe<Scalars['String']['input']>;
  valueNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type LaborCostResources = {
  __typename?: 'LaborCostResources';
  entity?: Maybe<Entity>;
  resource_types_count?: Maybe<Scalars['u8']['output']>;
  resource_types_packed?: Maybe<Scalars['u128']['output']>;
};

export type LaborCostResourcesConnection = {
  __typename?: 'LaborCostResourcesConnection';
  edges?: Maybe<Array<Maybe<LaborCostResourcesEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type LaborCostResourcesEdge = {
  __typename?: 'LaborCostResourcesEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<LaborCostResources>;
};

export type LaborCostResourcesOrder = {
  direction: Direction;
  field: LaborCostResourcesOrderOrderField;
};

export enum LaborCostResourcesOrderOrderField {
  ResourceTypesCount = 'RESOURCE_TYPES_COUNT',
  ResourceTypesPacked = 'RESOURCE_TYPES_PACKED'
}

export type LaborCostResourcesWhereInput = {
  resource_types_count?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countGT?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countGTE?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countLT?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countLTE?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countNEQ?: InputMaybe<Scalars['Int']['input']>;
  resource_types_packed?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedGT?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedGTE?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedLT?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedLTE?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type LaborEdge = {
  __typename?: 'LaborEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Labor>;
};

export type LaborOrder = {
  direction: Direction;
  field: LaborOrderOrderField;
};

export enum LaborOrderOrderField {
  Balance = 'BALANCE',
  LastHarvest = 'LAST_HARVEST',
  Multiplier = 'MULTIPLIER'
}

export type LaborWhereInput = {
  balance?: InputMaybe<Scalars['Int']['input']>;
  balanceGT?: InputMaybe<Scalars['Int']['input']>;
  balanceGTE?: InputMaybe<Scalars['Int']['input']>;
  balanceLT?: InputMaybe<Scalars['Int']['input']>;
  balanceLTE?: InputMaybe<Scalars['Int']['input']>;
  balanceNEQ?: InputMaybe<Scalars['Int']['input']>;
  last_harvest?: InputMaybe<Scalars['Int']['input']>;
  last_harvestGT?: InputMaybe<Scalars['Int']['input']>;
  last_harvestGTE?: InputMaybe<Scalars['Int']['input']>;
  last_harvestLT?: InputMaybe<Scalars['Int']['input']>;
  last_harvestLTE?: InputMaybe<Scalars['Int']['input']>;
  last_harvestNEQ?: InputMaybe<Scalars['Int']['input']>;
  multiplier?: InputMaybe<Scalars['Int']['input']>;
  multiplierGT?: InputMaybe<Scalars['Int']['input']>;
  multiplierGTE?: InputMaybe<Scalars['Int']['input']>;
  multiplierLT?: InputMaybe<Scalars['Int']['input']>;
  multiplierLTE?: InputMaybe<Scalars['Int']['input']>;
  multiplierNEQ?: InputMaybe<Scalars['Int']['input']>;
};

export type MetaData = {
  __typename?: 'MetaData';
  entity?: Maybe<Entity>;
  entity_type?: Maybe<Scalars['u128']['output']>;
};

export type MetaDataConnection = {
  __typename?: 'MetaDataConnection';
  edges?: Maybe<Array<Maybe<MetaDataEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type MetaDataEdge = {
  __typename?: 'MetaDataEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<MetaData>;
};

export type MetaDataOrder = {
  direction: Direction;
  field: MetaDataOrderOrderField;
};

export enum MetaDataOrderOrderField {
  EntityType = 'ENTITY_TYPE'
}

export type MetaDataWhereInput = {
  entity_type?: InputMaybe<Scalars['String']['input']>;
  entity_typeGT?: InputMaybe<Scalars['String']['input']>;
  entity_typeGTE?: InputMaybe<Scalars['String']['input']>;
  entity_typeLT?: InputMaybe<Scalars['String']['input']>;
  entity_typeLTE?: InputMaybe<Scalars['String']['input']>;
  entity_typeNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type Movable = {
  __typename?: 'Movable';
  blocked?: Maybe<Scalars['bool']['output']>;
  entity?: Maybe<Entity>;
  sec_per_km?: Maybe<Scalars['u16']['output']>;
};

export type MovableConnection = {
  __typename?: 'MovableConnection';
  edges?: Maybe<Array<Maybe<MovableEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type MovableEdge = {
  __typename?: 'MovableEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Movable>;
};

export type MovableOrder = {
  direction: Direction;
  field: MovableOrderOrderField;
};

export enum MovableOrderOrderField {
  Blocked = 'BLOCKED',
  SecPerKm = 'SEC_PER_KM'
}

export type MovableWhereInput = {
  blocked?: InputMaybe<Scalars['Int']['input']>;
  blockedGT?: InputMaybe<Scalars['Int']['input']>;
  blockedGTE?: InputMaybe<Scalars['Int']['input']>;
  blockedLT?: InputMaybe<Scalars['Int']['input']>;
  blockedLTE?: InputMaybe<Scalars['Int']['input']>;
  blockedNEQ?: InputMaybe<Scalars['Int']['input']>;
  sec_per_km?: InputMaybe<Scalars['Int']['input']>;
  sec_per_kmGT?: InputMaybe<Scalars['Int']['input']>;
  sec_per_kmGTE?: InputMaybe<Scalars['Int']['input']>;
  sec_per_kmLT?: InputMaybe<Scalars['Int']['input']>;
  sec_per_kmLTE?: InputMaybe<Scalars['Int']['input']>;
  sec_per_kmNEQ?: InputMaybe<Scalars['Int']['input']>;
};

export type OrderId = {
  __typename?: 'OrderId';
  entity?: Maybe<Entity>;
  id?: Maybe<Scalars['u128']['output']>;
};

export type OrderIdConnection = {
  __typename?: 'OrderIdConnection';
  edges?: Maybe<Array<Maybe<OrderIdEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type OrderIdEdge = {
  __typename?: 'OrderIdEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<OrderId>;
};

export type OrderIdOrder = {
  direction: Direction;
  field: OrderIdOrderOrderField;
};

export enum OrderIdOrderOrderField {
  Id = 'ID'
}

export type OrderIdWhereInput = {
  id?: InputMaybe<Scalars['String']['input']>;
  idGT?: InputMaybe<Scalars['String']['input']>;
  idGTE?: InputMaybe<Scalars['String']['input']>;
  idLT?: InputMaybe<Scalars['String']['input']>;
  idLTE?: InputMaybe<Scalars['String']['input']>;
  idNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type OrderResource = {
  __typename?: 'OrderResource';
  balance?: Maybe<Scalars['u128']['output']>;
  entity?: Maybe<Entity>;
  resource_type?: Maybe<Scalars['u8']['output']>;
};

export type OrderResourceConnection = {
  __typename?: 'OrderResourceConnection';
  edges?: Maybe<Array<Maybe<OrderResourceEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type OrderResourceEdge = {
  __typename?: 'OrderResourceEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<OrderResource>;
};

export type OrderResourceOrder = {
  direction: Direction;
  field: OrderResourceOrderOrderField;
};

export enum OrderResourceOrderOrderField {
  Balance = 'BALANCE',
  ResourceType = 'RESOURCE_TYPE'
}

export type OrderResourceWhereInput = {
  balance?: InputMaybe<Scalars['String']['input']>;
  balanceGT?: InputMaybe<Scalars['String']['input']>;
  balanceGTE?: InputMaybe<Scalars['String']['input']>;
  balanceLT?: InputMaybe<Scalars['String']['input']>;
  balanceLTE?: InputMaybe<Scalars['String']['input']>;
  balanceNEQ?: InputMaybe<Scalars['String']['input']>;
  resource_type?: InputMaybe<Scalars['Int']['input']>;
  resource_typeGT?: InputMaybe<Scalars['Int']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['Int']['input']>;
  resource_typeLT?: InputMaybe<Scalars['Int']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['Int']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['Int']['input']>;
};

export type Owner = {
  __typename?: 'Owner';
  address?: Maybe<Scalars['ContractAddress']['output']>;
  entity?: Maybe<Entity>;
};

export type OwnerConnection = {
  __typename?: 'OwnerConnection';
  edges?: Maybe<Array<Maybe<OwnerEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type OwnerEdge = {
  __typename?: 'OwnerEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Owner>;
};

export type OwnerOrder = {
  direction: Direction;
  field: OwnerOrderOrderField;
};

export enum OwnerOrderOrderField {
  Address = 'ADDRESS'
}

export type OwnerWhereInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  addressGT?: InputMaybe<Scalars['String']['input']>;
  addressGTE?: InputMaybe<Scalars['String']['input']>;
  addressLT?: InputMaybe<Scalars['String']['input']>;
  addressLTE?: InputMaybe<Scalars['String']['input']>;
  addressNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type Position = {
  __typename?: 'Position';
  entity?: Maybe<Entity>;
  x?: Maybe<Scalars['u32']['output']>;
  y?: Maybe<Scalars['u32']['output']>;
};

export type PositionConnection = {
  __typename?: 'PositionConnection';
  edges?: Maybe<Array<Maybe<PositionEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type PositionEdge = {
  __typename?: 'PositionEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Position>;
};

export type PositionOrder = {
  direction: Direction;
  field: PositionOrderOrderField;
};

export enum PositionOrderOrderField {
  X = 'X',
  Y = 'Y'
}

export type PositionWhereInput = {
  x?: InputMaybe<Scalars['Int']['input']>;
  xGT?: InputMaybe<Scalars['Int']['input']>;
  xGTE?: InputMaybe<Scalars['Int']['input']>;
  xLT?: InputMaybe<Scalars['Int']['input']>;
  xLTE?: InputMaybe<Scalars['Int']['input']>;
  xNEQ?: InputMaybe<Scalars['Int']['input']>;
  y?: InputMaybe<Scalars['Int']['input']>;
  yGT?: InputMaybe<Scalars['Int']['input']>;
  yGTE?: InputMaybe<Scalars['Int']['input']>;
  yLT?: InputMaybe<Scalars['Int']['input']>;
  yLTE?: InputMaybe<Scalars['Int']['input']>;
  yNEQ?: InputMaybe<Scalars['Int']['input']>;
};

export type Quantity = {
  __typename?: 'Quantity';
  entity?: Maybe<Entity>;
  value?: Maybe<Scalars['u128']['output']>;
};

export type QuantityConnection = {
  __typename?: 'QuantityConnection';
  edges?: Maybe<Array<Maybe<QuantityEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type QuantityEdge = {
  __typename?: 'QuantityEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Quantity>;
};

export type QuantityOrder = {
  direction: Direction;
  field: QuantityOrderOrderField;
};

export enum QuantityOrderOrderField {
  Value = 'VALUE'
}

export type QuantityTracker = {
  __typename?: 'QuantityTracker';
  count?: Maybe<Scalars['u128']['output']>;
  entity?: Maybe<Entity>;
};

export type QuantityTrackerConnection = {
  __typename?: 'QuantityTrackerConnection';
  edges?: Maybe<Array<Maybe<QuantityTrackerEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type QuantityTrackerEdge = {
  __typename?: 'QuantityTrackerEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<QuantityTracker>;
};

export type QuantityTrackerOrder = {
  direction: Direction;
  field: QuantityTrackerOrderOrderField;
};

export enum QuantityTrackerOrderOrderField {
  Count = 'COUNT'
}

export type QuantityTrackerWhereInput = {
  count?: InputMaybe<Scalars['String']['input']>;
  countGT?: InputMaybe<Scalars['String']['input']>;
  countGTE?: InputMaybe<Scalars['String']['input']>;
  countLT?: InputMaybe<Scalars['String']['input']>;
  countLTE?: InputMaybe<Scalars['String']['input']>;
  countNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type QuantityWhereInput = {
  value?: InputMaybe<Scalars['String']['input']>;
  valueGT?: InputMaybe<Scalars['String']['input']>;
  valueGTE?: InputMaybe<Scalars['String']['input']>;
  valueLT?: InputMaybe<Scalars['String']['input']>;
  valueLTE?: InputMaybe<Scalars['String']['input']>;
  valueNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type Query = {
  __typename?: 'Query';
  ageComponents?: Maybe<AgeConnection>;
  arrivaltimeComponents?: Maybe<ArrivalTimeConnection>;
  buildingconfigComponents?: Maybe<BuildingConfigConnection>;
  buildingcostComponents?: Maybe<BuildingCostConnection>;
  buildingtypeconfigComponents?: Maybe<BuildingTypeConfigConnection>;
  capacityComponents?: Maybe<CapacityConnection>;
  capacityconfigComponents?: Maybe<CapacityConfigConnection>;
  caravanComponents?: Maybe<CaravanConnection>;
  caravanmembersComponents?: Maybe<CaravanMembersConnection>;
  component: Component;
  components?: Maybe<ComponentConnection>;
  entities?: Maybe<EntityConnection>;
  entity: Entity;
  event: Event;
  events?: Maybe<EventConnection>;
  foreignkeyComponents?: Maybe<ForeignKeyConnection>;
  fungibleentitiesComponents?: Maybe<FungibleEntitiesConnection>;
  laborComponents?: Maybe<LaborConnection>;
  laborconfigComponents?: Maybe<LaborConfigConnection>;
  laborcostamountComponents?: Maybe<LaborCostAmountConnection>;
  laborcostresourcesComponents?: Maybe<LaborCostResourcesConnection>;
  metadataComponents?: Maybe<MetaDataConnection>;
  movableComponents?: Maybe<MovableConnection>;
  orderidComponents?: Maybe<OrderIdConnection>;
  orderresourceComponents?: Maybe<OrderResourceConnection>;
  ownerComponents?: Maybe<OwnerConnection>;
  positionComponents?: Maybe<PositionConnection>;
  quantityComponents?: Maybe<QuantityConnection>;
  quantitytrackerComponents?: Maybe<QuantityTrackerConnection>;
  realmComponents?: Maybe<RealmConnection>;
  resourceComponents?: Maybe<ResourceConnection>;
  speedconfigComponents?: Maybe<SpeedConfigConnection>;
  statusComponents?: Maybe<StatusConnection>;
  system: System;
  systemCall: SystemCall;
  systemCalls?: Maybe<SystemCallConnection>;
  systems?: Maybe<SystemConnection>;
  tradeComponents?: Maybe<TradeConnection>;
  travelconfigComponents?: Maybe<TravelConfigConnection>;
  vaultComponents?: Maybe<VaultConnection>;
  weightconfigComponents?: Maybe<WeightConfigConnection>;
  worldconfigComponents?: Maybe<WorldConfigConnection>;
};


export type QueryAgeComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<AgeOrder>;
  where?: InputMaybe<AgeWhereInput>;
};


export type QueryArrivaltimeComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<ArrivalTimeOrder>;
  where?: InputMaybe<ArrivalTimeWhereInput>;
};


export type QueryBuildingconfigComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<BuildingConfigOrder>;
  where?: InputMaybe<BuildingConfigWhereInput>;
};


export type QueryBuildingcostComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<BuildingCostOrder>;
  where?: InputMaybe<BuildingCostWhereInput>;
};


export type QueryBuildingtypeconfigComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<BuildingTypeConfigOrder>;
  where?: InputMaybe<BuildingTypeConfigWhereInput>;
};


export type QueryCapacityComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<CapacityOrder>;
  where?: InputMaybe<CapacityWhereInput>;
};


export type QueryCapacityconfigComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<CapacityConfigOrder>;
  where?: InputMaybe<CapacityConfigWhereInput>;
};


export type QueryCaravanComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<CaravanOrder>;
  where?: InputMaybe<CaravanWhereInput>;
};


export type QueryCaravanmembersComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<CaravanMembersOrder>;
  where?: InputMaybe<CaravanMembersWhereInput>;
};


export type QueryComponentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryEntitiesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  keys?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryEntityArgs = {
  id: Scalars['ID']['input'];
};


export type QueryEventArgs = {
  id: Scalars['ID']['input'];
};


export type QueryForeignkeyComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<ForeignKeyOrder>;
  where?: InputMaybe<ForeignKeyWhereInput>;
};


export type QueryFungibleentitiesComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<FungibleEntitiesOrder>;
  where?: InputMaybe<FungibleEntitiesWhereInput>;
};


export type QueryLaborComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<LaborOrder>;
  where?: InputMaybe<LaborWhereInput>;
};


export type QueryLaborconfigComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<LaborConfigOrder>;
  where?: InputMaybe<LaborConfigWhereInput>;
};


export type QueryLaborcostamountComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<LaborCostAmountOrder>;
  where?: InputMaybe<LaborCostAmountWhereInput>;
};


export type QueryLaborcostresourcesComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<LaborCostResourcesOrder>;
  where?: InputMaybe<LaborCostResourcesWhereInput>;
};


export type QueryMetadataComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<MetaDataOrder>;
  where?: InputMaybe<MetaDataWhereInput>;
};


export type QueryMovableComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<MovableOrder>;
  where?: InputMaybe<MovableWhereInput>;
};


export type QueryOrderidComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderIdOrder>;
  where?: InputMaybe<OrderIdWhereInput>;
};


export type QueryOrderresourceComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderResourceOrder>;
  where?: InputMaybe<OrderResourceWhereInput>;
};


export type QueryOwnerComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OwnerOrder>;
  where?: InputMaybe<OwnerWhereInput>;
};


export type QueryPositionComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<PositionOrder>;
  where?: InputMaybe<PositionWhereInput>;
};


export type QueryQuantityComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<QuantityOrder>;
  where?: InputMaybe<QuantityWhereInput>;
};


export type QueryQuantitytrackerComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<QuantityTrackerOrder>;
  where?: InputMaybe<QuantityTrackerWhereInput>;
};


export type QueryRealmComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<RealmOrder>;
  where?: InputMaybe<RealmWhereInput>;
};


export type QueryResourceComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<ResourceOrder>;
  where?: InputMaybe<ResourceWhereInput>;
};


export type QuerySpeedconfigComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<SpeedConfigOrder>;
  where?: InputMaybe<SpeedConfigWhereInput>;
};


export type QueryStatusComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<StatusOrder>;
  where?: InputMaybe<StatusWhereInput>;
};


export type QuerySystemArgs = {
  id: Scalars['ID']['input'];
};


export type QuerySystemCallArgs = {
  id: Scalars['Int']['input'];
};


export type QueryTradeComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<TradeOrder>;
  where?: InputMaybe<TradeWhereInput>;
};


export type QueryTravelconfigComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<TravelConfigOrder>;
  where?: InputMaybe<TravelConfigWhereInput>;
};


export type QueryVaultComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<VaultOrder>;
  where?: InputMaybe<VaultWhereInput>;
};


export type QueryWeightconfigComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<WeightConfigOrder>;
  where?: InputMaybe<WeightConfigWhereInput>;
};


export type QueryWorldconfigComponentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<WorldConfigOrder>;
  where?: InputMaybe<WorldConfigWhereInput>;
};

export type Realm = {
  __typename?: 'Realm';
  cities?: Maybe<Scalars['u8']['output']>;
  entity?: Maybe<Entity>;
  harbors?: Maybe<Scalars['u8']['output']>;
  order?: Maybe<Scalars['u8']['output']>;
  realm_id?: Maybe<Scalars['u128']['output']>;
  regions?: Maybe<Scalars['u8']['output']>;
  resource_types_count?: Maybe<Scalars['u8']['output']>;
  resource_types_packed?: Maybe<Scalars['u128']['output']>;
  rivers?: Maybe<Scalars['u8']['output']>;
  wonder?: Maybe<Scalars['u8']['output']>;
};

export type RealmConnection = {
  __typename?: 'RealmConnection';
  edges?: Maybe<Array<Maybe<RealmEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type RealmEdge = {
  __typename?: 'RealmEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Realm>;
};

export type RealmOrder = {
  direction: Direction;
  field: RealmOrderOrderField;
};

export enum RealmOrderOrderField {
  Cities = 'CITIES',
  Harbors = 'HARBORS',
  Order = 'ORDER',
  RealmId = 'REALM_ID',
  Regions = 'REGIONS',
  ResourceTypesCount = 'RESOURCE_TYPES_COUNT',
  ResourceTypesPacked = 'RESOURCE_TYPES_PACKED',
  Rivers = 'RIVERS',
  Wonder = 'WONDER'
}

export type RealmWhereInput = {
  cities?: InputMaybe<Scalars['Int']['input']>;
  citiesGT?: InputMaybe<Scalars['Int']['input']>;
  citiesGTE?: InputMaybe<Scalars['Int']['input']>;
  citiesLT?: InputMaybe<Scalars['Int']['input']>;
  citiesLTE?: InputMaybe<Scalars['Int']['input']>;
  citiesNEQ?: InputMaybe<Scalars['Int']['input']>;
  harbors?: InputMaybe<Scalars['Int']['input']>;
  harborsGT?: InputMaybe<Scalars['Int']['input']>;
  harborsGTE?: InputMaybe<Scalars['Int']['input']>;
  harborsLT?: InputMaybe<Scalars['Int']['input']>;
  harborsLTE?: InputMaybe<Scalars['Int']['input']>;
  harborsNEQ?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<Scalars['Int']['input']>;
  orderGT?: InputMaybe<Scalars['Int']['input']>;
  orderGTE?: InputMaybe<Scalars['Int']['input']>;
  orderLT?: InputMaybe<Scalars['Int']['input']>;
  orderLTE?: InputMaybe<Scalars['Int']['input']>;
  orderNEQ?: InputMaybe<Scalars['Int']['input']>;
  realm_id?: InputMaybe<Scalars['String']['input']>;
  realm_idGT?: InputMaybe<Scalars['String']['input']>;
  realm_idGTE?: InputMaybe<Scalars['String']['input']>;
  realm_idLT?: InputMaybe<Scalars['String']['input']>;
  realm_idLTE?: InputMaybe<Scalars['String']['input']>;
  realm_idNEQ?: InputMaybe<Scalars['String']['input']>;
  regions?: InputMaybe<Scalars['Int']['input']>;
  regionsGT?: InputMaybe<Scalars['Int']['input']>;
  regionsGTE?: InputMaybe<Scalars['Int']['input']>;
  regionsLT?: InputMaybe<Scalars['Int']['input']>;
  regionsLTE?: InputMaybe<Scalars['Int']['input']>;
  regionsNEQ?: InputMaybe<Scalars['Int']['input']>;
  resource_types_count?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countGT?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countGTE?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countLT?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countLTE?: InputMaybe<Scalars['Int']['input']>;
  resource_types_countNEQ?: InputMaybe<Scalars['Int']['input']>;
  resource_types_packed?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedGT?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedGTE?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedLT?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedLTE?: InputMaybe<Scalars['String']['input']>;
  resource_types_packedNEQ?: InputMaybe<Scalars['String']['input']>;
  rivers?: InputMaybe<Scalars['Int']['input']>;
  riversGT?: InputMaybe<Scalars['Int']['input']>;
  riversGTE?: InputMaybe<Scalars['Int']['input']>;
  riversLT?: InputMaybe<Scalars['Int']['input']>;
  riversLTE?: InputMaybe<Scalars['Int']['input']>;
  riversNEQ?: InputMaybe<Scalars['Int']['input']>;
  wonder?: InputMaybe<Scalars['Int']['input']>;
  wonderGT?: InputMaybe<Scalars['Int']['input']>;
  wonderGTE?: InputMaybe<Scalars['Int']['input']>;
  wonderLT?: InputMaybe<Scalars['Int']['input']>;
  wonderLTE?: InputMaybe<Scalars['Int']['input']>;
  wonderNEQ?: InputMaybe<Scalars['Int']['input']>;
};

export type Resource = {
  __typename?: 'Resource';
  balance?: Maybe<Scalars['u128']['output']>;
  entity?: Maybe<Entity>;
};

export type ResourceConnection = {
  __typename?: 'ResourceConnection';
  edges?: Maybe<Array<Maybe<ResourceEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type ResourceEdge = {
  __typename?: 'ResourceEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Resource>;
};

export type ResourceOrder = {
  direction: Direction;
  field: ResourceOrderOrderField;
};

export enum ResourceOrderOrderField {
  Balance = 'BALANCE'
}

export type ResourceWhereInput = {
  balance?: InputMaybe<Scalars['String']['input']>;
  balanceGT?: InputMaybe<Scalars['String']['input']>;
  balanceGTE?: InputMaybe<Scalars['String']['input']>;
  balanceLT?: InputMaybe<Scalars['String']['input']>;
  balanceLTE?: InputMaybe<Scalars['String']['input']>;
  balanceNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type SpeedConfig = {
  __typename?: 'SpeedConfig';
  entity?: Maybe<Entity>;
  entity_type?: Maybe<Scalars['u128']['output']>;
  sec_per_km?: Maybe<Scalars['u16']['output']>;
};

export type SpeedConfigConnection = {
  __typename?: 'SpeedConfigConnection';
  edges?: Maybe<Array<Maybe<SpeedConfigEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type SpeedConfigEdge = {
  __typename?: 'SpeedConfigEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<SpeedConfig>;
};

export type SpeedConfigOrder = {
  direction: Direction;
  field: SpeedConfigOrderOrderField;
};

export enum SpeedConfigOrderOrderField {
  EntityType = 'ENTITY_TYPE',
  SecPerKm = 'SEC_PER_KM'
}

export type SpeedConfigWhereInput = {
  entity_type?: InputMaybe<Scalars['String']['input']>;
  entity_typeGT?: InputMaybe<Scalars['String']['input']>;
  entity_typeGTE?: InputMaybe<Scalars['String']['input']>;
  entity_typeLT?: InputMaybe<Scalars['String']['input']>;
  entity_typeLTE?: InputMaybe<Scalars['String']['input']>;
  entity_typeNEQ?: InputMaybe<Scalars['String']['input']>;
  sec_per_km?: InputMaybe<Scalars['Int']['input']>;
  sec_per_kmGT?: InputMaybe<Scalars['Int']['input']>;
  sec_per_kmGTE?: InputMaybe<Scalars['Int']['input']>;
  sec_per_kmLT?: InputMaybe<Scalars['Int']['input']>;
  sec_per_kmLTE?: InputMaybe<Scalars['Int']['input']>;
  sec_per_kmNEQ?: InputMaybe<Scalars['Int']['input']>;
};

export type Status = {
  __typename?: 'Status';
  entity?: Maybe<Entity>;
  value?: Maybe<Scalars['u128']['output']>;
};

export type StatusConnection = {
  __typename?: 'StatusConnection';
  edges?: Maybe<Array<Maybe<StatusEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type StatusEdge = {
  __typename?: 'StatusEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Status>;
};

export type StatusOrder = {
  direction: Direction;
  field: StatusOrderOrderField;
};

export enum StatusOrderOrderField {
  Value = 'VALUE'
}

export type StatusWhereInput = {
  value?: InputMaybe<Scalars['String']['input']>;
  valueGT?: InputMaybe<Scalars['String']['input']>;
  valueGTE?: InputMaybe<Scalars['String']['input']>;
  valueLT?: InputMaybe<Scalars['String']['input']>;
  valueLTE?: InputMaybe<Scalars['String']['input']>;
  valueNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type Subscription = {
  __typename?: 'Subscription';
  componentRegistered: Component;
  entityUpdated: Entity;
};

export type System = {
  __typename?: 'System';
  classHash?: Maybe<Scalars['felt252']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  systemCalls: Array<SystemCall>;
  transactionHash?: Maybe<Scalars['felt252']['output']>;
};

export type SystemCall = {
  __typename?: 'SystemCall';
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  data?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  system: System;
  systemId?: Maybe<Scalars['ID']['output']>;
  transactionHash?: Maybe<Scalars['String']['output']>;
};

export type SystemCallConnection = {
  __typename?: 'SystemCallConnection';
  edges?: Maybe<Array<Maybe<SystemCallEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type SystemCallEdge = {
  __typename?: 'SystemCallEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<SystemCall>;
};

export type SystemConnection = {
  __typename?: 'SystemConnection';
  edges?: Maybe<Array<Maybe<SystemEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type SystemEdge = {
  __typename?: 'SystemEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<System>;
};

export type Trade = {
  __typename?: 'Trade';
  claimed_by_maker?: Maybe<Scalars['bool']['output']>;
  claimed_by_taker?: Maybe<Scalars['bool']['output']>;
  entity?: Maybe<Entity>;
  expires_at?: Maybe<Scalars['u64']['output']>;
  maker_id?: Maybe<Scalars['u128']['output']>;
  maker_order_id?: Maybe<Scalars['u128']['output']>;
  taker_id?: Maybe<Scalars['u128']['output']>;
  taker_needs_caravan?: Maybe<Scalars['bool']['output']>;
  taker_order_id?: Maybe<Scalars['u128']['output']>;
};

export type TradeConnection = {
  __typename?: 'TradeConnection';
  edges?: Maybe<Array<Maybe<TradeEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type TradeEdge = {
  __typename?: 'TradeEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Trade>;
};

export type TradeOrder = {
  direction: Direction;
  field: TradeOrderOrderField;
};

export enum TradeOrderOrderField {
  ClaimedByMaker = 'CLAIMED_BY_MAKER',
  ClaimedByTaker = 'CLAIMED_BY_TAKER',
  ExpiresAt = 'EXPIRES_AT',
  MakerId = 'MAKER_ID',
  MakerOrderId = 'MAKER_ORDER_ID',
  TakerId = 'TAKER_ID',
  TakerNeedsCaravan = 'TAKER_NEEDS_CARAVAN',
  TakerOrderId = 'TAKER_ORDER_ID'
}

export type TradeWhereInput = {
  claimed_by_maker?: InputMaybe<Scalars['Int']['input']>;
  claimed_by_makerGT?: InputMaybe<Scalars['Int']['input']>;
  claimed_by_makerGTE?: InputMaybe<Scalars['Int']['input']>;
  claimed_by_makerLT?: InputMaybe<Scalars['Int']['input']>;
  claimed_by_makerLTE?: InputMaybe<Scalars['Int']['input']>;
  claimed_by_makerNEQ?: InputMaybe<Scalars['Int']['input']>;
  claimed_by_taker?: InputMaybe<Scalars['Int']['input']>;
  claimed_by_takerGT?: InputMaybe<Scalars['Int']['input']>;
  claimed_by_takerGTE?: InputMaybe<Scalars['Int']['input']>;
  claimed_by_takerLT?: InputMaybe<Scalars['Int']['input']>;
  claimed_by_takerLTE?: InputMaybe<Scalars['Int']['input']>;
  claimed_by_takerNEQ?: InputMaybe<Scalars['Int']['input']>;
  expires_at?: InputMaybe<Scalars['Int']['input']>;
  expires_atGT?: InputMaybe<Scalars['Int']['input']>;
  expires_atGTE?: InputMaybe<Scalars['Int']['input']>;
  expires_atLT?: InputMaybe<Scalars['Int']['input']>;
  expires_atLTE?: InputMaybe<Scalars['Int']['input']>;
  expires_atNEQ?: InputMaybe<Scalars['Int']['input']>;
  maker_id?: InputMaybe<Scalars['String']['input']>;
  maker_idGT?: InputMaybe<Scalars['String']['input']>;
  maker_idGTE?: InputMaybe<Scalars['String']['input']>;
  maker_idLT?: InputMaybe<Scalars['String']['input']>;
  maker_idLTE?: InputMaybe<Scalars['String']['input']>;
  maker_idNEQ?: InputMaybe<Scalars['String']['input']>;
  maker_order_id?: InputMaybe<Scalars['String']['input']>;
  maker_order_idGT?: InputMaybe<Scalars['String']['input']>;
  maker_order_idGTE?: InputMaybe<Scalars['String']['input']>;
  maker_order_idLT?: InputMaybe<Scalars['String']['input']>;
  maker_order_idLTE?: InputMaybe<Scalars['String']['input']>;
  maker_order_idNEQ?: InputMaybe<Scalars['String']['input']>;
  taker_id?: InputMaybe<Scalars['String']['input']>;
  taker_idGT?: InputMaybe<Scalars['String']['input']>;
  taker_idGTE?: InputMaybe<Scalars['String']['input']>;
  taker_idLT?: InputMaybe<Scalars['String']['input']>;
  taker_idLTE?: InputMaybe<Scalars['String']['input']>;
  taker_idNEQ?: InputMaybe<Scalars['String']['input']>;
  taker_needs_caravan?: InputMaybe<Scalars['Int']['input']>;
  taker_needs_caravanGT?: InputMaybe<Scalars['Int']['input']>;
  taker_needs_caravanGTE?: InputMaybe<Scalars['Int']['input']>;
  taker_needs_caravanLT?: InputMaybe<Scalars['Int']['input']>;
  taker_needs_caravanLTE?: InputMaybe<Scalars['Int']['input']>;
  taker_needs_caravanNEQ?: InputMaybe<Scalars['Int']['input']>;
  taker_order_id?: InputMaybe<Scalars['String']['input']>;
  taker_order_idGT?: InputMaybe<Scalars['String']['input']>;
  taker_order_idGTE?: InputMaybe<Scalars['String']['input']>;
  taker_order_idLT?: InputMaybe<Scalars['String']['input']>;
  taker_order_idLTE?: InputMaybe<Scalars['String']['input']>;
  taker_order_idNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type TravelConfig = {
  __typename?: 'TravelConfig';
  entity?: Maybe<Entity>;
  free_transport_per_city?: Maybe<Scalars['u128']['output']>;
};

export type TravelConfigConnection = {
  __typename?: 'TravelConfigConnection';
  edges?: Maybe<Array<Maybe<TravelConfigEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type TravelConfigEdge = {
  __typename?: 'TravelConfigEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<TravelConfig>;
};

export type TravelConfigOrder = {
  direction: Direction;
  field: TravelConfigOrderOrderField;
};

export enum TravelConfigOrderOrderField {
  FreeTransportPerCity = 'FREE_TRANSPORT_PER_CITY'
}

export type TravelConfigWhereInput = {
  free_transport_per_city?: InputMaybe<Scalars['String']['input']>;
  free_transport_per_cityGT?: InputMaybe<Scalars['String']['input']>;
  free_transport_per_cityGTE?: InputMaybe<Scalars['String']['input']>;
  free_transport_per_cityLT?: InputMaybe<Scalars['String']['input']>;
  free_transport_per_cityLTE?: InputMaybe<Scalars['String']['input']>;
  free_transport_per_cityNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type Vault = {
  __typename?: 'Vault';
  balance?: Maybe<Scalars['u128']['output']>;
  entity?: Maybe<Entity>;
};

export type VaultConnection = {
  __typename?: 'VaultConnection';
  edges?: Maybe<Array<Maybe<VaultEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type VaultEdge = {
  __typename?: 'VaultEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<Vault>;
};

export type VaultOrder = {
  direction: Direction;
  field: VaultOrderOrderField;
};

export enum VaultOrderOrderField {
  Balance = 'BALANCE'
}

export type VaultWhereInput = {
  balance?: InputMaybe<Scalars['String']['input']>;
  balanceGT?: InputMaybe<Scalars['String']['input']>;
  balanceGTE?: InputMaybe<Scalars['String']['input']>;
  balanceLT?: InputMaybe<Scalars['String']['input']>;
  balanceLTE?: InputMaybe<Scalars['String']['input']>;
  balanceNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type WeightConfig = {
  __typename?: 'WeightConfig';
  entity?: Maybe<Entity>;
  entity_type?: Maybe<Scalars['u128']['output']>;
  weight_gram?: Maybe<Scalars['u128']['output']>;
};

export type WeightConfigConnection = {
  __typename?: 'WeightConfigConnection';
  edges?: Maybe<Array<Maybe<WeightConfigEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type WeightConfigEdge = {
  __typename?: 'WeightConfigEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<WeightConfig>;
};

export type WeightConfigOrder = {
  direction: Direction;
  field: WeightConfigOrderOrderField;
};

export enum WeightConfigOrderOrderField {
  EntityType = 'ENTITY_TYPE',
  WeightGram = 'WEIGHT_GRAM'
}

export type WeightConfigWhereInput = {
  entity_type?: InputMaybe<Scalars['String']['input']>;
  entity_typeGT?: InputMaybe<Scalars['String']['input']>;
  entity_typeGTE?: InputMaybe<Scalars['String']['input']>;
  entity_typeLT?: InputMaybe<Scalars['String']['input']>;
  entity_typeLTE?: InputMaybe<Scalars['String']['input']>;
  entity_typeNEQ?: InputMaybe<Scalars['String']['input']>;
  weight_gram?: InputMaybe<Scalars['String']['input']>;
  weight_gramGT?: InputMaybe<Scalars['String']['input']>;
  weight_gramGTE?: InputMaybe<Scalars['String']['input']>;
  weight_gramLT?: InputMaybe<Scalars['String']['input']>;
  weight_gramLTE?: InputMaybe<Scalars['String']['input']>;
  weight_gramNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type WorldConfig = {
  __typename?: 'WorldConfig';
  entity?: Maybe<Entity>;
  realm_l2_contract?: Maybe<Scalars['ContractAddress']['output']>;
};

export type WorldConfigConnection = {
  __typename?: 'WorldConfigConnection';
  edges?: Maybe<Array<Maybe<WorldConfigEdge>>>;
  totalCount: Scalars['Int']['output'];
};

export type WorldConfigEdge = {
  __typename?: 'WorldConfigEdge';
  cursor: Scalars['Cursor']['output'];
  node?: Maybe<WorldConfig>;
};

export type WorldConfigOrder = {
  direction: Direction;
  field: WorldConfigOrderOrderField;
};

export enum WorldConfigOrderOrderField {
  RealmL2Contract = 'REALM_L2_CONTRACT'
}

export type WorldConfigWhereInput = {
  realm_l2_contract?: InputMaybe<Scalars['String']['input']>;
  realm_l2_contractGT?: InputMaybe<Scalars['String']['input']>;
  realm_l2_contractGTE?: InputMaybe<Scalars['String']['input']>;
  realm_l2_contractLT?: InputMaybe<Scalars['String']['input']>;
  realm_l2_contractLTE?: InputMaybe<Scalars['String']['input']>;
  realm_l2_contractNEQ?: InputMaybe<Scalars['String']['input']>;
};

export type GetRealmLaborQueryVariables = Exact<{
  realmEntityId: Scalars['String']['input'];
}>;


export type GetRealmLaborQuery = { __typename?: 'Query', entities?: { __typename?: 'EntityConnection', edges?: Array<{ __typename?: 'EntityEdge', node?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor', last_harvest?: any | null, balance?: any | null, multiplier?: any | null } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null> | null } | null };

export type GetRealmResourcesQueryVariables = Exact<{
  realmEntityId: Scalars['String']['input'];
}>;


export type GetRealmResourcesQuery = { __typename?: 'Query', entities?: { __typename?: 'EntityConnection', edges?: Array<{ __typename?: 'EntityEdge', node?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource', balance?: any | null } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null> | null } | null };

export type GetRealmQueryVariables = Exact<{
  realmEntityId: Scalars['String']['input'];
}>;


export type GetRealmQuery = { __typename?: 'Query', entities?: { __typename?: 'EntityConnection', edges?: Array<{ __typename?: 'EntityEdge', node?: { __typename?: 'Entity', keys?: Array<string | null> | null, id?: string | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource' } | { __typename: 'Owner', address?: any | null } | { __typename: 'Position', x?: any | null, y?: any | null } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm', realm_id?: any | null, cities?: any | null, rivers?: any | null, wonder?: any | null, harbors?: any | null, regions?: any | null, resource_types_count?: any | null, resource_types_packed?: any | null, order?: any | null } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null> | null } | null };

export type GetRealmIdsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetRealmIdsQuery = { __typename?: 'Query', realmComponents?: { __typename?: 'RealmConnection', edges?: Array<{ __typename?: 'RealmEdge', node?: { __typename?: 'Realm', realm_id?: any | null } | null } | null> | null } | null };

export type GetRealmsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetRealmsQuery = { __typename?: 'Query', realmComponents?: { __typename?: 'RealmConnection', edges?: Array<{ __typename?: 'RealmEdge', node?: { __typename?: 'Realm', entity?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource' } | { __typename: 'Owner', address?: any | null } | { __typename: 'Position', x?: any | null, y?: any | null } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm', realm_id?: any | null, cities?: any | null, rivers?: any | null, wonder?: any | null, harbors?: any | null, regions?: any | null, resource_types_count?: any | null, resource_types_packed?: any | null, order?: any | null } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null } | null> | null } | null };

export type TradeFragmentFragment = { __typename?: 'Trade', maker_id?: any | null, taker_id?: any | null, maker_order_id?: any | null, taker_order_id?: any | null, expires_at?: any | null, claimed_by_maker?: any | null, claimed_by_taker?: any | null, taker_needs_caravan?: any | null };

export type GetCounterpartyOrderIdQueryVariables = Exact<{
  orderId: Scalars['String']['input'];
}>;


export type GetCounterpartyOrderIdQuery = { __typename?: 'Query', makerTradeComponents?: { __typename?: 'TradeConnection', edges?: Array<{ __typename?: 'TradeEdge', node?: { __typename: 'Trade', maker_id?: any | null, taker_id?: any | null, maker_order_id?: any | null, taker_order_id?: any | null, expires_at?: any | null, claimed_by_maker?: any | null, claimed_by_taker?: any | null, taker_needs_caravan?: any | null } | null } | null> | null } | null, takerTradeComponents?: { __typename?: 'TradeConnection', edges?: Array<{ __typename?: 'TradeEdge', node?: { __typename: 'Trade', maker_id?: any | null, taker_id?: any | null, maker_order_id?: any | null, taker_order_id?: any | null, expires_at?: any | null, claimed_by_maker?: any | null, claimed_by_taker?: any | null, taker_needs_caravan?: any | null } | null } | null> | null } | null };

export type GetIncomingOrderInfoQueryVariables = Exact<{
  orderId: Scalars['String']['input'];
  counterPartyOrderId: Scalars['String']['input'];
}>;


export type GetIncomingOrderInfoQuery = { __typename?: 'Query', resources?: { __typename?: 'EntityConnection', edges?: Array<{ __typename?: 'EntityEdge', node?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime', arrives_at?: any | null } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities', key?: any | null, count?: any | null } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource', resource_type?: any | null, balance?: any | null } | { __typename: 'Owner' } | { __typename: 'Position', x?: any | null, y?: any | null } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null> | null } | null, origin?: { __typename?: 'EntityConnection', edges?: Array<{ __typename?: 'EntityEdge', node?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource' } | { __typename: 'Owner' } | { __typename: 'Position', x?: any | null, y?: any | null } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null> | null } | null };

export type GetIncomingOrdersQueryVariables = Exact<{
  realmEntityId: Scalars['String']['input'];
}>;


export type GetIncomingOrdersQuery = { __typename?: 'Query', makerTradeComponents?: { __typename?: 'TradeConnection', edges?: Array<{ __typename?: 'TradeEdge', node?: { __typename?: 'Trade', entity?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade', maker_id?: any | null, taker_id?: any | null, maker_order_id?: any | null, taker_order_id?: any | null, expires_at?: any | null, claimed_by_maker?: any | null, claimed_by_taker?: any | null, taker_needs_caravan?: any | null } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null } | null> | null } | null, takerTradeComponents?: { __typename?: 'TradeConnection', edges?: Array<{ __typename?: 'TradeEdge', node?: { __typename?: 'Trade', entity?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade', maker_id?: any | null, taker_id?: any | null, maker_order_id?: any | null, taker_order_id?: any | null, expires_at?: any | null, claimed_by_maker?: any | null, claimed_by_taker?: any | null, taker_needs_caravan?: any | null } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null } | null> | null } | null };

export type GetMarketQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMarketQuery = { __typename?: 'Query', tradeComponents?: { __typename?: 'TradeConnection', edges?: Array<{ __typename?: 'TradeEdge', node?: { __typename?: 'Trade', entity?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status', value?: any | null } | { __typename: 'Trade', maker_id?: any | null, taker_id?: any | null, maker_order_id?: any | null, taker_order_id?: any | null, expires_at?: any | null, claimed_by_maker?: any | null, claimed_by_taker?: any | null, taker_needs_caravan?: any | null } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null } | null> | null } | null };

export type GetMyOffersQueryVariables = Exact<{
  makerId: Scalars['String']['input'];
}>;


export type GetMyOffersQuery = { __typename?: 'Query', tradeComponents?: { __typename?: 'TradeConnection', edges?: Array<{ __typename?: 'TradeEdge', node?: { __typename?: 'Trade', entity?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status', value?: any | null } | { __typename: 'Trade', maker_id?: any | null, taker_id?: any | null, maker_order_id?: any | null, taker_order_id?: any | null, expires_at?: any | null, claimed_by_maker?: any | null, claimed_by_taker?: any | null, taker_needs_caravan?: any | null } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null } | null> | null } | null };

export type GetTradeResourcesQueryVariables = Exact<{
  makerOrderId: Scalars['String']['input'];
  takerOrderId: Scalars['String']['input'];
}>;


export type GetTradeResourcesQuery = { __typename?: 'Query', resourcesGive?: { __typename?: 'EntityConnection', edges?: Array<{ __typename?: 'EntityEdge', node?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities', key?: any | null, count?: any | null } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource', resource_type?: any | null, balance?: any | null } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null> | null } | null, resourcesGet?: { __typename?: 'EntityConnection', edges?: Array<{ __typename?: 'EntityEdge', node?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities', key?: any | null, count?: any | null } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource', resource_type?: any | null, balance?: any | null } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null> | null } | null };

export type GetCaravanInfoQueryVariables = Exact<{
  caravanId: Scalars['String']['input'];
  orderId: Scalars['String']['input'];
  counterpartyOrderId: Scalars['String']['input'];
}>;


export type GetCaravanInfoQuery = { __typename?: 'Query', caravan?: { __typename?: 'EntityConnection', edges?: Array<{ __typename?: 'EntityEdge', node?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime', arrives_at?: any | null } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity', weight_gram?: any | null } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable', blocked?: any | null, sec_per_km?: any | null } | { __typename: 'OrderId' } | { __typename: 'OrderResource' } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null> | null } | null, destination?: { __typename?: 'EntityConnection', edges?: Array<{ __typename?: 'EntityEdge', node?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource' } | { __typename: 'Owner' } | { __typename: 'Position', x?: any | null, y?: any | null } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null> | null } | null, resourcesGive?: { __typename?: 'EntityConnection', edges?: Array<{ __typename?: 'EntityEdge', node?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities', key?: any | null, count?: any | null } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource', resource_type?: any | null, balance?: any | null } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null> | null } | null, resourcesGet?: { __typename?: 'EntityConnection', edges?: Array<{ __typename?: 'EntityEdge', node?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime' } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity' } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers' } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities', key?: any | null, count?: any | null } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable' } | { __typename: 'OrderId' } | { __typename: 'OrderResource', resource_type?: any | null, balance?: any | null } | { __typename: 'Owner' } | { __typename: 'Position' } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null> | null } | null };

export type GetRealmsCaravansQueryVariables = Exact<{
  x: Scalars['Int']['input'];
  y: Scalars['Int']['input'];
}>;


export type GetRealmsCaravansQuery = { __typename?: 'Query', positionComponents?: { __typename?: 'PositionConnection', edges?: Array<{ __typename?: 'PositionEdge', node?: { __typename?: 'Position', entity?: { __typename?: 'Entity', keys?: Array<string | null> | null, components?: Array<{ __typename: 'Age' } | { __typename: 'ArrivalTime', arrives_at?: any | null } | { __typename: 'BuildingConfig' } | { __typename: 'BuildingCost' } | { __typename: 'BuildingTypeConfig' } | { __typename: 'Capacity', weight_gram?: any | null } | { __typename: 'CapacityConfig' } | { __typename: 'Caravan' } | { __typename: 'CaravanMembers', key?: any | null, count?: any | null } | { __typename: 'ForeignKey' } | { __typename: 'FungibleEntities' } | { __typename: 'Labor' } | { __typename: 'LaborConfig' } | { __typename: 'LaborCostAmount' } | { __typename: 'LaborCostResources' } | { __typename: 'MetaData' } | { __typename: 'Movable', blocked?: any | null } | { __typename: 'OrderId', id?: any | null } | { __typename: 'OrderResource' } | { __typename: 'Owner' } | { __typename: 'Position', x?: any | null, y?: any | null } | { __typename: 'Quantity' } | { __typename: 'QuantityTracker' } | { __typename: 'Realm' } | { __typename: 'Resource' } | { __typename: 'SpeedConfig' } | { __typename: 'Status' } | { __typename: 'Trade' } | { __typename: 'TravelConfig' } | { __typename: 'Vault' } | { __typename: 'WeightConfig' } | { __typename: 'WorldConfig' } | null> | null } | null } | null } | null> | null } | null };

export const TradeFragmentFragmentDoc = gql`
    fragment TradeFragment on Trade {
  maker_id
  taker_id
  maker_order_id
  taker_order_id
  expires_at
  claimed_by_maker
  claimed_by_taker
  taker_needs_caravan
}
    `;
export const GetRealmLaborDocument = gql`
    query getRealmLabor($realmEntityId: String!) {
  entities(keys: [$realmEntityId], first: 100) {
    edges {
      node {
        keys
        components {
          __typename
          ... on Labor {
            last_harvest
            balance
            multiplier
          }
        }
      }
    }
  }
}
    `;
export const GetRealmResourcesDocument = gql`
    query getRealmResources($realmEntityId: String!) {
  entities(keys: [$realmEntityId], first: 50) {
    edges {
      node {
        keys
        components {
          __typename
          ... on Resource {
            balance
          }
        }
      }
    }
  }
}
    `;
export const GetRealmDocument = gql`
    query getRealm($realmEntityId: String!) {
  entities(keys: [$realmEntityId], first: 100) {
    edges {
      node {
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
  }
}
    `;
export const GetRealmIdsDocument = gql`
    query getRealmIds {
  realmComponents(first: 100) {
    edges {
      node {
        realm_id
      }
    }
  }
}
    `;
export const GetRealmsDocument = gql`
    query getRealms {
  realmComponents(first: 100) {
    edges {
      node {
        entity {
          keys
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
    }
  }
}
    `;
export const GetCounterpartyOrderIdDocument = gql`
    query getCounterpartyOrderId($orderId: String!) {
  makerTradeComponents: tradeComponents(where: {maker_order_id: $orderId}) {
    edges {
      node {
        __typename
        ...TradeFragment
      }
    }
  }
  takerTradeComponents: tradeComponents(where: {taker_order_id: $orderId}) {
    edges {
      node {
        __typename
        ...TradeFragment
      }
    }
  }
}
    ${TradeFragmentFragmentDoc}`;
export const GetIncomingOrderInfoDocument = gql`
    query getIncomingOrderInfo($orderId: String!, $counterPartyOrderId: String!) {
  resources: entities(keys: [$counterPartyOrderId]) {
    edges {
      node {
        keys
        components {
          __typename
          ... on OrderResource {
            resource_type
            balance
          }
          ... on FungibleEntities {
            key
            count
          }
          ... on ArrivalTime {
            arrives_at
          }
          ... on Position {
            x
            y
          }
        }
      }
    }
  }
  origin: entities(keys: [$orderId]) {
    edges {
      node {
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
  }
}
    `;
export const GetIncomingOrdersDocument = gql`
    query getIncomingOrders($realmEntityId: String!) {
  makerTradeComponents: tradeComponents(
    where: {maker_id: $realmEntityId, claimed_by_maker: 0}
  ) {
    edges {
      node {
        entity {
          keys
          components {
            __typename
            ...TradeFragment
          }
        }
      }
    }
  }
  takerTradeComponents: tradeComponents(
    where: {taker_id: $realmEntityId, claimed_by_taker: 0}
  ) {
    edges {
      node {
        entity {
          keys
          components {
            __typename
            ...TradeFragment
          }
        }
      }
    }
  }
}
    ${TradeFragmentFragmentDoc}`;
export const GetMarketDocument = gql`
    query getMarket {
  tradeComponents(where: {claimed_by_maker: 0, claimed_by_taker: 0}, last: 30) {
    edges {
      node {
        entity {
          keys
          components {
            __typename
            ... on Status {
              value
            }
            ...TradeFragment
          }
        }
      }
    }
  }
}
    ${TradeFragmentFragmentDoc}`;
export const GetMyOffersDocument = gql`
    query getMyOffers($makerId: String!) {
  tradeComponents(
    where: {maker_id: $makerId, claimed_by_maker: 0, claimed_by_taker: 0}
    last: 30
  ) {
    edges {
      node {
        entity {
          keys
          components {
            __typename
            ... on Status {
              value
            }
            ...TradeFragment
          }
        }
      }
    }
  }
}
    ${TradeFragmentFragmentDoc}`;
export const GetTradeResourcesDocument = gql`
    query getTradeResources($makerOrderId: String!, $takerOrderId: String!) {
  resourcesGive: entities(keys: [$makerOrderId], last: 100) {
    edges {
      node {
        keys
        components {
          __typename
          ... on OrderResource {
            resource_type
            balance
          }
          ... on FungibleEntities {
            key
            count
          }
        }
      }
    }
  }
  resourcesGet: entities(keys: [$takerOrderId], last: 100) {
    edges {
      node {
        keys
        components {
          __typename
          ... on OrderResource {
            resource_type
            balance
          }
          ... on FungibleEntities {
            key
            count
          }
        }
      }
    }
  }
}
    `;
export const GetCaravanInfoDocument = gql`
    query getCaravanInfo($caravanId: String!, $orderId: String!, $counterpartyOrderId: String!) {
  caravan: entities(keys: [$caravanId], first: 100) {
    edges {
      node {
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
    }
  }
  destination: entities(keys: [$orderId]) {
    edges {
      node {
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
  }
  resourcesGive: entities(keys: [$orderId]) {
    edges {
      node {
        keys
        components {
          __typename
          ... on OrderResource {
            resource_type
            balance
          }
          ... on FungibleEntities {
            key
            count
          }
        }
      }
    }
  }
  resourcesGet: entities(keys: [$counterpartyOrderId]) {
    edges {
      node {
        keys
        components {
          __typename
          ... on OrderResource {
            resource_type
            balance
          }
          ... on FungibleEntities {
            key
            count
          }
        }
      }
    }
  }
}
    `;
export const GetRealmsCaravansDocument = gql`
    query getRealmsCaravans($x: Int!, $y: Int!) {
  positionComponents(where: {x: $x, y: $y}) {
    edges {
      node {
        entity {
          keys
          components {
            __typename
            ... on OrderId {
              id
            }
            ... on ArrivalTime {
              arrives_at
            }
            ... on Movable {
              blocked
            }
            ... on Capacity {
              weight_gram
            }
            ... on Position {
              x
              y
            }
            ... on CaravanMembers {
              key
              count
            }
          }
        }
      }
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType) => action();
const GetRealmLaborDocumentString = print(GetRealmLaborDocument);
const GetRealmResourcesDocumentString = print(GetRealmResourcesDocument);
const GetRealmDocumentString = print(GetRealmDocument);
const GetRealmIdsDocumentString = print(GetRealmIdsDocument);
const GetRealmsDocumentString = print(GetRealmsDocument);
const GetCounterpartyOrderIdDocumentString = print(GetCounterpartyOrderIdDocument);
const GetIncomingOrderInfoDocumentString = print(GetIncomingOrderInfoDocument);
const GetIncomingOrdersDocumentString = print(GetIncomingOrdersDocument);
const GetMarketDocumentString = print(GetMarketDocument);
const GetMyOffersDocumentString = print(GetMyOffersDocument);
const GetTradeResourcesDocumentString = print(GetTradeResourcesDocument);
const GetCaravanInfoDocumentString = print(GetCaravanInfoDocument);
const GetRealmsCaravansDocumentString = print(GetRealmsCaravansDocument);
export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    getRealmLabor(variables: GetRealmLaborQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: GetRealmLaborQuery; extensions?: any; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetRealmLaborQuery>(GetRealmLaborDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getRealmLabor', 'query');
    },
    getRealmResources(variables: GetRealmResourcesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: GetRealmResourcesQuery; extensions?: any; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetRealmResourcesQuery>(GetRealmResourcesDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getRealmResources', 'query');
    },
    getRealm(variables: GetRealmQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: GetRealmQuery; extensions?: any; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetRealmQuery>(GetRealmDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getRealm', 'query');
    },
    getRealmIds(variables?: GetRealmIdsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: GetRealmIdsQuery; extensions?: any; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetRealmIdsQuery>(GetRealmIdsDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getRealmIds', 'query');
    },
    getRealms(variables?: GetRealmsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: GetRealmsQuery; extensions?: any; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetRealmsQuery>(GetRealmsDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getRealms', 'query');
    },
    getCounterpartyOrderId(variables: GetCounterpartyOrderIdQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: GetCounterpartyOrderIdQuery; extensions?: any; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetCounterpartyOrderIdQuery>(GetCounterpartyOrderIdDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getCounterpartyOrderId', 'query');
    },
    getIncomingOrderInfo(variables: GetIncomingOrderInfoQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: GetIncomingOrderInfoQuery; extensions?: any; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetIncomingOrderInfoQuery>(GetIncomingOrderInfoDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getIncomingOrderInfo', 'query');
    },
    getIncomingOrders(variables: GetIncomingOrdersQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: GetIncomingOrdersQuery; extensions?: any; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetIncomingOrdersQuery>(GetIncomingOrdersDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getIncomingOrders', 'query');
    },
    getMarket(variables?: GetMarketQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: GetMarketQuery; extensions?: any; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetMarketQuery>(GetMarketDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getMarket', 'query');
    },
    getMyOffers(variables: GetMyOffersQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: GetMyOffersQuery; extensions?: any; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetMyOffersQuery>(GetMyOffersDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getMyOffers', 'query');
    },
    getTradeResources(variables: GetTradeResourcesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: GetTradeResourcesQuery; extensions?: any; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetTradeResourcesQuery>(GetTradeResourcesDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getTradeResources', 'query');
    },
    getCaravanInfo(variables: GetCaravanInfoQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: GetCaravanInfoQuery; extensions?: any; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetCaravanInfoQuery>(GetCaravanInfoDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getCaravanInfo', 'query');
    },
    getRealmsCaravans(variables: GetRealmsCaravansQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<{ data: GetRealmsCaravansQuery; extensions?: any; headers: Headers; status: number; }> {
        return withWrapper((wrappedRequestHeaders) => client.rawRequest<GetRealmsCaravansQuery>(GetRealmsCaravansDocumentString, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getRealmsCaravans', 'query');
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;