/* eslint-disable */
import { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
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
  ByteArray: { input: any; output: any; }
  ContractAddress: { input: any; output: any; }
  Cursor: { input: any; output: any; }
  DateTime: { input: any; output: any; }
  Enum: { input: any; output: any; }
  bool: { input: any; output: any; }
  felt252: { input: any; output: any; }
  u8: { input: any; output: any; }
  u16: { input: any; output: any; }
  u32: { input: any; output: any; }
  u64: { input: any; output: any; }
  u128: { input: any; output: any; }
  u256: { input: any; output: any; }
};

export enum OrderDirection {
  Asc = 'ASC',
  Desc = 'DESC'
}

export type World__ModelOrder = {
  direction: OrderDirection;
  field: World__ModelOrderField;
};

export enum World__ModelOrderField {
  ClassHash = 'CLASS_HASH',
  Name = 'NAME'
}

export type S1_Eternum_AcceptOrderOrder = {
  direction: OrderDirection;
  field: S1_Eternum_AcceptOrderOrderField;
};

export enum S1_Eternum_AcceptOrderOrderField {
  Id = 'ID',
  MakerId = 'MAKER_ID',
  TakerId = 'TAKER_ID',
  Timestamp = 'TIMESTAMP',
  TradeId = 'TRADE_ID'
}

export type S1_Eternum_AcceptOrderWhereInput = {
  id?: InputMaybe<Scalars['u32']['input']>;
  idEQ?: InputMaybe<Scalars['u32']['input']>;
  idGT?: InputMaybe<Scalars['u32']['input']>;
  idGTE?: InputMaybe<Scalars['u32']['input']>;
  idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  idLIKE?: InputMaybe<Scalars['u32']['input']>;
  idLT?: InputMaybe<Scalars['u32']['input']>;
  idLTE?: InputMaybe<Scalars['u32']['input']>;
  idNEQ?: InputMaybe<Scalars['u32']['input']>;
  idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  maker_id?: InputMaybe<Scalars['u32']['input']>;
  maker_idEQ?: InputMaybe<Scalars['u32']['input']>;
  maker_idGT?: InputMaybe<Scalars['u32']['input']>;
  maker_idGTE?: InputMaybe<Scalars['u32']['input']>;
  maker_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maker_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  maker_idLT?: InputMaybe<Scalars['u32']['input']>;
  maker_idLTE?: InputMaybe<Scalars['u32']['input']>;
  maker_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  maker_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maker_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_id?: InputMaybe<Scalars['u32']['input']>;
  taker_idEQ?: InputMaybe<Scalars['u32']['input']>;
  taker_idGT?: InputMaybe<Scalars['u32']['input']>;
  taker_idGTE?: InputMaybe<Scalars['u32']['input']>;
  taker_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  taker_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_idLT?: InputMaybe<Scalars['u32']['input']>;
  taker_idLTE?: InputMaybe<Scalars['u32']['input']>;
  taker_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  taker_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  taker_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  trade_id?: InputMaybe<Scalars['u32']['input']>;
  trade_idEQ?: InputMaybe<Scalars['u32']['input']>;
  trade_idGT?: InputMaybe<Scalars['u32']['input']>;
  trade_idGTE?: InputMaybe<Scalars['u32']['input']>;
  trade_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  trade_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  trade_idLT?: InputMaybe<Scalars['u32']['input']>;
  trade_idLTE?: InputMaybe<Scalars['u32']['input']>;
  trade_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  trade_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  trade_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_AddressNameOrder = {
  direction: OrderDirection;
  field: S1_Eternum_AddressNameOrderField;
};

export enum S1_Eternum_AddressNameOrderField {
  Address = 'ADDRESS',
  Name = 'NAME'
}

export type S1_Eternum_AddressNameWhereInput = {
  address?: InputMaybe<Scalars['felt252']['input']>;
  addressEQ?: InputMaybe<Scalars['felt252']['input']>;
  addressGT?: InputMaybe<Scalars['felt252']['input']>;
  addressGTE?: InputMaybe<Scalars['felt252']['input']>;
  addressIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  addressLIKE?: InputMaybe<Scalars['felt252']['input']>;
  addressLT?: InputMaybe<Scalars['felt252']['input']>;
  addressLTE?: InputMaybe<Scalars['felt252']['input']>;
  addressNEQ?: InputMaybe<Scalars['felt252']['input']>;
  addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  addressNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  name?: InputMaybe<Scalars['felt252']['input']>;
  nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  nameGT?: InputMaybe<Scalars['felt252']['input']>;
  nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  nameLT?: InputMaybe<Scalars['felt252']['input']>;
  nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
};

export type S1_Eternum_BuildingCategoryPopConfigOrder = {
  direction: OrderDirection;
  field: S1_Eternum_BuildingCategoryPopConfigOrderField;
};

export enum S1_Eternum_BuildingCategoryPopConfigOrderField {
  BuildingCategory = 'BUILDING_CATEGORY',
  Capacity = 'CAPACITY',
  Population = 'POPULATION'
}

export type S1_Eternum_BuildingCategoryPopConfigWhereInput = {
  building_category?: InputMaybe<Scalars['Enum']['input']>;
  capacity?: InputMaybe<Scalars['u32']['input']>;
  capacityEQ?: InputMaybe<Scalars['u32']['input']>;
  capacityGT?: InputMaybe<Scalars['u32']['input']>;
  capacityGTE?: InputMaybe<Scalars['u32']['input']>;
  capacityIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  capacityLIKE?: InputMaybe<Scalars['u32']['input']>;
  capacityLT?: InputMaybe<Scalars['u32']['input']>;
  capacityLTE?: InputMaybe<Scalars['u32']['input']>;
  capacityNEQ?: InputMaybe<Scalars['u32']['input']>;
  capacityNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  capacityNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  population?: InputMaybe<Scalars['u32']['input']>;
  populationEQ?: InputMaybe<Scalars['u32']['input']>;
  populationGT?: InputMaybe<Scalars['u32']['input']>;
  populationGTE?: InputMaybe<Scalars['u32']['input']>;
  populationIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  populationLIKE?: InputMaybe<Scalars['u32']['input']>;
  populationLT?: InputMaybe<Scalars['u32']['input']>;
  populationLTE?: InputMaybe<Scalars['u32']['input']>;
  populationNEQ?: InputMaybe<Scalars['u32']['input']>;
  populationNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  populationNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_BuildingConfigOrder = {
  direction: OrderDirection;
  field: S1_Eternum_BuildingConfigOrderField;
};

export enum S1_Eternum_BuildingConfigOrderField {
  Category = 'CATEGORY',
  ConfigId = 'CONFIG_ID',
  ResourceCostCount = 'RESOURCE_COST_COUNT',
  ResourceCostId = 'RESOURCE_COST_ID',
  ResourceType = 'RESOURCE_TYPE'
}

export type S1_Eternum_BuildingConfigWhereInput = {
  category?: InputMaybe<Scalars['Enum']['input']>;
  config_id?: InputMaybe<Scalars['u32']['input']>;
  config_idEQ?: InputMaybe<Scalars['u32']['input']>;
  config_idGT?: InputMaybe<Scalars['u32']['input']>;
  config_idGTE?: InputMaybe<Scalars['u32']['input']>;
  config_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  config_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  config_idLT?: InputMaybe<Scalars['u32']['input']>;
  config_idLTE?: InputMaybe<Scalars['u32']['input']>;
  config_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  config_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  config_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_count?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_countEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_countGT?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_countGTE?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_countIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_cost_countLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_countLT?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_countLTE?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_countNEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_cost_countNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_id?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_idEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_idGT?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_idGTE?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_cost_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_idLT?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_idLTE?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_cost_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_cost_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_type?: InputMaybe<Scalars['u8']['input']>;
  resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S1_Eternum_BuildingOrder = {
  direction: OrderDirection;
  field: S1_Eternum_BuildingOrderField;
};

export enum S1_Eternum_BuildingOrderField {
  BonusPercent = 'BONUS_PERCENT',
  Category = 'CATEGORY',
  EntityId = 'ENTITY_ID',
  InnerCol = 'INNER_COL',
  InnerRow = 'INNER_ROW',
  OuterCol = 'OUTER_COL',
  OuterEntityId = 'OUTER_ENTITY_ID',
  OuterRow = 'OUTER_ROW',
  Paused = 'PAUSED',
  ProducedResourceType = 'PRODUCED_RESOURCE_TYPE'
}

export type S1_Eternum_BuildingWhereInput = {
  bonus_percent?: InputMaybe<Scalars['u32']['input']>;
  bonus_percentEQ?: InputMaybe<Scalars['u32']['input']>;
  bonus_percentGT?: InputMaybe<Scalars['u32']['input']>;
  bonus_percentGTE?: InputMaybe<Scalars['u32']['input']>;
  bonus_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  bonus_percentLIKE?: InputMaybe<Scalars['u32']['input']>;
  bonus_percentLT?: InputMaybe<Scalars['u32']['input']>;
  bonus_percentLTE?: InputMaybe<Scalars['u32']['input']>;
  bonus_percentNEQ?: InputMaybe<Scalars['u32']['input']>;
  bonus_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  bonus_percentNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  category?: InputMaybe<Scalars['Enum']['input']>;
  entity_id?: InputMaybe<Scalars['u32']['input']>;
  entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  inner_col?: InputMaybe<Scalars['u32']['input']>;
  inner_colEQ?: InputMaybe<Scalars['u32']['input']>;
  inner_colGT?: InputMaybe<Scalars['u32']['input']>;
  inner_colGTE?: InputMaybe<Scalars['u32']['input']>;
  inner_colIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  inner_colLIKE?: InputMaybe<Scalars['u32']['input']>;
  inner_colLT?: InputMaybe<Scalars['u32']['input']>;
  inner_colLTE?: InputMaybe<Scalars['u32']['input']>;
  inner_colNEQ?: InputMaybe<Scalars['u32']['input']>;
  inner_colNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  inner_colNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  inner_row?: InputMaybe<Scalars['u32']['input']>;
  inner_rowEQ?: InputMaybe<Scalars['u32']['input']>;
  inner_rowGT?: InputMaybe<Scalars['u32']['input']>;
  inner_rowGTE?: InputMaybe<Scalars['u32']['input']>;
  inner_rowIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  inner_rowLIKE?: InputMaybe<Scalars['u32']['input']>;
  inner_rowLT?: InputMaybe<Scalars['u32']['input']>;
  inner_rowLTE?: InputMaybe<Scalars['u32']['input']>;
  inner_rowNEQ?: InputMaybe<Scalars['u32']['input']>;
  inner_rowNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  inner_rowNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  outer_col?: InputMaybe<Scalars['u32']['input']>;
  outer_colEQ?: InputMaybe<Scalars['u32']['input']>;
  outer_colGT?: InputMaybe<Scalars['u32']['input']>;
  outer_colGTE?: InputMaybe<Scalars['u32']['input']>;
  outer_colIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  outer_colLIKE?: InputMaybe<Scalars['u32']['input']>;
  outer_colLT?: InputMaybe<Scalars['u32']['input']>;
  outer_colLTE?: InputMaybe<Scalars['u32']['input']>;
  outer_colNEQ?: InputMaybe<Scalars['u32']['input']>;
  outer_colNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  outer_colNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  outer_entity_id?: InputMaybe<Scalars['u32']['input']>;
  outer_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  outer_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  outer_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  outer_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  outer_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  outer_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  outer_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  outer_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  outer_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  outer_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  outer_row?: InputMaybe<Scalars['u32']['input']>;
  outer_rowEQ?: InputMaybe<Scalars['u32']['input']>;
  outer_rowGT?: InputMaybe<Scalars['u32']['input']>;
  outer_rowGTE?: InputMaybe<Scalars['u32']['input']>;
  outer_rowIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  outer_rowLIKE?: InputMaybe<Scalars['u32']['input']>;
  outer_rowLT?: InputMaybe<Scalars['u32']['input']>;
  outer_rowLTE?: InputMaybe<Scalars['u32']['input']>;
  outer_rowNEQ?: InputMaybe<Scalars['u32']['input']>;
  outer_rowNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  outer_rowNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  paused?: InputMaybe<Scalars['bool']['input']>;
  produced_resource_type?: InputMaybe<Scalars['u8']['input']>;
  produced_resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  produced_resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  produced_resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  produced_resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  produced_resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  produced_resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  produced_resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  produced_resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  produced_resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  produced_resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S1_Eternum_BurnDonkeyOrder = {
  direction: OrderDirection;
  field: S1_Eternum_BurnDonkeyOrderField;
};

export enum S1_Eternum_BurnDonkeyOrderField {
  Amount = 'AMOUNT',
  EntityId = 'ENTITY_ID',
  PlayerAddress = 'PLAYER_ADDRESS',
  Timestamp = 'TIMESTAMP'
}

export type S1_Eternum_BurnDonkeyWhereInput = {
  amount?: InputMaybe<Scalars['u128']['input']>;
  amountEQ?: InputMaybe<Scalars['u128']['input']>;
  amountGT?: InputMaybe<Scalars['u128']['input']>;
  amountGTE?: InputMaybe<Scalars['u128']['input']>;
  amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  amountLT?: InputMaybe<Scalars['u128']['input']>;
  amountLTE?: InputMaybe<Scalars['u128']['input']>;
  amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  entity_id?: InputMaybe<Scalars['u32']['input']>;
  entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  player_address?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  player_addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  player_addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_CancelOrderOrder = {
  direction: OrderDirection;
  field: S1_Eternum_CancelOrderOrderField;
};

export enum S1_Eternum_CancelOrderOrderField {
  MakerId = 'MAKER_ID',
  TakerId = 'TAKER_ID',
  Timestamp = 'TIMESTAMP',
  TradeId = 'TRADE_ID'
}

export type S1_Eternum_CancelOrderWhereInput = {
  maker_id?: InputMaybe<Scalars['u32']['input']>;
  maker_idEQ?: InputMaybe<Scalars['u32']['input']>;
  maker_idGT?: InputMaybe<Scalars['u32']['input']>;
  maker_idGTE?: InputMaybe<Scalars['u32']['input']>;
  maker_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maker_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  maker_idLT?: InputMaybe<Scalars['u32']['input']>;
  maker_idLTE?: InputMaybe<Scalars['u32']['input']>;
  maker_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  maker_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maker_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_id?: InputMaybe<Scalars['u32']['input']>;
  taker_idEQ?: InputMaybe<Scalars['u32']['input']>;
  taker_idGT?: InputMaybe<Scalars['u32']['input']>;
  taker_idGTE?: InputMaybe<Scalars['u32']['input']>;
  taker_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  taker_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_idLT?: InputMaybe<Scalars['u32']['input']>;
  taker_idLTE?: InputMaybe<Scalars['u32']['input']>;
  taker_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  taker_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  taker_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  trade_id?: InputMaybe<Scalars['u32']['input']>;
  trade_idEQ?: InputMaybe<Scalars['u32']['input']>;
  trade_idGT?: InputMaybe<Scalars['u32']['input']>;
  trade_idGTE?: InputMaybe<Scalars['u32']['input']>;
  trade_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  trade_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  trade_idLT?: InputMaybe<Scalars['u32']['input']>;
  trade_idLTE?: InputMaybe<Scalars['u32']['input']>;
  trade_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  trade_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  trade_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_ContributionOrder = {
  direction: OrderDirection;
  field: S1_Eternum_ContributionOrderField;
};

export enum S1_Eternum_ContributionOrderField {
  Amount = 'AMOUNT',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  PlayerAddress = 'PLAYER_ADDRESS',
  ResourceType = 'RESOURCE_TYPE'
}

export type S1_Eternum_ContributionWhereInput = {
  amount?: InputMaybe<Scalars['u128']['input']>;
  amountEQ?: InputMaybe<Scalars['u128']['input']>;
  amountGT?: InputMaybe<Scalars['u128']['input']>;
  amountGTE?: InputMaybe<Scalars['u128']['input']>;
  amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  amountLT?: InputMaybe<Scalars['u128']['input']>;
  amountLTE?: InputMaybe<Scalars['u128']['input']>;
  amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  hyperstructure_entity_id?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  player_address?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  player_addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  player_addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  player_addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  resource_type?: InputMaybe<Scalars['u8']['input']>;
  resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S1_Eternum_CreateGuildOrder = {
  direction: OrderDirection;
  field: S1_Eternum_CreateGuildOrderField;
};

export enum S1_Eternum_CreateGuildOrderField {
  GuildEntityId = 'GUILD_ENTITY_ID',
  GuildName = 'GUILD_NAME',
  Timestamp = 'TIMESTAMP'
}

export type S1_Eternum_CreateGuildWhereInput = {
  guild_entity_id?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  guild_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  guild_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  guild_name?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  guild_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  guild_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_CreateOrderOrder = {
  direction: OrderDirection;
  field: S1_Eternum_CreateOrderOrderField;
};

export enum S1_Eternum_CreateOrderOrderField {
  MakerId = 'MAKER_ID',
  TakerId = 'TAKER_ID',
  Timestamp = 'TIMESTAMP',
  TradeId = 'TRADE_ID'
}

export type S1_Eternum_CreateOrderWhereInput = {
  maker_id?: InputMaybe<Scalars['u32']['input']>;
  maker_idEQ?: InputMaybe<Scalars['u32']['input']>;
  maker_idGT?: InputMaybe<Scalars['u32']['input']>;
  maker_idGTE?: InputMaybe<Scalars['u32']['input']>;
  maker_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maker_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  maker_idLT?: InputMaybe<Scalars['u32']['input']>;
  maker_idLTE?: InputMaybe<Scalars['u32']['input']>;
  maker_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  maker_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maker_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_id?: InputMaybe<Scalars['u32']['input']>;
  taker_idEQ?: InputMaybe<Scalars['u32']['input']>;
  taker_idGT?: InputMaybe<Scalars['u32']['input']>;
  taker_idGTE?: InputMaybe<Scalars['u32']['input']>;
  taker_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  taker_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_idLT?: InputMaybe<Scalars['u32']['input']>;
  taker_idLTE?: InputMaybe<Scalars['u32']['input']>;
  taker_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  taker_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  taker_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  trade_id?: InputMaybe<Scalars['u32']['input']>;
  trade_idEQ?: InputMaybe<Scalars['u32']['input']>;
  trade_idGT?: InputMaybe<Scalars['u32']['input']>;
  trade_idGTE?: InputMaybe<Scalars['u32']['input']>;
  trade_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  trade_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  trade_idLT?: InputMaybe<Scalars['u32']['input']>;
  trade_idLTE?: InputMaybe<Scalars['u32']['input']>;
  trade_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  trade_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  trade_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_EpochOrder = {
  direction: OrderDirection;
  field: S1_Eternum_EpochOrderField;
};

export enum S1_Eternum_EpochOrderField {
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  Index = 'INDEX',
  Owners = 'OWNERS',
  StartTimestamp = 'START_TIMESTAMP'
}

export type S1_Eternum_EpochWhereInput = {
  hyperstructure_entity_id?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  index?: InputMaybe<Scalars['u16']['input']>;
  indexEQ?: InputMaybe<Scalars['u16']['input']>;
  indexGT?: InputMaybe<Scalars['u16']['input']>;
  indexGTE?: InputMaybe<Scalars['u16']['input']>;
  indexIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  indexLIKE?: InputMaybe<Scalars['u16']['input']>;
  indexLT?: InputMaybe<Scalars['u16']['input']>;
  indexLTE?: InputMaybe<Scalars['u16']['input']>;
  indexNEQ?: InputMaybe<Scalars['u16']['input']>;
  indexNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  indexNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  start_timestamp?: InputMaybe<Scalars['u64']['input']>;
  start_timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  start_timestampGT?: InputMaybe<Scalars['u64']['input']>;
  start_timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  start_timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  start_timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  start_timestampLT?: InputMaybe<Scalars['u64']['input']>;
  start_timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  start_timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  start_timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  start_timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_ExplorerTroopsOrder = {
  direction: OrderDirection;
  field: S1_Eternum_ExplorerTroopsOrderField;
};

export enum S1_Eternum_ExplorerTroopsOrderField {
  Coord = 'COORD',
  ExplorerId = 'EXPLORER_ID',
  Owner = 'OWNER',
  Troops = 'TROOPS'
}

export type S1_Eternum_ExplorerTroopsWhereInput = {
  coord?: InputMaybe<S1_Eternum_ExplorerTroops_CoordWhereInput>;
  explorer_id?: InputMaybe<Scalars['u32']['input']>;
  explorer_idEQ?: InputMaybe<Scalars['u32']['input']>;
  explorer_idGT?: InputMaybe<Scalars['u32']['input']>;
  explorer_idGTE?: InputMaybe<Scalars['u32']['input']>;
  explorer_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  explorer_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  explorer_idLT?: InputMaybe<Scalars['u32']['input']>;
  explorer_idLTE?: InputMaybe<Scalars['u32']['input']>;
  explorer_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  explorer_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  explorer_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  owner?: InputMaybe<Scalars['u32']['input']>;
  ownerEQ?: InputMaybe<Scalars['u32']['input']>;
  ownerGT?: InputMaybe<Scalars['u32']['input']>;
  ownerGTE?: InputMaybe<Scalars['u32']['input']>;
  ownerIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  ownerLIKE?: InputMaybe<Scalars['u32']['input']>;
  ownerLT?: InputMaybe<Scalars['u32']['input']>;
  ownerLTE?: InputMaybe<Scalars['u32']['input']>;
  ownerNEQ?: InputMaybe<Scalars['u32']['input']>;
  ownerNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  ownerNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  troops?: InputMaybe<S1_Eternum_ExplorerTroops_TroopsWhereInput>;
};

export type S1_Eternum_ExplorerTroops_CoordWhereInput = {
  x?: InputMaybe<Scalars['u32']['input']>;
  xEQ?: InputMaybe<Scalars['u32']['input']>;
  xGT?: InputMaybe<Scalars['u32']['input']>;
  xGTE?: InputMaybe<Scalars['u32']['input']>;
  xIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  xLIKE?: InputMaybe<Scalars['u32']['input']>;
  xLT?: InputMaybe<Scalars['u32']['input']>;
  xLTE?: InputMaybe<Scalars['u32']['input']>;
  xNEQ?: InputMaybe<Scalars['u32']['input']>;
  xNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  xNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  y?: InputMaybe<Scalars['u32']['input']>;
  yEQ?: InputMaybe<Scalars['u32']['input']>;
  yGT?: InputMaybe<Scalars['u32']['input']>;
  yGTE?: InputMaybe<Scalars['u32']['input']>;
  yIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  yLIKE?: InputMaybe<Scalars['u32']['input']>;
  yLT?: InputMaybe<Scalars['u32']['input']>;
  yLTE?: InputMaybe<Scalars['u32']['input']>;
  yNEQ?: InputMaybe<Scalars['u32']['input']>;
  yNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  yNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_ExplorerTroops_TroopsWhereInput = {
  category?: InputMaybe<Scalars['Enum']['input']>;
  count?: InputMaybe<Scalars['u128']['input']>;
  countEQ?: InputMaybe<Scalars['u128']['input']>;
  countGT?: InputMaybe<Scalars['u128']['input']>;
  countGTE?: InputMaybe<Scalars['u128']['input']>;
  countIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  countLIKE?: InputMaybe<Scalars['u128']['input']>;
  countLT?: InputMaybe<Scalars['u128']['input']>;
  countLTE?: InputMaybe<Scalars['u128']['input']>;
  countNEQ?: InputMaybe<Scalars['u128']['input']>;
  countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  countNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  stamina?: InputMaybe<S1_Eternum_ExplorerTroops_Troops_StaminaWhereInput>;
  tier?: InputMaybe<Scalars['Enum']['input']>;
};

export type S1_Eternum_ExplorerTroops_Troops_StaminaWhereInput = {
  amount?: InputMaybe<Scalars['u64']['input']>;
  amountEQ?: InputMaybe<Scalars['u64']['input']>;
  amountGT?: InputMaybe<Scalars['u64']['input']>;
  amountGTE?: InputMaybe<Scalars['u64']['input']>;
  amountIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  amountLIKE?: InputMaybe<Scalars['u64']['input']>;
  amountLT?: InputMaybe<Scalars['u64']['input']>;
  amountLTE?: InputMaybe<Scalars['u64']['input']>;
  amountNEQ?: InputMaybe<Scalars['u64']['input']>;
  amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  amountNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  updated_tick?: InputMaybe<Scalars['u64']['input']>;
  updated_tickEQ?: InputMaybe<Scalars['u64']['input']>;
  updated_tickGT?: InputMaybe<Scalars['u64']['input']>;
  updated_tickGTE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  updated_tickLIKE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickLT?: InputMaybe<Scalars['u64']['input']>;
  updated_tickLTE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickNEQ?: InputMaybe<Scalars['u64']['input']>;
  updated_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  updated_tickNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_GameEndedOrder = {
  direction: OrderDirection;
  field: S1_Eternum_GameEndedOrderField;
};

export enum S1_Eternum_GameEndedOrderField {
  Timestamp = 'TIMESTAMP',
  WinnerAddress = 'WINNER_ADDRESS'
}

export type S1_Eternum_GameEndedWhereInput = {
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  winner_address?: InputMaybe<Scalars['ContractAddress']['input']>;
  winner_addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  winner_addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  winner_addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  winner_addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  winner_addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  winner_addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  winner_addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  winner_addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  winner_addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  winner_addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
};

export type S1_Eternum_GuildMemberOrder = {
  direction: OrderDirection;
  field: S1_Eternum_GuildMemberOrderField;
};

export enum S1_Eternum_GuildMemberOrderField {
  Address = 'ADDRESS',
  GuildEntityId = 'GUILD_ENTITY_ID'
}

export type S1_Eternum_GuildMemberWhereInput = {
  address?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  guild_entity_id?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  guild_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  guild_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_GuildOrder = {
  direction: OrderDirection;
  field: S1_Eternum_GuildOrderField;
};

export enum S1_Eternum_GuildOrderField {
  EntityId = 'ENTITY_ID',
  IsPublic = 'IS_PUBLIC',
  MemberCount = 'MEMBER_COUNT',
  Owner = 'OWNER'
}

export type S1_Eternum_GuildWhereInput = {
  entity_id?: InputMaybe<Scalars['u32']['input']>;
  entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  is_public?: InputMaybe<Scalars['bool']['input']>;
  member_count?: InputMaybe<Scalars['u16']['input']>;
  member_countEQ?: InputMaybe<Scalars['u16']['input']>;
  member_countGT?: InputMaybe<Scalars['u16']['input']>;
  member_countGTE?: InputMaybe<Scalars['u16']['input']>;
  member_countIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  member_countLIKE?: InputMaybe<Scalars['u16']['input']>;
  member_countLT?: InputMaybe<Scalars['u16']['input']>;
  member_countLTE?: InputMaybe<Scalars['u16']['input']>;
  member_countNEQ?: InputMaybe<Scalars['u16']['input']>;
  member_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  member_countNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  owner?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  ownerLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  ownerNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
};

export type S1_Eternum_GuildWhitelistOrder = {
  direction: OrderDirection;
  field: S1_Eternum_GuildWhitelistOrderField;
};

export enum S1_Eternum_GuildWhitelistOrderField {
  Address = 'ADDRESS',
  GuildEntityId = 'GUILD_ENTITY_ID',
  IsWhitelisted = 'IS_WHITELISTED'
}

export type S1_Eternum_GuildWhitelistWhereInput = {
  address?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  guild_entity_id?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  guild_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  guild_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  is_whitelisted?: InputMaybe<Scalars['bool']['input']>;
};

export type S1_Eternum_HyperstructureCoOwnersChangeOrder = {
  direction: OrderDirection;
  field: S1_Eternum_HyperstructureCoOwnersChangeOrderField;
};

export enum S1_Eternum_HyperstructureCoOwnersChangeOrderField {
  CoOwners = 'CO_OWNERS',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  Id = 'ID',
  Timestamp = 'TIMESTAMP'
}

export type S1_Eternum_HyperstructureCoOwnersChangeWhereInput = {
  hyperstructure_entity_id?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  id?: InputMaybe<Scalars['u32']['input']>;
  idEQ?: InputMaybe<Scalars['u32']['input']>;
  idGT?: InputMaybe<Scalars['u32']['input']>;
  idGTE?: InputMaybe<Scalars['u32']['input']>;
  idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  idLIKE?: InputMaybe<Scalars['u32']['input']>;
  idLT?: InputMaybe<Scalars['u32']['input']>;
  idLTE?: InputMaybe<Scalars['u32']['input']>;
  idNEQ?: InputMaybe<Scalars['u32']['input']>;
  idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_HyperstructureContributionOrder = {
  direction: OrderDirection;
  field: S1_Eternum_HyperstructureContributionOrderField;
};

export enum S1_Eternum_HyperstructureContributionOrderField {
  Contributions = 'CONTRIBUTIONS',
  ContributorEntityId = 'CONTRIBUTOR_ENTITY_ID',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  Id = 'ID',
  Timestamp = 'TIMESTAMP'
}

export type S1_Eternum_HyperstructureContributionWhereInput = {
  contributor_entity_id?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  contributor_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  contributor_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_id?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  id?: InputMaybe<Scalars['u32']['input']>;
  idEQ?: InputMaybe<Scalars['u32']['input']>;
  idGT?: InputMaybe<Scalars['u32']['input']>;
  idGTE?: InputMaybe<Scalars['u32']['input']>;
  idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  idLIKE?: InputMaybe<Scalars['u32']['input']>;
  idLT?: InputMaybe<Scalars['u32']['input']>;
  idLTE?: InputMaybe<Scalars['u32']['input']>;
  idNEQ?: InputMaybe<Scalars['u32']['input']>;
  idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_HyperstructureFinishedOrder = {
  direction: OrderDirection;
  field: S1_Eternum_HyperstructureFinishedOrderField;
};

export enum S1_Eternum_HyperstructureFinishedOrderField {
  ContributorEntityId = 'CONTRIBUTOR_ENTITY_ID',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  HyperstructureOwnerName = 'HYPERSTRUCTURE_OWNER_NAME',
  Id = 'ID',
  Timestamp = 'TIMESTAMP'
}

export type S1_Eternum_HyperstructureFinishedWhereInput = {
  contributor_entity_id?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  contributor_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  contributor_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  contributor_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_id?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_owner_name?: InputMaybe<Scalars['felt252']['input']>;
  hyperstructure_owner_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  hyperstructure_owner_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  hyperstructure_owner_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  hyperstructure_owner_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  hyperstructure_owner_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  hyperstructure_owner_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  hyperstructure_owner_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  hyperstructure_owner_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  hyperstructure_owner_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  hyperstructure_owner_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  id?: InputMaybe<Scalars['u32']['input']>;
  idEQ?: InputMaybe<Scalars['u32']['input']>;
  idGT?: InputMaybe<Scalars['u32']['input']>;
  idGTE?: InputMaybe<Scalars['u32']['input']>;
  idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  idLIKE?: InputMaybe<Scalars['u32']['input']>;
  idLT?: InputMaybe<Scalars['u32']['input']>;
  idLTE?: InputMaybe<Scalars['u32']['input']>;
  idNEQ?: InputMaybe<Scalars['u32']['input']>;
  idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_HyperstructureGlobalsOrder = {
  direction: OrderDirection;
  field: S1_Eternum_HyperstructureGlobalsOrderField;
};

export enum S1_Eternum_HyperstructureGlobalsOrderField {
  CompletedCount = 'COMPLETED_COUNT',
  CreatedCount = 'CREATED_COUNT',
  WorldId = 'WORLD_ID'
}

export type S1_Eternum_HyperstructureGlobalsWhereInput = {
  created_count?: InputMaybe<Scalars['u32']['input']>;
  created_countEQ?: InputMaybe<Scalars['u32']['input']>;
  created_countGT?: InputMaybe<Scalars['u32']['input']>;
  created_countGTE?: InputMaybe<Scalars['u32']['input']>;
  created_countIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  created_countLIKE?: InputMaybe<Scalars['u32']['input']>;
  created_countLT?: InputMaybe<Scalars['u32']['input']>;
  created_countLTE?: InputMaybe<Scalars['u32']['input']>;
  created_countNEQ?: InputMaybe<Scalars['u32']['input']>;
  created_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  created_countNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  completed_count?: InputMaybe<Scalars['u32']['input']>;
  completed_countEQ?: InputMaybe<Scalars['u32']['input']>;
  completed_countGT?: InputMaybe<Scalars['u32']['input']>;
  completed_countGTE?: InputMaybe<Scalars['u32']['input']>;
  completed_countIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  completed_countLIKE?: InputMaybe<Scalars['u32']['input']>;
  completed_countLT?: InputMaybe<Scalars['u32']['input']>;
  completed_countLTE?: InputMaybe<Scalars['u32']['input']>;
  completed_countNEQ?: InputMaybe<Scalars['u32']['input']>;
  completed_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  completed_countNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  world_id?: InputMaybe<Scalars['u32']['input']>;
  world_idEQ?: InputMaybe<Scalars['u32']['input']>;
  world_idGT?: InputMaybe<Scalars['u32']['input']>;
  world_idGTE?: InputMaybe<Scalars['u32']['input']>;
  world_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  world_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  world_idLT?: InputMaybe<Scalars['u32']['input']>;
  world_idLTE?: InputMaybe<Scalars['u32']['input']>;
  world_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  world_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  world_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_HyperstructureOrder = {
  direction: OrderDirection;
  field: S1_Eternum_HyperstructureOrderField;
};

export enum S1_Eternum_HyperstructureOrderField {
  Access = 'ACCESS',
  Completed = 'COMPLETED',
  CurrentEpoch = 'CURRENT_EPOCH',
  EntityId = 'ENTITY_ID',
  Initialized = 'INITIALIZED',
  LastUpdatedBy = 'LAST_UPDATED_BY',
  LastUpdatedTimestamp = 'LAST_UPDATED_TIMESTAMP',
  Randomness = 'RANDOMNESS'
}

export type S1_Eternum_HyperstructureResourceConfigOrder = {
  direction: OrderDirection;
  field: S1_Eternum_HyperstructureResourceConfigOrderField;
};

export enum S1_Eternum_HyperstructureResourceConfigOrderField {
  MaxAmount = 'MAX_AMOUNT',
  MinAmount = 'MIN_AMOUNT',
  ResourceTier = 'RESOURCE_TIER'
}

export type S1_Eternum_HyperstructureResourceConfigWhereInput = {
  max_amount?: InputMaybe<Scalars['u128']['input']>;
  max_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  max_amountGT?: InputMaybe<Scalars['u128']['input']>;
  max_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  max_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  max_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  max_amountLT?: InputMaybe<Scalars['u128']['input']>;
  max_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  max_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  max_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  max_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  min_amount?: InputMaybe<Scalars['u128']['input']>;
  min_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  min_amountGT?: InputMaybe<Scalars['u128']['input']>;
  min_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  min_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  min_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  min_amountLT?: InputMaybe<Scalars['u128']['input']>;
  min_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  min_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  min_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  min_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_tier?: InputMaybe<Scalars['u8']['input']>;
  resource_tierEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_tierGT?: InputMaybe<Scalars['u8']['input']>;
  resource_tierGTE?: InputMaybe<Scalars['u8']['input']>;
  resource_tierIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_tierLIKE?: InputMaybe<Scalars['u8']['input']>;
  resource_tierLT?: InputMaybe<Scalars['u8']['input']>;
  resource_tierLTE?: InputMaybe<Scalars['u8']['input']>;
  resource_tierNEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_tierNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_tierNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S1_Eternum_HyperstructureStartedOrder = {
  direction: OrderDirection;
  field: S1_Eternum_HyperstructureStartedOrderField;
};

export enum S1_Eternum_HyperstructureStartedOrderField {
  CreatorAddressName = 'CREATOR_ADDRESS_NAME',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  Id = 'ID',
  Timestamp = 'TIMESTAMP'
}

export type S1_Eternum_HyperstructureStartedWhereInput = {
  creator_address_name?: InputMaybe<Scalars['felt252']['input']>;
  creator_address_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  creator_address_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  creator_address_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  creator_address_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  creator_address_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  creator_address_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  creator_address_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  creator_address_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  creator_address_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  creator_address_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  hyperstructure_entity_id?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  id?: InputMaybe<Scalars['u32']['input']>;
  idEQ?: InputMaybe<Scalars['u32']['input']>;
  idGT?: InputMaybe<Scalars['u32']['input']>;
  idGTE?: InputMaybe<Scalars['u32']['input']>;
  idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  idLIKE?: InputMaybe<Scalars['u32']['input']>;
  idLT?: InputMaybe<Scalars['u32']['input']>;
  idLTE?: InputMaybe<Scalars['u32']['input']>;
  idNEQ?: InputMaybe<Scalars['u32']['input']>;
  idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_HyperstructureWhereInput = {
  access?: InputMaybe<Scalars['Enum']['input']>;
  completed?: InputMaybe<Scalars['bool']['input']>;
  current_epoch?: InputMaybe<Scalars['u16']['input']>;
  current_epochEQ?: InputMaybe<Scalars['u16']['input']>;
  current_epochGT?: InputMaybe<Scalars['u16']['input']>;
  current_epochGTE?: InputMaybe<Scalars['u16']['input']>;
  current_epochIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  current_epochLIKE?: InputMaybe<Scalars['u16']['input']>;
  current_epochLT?: InputMaybe<Scalars['u16']['input']>;
  current_epochLTE?: InputMaybe<Scalars['u16']['input']>;
  current_epochNEQ?: InputMaybe<Scalars['u16']['input']>;
  current_epochNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  current_epochNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  entity_id?: InputMaybe<Scalars['u32']['input']>;
  entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  initialized?: InputMaybe<Scalars['bool']['input']>;
  last_updated_by?: InputMaybe<Scalars['ContractAddress']['input']>;
  last_updated_byEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  last_updated_byGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  last_updated_byGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  last_updated_byIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  last_updated_byLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  last_updated_byLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  last_updated_byLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  last_updated_byNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  last_updated_byNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  last_updated_byNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  last_updated_timestamp?: InputMaybe<Scalars['u64']['input']>;
  last_updated_timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  last_updated_timestampGT?: InputMaybe<Scalars['u64']['input']>;
  last_updated_timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  last_updated_timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  last_updated_timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  last_updated_timestampLT?: InputMaybe<Scalars['u64']['input']>;
  last_updated_timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  last_updated_timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  last_updated_timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  last_updated_timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  randomness?: InputMaybe<Scalars['felt252']['input']>;
  randomnessEQ?: InputMaybe<Scalars['felt252']['input']>;
  randomnessGT?: InputMaybe<Scalars['felt252']['input']>;
  randomnessGTE?: InputMaybe<Scalars['felt252']['input']>;
  randomnessIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  randomnessLIKE?: InputMaybe<Scalars['felt252']['input']>;
  randomnessLT?: InputMaybe<Scalars['felt252']['input']>;
  randomnessLTE?: InputMaybe<Scalars['felt252']['input']>;
  randomnessNEQ?: InputMaybe<Scalars['felt252']['input']>;
  randomnessNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  randomnessNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
};

export type S1_Eternum_JoinGuildOrder = {
  direction: OrderDirection;
  field: S1_Eternum_JoinGuildOrderField;
};

export enum S1_Eternum_JoinGuildOrderField {
  Address = 'ADDRESS',
  GuildEntityId = 'GUILD_ENTITY_ID',
  GuildName = 'GUILD_NAME',
  Timestamp = 'TIMESTAMP'
}

export type S1_Eternum_JoinGuildWhereInput = {
  address?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  guild_entity_id?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  guild_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  guild_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  guild_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  guild_name?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  guild_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  guild_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  guild_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_LeaderboardEntryOrder = {
  direction: OrderDirection;
  field: S1_Eternum_LeaderboardEntryOrderField;
};

export enum S1_Eternum_LeaderboardEntryOrderField {
  Address = 'ADDRESS',
  Points = 'POINTS'
}

export type S1_Eternum_LeaderboardEntryWhereInput = {
  address?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  points?: InputMaybe<Scalars['u128']['input']>;
  pointsEQ?: InputMaybe<Scalars['u128']['input']>;
  pointsGT?: InputMaybe<Scalars['u128']['input']>;
  pointsGTE?: InputMaybe<Scalars['u128']['input']>;
  pointsIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  pointsLIKE?: InputMaybe<Scalars['u128']['input']>;
  pointsLT?: InputMaybe<Scalars['u128']['input']>;
  pointsLTE?: InputMaybe<Scalars['u128']['input']>;
  pointsNEQ?: InputMaybe<Scalars['u128']['input']>;
  pointsNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  pointsNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type S1_Eternum_LeaderboardOrder = {
  direction: OrderDirection;
  field: S1_Eternum_LeaderboardOrderField;
};

export enum S1_Eternum_LeaderboardOrderField {
  ConfigId = 'CONFIG_ID',
  DistributionStarted = 'DISTRIBUTION_STARTED',
  RegistrationEndTimestamp = 'REGISTRATION_END_TIMESTAMP',
  TotalPoints = 'TOTAL_POINTS',
  TotalPricePool = 'TOTAL_PRICE_POOL'
}

export type S1_Eternum_LeaderboardRegisterContributionOrder = {
  direction: OrderDirection;
  field: S1_Eternum_LeaderboardRegisterContributionOrderField;
};

export enum S1_Eternum_LeaderboardRegisterContributionOrderField {
  Address = 'ADDRESS',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  Registered = 'REGISTERED'
}

export type S1_Eternum_LeaderboardRegisterContributionWhereInput = {
  address?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  hyperstructure_entity_id?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  registered?: InputMaybe<Scalars['bool']['input']>;
};

export type S1_Eternum_LeaderboardRegisterShareOrder = {
  direction: OrderDirection;
  field: S1_Eternum_LeaderboardRegisterShareOrderField;
};

export enum S1_Eternum_LeaderboardRegisterShareOrderField {
  Address = 'ADDRESS',
  Epoch = 'EPOCH',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  Registered = 'REGISTERED'
}

export type S1_Eternum_LeaderboardRegisterShareWhereInput = {
  address?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  epoch?: InputMaybe<Scalars['u16']['input']>;
  epochEQ?: InputMaybe<Scalars['u16']['input']>;
  epochGT?: InputMaybe<Scalars['u16']['input']>;
  epochGTE?: InputMaybe<Scalars['u16']['input']>;
  epochIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  epochLIKE?: InputMaybe<Scalars['u16']['input']>;
  epochLT?: InputMaybe<Scalars['u16']['input']>;
  epochLTE?: InputMaybe<Scalars['u16']['input']>;
  epochNEQ?: InputMaybe<Scalars['u16']['input']>;
  epochNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  epochNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  hyperstructure_entity_id?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  registered?: InputMaybe<Scalars['bool']['input']>;
};

export type S1_Eternum_LeaderboardRegisteredOrder = {
  direction: OrderDirection;
  field: S1_Eternum_LeaderboardRegisteredOrderField;
};

export enum S1_Eternum_LeaderboardRegisteredOrderField {
  Address = 'ADDRESS',
  Registered = 'REGISTERED'
}

export type S1_Eternum_LeaderboardRegisteredWhereInput = {
  address?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  registered?: InputMaybe<Scalars['bool']['input']>;
};

export type S1_Eternum_LeaderboardRewardClaimedOrder = {
  direction: OrderDirection;
  field: S1_Eternum_LeaderboardRewardClaimedOrderField;
};

export enum S1_Eternum_LeaderboardRewardClaimedOrderField {
  Address = 'ADDRESS',
  Claimed = 'CLAIMED'
}

export type S1_Eternum_LeaderboardRewardClaimedWhereInput = {
  address?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimed?: InputMaybe<Scalars['bool']['input']>;
};

export type S1_Eternum_LeaderboardWhereInput = {
  config_id?: InputMaybe<Scalars['u32']['input']>;
  config_idEQ?: InputMaybe<Scalars['u32']['input']>;
  config_idGT?: InputMaybe<Scalars['u32']['input']>;
  config_idGTE?: InputMaybe<Scalars['u32']['input']>;
  config_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  config_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  config_idLT?: InputMaybe<Scalars['u32']['input']>;
  config_idLTE?: InputMaybe<Scalars['u32']['input']>;
  config_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  config_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  config_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  distribution_started?: InputMaybe<Scalars['bool']['input']>;
  registration_end_timestamp?: InputMaybe<Scalars['u64']['input']>;
  registration_end_timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  registration_end_timestampGT?: InputMaybe<Scalars['u64']['input']>;
  registration_end_timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  registration_end_timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  registration_end_timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  registration_end_timestampLT?: InputMaybe<Scalars['u64']['input']>;
  registration_end_timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  registration_end_timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  registration_end_timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  registration_end_timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  total_points?: InputMaybe<Scalars['u128']['input']>;
  total_pointsEQ?: InputMaybe<Scalars['u128']['input']>;
  total_pointsGT?: InputMaybe<Scalars['u128']['input']>;
  total_pointsGTE?: InputMaybe<Scalars['u128']['input']>;
  total_pointsIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  total_pointsLIKE?: InputMaybe<Scalars['u128']['input']>;
  total_pointsLT?: InputMaybe<Scalars['u128']['input']>;
  total_pointsLTE?: InputMaybe<Scalars['u128']['input']>;
  total_pointsNEQ?: InputMaybe<Scalars['u128']['input']>;
  total_pointsNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  total_pointsNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  total_price_pool?: InputMaybe<S1_Eternum_Leaderboard_Total_Price_PoolWhereInput>;
};

export type S1_Eternum_Leaderboard_Total_Price_PoolWhereInput = {
  Some?: InputMaybe<Scalars['u256']['input']>;
  SomeEQ?: InputMaybe<Scalars['u256']['input']>;
  SomeGT?: InputMaybe<Scalars['u256']['input']>;
  SomeGTE?: InputMaybe<Scalars['u256']['input']>;
  SomeIN?: InputMaybe<Array<InputMaybe<Scalars['u256']['input']>>>;
  SomeLIKE?: InputMaybe<Scalars['u256']['input']>;
  SomeLT?: InputMaybe<Scalars['u256']['input']>;
  SomeLTE?: InputMaybe<Scalars['u256']['input']>;
  SomeNEQ?: InputMaybe<Scalars['u256']['input']>;
  SomeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u256']['input']>>>;
  SomeNOTLIKE?: InputMaybe<Scalars['u256']['input']>;
  option?: InputMaybe<Scalars['Enum']['input']>;
};

export type S1_Eternum_LiquidityEventOrder = {
  direction: OrderDirection;
  field: S1_Eternum_LiquidityEventOrderField;
};

export enum S1_Eternum_LiquidityEventOrderField {
  Add = 'ADD',
  BankEntityId = 'BANK_ENTITY_ID',
  EntityId = 'ENTITY_ID',
  LordsAmount = 'LORDS_AMOUNT',
  ResourceAmount = 'RESOURCE_AMOUNT',
  ResourcePrice = 'RESOURCE_PRICE',
  ResourceType = 'RESOURCE_TYPE',
  Timestamp = 'TIMESTAMP'
}

export type S1_Eternum_LiquidityEventWhereInput = {
  add?: InputMaybe<Scalars['bool']['input']>;
  bank_entity_id?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  bank_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  bank_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_id?: InputMaybe<Scalars['u32']['input']>;
  entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  lords_amount?: InputMaybe<Scalars['u128']['input']>;
  lords_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  lords_amountGT?: InputMaybe<Scalars['u128']['input']>;
  lords_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  lords_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lords_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  lords_amountLT?: InputMaybe<Scalars['u128']['input']>;
  lords_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  lords_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  lords_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lords_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_amount?: InputMaybe<Scalars['u128']['input']>;
  resource_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  resource_amountGT?: InputMaybe<Scalars['u128']['input']>;
  resource_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  resource_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resource_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_amountLT?: InputMaybe<Scalars['u128']['input']>;
  resource_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  resource_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  resource_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resource_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_price?: InputMaybe<Scalars['u128']['input']>;
  resource_priceEQ?: InputMaybe<Scalars['u128']['input']>;
  resource_priceGT?: InputMaybe<Scalars['u128']['input']>;
  resource_priceGTE?: InputMaybe<Scalars['u128']['input']>;
  resource_priceIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resource_priceLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_priceLT?: InputMaybe<Scalars['u128']['input']>;
  resource_priceLTE?: InputMaybe<Scalars['u128']['input']>;
  resource_priceNEQ?: InputMaybe<Scalars['u128']['input']>;
  resource_priceNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resource_priceNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_type?: InputMaybe<Scalars['u8']['input']>;
  resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_LiquidityOrder = {
  direction: OrderDirection;
  field: S1_Eternum_LiquidityOrderField;
};

export enum S1_Eternum_LiquidityOrderField {
  Player = 'PLAYER',
  ResourceType = 'RESOURCE_TYPE',
  Shares = 'SHARES'
}

export type S1_Eternum_LiquidityWhereInput = {
  player?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  playerLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  playerNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  playerNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  resource_type?: InputMaybe<Scalars['u8']['input']>;
  resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  shares?: InputMaybe<Scalars['u128']['input']>;
  sharesEQ?: InputMaybe<Scalars['u128']['input']>;
  sharesGT?: InputMaybe<Scalars['u128']['input']>;
  sharesGTE?: InputMaybe<Scalars['u128']['input']>;
  sharesIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  sharesLIKE?: InputMaybe<Scalars['u128']['input']>;
  sharesLT?: InputMaybe<Scalars['u128']['input']>;
  sharesLTE?: InputMaybe<Scalars['u128']['input']>;
  sharesNEQ?: InputMaybe<Scalars['u128']['input']>;
  sharesNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  sharesNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type S1_Eternum_MarketOrder = {
  direction: OrderDirection;
  field: S1_Eternum_MarketOrderField;
};

export enum S1_Eternum_MarketOrderField {
  LordsAmount = 'LORDS_AMOUNT',
  ResourceAmount = 'RESOURCE_AMOUNT',
  ResourceType = 'RESOURCE_TYPE',
  TotalShares = 'TOTAL_SHARES'
}

export type S1_Eternum_MarketWhereInput = {
  lords_amount?: InputMaybe<Scalars['u128']['input']>;
  lords_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  lords_amountGT?: InputMaybe<Scalars['u128']['input']>;
  lords_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  lords_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lords_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  lords_amountLT?: InputMaybe<Scalars['u128']['input']>;
  lords_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  lords_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  lords_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lords_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_amount?: InputMaybe<Scalars['u128']['input']>;
  resource_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  resource_amountGT?: InputMaybe<Scalars['u128']['input']>;
  resource_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  resource_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resource_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_amountLT?: InputMaybe<Scalars['u128']['input']>;
  resource_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  resource_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  resource_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resource_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_type?: InputMaybe<Scalars['u8']['input']>;
  resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  total_shares?: InputMaybe<Scalars['u128']['input']>;
  total_sharesEQ?: InputMaybe<Scalars['u128']['input']>;
  total_sharesGT?: InputMaybe<Scalars['u128']['input']>;
  total_sharesGTE?: InputMaybe<Scalars['u128']['input']>;
  total_sharesIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  total_sharesLIKE?: InputMaybe<Scalars['u128']['input']>;
  total_sharesLT?: InputMaybe<Scalars['u128']['input']>;
  total_sharesLTE?: InputMaybe<Scalars['u128']['input']>;
  total_sharesNEQ?: InputMaybe<Scalars['u128']['input']>;
  total_sharesNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  total_sharesNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type S1_Eternum_MessageOrder = {
  direction: OrderDirection;
  field: S1_Eternum_MessageOrderField;
};

export enum S1_Eternum_MessageOrderField {
  Channel = 'CHANNEL',
  Content = 'CONTENT',
  Identity = 'IDENTITY',
  Salt = 'SALT',
  Timestamp = 'TIMESTAMP'
}

export type S1_Eternum_MessageWhereInput = {
  channel?: InputMaybe<Scalars['felt252']['input']>;
  channelEQ?: InputMaybe<Scalars['felt252']['input']>;
  channelGT?: InputMaybe<Scalars['felt252']['input']>;
  channelGTE?: InputMaybe<Scalars['felt252']['input']>;
  channelIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  channelLIKE?: InputMaybe<Scalars['felt252']['input']>;
  channelLT?: InputMaybe<Scalars['felt252']['input']>;
  channelLTE?: InputMaybe<Scalars['felt252']['input']>;
  channelNEQ?: InputMaybe<Scalars['felt252']['input']>;
  channelNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  channelNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  content?: InputMaybe<Scalars['ByteArray']['input']>;
  contentEQ?: InputMaybe<Scalars['ByteArray']['input']>;
  contentGT?: InputMaybe<Scalars['ByteArray']['input']>;
  contentGTE?: InputMaybe<Scalars['ByteArray']['input']>;
  contentIN?: InputMaybe<Array<InputMaybe<Scalars['ByteArray']['input']>>>;
  contentLIKE?: InputMaybe<Scalars['ByteArray']['input']>;
  contentLT?: InputMaybe<Scalars['ByteArray']['input']>;
  contentLTE?: InputMaybe<Scalars['ByteArray']['input']>;
  contentNEQ?: InputMaybe<Scalars['ByteArray']['input']>;
  contentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ByteArray']['input']>>>;
  contentNOTLIKE?: InputMaybe<Scalars['ByteArray']['input']>;
  identity?: InputMaybe<Scalars['ContractAddress']['input']>;
  identityEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  identityGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  identityGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  identityIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  identityLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  identityLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  identityLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  identityNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  identityNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  identityNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  salt?: InputMaybe<Scalars['felt252']['input']>;
  saltEQ?: InputMaybe<Scalars['felt252']['input']>;
  saltGT?: InputMaybe<Scalars['felt252']['input']>;
  saltGTE?: InputMaybe<Scalars['felt252']['input']>;
  saltIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  saltLIKE?: InputMaybe<Scalars['felt252']['input']>;
  saltLT?: InputMaybe<Scalars['felt252']['input']>;
  saltLTE?: InputMaybe<Scalars['felt252']['input']>;
  saltNEQ?: InputMaybe<Scalars['felt252']['input']>;
  saltNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  saltNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_PositionOrder = {
  direction: OrderDirection;
  field: S1_Eternum_PositionOrderField;
};

export enum S1_Eternum_PositionOrderField {
  EntityId = 'ENTITY_ID',
  X = 'X',
  Y = 'Y'
}

export type S1_Eternum_PositionWhereInput = {
  entity_id?: InputMaybe<Scalars['u32']['input']>;
  entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  x?: InputMaybe<Scalars['u32']['input']>;
  xEQ?: InputMaybe<Scalars['u32']['input']>;
  xGT?: InputMaybe<Scalars['u32']['input']>;
  xGTE?: InputMaybe<Scalars['u32']['input']>;
  xIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  xLIKE?: InputMaybe<Scalars['u32']['input']>;
  xLT?: InputMaybe<Scalars['u32']['input']>;
  xLTE?: InputMaybe<Scalars['u32']['input']>;
  xNEQ?: InputMaybe<Scalars['u32']['input']>;
  xNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  xNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  y?: InputMaybe<Scalars['u32']['input']>;
  yEQ?: InputMaybe<Scalars['u32']['input']>;
  yGT?: InputMaybe<Scalars['u32']['input']>;
  yGTE?: InputMaybe<Scalars['u32']['input']>;
  yIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  yLIKE?: InputMaybe<Scalars['u32']['input']>;
  yLT?: InputMaybe<Scalars['u32']['input']>;
  yLTE?: InputMaybe<Scalars['u32']['input']>;
  yNEQ?: InputMaybe<Scalars['u32']['input']>;
  yNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  yNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_ProductionConfigOrder = {
  direction: OrderDirection;
  field: S1_Eternum_ProductionConfigOrderField;
};

export enum S1_Eternum_ProductionConfigOrderField {
  RealmOutputPerTick = 'REALM_OUTPUT_PER_TICK',
  VillageOutputPerTick = 'VILLAGE_OUTPUT_PER_TICK',
  LaborBurnStrategy = 'LABOR_BURN_STRATEGY',
  MultipleResourceBurnStrategy = 'MULTIPLE_RESOURCE_BURN_STRATEGY',
  ResourceType = 'RESOURCE_TYPE'
}

export type S1_Eternum_ProductionConfigWhereInput = {
  realm_output_per_tick?: InputMaybe<Scalars['u64']['input']>;
  realm_output_per_tickEQ?: InputMaybe<Scalars['u64']['input']>;
  realm_output_per_tickGT?: InputMaybe<Scalars['u64']['input']>;
  realm_output_per_tickGTE?: InputMaybe<Scalars['u64']['input']>;
  realm_output_per_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  realm_output_per_tickLIKE?: InputMaybe<Scalars['u64']['input']>;
  realm_output_per_tickLT?: InputMaybe<Scalars['u64']['input']>;
  realm_output_per_tickLTE?: InputMaybe<Scalars['u64']['input']>;
  realm_output_per_tickNEQ?: InputMaybe<Scalars['u64']['input']>;
  realm_output_per_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  realm_output_per_tickNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  village_output_per_tick?: InputMaybe<Scalars['u64']['input']>;
  village_output_per_tickEQ?: InputMaybe<Scalars['u64']['input']>;
  village_output_per_tickGT?: InputMaybe<Scalars['u64']['input']>;
  village_output_per_tickGTE?: InputMaybe<Scalars['u64']['input']>;
  village_output_per_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  village_output_per_tickLIKE?: InputMaybe<Scalars['u64']['input']>;
  village_output_per_tickLT?: InputMaybe<Scalars['u64']['input']>;
  village_output_per_tickLTE?: InputMaybe<Scalars['u64']['input']>;
  village_output_per_tickNEQ?: InputMaybe<Scalars['u64']['input']>;
  village_output_per_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  village_output_per_tickNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  labor_burn_strategy?: InputMaybe<S1_Eternum_ProductionConfig_Labor_Burn_StrategyWhereInput>;
  multiple_resource_burn_strategy?: InputMaybe<S1_Eternum_ProductionConfig_Multiple_Resource_Burn_StrategyWhereInput>;
  resource_type?: InputMaybe<Scalars['u8']['input']>;
  resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S1_Eternum_ProductionConfig_Labor_Burn_StrategyWhereInput = {
  depreciation_percent_denom?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_denomEQ?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_denomGT?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_denomGTE?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_denomIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  depreciation_percent_denomLIKE?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_denomLT?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_denomLTE?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_denomNEQ?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_denomNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  depreciation_percent_denomNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_num?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_numEQ?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_numGT?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_numGTE?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_numIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  depreciation_percent_numLIKE?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_numLT?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_numLTE?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_numNEQ?: InputMaybe<Scalars['u16']['input']>;
  depreciation_percent_numNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  depreciation_percent_numNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  fish_burn_per_labor?: InputMaybe<Scalars['u128']['input']>;
  fish_burn_per_laborEQ?: InputMaybe<Scalars['u128']['input']>;
  fish_burn_per_laborGT?: InputMaybe<Scalars['u128']['input']>;
  fish_burn_per_laborGTE?: InputMaybe<Scalars['u128']['input']>;
  fish_burn_per_laborIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  fish_burn_per_laborLIKE?: InputMaybe<Scalars['u128']['input']>;
  fish_burn_per_laborLT?: InputMaybe<Scalars['u128']['input']>;
  fish_burn_per_laborLTE?: InputMaybe<Scalars['u128']['input']>;
  fish_burn_per_laborNEQ?: InputMaybe<Scalars['u128']['input']>;
  fish_burn_per_laborNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  fish_burn_per_laborNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_rarity?: InputMaybe<Scalars['u128']['input']>;
  resource_rarityEQ?: InputMaybe<Scalars['u128']['input']>;
  resource_rarityGT?: InputMaybe<Scalars['u128']['input']>;
  resource_rarityGTE?: InputMaybe<Scalars['u128']['input']>;
  resource_rarityIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resource_rarityLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_rarityLT?: InputMaybe<Scalars['u128']['input']>;
  resource_rarityLTE?: InputMaybe<Scalars['u128']['input']>;
  resource_rarityNEQ?: InputMaybe<Scalars['u128']['input']>;
  resource_rarityNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resource_rarityNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  wheat_burn_per_labor?: InputMaybe<Scalars['u128']['input']>;
  wheat_burn_per_laborEQ?: InputMaybe<Scalars['u128']['input']>;
  wheat_burn_per_laborGT?: InputMaybe<Scalars['u128']['input']>;
  wheat_burn_per_laborGTE?: InputMaybe<Scalars['u128']['input']>;
  wheat_burn_per_laborIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  wheat_burn_per_laborLIKE?: InputMaybe<Scalars['u128']['input']>;
  wheat_burn_per_laborLT?: InputMaybe<Scalars['u128']['input']>;
  wheat_burn_per_laborLTE?: InputMaybe<Scalars['u128']['input']>;
  wheat_burn_per_laborNEQ?: InputMaybe<Scalars['u128']['input']>;
  wheat_burn_per_laborNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  wheat_burn_per_laborNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type S1_Eternum_ProductionConfig_Multiple_Resource_Burn_StrategyWhereInput = {
  required_resources_count?: InputMaybe<Scalars['u8']['input']>;
  required_resources_countEQ?: InputMaybe<Scalars['u8']['input']>;
  required_resources_countGT?: InputMaybe<Scalars['u8']['input']>;
  required_resources_countGTE?: InputMaybe<Scalars['u8']['input']>;
  required_resources_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  required_resources_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  required_resources_countLT?: InputMaybe<Scalars['u8']['input']>;
  required_resources_countLTE?: InputMaybe<Scalars['u8']['input']>;
  required_resources_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  required_resources_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  required_resources_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  required_resources_id?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idEQ?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idGT?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idGTE?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  required_resources_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idLT?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idLTE?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  required_resources_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_ProgressOrder = {
  direction: OrderDirection;
  field: S1_Eternum_ProgressOrderField;
};

export enum S1_Eternum_ProgressOrderField {
  Amount = 'AMOUNT',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  ResourceType = 'RESOURCE_TYPE'
}

export type S1_Eternum_ProgressWhereInput = {
  amount?: InputMaybe<Scalars['u128']['input']>;
  amountEQ?: InputMaybe<Scalars['u128']['input']>;
  amountGT?: InputMaybe<Scalars['u128']['input']>;
  amountGTE?: InputMaybe<Scalars['u128']['input']>;
  amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  amountLT?: InputMaybe<Scalars['u128']['input']>;
  amountLTE?: InputMaybe<Scalars['u128']['input']>;
  amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  hyperstructure_entity_id?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_type?: InputMaybe<Scalars['u8']['input']>;
  resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S1_Eternum_QuantityOrder = {
  direction: OrderDirection;
  field: S1_Eternum_QuantityOrderField;
};

export enum S1_Eternum_QuantityOrderField {
  EntityId = 'ENTITY_ID',
  Value = 'VALUE'
}

export type S1_Eternum_QuantityTrackerOrder = {
  direction: OrderDirection;
  field: S1_Eternum_QuantityTrackerOrderField;
};

export enum S1_Eternum_QuantityTrackerOrderField {
  Count = 'COUNT',
  EntityId = 'ENTITY_ID'
}

export type S1_Eternum_QuantityTrackerWhereInput = {
  count?: InputMaybe<Scalars['u128']['input']>;
  countEQ?: InputMaybe<Scalars['u128']['input']>;
  countGT?: InputMaybe<Scalars['u128']['input']>;
  countGTE?: InputMaybe<Scalars['u128']['input']>;
  countIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  countLIKE?: InputMaybe<Scalars['u128']['input']>;
  countLT?: InputMaybe<Scalars['u128']['input']>;
  countLTE?: InputMaybe<Scalars['u128']['input']>;
  countNEQ?: InputMaybe<Scalars['u128']['input']>;
  countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  countNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  entity_id?: InputMaybe<Scalars['felt252']['input']>;
  entity_idEQ?: InputMaybe<Scalars['felt252']['input']>;
  entity_idGT?: InputMaybe<Scalars['felt252']['input']>;
  entity_idGTE?: InputMaybe<Scalars['felt252']['input']>;
  entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  entity_idLIKE?: InputMaybe<Scalars['felt252']['input']>;
  entity_idLT?: InputMaybe<Scalars['felt252']['input']>;
  entity_idLTE?: InputMaybe<Scalars['felt252']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['felt252']['input']>;
  entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  entity_idNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
};

export type S1_Eternum_QuantityWhereInput = {
  entity_id?: InputMaybe<Scalars['u32']['input']>;
  entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  value?: InputMaybe<Scalars['u128']['input']>;
  valueEQ?: InputMaybe<Scalars['u128']['input']>;
  valueGT?: InputMaybe<Scalars['u128']['input']>;
  valueGTE?: InputMaybe<Scalars['u128']['input']>;
  valueIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  valueLIKE?: InputMaybe<Scalars['u128']['input']>;
  valueLT?: InputMaybe<Scalars['u128']['input']>;
  valueLTE?: InputMaybe<Scalars['u128']['input']>;
  valueNEQ?: InputMaybe<Scalars['u128']['input']>;
  valueNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  valueNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type S1_Eternum_ResourceAllowanceOrder = {
  direction: OrderDirection;
  field: S1_Eternum_ResourceAllowanceOrderField;
};

export enum S1_Eternum_ResourceAllowanceOrderField {
  Amount = 'AMOUNT',
  ApprovedEntityId = 'APPROVED_ENTITY_ID',
  OwnerEntityId = 'OWNER_ENTITY_ID',
  ResourceType = 'RESOURCE_TYPE'
}

export type S1_Eternum_ResourceAllowanceWhereInput = {
  amount?: InputMaybe<Scalars['u128']['input']>;
  amountEQ?: InputMaybe<Scalars['u128']['input']>;
  amountGT?: InputMaybe<Scalars['u128']['input']>;
  amountGTE?: InputMaybe<Scalars['u128']['input']>;
  amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  amountLT?: InputMaybe<Scalars['u128']['input']>;
  amountLTE?: InputMaybe<Scalars['u128']['input']>;
  amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  approved_entity_id?: InputMaybe<Scalars['u32']['input']>;
  approved_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  approved_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  approved_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  approved_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  approved_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  approved_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  approved_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  approved_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  approved_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  approved_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  owner_entity_id?: InputMaybe<Scalars['u32']['input']>;
  owner_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  owner_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  owner_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  owner_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  owner_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  owner_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  owner_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  owner_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  owner_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  owner_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_type?: InputMaybe<Scalars['u8']['input']>;
  resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S1_Eternum_ResourceArrivalOrder = {
  direction: OrderDirection;
  field: S1_Eternum_ResourceArrivalOrderField;
};

export enum S1_Eternum_ResourceArrivalOrderField {
  Day = 'DAY',
  Initialized = 'INITIALIZED',
  Slot_1 = 'SLOT_1',
  Slot_2 = 'SLOT_2',
  Slot_3 = 'SLOT_3',
  Slot_4 = 'SLOT_4',
  Slot_5 = 'SLOT_5',
  Slot_6 = 'SLOT_6',
  Slot_7 = 'SLOT_7',
  Slot_8 = 'SLOT_8',
  Slot_9 = 'SLOT_9',
  Slot_10 = 'SLOT_10',
  Slot_11 = 'SLOT_11',
  Slot_12 = 'SLOT_12',
  Slot_13 = 'SLOT_13',
  Slot_14 = 'SLOT_14',
  Slot_15 = 'SLOT_15',
  Slot_16 = 'SLOT_16',
  Slot_17 = 'SLOT_17',
  Slot_18 = 'SLOT_18',
  Slot_19 = 'SLOT_19',
  Slot_20 = 'SLOT_20',
  Slot_21 = 'SLOT_21',
  Slot_22 = 'SLOT_22',
  Slot_23 = 'SLOT_23',
  Slot_24 = 'SLOT_24',
  StructureId = 'STRUCTURE_ID',
  TotalAmount = 'TOTAL_AMOUNT'
}

export type S1_Eternum_ResourceArrivalWhereInput = {
  day?: InputMaybe<Scalars['u64']['input']>;
  dayEQ?: InputMaybe<Scalars['u64']['input']>;
  dayGT?: InputMaybe<Scalars['u64']['input']>;
  dayGTE?: InputMaybe<Scalars['u64']['input']>;
  dayIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  dayLIKE?: InputMaybe<Scalars['u64']['input']>;
  dayLT?: InputMaybe<Scalars['u64']['input']>;
  dayLTE?: InputMaybe<Scalars['u64']['input']>;
  dayNEQ?: InputMaybe<Scalars['u64']['input']>;
  dayNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  dayNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  initialized?: InputMaybe<Scalars['bool']['input']>;
  structure_id?: InputMaybe<Scalars['u32']['input']>;
  structure_idEQ?: InputMaybe<Scalars['u32']['input']>;
  structure_idGT?: InputMaybe<Scalars['u32']['input']>;
  structure_idGTE?: InputMaybe<Scalars['u32']['input']>;
  structure_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  structure_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  structure_idLT?: InputMaybe<Scalars['u32']['input']>;
  structure_idLTE?: InputMaybe<Scalars['u32']['input']>;
  structure_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  structure_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  structure_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  total_amount?: InputMaybe<Scalars['u128']['input']>;
  total_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  total_amountGT?: InputMaybe<Scalars['u128']['input']>;
  total_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  total_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  total_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  total_amountLT?: InputMaybe<Scalars['u128']['input']>;
  total_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  total_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  total_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  total_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type S1_Eternum_ResourceBridgeWhitelistConfigOrder = {
  direction: OrderDirection;
  field: S1_Eternum_ResourceBridgeWhitelistConfigOrderField;
};

export enum S1_Eternum_ResourceBridgeWhitelistConfigOrderField {
  ResourceType = 'RESOURCE_TYPE',
  Token = 'TOKEN'
}

export type S1_Eternum_ResourceBridgeWhitelistConfigWhereInput = {
  resource_type?: InputMaybe<Scalars['u8']['input']>;
  resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  token?: InputMaybe<Scalars['ContractAddress']['input']>;
  tokenEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  tokenGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  tokenGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  tokenIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  tokenLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  tokenLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  tokenLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  tokenNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  tokenNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  tokenNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
};

export type S1_Eternum_ResourceListOrder = {
  direction: OrderDirection;
  field: S1_Eternum_ResourceListOrderField;
};

export enum S1_Eternum_ResourceListOrderField {
  Amount = 'AMOUNT',
  EntityId = 'ENTITY_ID',
  Index = 'INDEX',
  ResourceType = 'RESOURCE_TYPE'
}

export type S1_Eternum_ResourceListWhereInput = {
  amount?: InputMaybe<Scalars['u128']['input']>;
  amountEQ?: InputMaybe<Scalars['u128']['input']>;
  amountGT?: InputMaybe<Scalars['u128']['input']>;
  amountGTE?: InputMaybe<Scalars['u128']['input']>;
  amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  amountLT?: InputMaybe<Scalars['u128']['input']>;
  amountLTE?: InputMaybe<Scalars['u128']['input']>;
  amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  entity_id?: InputMaybe<Scalars['u32']['input']>;
  entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  index?: InputMaybe<Scalars['u32']['input']>;
  indexEQ?: InputMaybe<Scalars['u32']['input']>;
  indexGT?: InputMaybe<Scalars['u32']['input']>;
  indexGTE?: InputMaybe<Scalars['u32']['input']>;
  indexIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  indexLIKE?: InputMaybe<Scalars['u32']['input']>;
  indexLT?: InputMaybe<Scalars['u32']['input']>;
  indexLTE?: InputMaybe<Scalars['u32']['input']>;
  indexNEQ?: InputMaybe<Scalars['u32']['input']>;
  indexNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  indexNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_type?: InputMaybe<Scalars['u8']['input']>;
  resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S1_Eternum_ResourceOrder = {
  direction: OrderDirection;
  field: S1_Eternum_ResourceOrderField;
};

export enum S1_Eternum_ResourceOrderField {
  AdamantineBalance = 'ADAMANTINE_BALANCE',
  AdamantineProduction = 'ADAMANTINE_PRODUCTION',
  AlchemicalSilverBalance = 'ALCHEMICAL_SILVER_BALANCE',
  AlchemicalSilverProduction = 'ALCHEMICAL_SILVER_PRODUCTION',
  CoalBalance = 'COAL_BALANCE',
  CoalProduction = 'COAL_PRODUCTION',
  ColdIronBalance = 'COLD_IRON_BALANCE',
  ColdIronProduction = 'COLD_IRON_PRODUCTION',
  CopperBalance = 'COPPER_BALANCE',
  CopperProduction = 'COPPER_PRODUCTION',
  CrossbowmanT1Balance = 'CROSSBOWMAN_T1_BALANCE',
  CrossbowmanT1Production = 'CROSSBOWMAN_T1_PRODUCTION',
  CrossbowmanT2Balance = 'CROSSBOWMAN_T2_BALANCE',
  CrossbowmanT2Production = 'CROSSBOWMAN_T2_PRODUCTION',
  CrossbowmanT3Balance = 'CROSSBOWMAN_T3_BALANCE',
  CrossbowmanT3Production = 'CROSSBOWMAN_T3_PRODUCTION',
  DeepCrystalBalance = 'DEEP_CRYSTAL_BALANCE',
  DeepCrystalProduction = 'DEEP_CRYSTAL_PRODUCTION',
  DiamondsBalance = 'DIAMONDS_BALANCE',
  DiamondsProduction = 'DIAMONDS_PRODUCTION',
  DonkeyBalance = 'DONKEY_BALANCE',
  DonkeyProduction = 'DONKEY_PRODUCTION',
  DragonhideBalance = 'DRAGONHIDE_BALANCE',
  DragonhideProduction = 'DRAGONHIDE_PRODUCTION',
  EarthenShardBalance = 'EARTHEN_SHARD_BALANCE',
  EarthenShardProduction = 'EARTHEN_SHARD_PRODUCTION',
  EntityId = 'ENTITY_ID',
  EtherealSilicaBalance = 'ETHEREAL_SILICA_BALANCE',
  EtherealSilicaProduction = 'ETHEREAL_SILICA_PRODUCTION',
  FishBalance = 'FISH_BALANCE',
  FishProduction = 'FISH_PRODUCTION',
  GoldBalance = 'GOLD_BALANCE',
  GoldProduction = 'GOLD_PRODUCTION',
  HartwoodBalance = 'HARTWOOD_BALANCE',
  HartwoodProduction = 'HARTWOOD_PRODUCTION',
  IgniumBalance = 'IGNIUM_BALANCE',
  IgniumProduction = 'IGNIUM_PRODUCTION',
  IronwoodBalance = 'IRONWOOD_BALANCE',
  IronwoodProduction = 'IRONWOOD_PRODUCTION',
  KnightT1Balance = 'KNIGHT_T1_BALANCE',
  KnightT1Production = 'KNIGHT_T1_PRODUCTION',
  KnightT2Balance = 'KNIGHT_T2_BALANCE',
  KnightT2Production = 'KNIGHT_T2_PRODUCTION',
  KnightT3Balance = 'KNIGHT_T3_BALANCE',
  KnightT3Production = 'KNIGHT_T3_PRODUCTION',
  LaborBalance = 'LABOR_BALANCE',
  LaborProduction = 'LABOR_PRODUCTION',
  LordsBalance = 'LORDS_BALANCE',
  LordsProduction = 'LORDS_PRODUCTION',
  MithralBalance = 'MITHRAL_BALANCE',
  MithralProduction = 'MITHRAL_PRODUCTION',
  ObsidianBalance = 'OBSIDIAN_BALANCE',
  ObsidianProduction = 'OBSIDIAN_PRODUCTION',
  PaladinT1Balance = 'PALADIN_T1_BALANCE',
  PaladinT1Production = 'PALADIN_T1_PRODUCTION',
  PaladinT2Balance = 'PALADIN_T2_BALANCE',
  PaladinT2Production = 'PALADIN_T2_PRODUCTION',
  PaladinT3Balance = 'PALADIN_T3_BALANCE',
  PaladinT3Production = 'PALADIN_T3_PRODUCTION',
  RubyBalance = 'RUBY_BALANCE',
  RubyProduction = 'RUBY_PRODUCTION',
  SapphireBalance = 'SAPPHIRE_BALANCE',
  SapphireProduction = 'SAPPHIRE_PRODUCTION',
  SilverBalance = 'SILVER_BALANCE',
  SilverProduction = 'SILVER_PRODUCTION',
  StoneBalance = 'STONE_BALANCE',
  StoneProduction = 'STONE_PRODUCTION',
  TrueIceBalance = 'TRUE_ICE_BALANCE',
  TrueIceProduction = 'TRUE_ICE_PRODUCTION',
  TwilightQuartzBalance = 'TWILIGHT_QUARTZ_BALANCE',
  TwilightQuartzProduction = 'TWILIGHT_QUARTZ_PRODUCTION',
  Weight = 'WEIGHT',
  WheatBalance = 'WHEAT_BALANCE',
  WheatProduction = 'WHEAT_PRODUCTION',
  WoodBalance = 'WOOD_BALANCE',
  WoodProduction = 'WOOD_PRODUCTION'
}

export type S1_Eternum_ResourceWhereInput = {
  ADAMANTINE_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  ADAMANTINE_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  ADAMANTINE_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  ADAMANTINE_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  ADAMANTINE_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  ADAMANTINE_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  ADAMANTINE_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  ADAMANTINE_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  ADAMANTINE_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  ADAMANTINE_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  ADAMANTINE_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  ADAMANTINE_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Adamantine_ProductionWhereInput>;
  ALCHEMICAL_SILVER_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  ALCHEMICAL_SILVER_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  ALCHEMICAL_SILVER_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  ALCHEMICAL_SILVER_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  ALCHEMICAL_SILVER_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  ALCHEMICAL_SILVER_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  ALCHEMICAL_SILVER_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  ALCHEMICAL_SILVER_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  ALCHEMICAL_SILVER_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  ALCHEMICAL_SILVER_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  ALCHEMICAL_SILVER_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  ALCHEMICAL_SILVER_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Alchemical_Silver_ProductionWhereInput>;
  COAL_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  COAL_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  COAL_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  COAL_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  COAL_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  COAL_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  COAL_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  COAL_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  COAL_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  COAL_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  COAL_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  COAL_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Coal_ProductionWhereInput>;
  COLD_IRON_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  COLD_IRON_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  COLD_IRON_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  COLD_IRON_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  COLD_IRON_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  COLD_IRON_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  COLD_IRON_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  COLD_IRON_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  COLD_IRON_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  COLD_IRON_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  COLD_IRON_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  COLD_IRON_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Cold_Iron_ProductionWhereInput>;
  COPPER_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  COPPER_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  COPPER_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  COPPER_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  COPPER_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  COPPER_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  COPPER_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  COPPER_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  COPPER_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  COPPER_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  COPPER_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  COPPER_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Copper_ProductionWhereInput>;
  CROSSBOWMAN_T1_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T1_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T1_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T1_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T1_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  CROSSBOWMAN_T1_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T1_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T1_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T1_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T1_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  CROSSBOWMAN_T1_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T1_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Crossbowman_T1_ProductionWhereInput>;
  CROSSBOWMAN_T2_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T2_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T2_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T2_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T2_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  CROSSBOWMAN_T2_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T2_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T2_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T2_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T2_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  CROSSBOWMAN_T2_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T2_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Crossbowman_T2_ProductionWhereInput>;
  CROSSBOWMAN_T3_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T3_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T3_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T3_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T3_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  CROSSBOWMAN_T3_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T3_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T3_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T3_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T3_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  CROSSBOWMAN_T3_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  CROSSBOWMAN_T3_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Crossbowman_T3_ProductionWhereInput>;
  DEEP_CRYSTAL_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  DEEP_CRYSTAL_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  DEEP_CRYSTAL_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  DEEP_CRYSTAL_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  DEEP_CRYSTAL_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  DEEP_CRYSTAL_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  DEEP_CRYSTAL_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  DEEP_CRYSTAL_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  DEEP_CRYSTAL_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  DEEP_CRYSTAL_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  DEEP_CRYSTAL_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  DEEP_CRYSTAL_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Deep_Crystal_ProductionWhereInput>;
  DIAMONDS_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  DIAMONDS_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  DIAMONDS_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  DIAMONDS_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  DIAMONDS_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  DIAMONDS_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  DIAMONDS_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  DIAMONDS_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  DIAMONDS_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  DIAMONDS_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  DIAMONDS_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  DIAMONDS_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Diamonds_ProductionWhereInput>;
  DONKEY_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  DONKEY_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  DONKEY_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  DONKEY_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  DONKEY_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  DONKEY_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  DONKEY_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  DONKEY_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  DONKEY_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  DONKEY_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  DONKEY_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  DONKEY_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Donkey_ProductionWhereInput>;
  DRAGONHIDE_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  DRAGONHIDE_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  DRAGONHIDE_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  DRAGONHIDE_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  DRAGONHIDE_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  DRAGONHIDE_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  DRAGONHIDE_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  DRAGONHIDE_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  DRAGONHIDE_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  DRAGONHIDE_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  DRAGONHIDE_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  DRAGONHIDE_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Dragonhide_ProductionWhereInput>;
  EARTHEN_SHARD_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  EARTHEN_SHARD_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  EARTHEN_SHARD_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  EARTHEN_SHARD_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  EARTHEN_SHARD_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  EARTHEN_SHARD_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  EARTHEN_SHARD_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  EARTHEN_SHARD_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  EARTHEN_SHARD_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  EARTHEN_SHARD_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  EARTHEN_SHARD_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  EARTHEN_SHARD_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Earthen_Shard_ProductionWhereInput>;
  ETHEREAL_SILICA_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  ETHEREAL_SILICA_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  ETHEREAL_SILICA_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  ETHEREAL_SILICA_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  ETHEREAL_SILICA_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  ETHEREAL_SILICA_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  ETHEREAL_SILICA_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  ETHEREAL_SILICA_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  ETHEREAL_SILICA_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  ETHEREAL_SILICA_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  ETHEREAL_SILICA_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  ETHEREAL_SILICA_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Ethereal_Silica_ProductionWhereInput>;
  FISH_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  FISH_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  FISH_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  FISH_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  FISH_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  FISH_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  FISH_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  FISH_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  FISH_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  FISH_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  FISH_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  FISH_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Fish_ProductionWhereInput>;
  GOLD_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  GOLD_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  GOLD_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  GOLD_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  GOLD_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  GOLD_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  GOLD_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  GOLD_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  GOLD_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  GOLD_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  GOLD_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  GOLD_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Gold_ProductionWhereInput>;
  HARTWOOD_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  HARTWOOD_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  HARTWOOD_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  HARTWOOD_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  HARTWOOD_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  HARTWOOD_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  HARTWOOD_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  HARTWOOD_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  HARTWOOD_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  HARTWOOD_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  HARTWOOD_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  HARTWOOD_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Hartwood_ProductionWhereInput>;
  IGNIUM_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  IGNIUM_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  IGNIUM_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  IGNIUM_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  IGNIUM_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  IGNIUM_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  IGNIUM_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  IGNIUM_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  IGNIUM_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  IGNIUM_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  IGNIUM_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  IGNIUM_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Ignium_ProductionWhereInput>;
  IRONWOOD_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  IRONWOOD_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  IRONWOOD_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  IRONWOOD_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  IRONWOOD_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  IRONWOOD_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  IRONWOOD_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  IRONWOOD_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  IRONWOOD_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  IRONWOOD_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  IRONWOOD_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  IRONWOOD_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Ironwood_ProductionWhereInput>;
  KNIGHT_T1_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T1_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T1_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T1_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T1_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  KNIGHT_T1_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T1_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T1_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T1_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T1_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  KNIGHT_T1_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T1_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Knight_T1_ProductionWhereInput>;
  KNIGHT_T2_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T2_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T2_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T2_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T2_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  KNIGHT_T2_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T2_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T2_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T2_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T2_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  KNIGHT_T2_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T2_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Knight_T2_ProductionWhereInput>;
  KNIGHT_T3_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T3_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T3_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T3_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T3_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  KNIGHT_T3_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T3_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T3_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T3_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T3_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  KNIGHT_T3_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  KNIGHT_T3_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Knight_T3_ProductionWhereInput>;
  LABOR_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  LABOR_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  LABOR_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  LABOR_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  LABOR_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  LABOR_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  LABOR_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  LABOR_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  LABOR_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  LABOR_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  LABOR_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  LABOR_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Labor_ProductionWhereInput>;
  LORDS_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  LORDS_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  LORDS_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  LORDS_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  LORDS_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  LORDS_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  LORDS_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  LORDS_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  LORDS_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  LORDS_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  LORDS_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  LORDS_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Lords_ProductionWhereInput>;
  MITHRAL_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  MITHRAL_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  MITHRAL_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  MITHRAL_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  MITHRAL_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  MITHRAL_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  MITHRAL_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  MITHRAL_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  MITHRAL_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  MITHRAL_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  MITHRAL_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  MITHRAL_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Mithral_ProductionWhereInput>;
  OBSIDIAN_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  OBSIDIAN_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  OBSIDIAN_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  OBSIDIAN_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  OBSIDIAN_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  OBSIDIAN_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  OBSIDIAN_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  OBSIDIAN_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  OBSIDIAN_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  OBSIDIAN_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  OBSIDIAN_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  OBSIDIAN_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Obsidian_ProductionWhereInput>;
  PALADIN_T1_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T1_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T1_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T1_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T1_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  PALADIN_T1_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T1_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T1_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T1_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T1_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  PALADIN_T1_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T1_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Paladin_T1_ProductionWhereInput>;
  PALADIN_T2_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T2_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T2_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T2_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T2_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  PALADIN_T2_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T2_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T2_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T2_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T2_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  PALADIN_T2_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T2_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Paladin_T2_ProductionWhereInput>;
  PALADIN_T3_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T3_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T3_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T3_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T3_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  PALADIN_T3_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T3_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T3_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T3_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T3_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  PALADIN_T3_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  PALADIN_T3_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Paladin_T3_ProductionWhereInput>;
  RUBY_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  RUBY_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  RUBY_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  RUBY_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  RUBY_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  RUBY_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  RUBY_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  RUBY_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  RUBY_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  RUBY_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  RUBY_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  RUBY_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Ruby_ProductionWhereInput>;
  SAPPHIRE_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  SAPPHIRE_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  SAPPHIRE_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  SAPPHIRE_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  SAPPHIRE_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  SAPPHIRE_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  SAPPHIRE_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  SAPPHIRE_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  SAPPHIRE_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  SAPPHIRE_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  SAPPHIRE_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  SAPPHIRE_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Sapphire_ProductionWhereInput>;
  SILVER_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  SILVER_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  SILVER_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  SILVER_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  SILVER_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  SILVER_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  SILVER_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  SILVER_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  SILVER_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  SILVER_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  SILVER_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  SILVER_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Silver_ProductionWhereInput>;
  STONE_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  STONE_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  STONE_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  STONE_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  STONE_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  STONE_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  STONE_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  STONE_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  STONE_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  STONE_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  STONE_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  STONE_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Stone_ProductionWhereInput>;
  TRUE_ICE_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  TRUE_ICE_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  TRUE_ICE_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  TRUE_ICE_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  TRUE_ICE_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  TRUE_ICE_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  TRUE_ICE_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  TRUE_ICE_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  TRUE_ICE_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  TRUE_ICE_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  TRUE_ICE_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  TRUE_ICE_PRODUCTION?: InputMaybe<S1_Eternum_Resource_True_Ice_ProductionWhereInput>;
  TWILIGHT_QUARTZ_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  TWILIGHT_QUARTZ_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  TWILIGHT_QUARTZ_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  TWILIGHT_QUARTZ_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  TWILIGHT_QUARTZ_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  TWILIGHT_QUARTZ_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  TWILIGHT_QUARTZ_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  TWILIGHT_QUARTZ_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  TWILIGHT_QUARTZ_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  TWILIGHT_QUARTZ_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  TWILIGHT_QUARTZ_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  TWILIGHT_QUARTZ_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Twilight_Quartz_ProductionWhereInput>;
  WHEAT_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  WHEAT_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  WHEAT_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  WHEAT_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  WHEAT_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  WHEAT_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  WHEAT_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  WHEAT_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  WHEAT_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  WHEAT_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  WHEAT_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  WHEAT_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Wheat_ProductionWhereInput>;
  WOOD_BALANCE?: InputMaybe<Scalars['u128']['input']>;
  WOOD_BALANCEEQ?: InputMaybe<Scalars['u128']['input']>;
  WOOD_BALANCEGT?: InputMaybe<Scalars['u128']['input']>;
  WOOD_BALANCEGTE?: InputMaybe<Scalars['u128']['input']>;
  WOOD_BALANCEIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  WOOD_BALANCELIKE?: InputMaybe<Scalars['u128']['input']>;
  WOOD_BALANCELT?: InputMaybe<Scalars['u128']['input']>;
  WOOD_BALANCELTE?: InputMaybe<Scalars['u128']['input']>;
  WOOD_BALANCENEQ?: InputMaybe<Scalars['u128']['input']>;
  WOOD_BALANCENOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  WOOD_BALANCENOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  WOOD_PRODUCTION?: InputMaybe<S1_Eternum_Resource_Wood_ProductionWhereInput>;
  entity_id?: InputMaybe<Scalars['u32']['input']>;
  entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  weight?: InputMaybe<S1_Eternum_Resource_WeightWhereInput>;
};

export type S1_Eternum_Resource_Adamantine_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Alchemical_Silver_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Coal_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Cold_Iron_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Copper_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Crossbowman_T1_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Crossbowman_T2_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Crossbowman_T3_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Deep_Crystal_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Diamonds_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Donkey_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Dragonhide_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Earthen_Shard_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Ethereal_Silica_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Fish_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Gold_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Hartwood_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Ignium_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Ironwood_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Knight_T1_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Knight_T2_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Knight_T3_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Labor_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Lords_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Mithral_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Obsidian_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Paladin_T1_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Paladin_T2_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Paladin_T3_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Ruby_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Sapphire_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Silver_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Stone_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_True_Ice_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Twilight_Quartz_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Wheat_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_Wood_ProductionWhereInput = {
  building_count?: InputMaybe<Scalars['u8']['input']>;
  building_countEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countGT?: InputMaybe<Scalars['u8']['input']>;
  building_countGTE?: InputMaybe<Scalars['u8']['input']>;
  building_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  building_countLT?: InputMaybe<Scalars['u8']['input']>;
  building_countLTE?: InputMaybe<Scalars['u8']['input']>;
  building_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  building_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  building_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  last_updated_at?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atGTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLT?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atLTE?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  last_updated_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  last_updated_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  output_amount_left?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftGTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLT?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftLTE?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_amount_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_amount_leftNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rate?: InputMaybe<Scalars['u64']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateGT?: InputMaybe<Scalars['u64']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rateLT?: InputMaybe<Scalars['u64']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u64']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Resource_WeightWhereInput = {
  capacity?: InputMaybe<Scalars['u128']['input']>;
  capacityEQ?: InputMaybe<Scalars['u128']['input']>;
  capacityGT?: InputMaybe<Scalars['u128']['input']>;
  capacityGTE?: InputMaybe<Scalars['u128']['input']>;
  capacityIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  capacityLIKE?: InputMaybe<Scalars['u128']['input']>;
  capacityLT?: InputMaybe<Scalars['u128']['input']>;
  capacityLTE?: InputMaybe<Scalars['u128']['input']>;
  capacityNEQ?: InputMaybe<Scalars['u128']['input']>;
  capacityNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  capacityNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  weight?: InputMaybe<Scalars['u128']['input']>;
  weightEQ?: InputMaybe<Scalars['u128']['input']>;
  weightGT?: InputMaybe<Scalars['u128']['input']>;
  weightGTE?: InputMaybe<Scalars['u128']['input']>;
  weightIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  weightLIKE?: InputMaybe<Scalars['u128']['input']>;
  weightLT?: InputMaybe<Scalars['u128']['input']>;
  weightLTE?: InputMaybe<Scalars['u128']['input']>;
  weightNEQ?: InputMaybe<Scalars['u128']['input']>;
  weightNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  weightNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type S1_Eternum_SeasonOrder = {
  direction: OrderDirection;
  field: S1_Eternum_SeasonOrderField;
};

export enum S1_Eternum_SeasonOrderField {
  ConfigId = 'CONFIG_ID',
  EndedAt = 'ENDED_AT',
  IsOver = 'IS_OVER',
  StartAt = 'START_AT'
}

export type S1_Eternum_SeasonWhereInput = {
  config_id?: InputMaybe<Scalars['u32']['input']>;
  config_idEQ?: InputMaybe<Scalars['u32']['input']>;
  config_idGT?: InputMaybe<Scalars['u32']['input']>;
  config_idGTE?: InputMaybe<Scalars['u32']['input']>;
  config_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  config_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  config_idLT?: InputMaybe<Scalars['u32']['input']>;
  config_idLTE?: InputMaybe<Scalars['u32']['input']>;
  config_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  config_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  config_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  ended_at?: InputMaybe<Scalars['u64']['input']>;
  ended_atEQ?: InputMaybe<Scalars['u64']['input']>;
  ended_atGT?: InputMaybe<Scalars['u64']['input']>;
  ended_atGTE?: InputMaybe<Scalars['u64']['input']>;
  ended_atIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  ended_atLIKE?: InputMaybe<Scalars['u64']['input']>;
  ended_atLT?: InputMaybe<Scalars['u64']['input']>;
  ended_atLTE?: InputMaybe<Scalars['u64']['input']>;
  ended_atNEQ?: InputMaybe<Scalars['u64']['input']>;
  ended_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  ended_atNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  is_over?: InputMaybe<Scalars['bool']['input']>;
  start_at?: InputMaybe<Scalars['u64']['input']>;
  start_atEQ?: InputMaybe<Scalars['u64']['input']>;
  start_atGT?: InputMaybe<Scalars['u64']['input']>;
  start_atGTE?: InputMaybe<Scalars['u64']['input']>;
  start_atIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  start_atLIKE?: InputMaybe<Scalars['u64']['input']>;
  start_atLT?: InputMaybe<Scalars['u64']['input']>;
  start_atLTE?: InputMaybe<Scalars['u64']['input']>;
  start_atNEQ?: InputMaybe<Scalars['u64']['input']>;
  start_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  start_atNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_SettleRealmDataOrder = {
  direction: OrderDirection;
  field: S1_Eternum_SettleRealmDataOrderField;
};

export enum S1_Eternum_SettleRealmDataOrderField {
  Cities = 'CITIES',
  EntityId = 'ENTITY_ID',
  EventId = 'EVENT_ID',
  Harbors = 'HARBORS',
  Id = 'ID',
  Order = 'ORDER',
  OwnerAddress = 'OWNER_ADDRESS',
  OwnerName = 'OWNER_NAME',
  ProducedResources = 'PRODUCED_RESOURCES',
  RealmName = 'REALM_NAME',
  Regions = 'REGIONS',
  Rivers = 'RIVERS',
  Timestamp = 'TIMESTAMP',
  Wonder = 'WONDER',
  X = 'X',
  Y = 'Y'
}

export type S1_Eternum_SettleRealmDataWhereInput = {
  cities?: InputMaybe<Scalars['u8']['input']>;
  citiesEQ?: InputMaybe<Scalars['u8']['input']>;
  citiesGT?: InputMaybe<Scalars['u8']['input']>;
  citiesGTE?: InputMaybe<Scalars['u8']['input']>;
  citiesIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  citiesLIKE?: InputMaybe<Scalars['u8']['input']>;
  citiesLT?: InputMaybe<Scalars['u8']['input']>;
  citiesLTE?: InputMaybe<Scalars['u8']['input']>;
  citiesNEQ?: InputMaybe<Scalars['u8']['input']>;
  citiesNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  citiesNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  entity_id?: InputMaybe<Scalars['u32']['input']>;
  entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  event_id?: InputMaybe<Scalars['Enum']['input']>;
  harbors?: InputMaybe<Scalars['u8']['input']>;
  harborsEQ?: InputMaybe<Scalars['u8']['input']>;
  harborsGT?: InputMaybe<Scalars['u8']['input']>;
  harborsGTE?: InputMaybe<Scalars['u8']['input']>;
  harborsIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  harborsLIKE?: InputMaybe<Scalars['u8']['input']>;
  harborsLT?: InputMaybe<Scalars['u8']['input']>;
  harborsLTE?: InputMaybe<Scalars['u8']['input']>;
  harborsNEQ?: InputMaybe<Scalars['u8']['input']>;
  harborsNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  harborsNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  id?: InputMaybe<Scalars['u32']['input']>;
  idEQ?: InputMaybe<Scalars['u32']['input']>;
  idGT?: InputMaybe<Scalars['u32']['input']>;
  idGTE?: InputMaybe<Scalars['u32']['input']>;
  idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  idLIKE?: InputMaybe<Scalars['u32']['input']>;
  idLT?: InputMaybe<Scalars['u32']['input']>;
  idLTE?: InputMaybe<Scalars['u32']['input']>;
  idNEQ?: InputMaybe<Scalars['u32']['input']>;
  idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  order?: InputMaybe<Scalars['u8']['input']>;
  orderEQ?: InputMaybe<Scalars['u8']['input']>;
  orderGT?: InputMaybe<Scalars['u8']['input']>;
  orderGTE?: InputMaybe<Scalars['u8']['input']>;
  orderIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  orderLIKE?: InputMaybe<Scalars['u8']['input']>;
  orderLT?: InputMaybe<Scalars['u8']['input']>;
  orderLTE?: InputMaybe<Scalars['u8']['input']>;
  orderNEQ?: InputMaybe<Scalars['u8']['input']>;
  orderNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  orderNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  owner_address?: InputMaybe<Scalars['ContractAddress']['input']>;
  owner_addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  owner_addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  owner_addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  owner_addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  owner_addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  owner_addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  owner_addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  owner_addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  owner_addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  owner_addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  owner_name?: InputMaybe<Scalars['felt252']['input']>;
  owner_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  owner_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  owner_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  owner_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  owner_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  owner_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  owner_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  owner_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  owner_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  owner_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  produced_resources?: InputMaybe<Scalars['u128']['input']>;
  produced_resourcesEQ?: InputMaybe<Scalars['u128']['input']>;
  produced_resourcesGT?: InputMaybe<Scalars['u128']['input']>;
  produced_resourcesGTE?: InputMaybe<Scalars['u128']['input']>;
  produced_resourcesIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  produced_resourcesLIKE?: InputMaybe<Scalars['u128']['input']>;
  produced_resourcesLT?: InputMaybe<Scalars['u128']['input']>;
  produced_resourcesLTE?: InputMaybe<Scalars['u128']['input']>;
  produced_resourcesNEQ?: InputMaybe<Scalars['u128']['input']>;
  produced_resourcesNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  produced_resourcesNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  realm_name?: InputMaybe<Scalars['felt252']['input']>;
  realm_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  realm_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  realm_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  realm_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  realm_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  realm_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  realm_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  realm_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  realm_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  realm_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  regions?: InputMaybe<Scalars['u8']['input']>;
  regionsEQ?: InputMaybe<Scalars['u8']['input']>;
  regionsGT?: InputMaybe<Scalars['u8']['input']>;
  regionsGTE?: InputMaybe<Scalars['u8']['input']>;
  regionsIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  regionsLIKE?: InputMaybe<Scalars['u8']['input']>;
  regionsLT?: InputMaybe<Scalars['u8']['input']>;
  regionsLTE?: InputMaybe<Scalars['u8']['input']>;
  regionsNEQ?: InputMaybe<Scalars['u8']['input']>;
  regionsNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  regionsNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  rivers?: InputMaybe<Scalars['u8']['input']>;
  riversEQ?: InputMaybe<Scalars['u8']['input']>;
  riversGT?: InputMaybe<Scalars['u8']['input']>;
  riversGTE?: InputMaybe<Scalars['u8']['input']>;
  riversIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  riversLIKE?: InputMaybe<Scalars['u8']['input']>;
  riversLT?: InputMaybe<Scalars['u8']['input']>;
  riversLTE?: InputMaybe<Scalars['u8']['input']>;
  riversNEQ?: InputMaybe<Scalars['u8']['input']>;
  riversNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  riversNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  wonder?: InputMaybe<Scalars['u8']['input']>;
  wonderEQ?: InputMaybe<Scalars['u8']['input']>;
  wonderGT?: InputMaybe<Scalars['u8']['input']>;
  wonderGTE?: InputMaybe<Scalars['u8']['input']>;
  wonderIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  wonderLIKE?: InputMaybe<Scalars['u8']['input']>;
  wonderLT?: InputMaybe<Scalars['u8']['input']>;
  wonderLTE?: InputMaybe<Scalars['u8']['input']>;
  wonderNEQ?: InputMaybe<Scalars['u8']['input']>;
  wonderNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  wonderNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  x?: InputMaybe<Scalars['u32']['input']>;
  xEQ?: InputMaybe<Scalars['u32']['input']>;
  xGT?: InputMaybe<Scalars['u32']['input']>;
  xGTE?: InputMaybe<Scalars['u32']['input']>;
  xIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  xLIKE?: InputMaybe<Scalars['u32']['input']>;
  xLT?: InputMaybe<Scalars['u32']['input']>;
  xLTE?: InputMaybe<Scalars['u32']['input']>;
  xNEQ?: InputMaybe<Scalars['u32']['input']>;
  xNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  xNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  y?: InputMaybe<Scalars['u32']['input']>;
  yEQ?: InputMaybe<Scalars['u32']['input']>;
  yGT?: InputMaybe<Scalars['u32']['input']>;
  yGTE?: InputMaybe<Scalars['u32']['input']>;
  yIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  yLIKE?: InputMaybe<Scalars['u32']['input']>;
  yLT?: InputMaybe<Scalars['u32']['input']>;
  yLTE?: InputMaybe<Scalars['u32']['input']>;
  yNEQ?: InputMaybe<Scalars['u32']['input']>;
  yNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  yNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_StartingResourcesConfigOrder = {
  direction: OrderDirection;
  field: S1_Eternum_StartingResourcesConfigOrderField;
};

export enum S1_Eternum_StartingResourcesConfigOrderField {
  ResourceAmount = 'RESOURCE_AMOUNT',
  ResourceType = 'RESOURCE_TYPE'
}

export type S1_Eternum_StartingResourcesConfigWhereInput = {
  resource_amount?: InputMaybe<Scalars['u128']['input']>;
  resource_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  resource_amountGT?: InputMaybe<Scalars['u128']['input']>;
  resource_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  resource_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resource_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_amountLT?: InputMaybe<Scalars['u128']['input']>;
  resource_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  resource_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  resource_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resource_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_type?: InputMaybe<Scalars['u8']['input']>;
  resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S1_Eternum_StructureBuildingsOrder = {
  direction: OrderDirection;
  field: S1_Eternum_StructureBuildingsOrderField;
};

export enum S1_Eternum_StructureBuildingsOrderField {
  EntityId = 'ENTITY_ID',
  PackedCounts = 'PACKED_COUNTS',
  Population = 'POPULATION'
}

export type S1_Eternum_StructureBuildingsWhereInput = {
  entity_id?: InputMaybe<Scalars['u32']['input']>;
  entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  packed_counts?: InputMaybe<Scalars['u128']['input']>;
  packed_countsEQ?: InputMaybe<Scalars['u128']['input']>;
  packed_countsGT?: InputMaybe<Scalars['u128']['input']>;
  packed_countsGTE?: InputMaybe<Scalars['u128']['input']>;
  packed_countsIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  packed_countsLIKE?: InputMaybe<Scalars['u128']['input']>;
  packed_countsLT?: InputMaybe<Scalars['u128']['input']>;
  packed_countsLTE?: InputMaybe<Scalars['u128']['input']>;
  packed_countsNEQ?: InputMaybe<Scalars['u128']['input']>;
  packed_countsNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  packed_countsNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  population?: InputMaybe<S1_Eternum_StructureBuildings_PopulationWhereInput>;
};

export type S1_Eternum_StructureBuildings_PopulationWhereInput = {
  current?: InputMaybe<Scalars['u32']['input']>;
  currentEQ?: InputMaybe<Scalars['u32']['input']>;
  currentGT?: InputMaybe<Scalars['u32']['input']>;
  currentGTE?: InputMaybe<Scalars['u32']['input']>;
  currentIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  currentLIKE?: InputMaybe<Scalars['u32']['input']>;
  currentLT?: InputMaybe<Scalars['u32']['input']>;
  currentLTE?: InputMaybe<Scalars['u32']['input']>;
  currentNEQ?: InputMaybe<Scalars['u32']['input']>;
  currentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  currentNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  max?: InputMaybe<Scalars['u32']['input']>;
  maxEQ?: InputMaybe<Scalars['u32']['input']>;
  maxGT?: InputMaybe<Scalars['u32']['input']>;
  maxGTE?: InputMaybe<Scalars['u32']['input']>;
  maxIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maxLIKE?: InputMaybe<Scalars['u32']['input']>;
  maxLT?: InputMaybe<Scalars['u32']['input']>;
  maxLTE?: InputMaybe<Scalars['u32']['input']>;
  maxNEQ?: InputMaybe<Scalars['u32']['input']>;
  maxNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maxNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_StructureLevelConfigOrder = {
  direction: OrderDirection;
  field: S1_Eternum_StructureLevelConfigOrderField;
};

export enum S1_Eternum_StructureLevelConfigOrderField {
  Level = 'LEVEL',
  RequiredResourcesId = 'REQUIRED_RESOURCES_ID',
  RequiredResourceCount = 'REQUIRED_RESOURCE_COUNT'
}

export type S1_Eternum_StructureLevelConfigWhereInput = {
  level?: InputMaybe<Scalars['u8']['input']>;
  levelEQ?: InputMaybe<Scalars['u8']['input']>;
  levelGT?: InputMaybe<Scalars['u8']['input']>;
  levelGTE?: InputMaybe<Scalars['u8']['input']>;
  levelIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  levelLIKE?: InputMaybe<Scalars['u8']['input']>;
  levelLT?: InputMaybe<Scalars['u8']['input']>;
  levelLTE?: InputMaybe<Scalars['u8']['input']>;
  levelNEQ?: InputMaybe<Scalars['u8']['input']>;
  levelNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  levelNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  required_resource_count?: InputMaybe<Scalars['u8']['input']>;
  required_resource_countEQ?: InputMaybe<Scalars['u8']['input']>;
  required_resource_countGT?: InputMaybe<Scalars['u8']['input']>;
  required_resource_countGTE?: InputMaybe<Scalars['u8']['input']>;
  required_resource_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  required_resource_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  required_resource_countLT?: InputMaybe<Scalars['u8']['input']>;
  required_resource_countLTE?: InputMaybe<Scalars['u8']['input']>;
  required_resource_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  required_resource_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  required_resource_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  required_resources_id?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idEQ?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idGT?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idGTE?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  required_resources_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idLT?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idLTE?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  required_resources_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  required_resources_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_StructureOrder = {
  direction: OrderDirection;
  field: S1_Eternum_StructureOrderField;
};

export enum S1_Eternum_StructureOrderField {
  Base = 'BASE',
  Category = 'CATEGORY',
  EntityId = 'ENTITY_ID',
  Metadata = 'METADATA',
  Owner = 'OWNER',
  ResourcesPacked = 'RESOURCES_PACKED',
  TroopExplorers = 'TROOP_EXPLORERS',
  TroopGuards = 'TROOP_GUARDS'
}

export type S1_Eternum_StructureWhereInput = {
  base?: InputMaybe<S1_Eternum_Structure_BaseWhereInput>;
  category?: InputMaybe<Scalars['u8']['input']>;
  categoryEQ?: InputMaybe<Scalars['u8']['input']>;
  categoryGT?: InputMaybe<Scalars['u8']['input']>;
  categoryGTE?: InputMaybe<Scalars['u8']['input']>;
  categoryIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  categoryLIKE?: InputMaybe<Scalars['u8']['input']>;
  categoryLT?: InputMaybe<Scalars['u8']['input']>;
  categoryLTE?: InputMaybe<Scalars['u8']['input']>;
  categoryNEQ?: InputMaybe<Scalars['u8']['input']>;
  categoryNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  categoryNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  entity_id?: InputMaybe<Scalars['u32']['input']>;
  entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  metadata?: InputMaybe<S1_Eternum_Structure_MetadataWhereInput>;
  owner?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  ownerLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  ownerNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  ownerNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  resources_packed?: InputMaybe<Scalars['u128']['input']>;
  resources_packedEQ?: InputMaybe<Scalars['u128']['input']>;
  resources_packedGT?: InputMaybe<Scalars['u128']['input']>;
  resources_packedGTE?: InputMaybe<Scalars['u128']['input']>;
  resources_packedIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resources_packedLIKE?: InputMaybe<Scalars['u128']['input']>;
  resources_packedLT?: InputMaybe<Scalars['u128']['input']>;
  resources_packedLTE?: InputMaybe<Scalars['u128']['input']>;
  resources_packedNEQ?: InputMaybe<Scalars['u128']['input']>;
  resources_packedNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resources_packedNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  troop_guards?: InputMaybe<S1_Eternum_Structure_Troop_GuardsWhereInput>;
};

export type S1_Eternum_Structure_BaseWhereInput = {
  category?: InputMaybe<Scalars['u8']['input']>;
  categoryEQ?: InputMaybe<Scalars['u8']['input']>;
  categoryGT?: InputMaybe<Scalars['u8']['input']>;
  categoryGTE?: InputMaybe<Scalars['u8']['input']>;
  categoryIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  categoryLIKE?: InputMaybe<Scalars['u8']['input']>;
  categoryLT?: InputMaybe<Scalars['u8']['input']>;
  categoryLTE?: InputMaybe<Scalars['u8']['input']>;
  categoryNEQ?: InputMaybe<Scalars['u8']['input']>;
  categoryNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  categoryNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  coord_x?: InputMaybe<Scalars['u32']['input']>;
  coord_xEQ?: InputMaybe<Scalars['u32']['input']>;
  coord_xGT?: InputMaybe<Scalars['u32']['input']>;
  coord_xGTE?: InputMaybe<Scalars['u32']['input']>;
  coord_xIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  coord_xLIKE?: InputMaybe<Scalars['u32']['input']>;
  coord_xLT?: InputMaybe<Scalars['u32']['input']>;
  coord_xLTE?: InputMaybe<Scalars['u32']['input']>;
  coord_xNEQ?: InputMaybe<Scalars['u32']['input']>;
  coord_xNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  coord_xNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  coord_y?: InputMaybe<Scalars['u32']['input']>;
  coord_yEQ?: InputMaybe<Scalars['u32']['input']>;
  coord_yGT?: InputMaybe<Scalars['u32']['input']>;
  coord_yGTE?: InputMaybe<Scalars['u32']['input']>;
  coord_yIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  coord_yLIKE?: InputMaybe<Scalars['u32']['input']>;
  coord_yLT?: InputMaybe<Scalars['u32']['input']>;
  coord_yLTE?: InputMaybe<Scalars['u32']['input']>;
  coord_yNEQ?: InputMaybe<Scalars['u32']['input']>;
  coord_yNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  coord_yNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  created_at?: InputMaybe<Scalars['u32']['input']>;
  created_atEQ?: InputMaybe<Scalars['u32']['input']>;
  created_atGT?: InputMaybe<Scalars['u32']['input']>;
  created_atGTE?: InputMaybe<Scalars['u32']['input']>;
  created_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  created_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  created_atLT?: InputMaybe<Scalars['u32']['input']>;
  created_atLTE?: InputMaybe<Scalars['u32']['input']>;
  created_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  created_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  created_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  level?: InputMaybe<Scalars['u8']['input']>;
  levelEQ?: InputMaybe<Scalars['u8']['input']>;
  levelGT?: InputMaybe<Scalars['u8']['input']>;
  levelGTE?: InputMaybe<Scalars['u8']['input']>;
  levelIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  levelLIKE?: InputMaybe<Scalars['u8']['input']>;
  levelLT?: InputMaybe<Scalars['u8']['input']>;
  levelLTE?: InputMaybe<Scalars['u8']['input']>;
  levelNEQ?: InputMaybe<Scalars['u8']['input']>;
  levelNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  levelNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  troop_explorer_count?: InputMaybe<Scalars['u16']['input']>;
  troop_explorer_countEQ?: InputMaybe<Scalars['u16']['input']>;
  troop_explorer_countGT?: InputMaybe<Scalars['u16']['input']>;
  troop_explorer_countGTE?: InputMaybe<Scalars['u16']['input']>;
  troop_explorer_countIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  troop_explorer_countLIKE?: InputMaybe<Scalars['u16']['input']>;
  troop_explorer_countLT?: InputMaybe<Scalars['u16']['input']>;
  troop_explorer_countLTE?: InputMaybe<Scalars['u16']['input']>;
  troop_explorer_countNEQ?: InputMaybe<Scalars['u16']['input']>;
  troop_explorer_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  troop_explorer_countNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  troop_guard_count?: InputMaybe<Scalars['u8']['input']>;
  troop_guard_countEQ?: InputMaybe<Scalars['u8']['input']>;
  troop_guard_countGT?: InputMaybe<Scalars['u8']['input']>;
  troop_guard_countGTE?: InputMaybe<Scalars['u8']['input']>;
  troop_guard_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  troop_guard_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  troop_guard_countLT?: InputMaybe<Scalars['u8']['input']>;
  troop_guard_countLTE?: InputMaybe<Scalars['u8']['input']>;
  troop_guard_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  troop_guard_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  troop_guard_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  troop_max_explorer_count?: InputMaybe<Scalars['u16']['input']>;
  troop_max_explorer_countEQ?: InputMaybe<Scalars['u16']['input']>;
  troop_max_explorer_countGT?: InputMaybe<Scalars['u16']['input']>;
  troop_max_explorer_countGTE?: InputMaybe<Scalars['u16']['input']>;
  troop_max_explorer_countIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  troop_max_explorer_countLIKE?: InputMaybe<Scalars['u16']['input']>;
  troop_max_explorer_countLT?: InputMaybe<Scalars['u16']['input']>;
  troop_max_explorer_countLTE?: InputMaybe<Scalars['u16']['input']>;
  troop_max_explorer_countNEQ?: InputMaybe<Scalars['u16']['input']>;
  troop_max_explorer_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  troop_max_explorer_countNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  troop_max_guard_count?: InputMaybe<Scalars['u8']['input']>;
  troop_max_guard_countEQ?: InputMaybe<Scalars['u8']['input']>;
  troop_max_guard_countGT?: InputMaybe<Scalars['u8']['input']>;
  troop_max_guard_countGTE?: InputMaybe<Scalars['u8']['input']>;
  troop_max_guard_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  troop_max_guard_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  troop_max_guard_countLT?: InputMaybe<Scalars['u8']['input']>;
  troop_max_guard_countLTE?: InputMaybe<Scalars['u8']['input']>;
  troop_max_guard_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  troop_max_guard_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  troop_max_guard_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S1_Eternum_Structure_MetadataWhereInput = {
  has_wonder?: InputMaybe<Scalars['bool']['input']>;
  order?: InputMaybe<Scalars['u8']['input']>;
  orderEQ?: InputMaybe<Scalars['u8']['input']>;
  orderGT?: InputMaybe<Scalars['u8']['input']>;
  orderGTE?: InputMaybe<Scalars['u8']['input']>;
  orderIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  orderLIKE?: InputMaybe<Scalars['u8']['input']>;
  orderLT?: InputMaybe<Scalars['u8']['input']>;
  orderLTE?: InputMaybe<Scalars['u8']['input']>;
  orderNEQ?: InputMaybe<Scalars['u8']['input']>;
  orderNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  orderNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  realm_id?: InputMaybe<Scalars['u16']['input']>;
  realm_idEQ?: InputMaybe<Scalars['u16']['input']>;
  realm_idGT?: InputMaybe<Scalars['u16']['input']>;
  realm_idGTE?: InputMaybe<Scalars['u16']['input']>;
  realm_idIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  realm_idLIKE?: InputMaybe<Scalars['u16']['input']>;
  realm_idLT?: InputMaybe<Scalars['u16']['input']>;
  realm_idLTE?: InputMaybe<Scalars['u16']['input']>;
  realm_idNEQ?: InputMaybe<Scalars['u16']['input']>;
  realm_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  realm_idNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
};

export type S1_Eternum_Structure_Troop_GuardsWhereInput = {
  alpha?: InputMaybe<S1_Eternum_Structure_Troop_Guards_AlphaWhereInput>;
  alpha_destroyed_tick?: InputMaybe<Scalars['u32']['input']>;
  alpha_destroyed_tickEQ?: InputMaybe<Scalars['u32']['input']>;
  alpha_destroyed_tickGT?: InputMaybe<Scalars['u32']['input']>;
  alpha_destroyed_tickGTE?: InputMaybe<Scalars['u32']['input']>;
  alpha_destroyed_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  alpha_destroyed_tickLIKE?: InputMaybe<Scalars['u32']['input']>;
  alpha_destroyed_tickLT?: InputMaybe<Scalars['u32']['input']>;
  alpha_destroyed_tickLTE?: InputMaybe<Scalars['u32']['input']>;
  alpha_destroyed_tickNEQ?: InputMaybe<Scalars['u32']['input']>;
  alpha_destroyed_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  alpha_destroyed_tickNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  bravo?: InputMaybe<S1_Eternum_Structure_Troop_Guards_BravoWhereInput>;
  bravo_destroyed_tick?: InputMaybe<Scalars['u32']['input']>;
  bravo_destroyed_tickEQ?: InputMaybe<Scalars['u32']['input']>;
  bravo_destroyed_tickGT?: InputMaybe<Scalars['u32']['input']>;
  bravo_destroyed_tickGTE?: InputMaybe<Scalars['u32']['input']>;
  bravo_destroyed_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  bravo_destroyed_tickLIKE?: InputMaybe<Scalars['u32']['input']>;
  bravo_destroyed_tickLT?: InputMaybe<Scalars['u32']['input']>;
  bravo_destroyed_tickLTE?: InputMaybe<Scalars['u32']['input']>;
  bravo_destroyed_tickNEQ?: InputMaybe<Scalars['u32']['input']>;
  bravo_destroyed_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  bravo_destroyed_tickNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  charlie?: InputMaybe<S1_Eternum_Structure_Troop_Guards_CharlieWhereInput>;
  charlie_destroyed_tick?: InputMaybe<Scalars['u32']['input']>;
  charlie_destroyed_tickEQ?: InputMaybe<Scalars['u32']['input']>;
  charlie_destroyed_tickGT?: InputMaybe<Scalars['u32']['input']>;
  charlie_destroyed_tickGTE?: InputMaybe<Scalars['u32']['input']>;
  charlie_destroyed_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  charlie_destroyed_tickLIKE?: InputMaybe<Scalars['u32']['input']>;
  charlie_destroyed_tickLT?: InputMaybe<Scalars['u32']['input']>;
  charlie_destroyed_tickLTE?: InputMaybe<Scalars['u32']['input']>;
  charlie_destroyed_tickNEQ?: InputMaybe<Scalars['u32']['input']>;
  charlie_destroyed_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  charlie_destroyed_tickNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  delta?: InputMaybe<S1_Eternum_Structure_Troop_Guards_DeltaWhereInput>;
  delta_destroyed_tick?: InputMaybe<Scalars['u32']['input']>;
  delta_destroyed_tickEQ?: InputMaybe<Scalars['u32']['input']>;
  delta_destroyed_tickGT?: InputMaybe<Scalars['u32']['input']>;
  delta_destroyed_tickGTE?: InputMaybe<Scalars['u32']['input']>;
  delta_destroyed_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  delta_destroyed_tickLIKE?: InputMaybe<Scalars['u32']['input']>;
  delta_destroyed_tickLT?: InputMaybe<Scalars['u32']['input']>;
  delta_destroyed_tickLTE?: InputMaybe<Scalars['u32']['input']>;
  delta_destroyed_tickNEQ?: InputMaybe<Scalars['u32']['input']>;
  delta_destroyed_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  delta_destroyed_tickNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_Structure_Troop_Guards_AlphaWhereInput = {
  category?: InputMaybe<Scalars['Enum']['input']>;
  count?: InputMaybe<Scalars['u128']['input']>;
  countEQ?: InputMaybe<Scalars['u128']['input']>;
  countGT?: InputMaybe<Scalars['u128']['input']>;
  countGTE?: InputMaybe<Scalars['u128']['input']>;
  countIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  countLIKE?: InputMaybe<Scalars['u128']['input']>;
  countLT?: InputMaybe<Scalars['u128']['input']>;
  countLTE?: InputMaybe<Scalars['u128']['input']>;
  countNEQ?: InputMaybe<Scalars['u128']['input']>;
  countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  countNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  stamina?: InputMaybe<S1_Eternum_Structure_Troop_Guards_Alpha_StaminaWhereInput>;
  tier?: InputMaybe<Scalars['Enum']['input']>;
};

export type S1_Eternum_Structure_Troop_Guards_Alpha_StaminaWhereInput = {
  amount?: InputMaybe<Scalars['u64']['input']>;
  amountEQ?: InputMaybe<Scalars['u64']['input']>;
  amountGT?: InputMaybe<Scalars['u64']['input']>;
  amountGTE?: InputMaybe<Scalars['u64']['input']>;
  amountIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  amountLIKE?: InputMaybe<Scalars['u64']['input']>;
  amountLT?: InputMaybe<Scalars['u64']['input']>;
  amountLTE?: InputMaybe<Scalars['u64']['input']>;
  amountNEQ?: InputMaybe<Scalars['u64']['input']>;
  amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  amountNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  updated_tick?: InputMaybe<Scalars['u64']['input']>;
  updated_tickEQ?: InputMaybe<Scalars['u64']['input']>;
  updated_tickGT?: InputMaybe<Scalars['u64']['input']>;
  updated_tickGTE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  updated_tickLIKE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickLT?: InputMaybe<Scalars['u64']['input']>;
  updated_tickLTE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickNEQ?: InputMaybe<Scalars['u64']['input']>;
  updated_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  updated_tickNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Structure_Troop_Guards_BravoWhereInput = {
  category?: InputMaybe<Scalars['Enum']['input']>;
  count?: InputMaybe<Scalars['u128']['input']>;
  countEQ?: InputMaybe<Scalars['u128']['input']>;
  countGT?: InputMaybe<Scalars['u128']['input']>;
  countGTE?: InputMaybe<Scalars['u128']['input']>;
  countIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  countLIKE?: InputMaybe<Scalars['u128']['input']>;
  countLT?: InputMaybe<Scalars['u128']['input']>;
  countLTE?: InputMaybe<Scalars['u128']['input']>;
  countNEQ?: InputMaybe<Scalars['u128']['input']>;
  countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  countNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  stamina?: InputMaybe<S1_Eternum_Structure_Troop_Guards_Bravo_StaminaWhereInput>;
  tier?: InputMaybe<Scalars['Enum']['input']>;
};

export type S1_Eternum_Structure_Troop_Guards_Bravo_StaminaWhereInput = {
  amount?: InputMaybe<Scalars['u64']['input']>;
  amountEQ?: InputMaybe<Scalars['u64']['input']>;
  amountGT?: InputMaybe<Scalars['u64']['input']>;
  amountGTE?: InputMaybe<Scalars['u64']['input']>;
  amountIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  amountLIKE?: InputMaybe<Scalars['u64']['input']>;
  amountLT?: InputMaybe<Scalars['u64']['input']>;
  amountLTE?: InputMaybe<Scalars['u64']['input']>;
  amountNEQ?: InputMaybe<Scalars['u64']['input']>;
  amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  amountNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  updated_tick?: InputMaybe<Scalars['u64']['input']>;
  updated_tickEQ?: InputMaybe<Scalars['u64']['input']>;
  updated_tickGT?: InputMaybe<Scalars['u64']['input']>;
  updated_tickGTE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  updated_tickLIKE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickLT?: InputMaybe<Scalars['u64']['input']>;
  updated_tickLTE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickNEQ?: InputMaybe<Scalars['u64']['input']>;
  updated_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  updated_tickNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Structure_Troop_Guards_CharlieWhereInput = {
  category?: InputMaybe<Scalars['Enum']['input']>;
  count?: InputMaybe<Scalars['u128']['input']>;
  countEQ?: InputMaybe<Scalars['u128']['input']>;
  countGT?: InputMaybe<Scalars['u128']['input']>;
  countGTE?: InputMaybe<Scalars['u128']['input']>;
  countIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  countLIKE?: InputMaybe<Scalars['u128']['input']>;
  countLT?: InputMaybe<Scalars['u128']['input']>;
  countLTE?: InputMaybe<Scalars['u128']['input']>;
  countNEQ?: InputMaybe<Scalars['u128']['input']>;
  countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  countNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  stamina?: InputMaybe<S1_Eternum_Structure_Troop_Guards_Charlie_StaminaWhereInput>;
  tier?: InputMaybe<Scalars['Enum']['input']>;
};

export type S1_Eternum_Structure_Troop_Guards_Charlie_StaminaWhereInput = {
  amount?: InputMaybe<Scalars['u64']['input']>;
  amountEQ?: InputMaybe<Scalars['u64']['input']>;
  amountGT?: InputMaybe<Scalars['u64']['input']>;
  amountGTE?: InputMaybe<Scalars['u64']['input']>;
  amountIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  amountLIKE?: InputMaybe<Scalars['u64']['input']>;
  amountLT?: InputMaybe<Scalars['u64']['input']>;
  amountLTE?: InputMaybe<Scalars['u64']['input']>;
  amountNEQ?: InputMaybe<Scalars['u64']['input']>;
  amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  amountNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  updated_tick?: InputMaybe<Scalars['u64']['input']>;
  updated_tickEQ?: InputMaybe<Scalars['u64']['input']>;
  updated_tickGT?: InputMaybe<Scalars['u64']['input']>;
  updated_tickGTE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  updated_tickLIKE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickLT?: InputMaybe<Scalars['u64']['input']>;
  updated_tickLTE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickNEQ?: InputMaybe<Scalars['u64']['input']>;
  updated_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  updated_tickNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_Structure_Troop_Guards_DeltaWhereInput = {
  category?: InputMaybe<Scalars['Enum']['input']>;
  count?: InputMaybe<Scalars['u128']['input']>;
  countEQ?: InputMaybe<Scalars['u128']['input']>;
  countGT?: InputMaybe<Scalars['u128']['input']>;
  countGTE?: InputMaybe<Scalars['u128']['input']>;
  countIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  countLIKE?: InputMaybe<Scalars['u128']['input']>;
  countLT?: InputMaybe<Scalars['u128']['input']>;
  countLTE?: InputMaybe<Scalars['u128']['input']>;
  countNEQ?: InputMaybe<Scalars['u128']['input']>;
  countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  countNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  stamina?: InputMaybe<S1_Eternum_Structure_Troop_Guards_Delta_StaminaWhereInput>;
  tier?: InputMaybe<Scalars['Enum']['input']>;
};

export type S1_Eternum_Structure_Troop_Guards_Delta_StaminaWhereInput = {
  amount?: InputMaybe<Scalars['u64']['input']>;
  amountEQ?: InputMaybe<Scalars['u64']['input']>;
  amountGT?: InputMaybe<Scalars['u64']['input']>;
  amountGTE?: InputMaybe<Scalars['u64']['input']>;
  amountIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  amountLIKE?: InputMaybe<Scalars['u64']['input']>;
  amountLT?: InputMaybe<Scalars['u64']['input']>;
  amountLTE?: InputMaybe<Scalars['u64']['input']>;
  amountNEQ?: InputMaybe<Scalars['u64']['input']>;
  amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  amountNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  updated_tick?: InputMaybe<Scalars['u64']['input']>;
  updated_tickEQ?: InputMaybe<Scalars['u64']['input']>;
  updated_tickGT?: InputMaybe<Scalars['u64']['input']>;
  updated_tickGTE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  updated_tickLIKE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickLT?: InputMaybe<Scalars['u64']['input']>;
  updated_tickLTE?: InputMaybe<Scalars['u64']['input']>;
  updated_tickNEQ?: InputMaybe<Scalars['u64']['input']>;
  updated_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  updated_tickNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_SwapEventOrder = {
  direction: OrderDirection;
  field: S1_Eternum_SwapEventOrderField;
};

export enum S1_Eternum_SwapEventOrderField {
  BankEntityId = 'BANK_ENTITY_ID',
  BankOwnerFees = 'BANK_OWNER_FEES',
  Buy = 'BUY',
  EntityId = 'ENTITY_ID',
  Id = 'ID',
  LordsAmount = 'LORDS_AMOUNT',
  LpFees = 'LP_FEES',
  ResourceAmount = 'RESOURCE_AMOUNT',
  ResourcePrice = 'RESOURCE_PRICE',
  ResourceType = 'RESOURCE_TYPE',
  Timestamp = 'TIMESTAMP'
}

export type S1_Eternum_SwapEventWhereInput = {
  bank_entity_id?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  bank_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  bank_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  bank_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  bank_owner_fees?: InputMaybe<Scalars['u128']['input']>;
  bank_owner_feesEQ?: InputMaybe<Scalars['u128']['input']>;
  bank_owner_feesGT?: InputMaybe<Scalars['u128']['input']>;
  bank_owner_feesGTE?: InputMaybe<Scalars['u128']['input']>;
  bank_owner_feesIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  bank_owner_feesLIKE?: InputMaybe<Scalars['u128']['input']>;
  bank_owner_feesLT?: InputMaybe<Scalars['u128']['input']>;
  bank_owner_feesLTE?: InputMaybe<Scalars['u128']['input']>;
  bank_owner_feesNEQ?: InputMaybe<Scalars['u128']['input']>;
  bank_owner_feesNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  bank_owner_feesNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  buy?: InputMaybe<Scalars['bool']['input']>;
  entity_id?: InputMaybe<Scalars['u32']['input']>;
  entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  id?: InputMaybe<Scalars['u32']['input']>;
  idEQ?: InputMaybe<Scalars['u32']['input']>;
  idGT?: InputMaybe<Scalars['u32']['input']>;
  idGTE?: InputMaybe<Scalars['u32']['input']>;
  idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  idLIKE?: InputMaybe<Scalars['u32']['input']>;
  idLT?: InputMaybe<Scalars['u32']['input']>;
  idLTE?: InputMaybe<Scalars['u32']['input']>;
  idNEQ?: InputMaybe<Scalars['u32']['input']>;
  idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  lords_amount?: InputMaybe<Scalars['u128']['input']>;
  lords_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  lords_amountGT?: InputMaybe<Scalars['u128']['input']>;
  lords_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  lords_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lords_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  lords_amountLT?: InputMaybe<Scalars['u128']['input']>;
  lords_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  lords_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  lords_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lords_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  lp_fees?: InputMaybe<Scalars['u128']['input']>;
  lp_feesEQ?: InputMaybe<Scalars['u128']['input']>;
  lp_feesGT?: InputMaybe<Scalars['u128']['input']>;
  lp_feesGTE?: InputMaybe<Scalars['u128']['input']>;
  lp_feesIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lp_feesLIKE?: InputMaybe<Scalars['u128']['input']>;
  lp_feesLT?: InputMaybe<Scalars['u128']['input']>;
  lp_feesLTE?: InputMaybe<Scalars['u128']['input']>;
  lp_feesNEQ?: InputMaybe<Scalars['u128']['input']>;
  lp_feesNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lp_feesNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_amount?: InputMaybe<Scalars['u128']['input']>;
  resource_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  resource_amountGT?: InputMaybe<Scalars['u128']['input']>;
  resource_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  resource_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resource_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_amountLT?: InputMaybe<Scalars['u128']['input']>;
  resource_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  resource_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  resource_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resource_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_price?: InputMaybe<Scalars['u128']['input']>;
  resource_priceEQ?: InputMaybe<Scalars['u128']['input']>;
  resource_priceGT?: InputMaybe<Scalars['u128']['input']>;
  resource_priceGTE?: InputMaybe<Scalars['u128']['input']>;
  resource_priceIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resource_priceLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_priceLT?: InputMaybe<Scalars['u128']['input']>;
  resource_priceLTE?: InputMaybe<Scalars['u128']['input']>;
  resource_priceNEQ?: InputMaybe<Scalars['u128']['input']>;
  resource_priceNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  resource_priceNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  resource_type?: InputMaybe<Scalars['u8']['input']>;
  resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_TileOrder = {
  direction: OrderDirection;
  field: S1_Eternum_TileOrderField;
};

export enum S1_Eternum_TileOrderField {
  Biome = 'BIOME',
  Col = 'COL',
  OccupierId = 'OCCUPIER_ID',
  OccupierIsStructure = 'OCCUPIER_IS_STRUCTURE',
  OccupierType = 'OCCUPIER_TYPE',
  Row = 'ROW'
}

export type S1_Eternum_TileWhereInput = {
  biome?: InputMaybe<Scalars['u8']['input']>;
  biomeEQ?: InputMaybe<Scalars['u8']['input']>;
  biomeGT?: InputMaybe<Scalars['u8']['input']>;
  biomeGTE?: InputMaybe<Scalars['u8']['input']>;
  biomeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  biomeLIKE?: InputMaybe<Scalars['u8']['input']>;
  biomeLT?: InputMaybe<Scalars['u8']['input']>;
  biomeLTE?: InputMaybe<Scalars['u8']['input']>;
  biomeNEQ?: InputMaybe<Scalars['u8']['input']>;
  biomeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  biomeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  col?: InputMaybe<Scalars['u32']['input']>;
  colEQ?: InputMaybe<Scalars['u32']['input']>;
  colGT?: InputMaybe<Scalars['u32']['input']>;
  colGTE?: InputMaybe<Scalars['u32']['input']>;
  colIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  colLIKE?: InputMaybe<Scalars['u32']['input']>;
  colLT?: InputMaybe<Scalars['u32']['input']>;
  colLTE?: InputMaybe<Scalars['u32']['input']>;
  colNEQ?: InputMaybe<Scalars['u32']['input']>;
  colNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  colNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  occupier_id?: InputMaybe<Scalars['u32']['input']>;
  occupier_idEQ?: InputMaybe<Scalars['u32']['input']>;
  occupier_idGT?: InputMaybe<Scalars['u32']['input']>;
  occupier_idGTE?: InputMaybe<Scalars['u32']['input']>;
  occupier_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  occupier_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  occupier_idLT?: InputMaybe<Scalars['u32']['input']>;
  occupier_idLTE?: InputMaybe<Scalars['u32']['input']>;
  occupier_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  occupier_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  occupier_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  occupier_is_structure?: InputMaybe<Scalars['bool']['input']>;
  occupier_type?: InputMaybe<Scalars['u8']['input']>;
  occupier_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  occupier_typeGT?: InputMaybe<Scalars['u8']['input']>;
  occupier_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  occupier_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  occupier_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  occupier_typeLT?: InputMaybe<Scalars['u8']['input']>;
  occupier_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  occupier_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  occupier_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  occupier_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  row?: InputMaybe<Scalars['u32']['input']>;
  rowEQ?: InputMaybe<Scalars['u32']['input']>;
  rowGT?: InputMaybe<Scalars['u32']['input']>;
  rowGTE?: InputMaybe<Scalars['u32']['input']>;
  rowIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  rowLIKE?: InputMaybe<Scalars['u32']['input']>;
  rowLT?: InputMaybe<Scalars['u32']['input']>;
  rowLTE?: InputMaybe<Scalars['u32']['input']>;
  rowNEQ?: InputMaybe<Scalars['u32']['input']>;
  rowNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  rowNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_TradeCountOrder = {
  direction: OrderDirection;
  field: S1_Eternum_TradeCountOrderField;
};

export enum S1_Eternum_TradeCountOrderField {
  Count = 'COUNT',
  StructureId = 'STRUCTURE_ID'
}

export type S1_Eternum_TradeCountWhereInput = {
  count?: InputMaybe<Scalars['u8']['input']>;
  countEQ?: InputMaybe<Scalars['u8']['input']>;
  countGT?: InputMaybe<Scalars['u8']['input']>;
  countGTE?: InputMaybe<Scalars['u8']['input']>;
  countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  countLIKE?: InputMaybe<Scalars['u8']['input']>;
  countLT?: InputMaybe<Scalars['u8']['input']>;
  countLTE?: InputMaybe<Scalars['u8']['input']>;
  countNEQ?: InputMaybe<Scalars['u8']['input']>;
  countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  structure_id?: InputMaybe<Scalars['u32']['input']>;
  structure_idEQ?: InputMaybe<Scalars['u32']['input']>;
  structure_idGT?: InputMaybe<Scalars['u32']['input']>;
  structure_idGTE?: InputMaybe<Scalars['u32']['input']>;
  structure_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  structure_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  structure_idLT?: InputMaybe<Scalars['u32']['input']>;
  structure_idLTE?: InputMaybe<Scalars['u32']['input']>;
  structure_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  structure_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  structure_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_TradeOrder = {
  direction: OrderDirection;
  field: S1_Eternum_TradeOrderField;
};

export enum S1_Eternum_TradeOrderField {
  ExpiresAt = 'EXPIRES_AT',
  MakerGivesMaxCount = 'MAKER_GIVES_MAX_COUNT',
  MakerGivesMinResourceAmount = 'MAKER_GIVES_MIN_RESOURCE_AMOUNT',
  MakerGivesResourceType = 'MAKER_GIVES_RESOURCE_TYPE',
  MakerId = 'MAKER_ID',
  TakerId = 'TAKER_ID',
  TakerPaysMinResourceAmount = 'TAKER_PAYS_MIN_RESOURCE_AMOUNT',
  TakerPaysResourceType = 'TAKER_PAYS_RESOURCE_TYPE',
  TradeId = 'TRADE_ID'
}

export type S1_Eternum_TradeWhereInput = {
  expires_at?: InputMaybe<Scalars['u32']['input']>;
  expires_atEQ?: InputMaybe<Scalars['u32']['input']>;
  expires_atGT?: InputMaybe<Scalars['u32']['input']>;
  expires_atGTE?: InputMaybe<Scalars['u32']['input']>;
  expires_atIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  expires_atLIKE?: InputMaybe<Scalars['u32']['input']>;
  expires_atLT?: InputMaybe<Scalars['u32']['input']>;
  expires_atLTE?: InputMaybe<Scalars['u32']['input']>;
  expires_atNEQ?: InputMaybe<Scalars['u32']['input']>;
  expires_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  expires_atNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_max_count?: InputMaybe<Scalars['u64']['input']>;
  maker_gives_max_countEQ?: InputMaybe<Scalars['u64']['input']>;
  maker_gives_max_countGT?: InputMaybe<Scalars['u64']['input']>;
  maker_gives_max_countGTE?: InputMaybe<Scalars['u64']['input']>;
  maker_gives_max_countIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  maker_gives_max_countLIKE?: InputMaybe<Scalars['u64']['input']>;
  maker_gives_max_countLT?: InputMaybe<Scalars['u64']['input']>;
  maker_gives_max_countLTE?: InputMaybe<Scalars['u64']['input']>;
  maker_gives_max_countNEQ?: InputMaybe<Scalars['u64']['input']>;
  maker_gives_max_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  maker_gives_max_countNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  maker_gives_min_resource_amount?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_min_resource_amountEQ?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_min_resource_amountGT?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_min_resource_amountGTE?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_min_resource_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maker_gives_min_resource_amountLIKE?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_min_resource_amountLT?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_min_resource_amountLTE?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_min_resource_amountNEQ?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_min_resource_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maker_gives_min_resource_amountNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resource_type?: InputMaybe<Scalars['u8']['input']>;
  maker_gives_resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  maker_gives_resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  maker_gives_resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  maker_gives_resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  maker_gives_resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  maker_gives_resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  maker_gives_resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  maker_gives_resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  maker_gives_resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  maker_gives_resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  maker_id?: InputMaybe<Scalars['u32']['input']>;
  maker_idEQ?: InputMaybe<Scalars['u32']['input']>;
  maker_idGT?: InputMaybe<Scalars['u32']['input']>;
  maker_idGTE?: InputMaybe<Scalars['u32']['input']>;
  maker_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maker_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  maker_idLT?: InputMaybe<Scalars['u32']['input']>;
  maker_idLTE?: InputMaybe<Scalars['u32']['input']>;
  maker_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  maker_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maker_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_id?: InputMaybe<Scalars['u32']['input']>;
  taker_idEQ?: InputMaybe<Scalars['u32']['input']>;
  taker_idGT?: InputMaybe<Scalars['u32']['input']>;
  taker_idGTE?: InputMaybe<Scalars['u32']['input']>;
  taker_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  taker_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_idLT?: InputMaybe<Scalars['u32']['input']>;
  taker_idLTE?: InputMaybe<Scalars['u32']['input']>;
  taker_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  taker_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  taker_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_pays_min_resource_amount?: InputMaybe<Scalars['u32']['input']>;
  taker_pays_min_resource_amountEQ?: InputMaybe<Scalars['u32']['input']>;
  taker_pays_min_resource_amountGT?: InputMaybe<Scalars['u32']['input']>;
  taker_pays_min_resource_amountGTE?: InputMaybe<Scalars['u32']['input']>;
  taker_pays_min_resource_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  taker_pays_min_resource_amountLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_pays_min_resource_amountLT?: InputMaybe<Scalars['u32']['input']>;
  taker_pays_min_resource_amountLTE?: InputMaybe<Scalars['u32']['input']>;
  taker_pays_min_resource_amountNEQ?: InputMaybe<Scalars['u32']['input']>;
  taker_pays_min_resource_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  taker_pays_min_resource_amountNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_pays_resource_type?: InputMaybe<Scalars['u8']['input']>;
  taker_pays_resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  taker_pays_resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  taker_pays_resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  taker_pays_resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  taker_pays_resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  taker_pays_resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  taker_pays_resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  taker_pays_resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  taker_pays_resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  taker_pays_resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  trade_id?: InputMaybe<Scalars['u32']['input']>;
  trade_idEQ?: InputMaybe<Scalars['u32']['input']>;
  trade_idGT?: InputMaybe<Scalars['u32']['input']>;
  trade_idGTE?: InputMaybe<Scalars['u32']['input']>;
  trade_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  trade_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  trade_idLT?: InputMaybe<Scalars['u32']['input']>;
  trade_idLTE?: InputMaybe<Scalars['u32']['input']>;
  trade_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  trade_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  trade_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_TransferOrder = {
  direction: OrderDirection;
  field: S1_Eternum_TransferOrderField;
};

export enum S1_Eternum_TransferOrderField {
  RecipientStructureId = 'RECIPIENT_STRUCTURE_ID',
  Resources = 'RESOURCES',
  SenderStructureId = 'SENDER_STRUCTURE_ID',
  SendingRealmId = 'SENDING_REALM_ID',
  Timestamp = 'TIMESTAMP'
}

export type S1_Eternum_TransferWhereInput = {
  recipient_structure_id?: InputMaybe<Scalars['u32']['input']>;
  recipient_structure_idEQ?: InputMaybe<Scalars['u32']['input']>;
  recipient_structure_idGT?: InputMaybe<Scalars['u32']['input']>;
  recipient_structure_idGTE?: InputMaybe<Scalars['u32']['input']>;
  recipient_structure_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  recipient_structure_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  recipient_structure_idLT?: InputMaybe<Scalars['u32']['input']>;
  recipient_structure_idLTE?: InputMaybe<Scalars['u32']['input']>;
  recipient_structure_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  recipient_structure_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  recipient_structure_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  sender_structure_id?: InputMaybe<Scalars['u32']['input']>;
  sender_structure_idEQ?: InputMaybe<Scalars['u32']['input']>;
  sender_structure_idGT?: InputMaybe<Scalars['u32']['input']>;
  sender_structure_idGTE?: InputMaybe<Scalars['u32']['input']>;
  sender_structure_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  sender_structure_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  sender_structure_idLT?: InputMaybe<Scalars['u32']['input']>;
  sender_structure_idLTE?: InputMaybe<Scalars['u32']['input']>;
  sender_structure_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  sender_structure_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  sender_structure_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  sending_realm_id?: InputMaybe<Scalars['u32']['input']>;
  sending_realm_idEQ?: InputMaybe<Scalars['u32']['input']>;
  sending_realm_idGT?: InputMaybe<Scalars['u32']['input']>;
  sending_realm_idGTE?: InputMaybe<Scalars['u32']['input']>;
  sending_realm_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  sending_realm_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  sending_realm_idLT?: InputMaybe<Scalars['u32']['input']>;
  sending_realm_idLTE?: InputMaybe<Scalars['u32']['input']>;
  sending_realm_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  sending_realm_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  sending_realm_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  timestamp?: InputMaybe<Scalars['u64']['input']>;
  timestampEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampGT?: InputMaybe<Scalars['u64']['input']>;
  timestampGTE?: InputMaybe<Scalars['u64']['input']>;
  timestampIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampLIKE?: InputMaybe<Scalars['u64']['input']>;
  timestampLT?: InputMaybe<Scalars['u64']['input']>;
  timestampLTE?: InputMaybe<Scalars['u64']['input']>;
  timestampNEQ?: InputMaybe<Scalars['u64']['input']>;
  timestampNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timestampNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_TrophyCreationOrder = {
  direction: OrderDirection;
  field: S1_Eternum_TrophyCreationOrderField;
};

export enum S1_Eternum_TrophyCreationOrderField {
  Data = 'DATA',
  Description = 'DESCRIPTION',
  End = 'END',
  Group = 'GROUP',
  Hidden = 'HIDDEN',
  Icon = 'ICON',
  Id = 'ID',
  Index = 'INDEX',
  Points = 'POINTS',
  Start = 'START',
  Tasks = 'TASKS',
  Title = 'TITLE'
}

export type S1_Eternum_TrophyCreationWhereInput = {
  data?: InputMaybe<Scalars['ByteArray']['input']>;
  dataEQ?: InputMaybe<Scalars['ByteArray']['input']>;
  dataGT?: InputMaybe<Scalars['ByteArray']['input']>;
  dataGTE?: InputMaybe<Scalars['ByteArray']['input']>;
  dataIN?: InputMaybe<Array<InputMaybe<Scalars['ByteArray']['input']>>>;
  dataLIKE?: InputMaybe<Scalars['ByteArray']['input']>;
  dataLT?: InputMaybe<Scalars['ByteArray']['input']>;
  dataLTE?: InputMaybe<Scalars['ByteArray']['input']>;
  dataNEQ?: InputMaybe<Scalars['ByteArray']['input']>;
  dataNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ByteArray']['input']>>>;
  dataNOTLIKE?: InputMaybe<Scalars['ByteArray']['input']>;
  description?: InputMaybe<Scalars['ByteArray']['input']>;
  descriptionEQ?: InputMaybe<Scalars['ByteArray']['input']>;
  descriptionGT?: InputMaybe<Scalars['ByteArray']['input']>;
  descriptionGTE?: InputMaybe<Scalars['ByteArray']['input']>;
  descriptionIN?: InputMaybe<Array<InputMaybe<Scalars['ByteArray']['input']>>>;
  descriptionLIKE?: InputMaybe<Scalars['ByteArray']['input']>;
  descriptionLT?: InputMaybe<Scalars['ByteArray']['input']>;
  descriptionLTE?: InputMaybe<Scalars['ByteArray']['input']>;
  descriptionNEQ?: InputMaybe<Scalars['ByteArray']['input']>;
  descriptionNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ByteArray']['input']>>>;
  descriptionNOTLIKE?: InputMaybe<Scalars['ByteArray']['input']>;
  end?: InputMaybe<Scalars['u64']['input']>;
  endEQ?: InputMaybe<Scalars['u64']['input']>;
  endGT?: InputMaybe<Scalars['u64']['input']>;
  endGTE?: InputMaybe<Scalars['u64']['input']>;
  endIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  endLIKE?: InputMaybe<Scalars['u64']['input']>;
  endLT?: InputMaybe<Scalars['u64']['input']>;
  endLTE?: InputMaybe<Scalars['u64']['input']>;
  endNEQ?: InputMaybe<Scalars['u64']['input']>;
  endNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  endNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  group?: InputMaybe<Scalars['felt252']['input']>;
  groupEQ?: InputMaybe<Scalars['felt252']['input']>;
  groupGT?: InputMaybe<Scalars['felt252']['input']>;
  groupGTE?: InputMaybe<Scalars['felt252']['input']>;
  groupIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  groupLIKE?: InputMaybe<Scalars['felt252']['input']>;
  groupLT?: InputMaybe<Scalars['felt252']['input']>;
  groupLTE?: InputMaybe<Scalars['felt252']['input']>;
  groupNEQ?: InputMaybe<Scalars['felt252']['input']>;
  groupNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  groupNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  hidden?: InputMaybe<Scalars['bool']['input']>;
  icon?: InputMaybe<Scalars['felt252']['input']>;
  iconEQ?: InputMaybe<Scalars['felt252']['input']>;
  iconGT?: InputMaybe<Scalars['felt252']['input']>;
  iconGTE?: InputMaybe<Scalars['felt252']['input']>;
  iconIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  iconLIKE?: InputMaybe<Scalars['felt252']['input']>;
  iconLT?: InputMaybe<Scalars['felt252']['input']>;
  iconLTE?: InputMaybe<Scalars['felt252']['input']>;
  iconNEQ?: InputMaybe<Scalars['felt252']['input']>;
  iconNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  iconNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  id?: InputMaybe<Scalars['felt252']['input']>;
  idEQ?: InputMaybe<Scalars['felt252']['input']>;
  idGT?: InputMaybe<Scalars['felt252']['input']>;
  idGTE?: InputMaybe<Scalars['felt252']['input']>;
  idIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  idLIKE?: InputMaybe<Scalars['felt252']['input']>;
  idLT?: InputMaybe<Scalars['felt252']['input']>;
  idLTE?: InputMaybe<Scalars['felt252']['input']>;
  idNEQ?: InputMaybe<Scalars['felt252']['input']>;
  idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  idNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  index?: InputMaybe<Scalars['u8']['input']>;
  indexEQ?: InputMaybe<Scalars['u8']['input']>;
  indexGT?: InputMaybe<Scalars['u8']['input']>;
  indexGTE?: InputMaybe<Scalars['u8']['input']>;
  indexIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  indexLIKE?: InputMaybe<Scalars['u8']['input']>;
  indexLT?: InputMaybe<Scalars['u8']['input']>;
  indexLTE?: InputMaybe<Scalars['u8']['input']>;
  indexNEQ?: InputMaybe<Scalars['u8']['input']>;
  indexNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  indexNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  points?: InputMaybe<Scalars['u16']['input']>;
  pointsEQ?: InputMaybe<Scalars['u16']['input']>;
  pointsGT?: InputMaybe<Scalars['u16']['input']>;
  pointsGTE?: InputMaybe<Scalars['u16']['input']>;
  pointsIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  pointsLIKE?: InputMaybe<Scalars['u16']['input']>;
  pointsLT?: InputMaybe<Scalars['u16']['input']>;
  pointsLTE?: InputMaybe<Scalars['u16']['input']>;
  pointsNEQ?: InputMaybe<Scalars['u16']['input']>;
  pointsNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  pointsNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  start?: InputMaybe<Scalars['u64']['input']>;
  startEQ?: InputMaybe<Scalars['u64']['input']>;
  startGT?: InputMaybe<Scalars['u64']['input']>;
  startGTE?: InputMaybe<Scalars['u64']['input']>;
  startIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  startLIKE?: InputMaybe<Scalars['u64']['input']>;
  startLT?: InputMaybe<Scalars['u64']['input']>;
  startLTE?: InputMaybe<Scalars['u64']['input']>;
  startNEQ?: InputMaybe<Scalars['u64']['input']>;
  startNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  startNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  title?: InputMaybe<Scalars['felt252']['input']>;
  titleEQ?: InputMaybe<Scalars['felt252']['input']>;
  titleGT?: InputMaybe<Scalars['felt252']['input']>;
  titleGTE?: InputMaybe<Scalars['felt252']['input']>;
  titleIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  titleLIKE?: InputMaybe<Scalars['felt252']['input']>;
  titleLT?: InputMaybe<Scalars['felt252']['input']>;
  titleLTE?: InputMaybe<Scalars['felt252']['input']>;
  titleNEQ?: InputMaybe<Scalars['felt252']['input']>;
  titleNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  titleNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
};

export type S1_Eternum_TrophyProgressionOrder = {
  direction: OrderDirection;
  field: S1_Eternum_TrophyProgressionOrderField;
};

export enum S1_Eternum_TrophyProgressionOrderField {
  Count = 'COUNT',
  PlayerId = 'PLAYER_ID',
  TaskId = 'TASK_ID',
  Time = 'TIME'
}

export type S1_Eternum_TrophyProgressionWhereInput = {
  count?: InputMaybe<Scalars['u32']['input']>;
  countEQ?: InputMaybe<Scalars['u32']['input']>;
  countGT?: InputMaybe<Scalars['u32']['input']>;
  countGTE?: InputMaybe<Scalars['u32']['input']>;
  countIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  countLIKE?: InputMaybe<Scalars['u32']['input']>;
  countLT?: InputMaybe<Scalars['u32']['input']>;
  countLTE?: InputMaybe<Scalars['u32']['input']>;
  countNEQ?: InputMaybe<Scalars['u32']['input']>;
  countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  countNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  player_id?: InputMaybe<Scalars['felt252']['input']>;
  player_idEQ?: InputMaybe<Scalars['felt252']['input']>;
  player_idGT?: InputMaybe<Scalars['felt252']['input']>;
  player_idGTE?: InputMaybe<Scalars['felt252']['input']>;
  player_idIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  player_idLIKE?: InputMaybe<Scalars['felt252']['input']>;
  player_idLT?: InputMaybe<Scalars['felt252']['input']>;
  player_idLTE?: InputMaybe<Scalars['felt252']['input']>;
  player_idNEQ?: InputMaybe<Scalars['felt252']['input']>;
  player_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  player_idNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  task_id?: InputMaybe<Scalars['felt252']['input']>;
  task_idEQ?: InputMaybe<Scalars['felt252']['input']>;
  task_idGT?: InputMaybe<Scalars['felt252']['input']>;
  task_idGTE?: InputMaybe<Scalars['felt252']['input']>;
  task_idIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  task_idLIKE?: InputMaybe<Scalars['felt252']['input']>;
  task_idLT?: InputMaybe<Scalars['felt252']['input']>;
  task_idLTE?: InputMaybe<Scalars['felt252']['input']>;
  task_idNEQ?: InputMaybe<Scalars['felt252']['input']>;
  task_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  task_idNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  time?: InputMaybe<Scalars['u64']['input']>;
  timeEQ?: InputMaybe<Scalars['u64']['input']>;
  timeGT?: InputMaybe<Scalars['u64']['input']>;
  timeGTE?: InputMaybe<Scalars['u64']['input']>;
  timeIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timeLIKE?: InputMaybe<Scalars['u64']['input']>;
  timeLT?: InputMaybe<Scalars['u64']['input']>;
  timeLTE?: InputMaybe<Scalars['u64']['input']>;
  timeNEQ?: InputMaybe<Scalars['u64']['input']>;
  timeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  timeNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_WeightConfigOrder = {
  direction: OrderDirection;
  field: S1_Eternum_WeightConfigOrderField;
};

export enum S1_Eternum_WeightConfigOrderField {
  ResourceType = 'RESOURCE_TYPE',
  WeightGram = 'WEIGHT_GRAM'
}

export type S1_Eternum_WeightConfigWhereInput = {
  resource_type?: InputMaybe<Scalars['u8']['input']>;
  resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  weight_gram?: InputMaybe<Scalars['u128']['input']>;
  weight_gramEQ?: InputMaybe<Scalars['u128']['input']>;
  weight_gramGT?: InputMaybe<Scalars['u128']['input']>;
  weight_gramGTE?: InputMaybe<Scalars['u128']['input']>;
  weight_gramIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  weight_gramLIKE?: InputMaybe<Scalars['u128']['input']>;
  weight_gramLT?: InputMaybe<Scalars['u128']['input']>;
  weight_gramLTE?: InputMaybe<Scalars['u128']['input']>;
  weight_gramNEQ?: InputMaybe<Scalars['u128']['input']>;
  weight_gramNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  weight_gramNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type S1_Eternum_WorldConfigOrder = {
  direction: OrderDirection;
  field: S1_Eternum_WorldConfigOrderField;
};

export enum S1_Eternum_WorldConfigOrderField {
  AdminAddress = 'ADMIN_ADDRESS',
  BankConfig = 'BANK_CONFIG',
  BattleConfig = 'BATTLE_CONFIG',
  BuildingGeneralConfig = 'BUILDING_GENERAL_CONFIG',
  CapacityConfig = 'CAPACITY_CONFIG',
  ConfigId = 'CONFIG_ID',
  HyperstructureConfig = 'HYPERSTRUCTURE_CONFIG',
  MapConfig = 'MAP_CONFIG',
  PopulationConfig = 'POPULATION_CONFIG',
  ResourceBridgeConfig = 'RESOURCE_BRIDGE_CONFIG',
  ResBridgeFeeSplitConfig = 'RES_BRIDGE_FEE_SPLIT_CONFIG',
  SeasonAddressesConfig = 'SEASON_ADDRESSES_CONFIG',
  SeasonBridgeConfig = 'SEASON_BRIDGE_CONFIG',
  SettlementConfig = 'SETTLEMENT_CONFIG',
  SpeedConfig = 'SPEED_CONFIG',
  StructureMaxLevelConfig = 'STRUCTURE_MAX_LEVEL_CONFIG',
  TickConfig = 'TICK_CONFIG',
  TradeConfig = 'TRADE_CONFIG',
  TroopDamageConfig = 'TROOP_DAMAGE_CONFIG',
  TroopLimitConfig = 'TROOP_LIMIT_CONFIG',
  TroopStaminaConfig = 'TROOP_STAMINA_CONFIG',
  VrfProviderAddress = 'VRF_PROVIDER_ADDRESS'
}

export type S1_Eternum_WorldConfigWhereInput = {
  admin_address?: InputMaybe<Scalars['ContractAddress']['input']>;
  admin_addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  admin_addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  admin_addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  admin_addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  admin_addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  admin_addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  admin_addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  admin_addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  admin_addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  admin_addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  bank_config?: InputMaybe<S1_Eternum_WorldConfig_Bank_ConfigWhereInput>;
  battle_config?: InputMaybe<S1_Eternum_WorldConfig_Battle_ConfigWhereInput>;
  building_general_config?: InputMaybe<S1_Eternum_WorldConfig_Building_General_ConfigWhereInput>;
  capacity_config?: InputMaybe<S1_Eternum_WorldConfig_Capacity_ConfigWhereInput>;
  config_id?: InputMaybe<Scalars['u32']['input']>;
  config_idEQ?: InputMaybe<Scalars['u32']['input']>;
  config_idGT?: InputMaybe<Scalars['u32']['input']>;
  config_idGTE?: InputMaybe<Scalars['u32']['input']>;
  config_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  config_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  config_idLT?: InputMaybe<Scalars['u32']['input']>;
  config_idLTE?: InputMaybe<Scalars['u32']['input']>;
  config_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  config_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  config_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_config?: InputMaybe<S1_Eternum_WorldConfig_Hyperstructure_ConfigWhereInput>;
  map_config?: InputMaybe<S1_Eternum_WorldConfig_Map_ConfigWhereInput>;
  population_config?: InputMaybe<S1_Eternum_WorldConfig_Population_ConfigWhereInput>;
  res_bridge_fee_split_config?: InputMaybe<S1_Eternum_WorldConfig_Res_Bridge_Fee_Split_ConfigWhereInput>;
  resource_bridge_config?: InputMaybe<S1_Eternum_WorldConfig_Resource_Bridge_ConfigWhereInput>;
  season_addresses_config?: InputMaybe<S1_Eternum_WorldConfig_Season_Addresses_ConfigWhereInput>;
  season_bridge_config?: InputMaybe<S1_Eternum_WorldConfig_Season_Bridge_ConfigWhereInput>;
  settlement_config?: InputMaybe<S1_Eternum_WorldConfig_Settlement_ConfigWhereInput>;
  speed_config?: InputMaybe<S1_Eternum_WorldConfig_Speed_ConfigWhereInput>;
  structure_max_level_config?: InputMaybe<S1_Eternum_WorldConfig_Structure_Max_Level_ConfigWhereInput>;
  tick_config?: InputMaybe<S1_Eternum_WorldConfig_Tick_ConfigWhereInput>;
  trade_config?: InputMaybe<S1_Eternum_WorldConfig_Trade_ConfigWhereInput>;
  troop_damage_config?: InputMaybe<S1_Eternum_WorldConfig_Troop_Damage_ConfigWhereInput>;
  troop_limit_config?: InputMaybe<S1_Eternum_WorldConfig_Troop_Limit_ConfigWhereInput>;
  troop_stamina_config?: InputMaybe<S1_Eternum_WorldConfig_Troop_Stamina_ConfigWhereInput>;
  vrf_provider_address?: InputMaybe<Scalars['ContractAddress']['input']>;
  vrf_provider_addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  vrf_provider_addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  vrf_provider_addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  vrf_provider_addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  vrf_provider_addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  vrf_provider_addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  vrf_provider_addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  vrf_provider_addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  vrf_provider_addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  vrf_provider_addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
};

export type S1_Eternum_WorldConfig_Bank_ConfigWhereInput = {
  lp_fee_denom?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_denomEQ?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_denomGT?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_denomGTE?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_denomIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  lp_fee_denomLIKE?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_denomLT?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_denomLTE?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_denomNEQ?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_denomNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  lp_fee_denomNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_num?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_numEQ?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_numGT?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_numGTE?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_numIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  lp_fee_numLIKE?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_numLT?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_numLTE?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_numNEQ?: InputMaybe<Scalars['u32']['input']>;
  lp_fee_numNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  lp_fee_numNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_denom?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_denomEQ?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_denomGT?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_denomGTE?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_denomIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  owner_fee_denomLIKE?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_denomLT?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_denomLTE?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_denomNEQ?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_denomNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  owner_fee_denomNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_num?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_numEQ?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_numGT?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_numGTE?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_numIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  owner_fee_numLIKE?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_numLT?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_numLTE?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_numNEQ?: InputMaybe<Scalars['u32']['input']>;
  owner_fee_numNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  owner_fee_numNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_WorldConfig_Battle_ConfigWhereInput = {
  hyperstructure_immunity_ticks?: InputMaybe<Scalars['u8']['input']>;
  hyperstructure_immunity_ticksEQ?: InputMaybe<Scalars['u8']['input']>;
  hyperstructure_immunity_ticksGT?: InputMaybe<Scalars['u8']['input']>;
  hyperstructure_immunity_ticksGTE?: InputMaybe<Scalars['u8']['input']>;
  hyperstructure_immunity_ticksIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hyperstructure_immunity_ticksLIKE?: InputMaybe<Scalars['u8']['input']>;
  hyperstructure_immunity_ticksLT?: InputMaybe<Scalars['u8']['input']>;
  hyperstructure_immunity_ticksLTE?: InputMaybe<Scalars['u8']['input']>;
  hyperstructure_immunity_ticksNEQ?: InputMaybe<Scalars['u8']['input']>;
  hyperstructure_immunity_ticksNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  hyperstructure_immunity_ticksNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  regular_immunity_ticks?: InputMaybe<Scalars['u8']['input']>;
  regular_immunity_ticksEQ?: InputMaybe<Scalars['u8']['input']>;
  regular_immunity_ticksGT?: InputMaybe<Scalars['u8']['input']>;
  regular_immunity_ticksGTE?: InputMaybe<Scalars['u8']['input']>;
  regular_immunity_ticksIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  regular_immunity_ticksLIKE?: InputMaybe<Scalars['u8']['input']>;
  regular_immunity_ticksLT?: InputMaybe<Scalars['u8']['input']>;
  regular_immunity_ticksLTE?: InputMaybe<Scalars['u8']['input']>;
  regular_immunity_ticksNEQ?: InputMaybe<Scalars['u8']['input']>;
  regular_immunity_ticksNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  regular_immunity_ticksNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S1_Eternum_WorldConfig_Building_General_ConfigWhereInput = {
  base_cost_percent_increase?: InputMaybe<Scalars['u16']['input']>;
  base_cost_percent_increaseEQ?: InputMaybe<Scalars['u16']['input']>;
  base_cost_percent_increaseGT?: InputMaybe<Scalars['u16']['input']>;
  base_cost_percent_increaseGTE?: InputMaybe<Scalars['u16']['input']>;
  base_cost_percent_increaseIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  base_cost_percent_increaseLIKE?: InputMaybe<Scalars['u16']['input']>;
  base_cost_percent_increaseLT?: InputMaybe<Scalars['u16']['input']>;
  base_cost_percent_increaseLTE?: InputMaybe<Scalars['u16']['input']>;
  base_cost_percent_increaseNEQ?: InputMaybe<Scalars['u16']['input']>;
  base_cost_percent_increaseNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  base_cost_percent_increaseNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
};

export type S1_Eternum_WorldConfig_Capacity_ConfigWhereInput = {
  donkey_capacity?: InputMaybe<Scalars['u32']['input']>;
  donkey_capacityEQ?: InputMaybe<Scalars['u32']['input']>;
  donkey_capacityGT?: InputMaybe<Scalars['u32']['input']>;
  donkey_capacityGTE?: InputMaybe<Scalars['u32']['input']>;
  donkey_capacityIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  donkey_capacityLIKE?: InputMaybe<Scalars['u32']['input']>;
  donkey_capacityLT?: InputMaybe<Scalars['u32']['input']>;
  donkey_capacityLTE?: InputMaybe<Scalars['u32']['input']>;
  donkey_capacityNEQ?: InputMaybe<Scalars['u32']['input']>;
  donkey_capacityNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  donkey_capacityNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  storehouse_boost_capacity?: InputMaybe<Scalars['u32']['input']>;
  storehouse_boost_capacityEQ?: InputMaybe<Scalars['u32']['input']>;
  storehouse_boost_capacityGT?: InputMaybe<Scalars['u32']['input']>;
  storehouse_boost_capacityGTE?: InputMaybe<Scalars['u32']['input']>;
  storehouse_boost_capacityIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  storehouse_boost_capacityLIKE?: InputMaybe<Scalars['u32']['input']>;
  storehouse_boost_capacityLT?: InputMaybe<Scalars['u32']['input']>;
  storehouse_boost_capacityLTE?: InputMaybe<Scalars['u32']['input']>;
  storehouse_boost_capacityNEQ?: InputMaybe<Scalars['u32']['input']>;
  storehouse_boost_capacityNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  storehouse_boost_capacityNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  structure_capacity?: InputMaybe<Scalars['u128']['input']>;
  structure_capacityEQ?: InputMaybe<Scalars['u128']['input']>;
  structure_capacityGT?: InputMaybe<Scalars['u128']['input']>;
  structure_capacityGTE?: InputMaybe<Scalars['u128']['input']>;
  structure_capacityIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  structure_capacityLIKE?: InputMaybe<Scalars['u128']['input']>;
  structure_capacityLT?: InputMaybe<Scalars['u128']['input']>;
  structure_capacityLTE?: InputMaybe<Scalars['u128']['input']>;
  structure_capacityNEQ?: InputMaybe<Scalars['u128']['input']>;
  structure_capacityNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  structure_capacityNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  troop_capacity?: InputMaybe<Scalars['u32']['input']>;
  troop_capacityEQ?: InputMaybe<Scalars['u32']['input']>;
  troop_capacityGT?: InputMaybe<Scalars['u32']['input']>;
  troop_capacityGTE?: InputMaybe<Scalars['u32']['input']>;
  troop_capacityIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  troop_capacityLIKE?: InputMaybe<Scalars['u32']['input']>;
  troop_capacityLT?: InputMaybe<Scalars['u32']['input']>;
  troop_capacityLTE?: InputMaybe<Scalars['u32']['input']>;
  troop_capacityNEQ?: InputMaybe<Scalars['u32']['input']>;
  troop_capacityNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  troop_capacityNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_WorldConfig_Hyperstructure_ConfigWhereInput = {
  points_for_win?: InputMaybe<Scalars['u128']['input']>;
  points_for_winEQ?: InputMaybe<Scalars['u128']['input']>;
  points_for_winGT?: InputMaybe<Scalars['u128']['input']>;
  points_for_winGTE?: InputMaybe<Scalars['u128']['input']>;
  points_for_winIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  points_for_winLIKE?: InputMaybe<Scalars['u128']['input']>;
  points_for_winLT?: InputMaybe<Scalars['u128']['input']>;
  points_for_winLTE?: InputMaybe<Scalars['u128']['input']>;
  points_for_winNEQ?: InputMaybe<Scalars['u128']['input']>;
  points_for_winNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  points_for_winNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  points_on_completion?: InputMaybe<Scalars['u128']['input']>;
  points_on_completionEQ?: InputMaybe<Scalars['u128']['input']>;
  points_on_completionGT?: InputMaybe<Scalars['u128']['input']>;
  points_on_completionGTE?: InputMaybe<Scalars['u128']['input']>;
  points_on_completionIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  points_on_completionLIKE?: InputMaybe<Scalars['u128']['input']>;
  points_on_completionLT?: InputMaybe<Scalars['u128']['input']>;
  points_on_completionLTE?: InputMaybe<Scalars['u128']['input']>;
  points_on_completionNEQ?: InputMaybe<Scalars['u128']['input']>;
  points_on_completionNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  points_on_completionNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  points_per_cycle?: InputMaybe<Scalars['u128']['input']>;
  points_per_cycleEQ?: InputMaybe<Scalars['u128']['input']>;
  points_per_cycleGT?: InputMaybe<Scalars['u128']['input']>;
  points_per_cycleGTE?: InputMaybe<Scalars['u128']['input']>;
  points_per_cycleIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  points_per_cycleLIKE?: InputMaybe<Scalars['u128']['input']>;
  points_per_cycleLT?: InputMaybe<Scalars['u128']['input']>;
  points_per_cycleLTE?: InputMaybe<Scalars['u128']['input']>;
  points_per_cycleNEQ?: InputMaybe<Scalars['u128']['input']>;
  points_per_cycleNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  points_per_cycleNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  time_between_shares_change?: InputMaybe<Scalars['u64']['input']>;
  time_between_shares_changeEQ?: InputMaybe<Scalars['u64']['input']>;
  time_between_shares_changeGT?: InputMaybe<Scalars['u64']['input']>;
  time_between_shares_changeGTE?: InputMaybe<Scalars['u64']['input']>;
  time_between_shares_changeIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  time_between_shares_changeLIKE?: InputMaybe<Scalars['u64']['input']>;
  time_between_shares_changeLT?: InputMaybe<Scalars['u64']['input']>;
  time_between_shares_changeLTE?: InputMaybe<Scalars['u64']['input']>;
  time_between_shares_changeNEQ?: InputMaybe<Scalars['u64']['input']>;
  time_between_shares_changeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  time_between_shares_changeNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_WorldConfig_Map_ConfigWhereInput = {
  hyps_fail_prob?: InputMaybe<Scalars['u32']['input']>;
  hyps_fail_probEQ?: InputMaybe<Scalars['u32']['input']>;
  hyps_fail_probGT?: InputMaybe<Scalars['u32']['input']>;
  hyps_fail_probGTE?: InputMaybe<Scalars['u32']['input']>;
  hyps_fail_probIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyps_fail_probLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyps_fail_probLT?: InputMaybe<Scalars['u32']['input']>;
  hyps_fail_probLTE?: InputMaybe<Scalars['u32']['input']>;
  hyps_fail_probNEQ?: InputMaybe<Scalars['u32']['input']>;
  hyps_fail_probNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyps_fail_probNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyps_fail_prob_increase_p_fnd?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_fndEQ?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_fndGT?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_fndGTE?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_fndIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  hyps_fail_prob_increase_p_fndLIKE?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_fndLT?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_fndLTE?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_fndNEQ?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_fndNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  hyps_fail_prob_increase_p_fndNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_hex?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_hexEQ?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_hexGT?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_hexGTE?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_hexIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  hyps_fail_prob_increase_p_hexLIKE?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_hexLT?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_hexLTE?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_hexNEQ?: InputMaybe<Scalars['u16']['input']>;
  hyps_fail_prob_increase_p_hexNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  hyps_fail_prob_increase_p_hexNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  hyps_win_prob?: InputMaybe<Scalars['u32']['input']>;
  hyps_win_probEQ?: InputMaybe<Scalars['u32']['input']>;
  hyps_win_probGT?: InputMaybe<Scalars['u32']['input']>;
  hyps_win_probGTE?: InputMaybe<Scalars['u32']['input']>;
  hyps_win_probIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyps_win_probLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyps_win_probLT?: InputMaybe<Scalars['u32']['input']>;
  hyps_win_probLTE?: InputMaybe<Scalars['u32']['input']>;
  hyps_win_probNEQ?: InputMaybe<Scalars['u32']['input']>;
  hyps_win_probNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyps_win_probNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  mine_fish_grant_amount?: InputMaybe<Scalars['u32']['input']>;
  mine_fish_grant_amountEQ?: InputMaybe<Scalars['u32']['input']>;
  mine_fish_grant_amountGT?: InputMaybe<Scalars['u32']['input']>;
  mine_fish_grant_amountGTE?: InputMaybe<Scalars['u32']['input']>;
  mine_fish_grant_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  mine_fish_grant_amountLIKE?: InputMaybe<Scalars['u32']['input']>;
  mine_fish_grant_amountLT?: InputMaybe<Scalars['u32']['input']>;
  mine_fish_grant_amountLTE?: InputMaybe<Scalars['u32']['input']>;
  mine_fish_grant_amountNEQ?: InputMaybe<Scalars['u32']['input']>;
  mine_fish_grant_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  mine_fish_grant_amountNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  mine_wheat_grant_amount?: InputMaybe<Scalars['u32']['input']>;
  mine_wheat_grant_amountEQ?: InputMaybe<Scalars['u32']['input']>;
  mine_wheat_grant_amountGT?: InputMaybe<Scalars['u32']['input']>;
  mine_wheat_grant_amountGTE?: InputMaybe<Scalars['u32']['input']>;
  mine_wheat_grant_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  mine_wheat_grant_amountLIKE?: InputMaybe<Scalars['u32']['input']>;
  mine_wheat_grant_amountLT?: InputMaybe<Scalars['u32']['input']>;
  mine_wheat_grant_amountLTE?: InputMaybe<Scalars['u32']['input']>;
  mine_wheat_grant_amountNEQ?: InputMaybe<Scalars['u32']['input']>;
  mine_wheat_grant_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  mine_wheat_grant_amountNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  reward_resource_amount?: InputMaybe<Scalars['u16']['input']>;
  reward_resource_amountEQ?: InputMaybe<Scalars['u16']['input']>;
  reward_resource_amountGT?: InputMaybe<Scalars['u16']['input']>;
  reward_resource_amountGTE?: InputMaybe<Scalars['u16']['input']>;
  reward_resource_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  reward_resource_amountLIKE?: InputMaybe<Scalars['u16']['input']>;
  reward_resource_amountLT?: InputMaybe<Scalars['u16']['input']>;
  reward_resource_amountLTE?: InputMaybe<Scalars['u16']['input']>;
  reward_resource_amountNEQ?: InputMaybe<Scalars['u16']['input']>;
  reward_resource_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  reward_resource_amountNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  shards_mines_fail_probability?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_fail_probabilityEQ?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_fail_probabilityGT?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_fail_probabilityGTE?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_fail_probabilityIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  shards_mines_fail_probabilityLIKE?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_fail_probabilityLT?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_fail_probabilityLTE?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_fail_probabilityNEQ?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_fail_probabilityNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  shards_mines_fail_probabilityNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_win_probability?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_win_probabilityEQ?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_win_probabilityGT?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_win_probabilityGTE?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_win_probabilityIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  shards_mines_win_probabilityLIKE?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_win_probabilityLT?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_win_probabilityLTE?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_win_probabilityNEQ?: InputMaybe<Scalars['u32']['input']>;
  shards_mines_win_probabilityNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  shards_mines_win_probabilityNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_WorldConfig_Population_ConfigWhereInput = {
  base_population?: InputMaybe<Scalars['u32']['input']>;
  base_populationEQ?: InputMaybe<Scalars['u32']['input']>;
  base_populationGT?: InputMaybe<Scalars['u32']['input']>;
  base_populationGTE?: InputMaybe<Scalars['u32']['input']>;
  base_populationIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  base_populationLIKE?: InputMaybe<Scalars['u32']['input']>;
  base_populationLT?: InputMaybe<Scalars['u32']['input']>;
  base_populationLTE?: InputMaybe<Scalars['u32']['input']>;
  base_populationNEQ?: InputMaybe<Scalars['u32']['input']>;
  base_populationNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  base_populationNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_WorldConfig_Res_Bridge_Fee_Split_ConfigWhereInput = {
  client_fee_on_dpt_percent?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_dpt_percentEQ?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_dpt_percentGT?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_dpt_percentGTE?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_dpt_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  client_fee_on_dpt_percentLIKE?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_dpt_percentLT?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_dpt_percentLTE?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_dpt_percentNEQ?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_dpt_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  client_fee_on_dpt_percentNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_wtdr_percent?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_wtdr_percentEQ?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_wtdr_percentGT?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_wtdr_percentGTE?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_wtdr_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  client_fee_on_wtdr_percentLIKE?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_wtdr_percentLT?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_wtdr_percentLTE?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_wtdr_percentNEQ?: InputMaybe<Scalars['u16']['input']>;
  client_fee_on_wtdr_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  client_fee_on_wtdr_percentNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_dpt_percent?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_dpt_percentEQ?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_dpt_percentGT?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_dpt_percentGTE?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_dpt_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  realm_fee_dpt_percentLIKE?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_dpt_percentLT?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_dpt_percentLTE?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_dpt_percentNEQ?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_dpt_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  realm_fee_dpt_percentNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_wtdr_percent?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_wtdr_percentEQ?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_wtdr_percentGT?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_wtdr_percentGTE?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_wtdr_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  realm_fee_wtdr_percentLIKE?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_wtdr_percentLT?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_wtdr_percentLTE?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_wtdr_percentNEQ?: InputMaybe<Scalars['u16']['input']>;
  realm_fee_wtdr_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  realm_fee_wtdr_percentNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_dpt_percent?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_dpt_percentEQ?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_dpt_percentGT?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_dpt_percentGTE?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_dpt_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  season_pool_fee_on_dpt_percentLIKE?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_dpt_percentLT?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_dpt_percentLTE?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_dpt_percentNEQ?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_dpt_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  season_pool_fee_on_dpt_percentNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_wtdr_percent?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_wtdr_percentEQ?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_wtdr_percentGT?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_wtdr_percentGTE?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_wtdr_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  season_pool_fee_on_wtdr_percentLIKE?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_wtdr_percentLT?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_wtdr_percentLTE?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_wtdr_percentNEQ?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_on_wtdr_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  season_pool_fee_on_wtdr_percentNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  season_pool_fee_recipient?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pool_fee_recipientEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pool_fee_recipientGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pool_fee_recipientGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pool_fee_recipientIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  season_pool_fee_recipientLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pool_fee_recipientLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pool_fee_recipientLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pool_fee_recipientNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pool_fee_recipientNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  season_pool_fee_recipientNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  velords_fee_on_dpt_percent?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_dpt_percentEQ?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_dpt_percentGT?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_dpt_percentGTE?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_dpt_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  velords_fee_on_dpt_percentLIKE?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_dpt_percentLT?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_dpt_percentLTE?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_dpt_percentNEQ?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_dpt_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  velords_fee_on_dpt_percentNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_wtdr_percent?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_wtdr_percentEQ?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_wtdr_percentGT?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_wtdr_percentGTE?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_wtdr_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  velords_fee_on_wtdr_percentLIKE?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_wtdr_percentLT?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_wtdr_percentLTE?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_wtdr_percentNEQ?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_on_wtdr_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  velords_fee_on_wtdr_percentNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  velords_fee_recipient?: InputMaybe<Scalars['ContractAddress']['input']>;
  velords_fee_recipientEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  velords_fee_recipientGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  velords_fee_recipientGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  velords_fee_recipientIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  velords_fee_recipientLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  velords_fee_recipientLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  velords_fee_recipientLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  velords_fee_recipientNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  velords_fee_recipientNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  velords_fee_recipientNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
};

export type S1_Eternum_WorldConfig_Resource_Bridge_ConfigWhereInput = {
  deposit_paused?: InputMaybe<Scalars['bool']['input']>;
  withdraw_paused?: InputMaybe<Scalars['bool']['input']>;
};

export type S1_Eternum_WorldConfig_Season_Addresses_ConfigWhereInput = {
  lords_address?: InputMaybe<Scalars['ContractAddress']['input']>;
  lords_addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  lords_addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  lords_addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  lords_addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  lords_addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  lords_addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  lords_addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  lords_addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  lords_addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  lords_addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  realms_address?: InputMaybe<Scalars['ContractAddress']['input']>;
  realms_addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  realms_addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  realms_addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  realms_addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  realms_addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  realms_addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  realms_addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  realms_addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  realms_addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  realms_addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pass_address?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pass_addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pass_addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pass_addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pass_addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  season_pass_addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pass_addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pass_addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pass_addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  season_pass_addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  season_pass_addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
};

export type S1_Eternum_WorldConfig_Season_Bridge_ConfigWhereInput = {
  close_after_end_seconds?: InputMaybe<Scalars['u64']['input']>;
  close_after_end_secondsEQ?: InputMaybe<Scalars['u64']['input']>;
  close_after_end_secondsGT?: InputMaybe<Scalars['u64']['input']>;
  close_after_end_secondsGTE?: InputMaybe<Scalars['u64']['input']>;
  close_after_end_secondsIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  close_after_end_secondsLIKE?: InputMaybe<Scalars['u64']['input']>;
  close_after_end_secondsLT?: InputMaybe<Scalars['u64']['input']>;
  close_after_end_secondsLTE?: InputMaybe<Scalars['u64']['input']>;
  close_after_end_secondsNEQ?: InputMaybe<Scalars['u64']['input']>;
  close_after_end_secondsNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  close_after_end_secondsNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_WorldConfig_Settlement_ConfigWhereInput = {
  base_distance?: InputMaybe<Scalars['u32']['input']>;
  base_distanceEQ?: InputMaybe<Scalars['u32']['input']>;
  base_distanceGT?: InputMaybe<Scalars['u32']['input']>;
  base_distanceGTE?: InputMaybe<Scalars['u32']['input']>;
  base_distanceIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  base_distanceLIKE?: InputMaybe<Scalars['u32']['input']>;
  base_distanceLT?: InputMaybe<Scalars['u32']['input']>;
  base_distanceLTE?: InputMaybe<Scalars['u32']['input']>;
  base_distanceNEQ?: InputMaybe<Scalars['u32']['input']>;
  base_distanceNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  base_distanceNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  center?: InputMaybe<Scalars['u32']['input']>;
  centerEQ?: InputMaybe<Scalars['u32']['input']>;
  centerGT?: InputMaybe<Scalars['u32']['input']>;
  centerGTE?: InputMaybe<Scalars['u32']['input']>;
  centerIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  centerLIKE?: InputMaybe<Scalars['u32']['input']>;
  centerLT?: InputMaybe<Scalars['u32']['input']>;
  centerLTE?: InputMaybe<Scalars['u32']['input']>;
  centerNEQ?: InputMaybe<Scalars['u32']['input']>;
  centerNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  centerNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  current_layer?: InputMaybe<Scalars['u32']['input']>;
  current_layerEQ?: InputMaybe<Scalars['u32']['input']>;
  current_layerGT?: InputMaybe<Scalars['u32']['input']>;
  current_layerGTE?: InputMaybe<Scalars['u32']['input']>;
  current_layerIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  current_layerLIKE?: InputMaybe<Scalars['u32']['input']>;
  current_layerLT?: InputMaybe<Scalars['u32']['input']>;
  current_layerLTE?: InputMaybe<Scalars['u32']['input']>;
  current_layerNEQ?: InputMaybe<Scalars['u32']['input']>;
  current_layerNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  current_layerNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  current_point_on_side?: InputMaybe<Scalars['u32']['input']>;
  current_point_on_sideEQ?: InputMaybe<Scalars['u32']['input']>;
  current_point_on_sideGT?: InputMaybe<Scalars['u32']['input']>;
  current_point_on_sideGTE?: InputMaybe<Scalars['u32']['input']>;
  current_point_on_sideIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  current_point_on_sideLIKE?: InputMaybe<Scalars['u32']['input']>;
  current_point_on_sideLT?: InputMaybe<Scalars['u32']['input']>;
  current_point_on_sideLTE?: InputMaybe<Scalars['u32']['input']>;
  current_point_on_sideNEQ?: InputMaybe<Scalars['u32']['input']>;
  current_point_on_sideNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  current_point_on_sideNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  current_side?: InputMaybe<Scalars['u32']['input']>;
  current_sideEQ?: InputMaybe<Scalars['u32']['input']>;
  current_sideGT?: InputMaybe<Scalars['u32']['input']>;
  current_sideGTE?: InputMaybe<Scalars['u32']['input']>;
  current_sideIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  current_sideLIKE?: InputMaybe<Scalars['u32']['input']>;
  current_sideLT?: InputMaybe<Scalars['u32']['input']>;
  current_sideLTE?: InputMaybe<Scalars['u32']['input']>;
  current_sideNEQ?: InputMaybe<Scalars['u32']['input']>;
  current_sideNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  current_sideNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  min_first_layer_distance?: InputMaybe<Scalars['u32']['input']>;
  min_first_layer_distanceEQ?: InputMaybe<Scalars['u32']['input']>;
  min_first_layer_distanceGT?: InputMaybe<Scalars['u32']['input']>;
  min_first_layer_distanceGTE?: InputMaybe<Scalars['u32']['input']>;
  min_first_layer_distanceIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  min_first_layer_distanceLIKE?: InputMaybe<Scalars['u32']['input']>;
  min_first_layer_distanceLT?: InputMaybe<Scalars['u32']['input']>;
  min_first_layer_distanceLTE?: InputMaybe<Scalars['u32']['input']>;
  min_first_layer_distanceNEQ?: InputMaybe<Scalars['u32']['input']>;
  min_first_layer_distanceNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  min_first_layer_distanceNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  points_placed?: InputMaybe<Scalars['u32']['input']>;
  points_placedEQ?: InputMaybe<Scalars['u32']['input']>;
  points_placedGT?: InputMaybe<Scalars['u32']['input']>;
  points_placedGTE?: InputMaybe<Scalars['u32']['input']>;
  points_placedIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  points_placedLIKE?: InputMaybe<Scalars['u32']['input']>;
  points_placedLT?: InputMaybe<Scalars['u32']['input']>;
  points_placedLTE?: InputMaybe<Scalars['u32']['input']>;
  points_placedNEQ?: InputMaybe<Scalars['u32']['input']>;
  points_placedNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  points_placedNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S1_Eternum_WorldConfig_Speed_ConfigWhereInput = {
  donkey_sec_per_km?: InputMaybe<Scalars['u16']['input']>;
  donkey_sec_per_kmEQ?: InputMaybe<Scalars['u16']['input']>;
  donkey_sec_per_kmGT?: InputMaybe<Scalars['u16']['input']>;
  donkey_sec_per_kmGTE?: InputMaybe<Scalars['u16']['input']>;
  donkey_sec_per_kmIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  donkey_sec_per_kmLIKE?: InputMaybe<Scalars['u16']['input']>;
  donkey_sec_per_kmLT?: InputMaybe<Scalars['u16']['input']>;
  donkey_sec_per_kmLTE?: InputMaybe<Scalars['u16']['input']>;
  donkey_sec_per_kmNEQ?: InputMaybe<Scalars['u16']['input']>;
  donkey_sec_per_kmNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  donkey_sec_per_kmNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
};

export type S1_Eternum_WorldConfig_Structure_Max_Level_ConfigWhereInput = {
  realm_max?: InputMaybe<Scalars['u8']['input']>;
  realm_maxEQ?: InputMaybe<Scalars['u8']['input']>;
  realm_maxGT?: InputMaybe<Scalars['u8']['input']>;
  realm_maxGTE?: InputMaybe<Scalars['u8']['input']>;
  realm_maxIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  realm_maxLIKE?: InputMaybe<Scalars['u8']['input']>;
  realm_maxLT?: InputMaybe<Scalars['u8']['input']>;
  realm_maxLTE?: InputMaybe<Scalars['u8']['input']>;
  realm_maxNEQ?: InputMaybe<Scalars['u8']['input']>;
  realm_maxNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  realm_maxNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  village_max?: InputMaybe<Scalars['u8']['input']>;
  village_maxEQ?: InputMaybe<Scalars['u8']['input']>;
  village_maxGT?: InputMaybe<Scalars['u8']['input']>;
  village_maxGTE?: InputMaybe<Scalars['u8']['input']>;
  village_maxIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  village_maxLIKE?: InputMaybe<Scalars['u8']['input']>;
  village_maxLT?: InputMaybe<Scalars['u8']['input']>;
  village_maxLTE?: InputMaybe<Scalars['u8']['input']>;
  village_maxNEQ?: InputMaybe<Scalars['u8']['input']>;
  village_maxNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  village_maxNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S1_Eternum_WorldConfig_Tick_ConfigWhereInput = {
  armies_tick_in_seconds?: InputMaybe<Scalars['u64']['input']>;
  armies_tick_in_secondsEQ?: InputMaybe<Scalars['u64']['input']>;
  armies_tick_in_secondsGT?: InputMaybe<Scalars['u64']['input']>;
  armies_tick_in_secondsGTE?: InputMaybe<Scalars['u64']['input']>;
  armies_tick_in_secondsIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  armies_tick_in_secondsLIKE?: InputMaybe<Scalars['u64']['input']>;
  armies_tick_in_secondsLT?: InputMaybe<Scalars['u64']['input']>;
  armies_tick_in_secondsLTE?: InputMaybe<Scalars['u64']['input']>;
  armies_tick_in_secondsNEQ?: InputMaybe<Scalars['u64']['input']>;
  armies_tick_in_secondsNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  armies_tick_in_secondsNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_WorldConfig_Trade_ConfigWhereInput = {
  max_count?: InputMaybe<Scalars['u8']['input']>;
  max_countEQ?: InputMaybe<Scalars['u8']['input']>;
  max_countGT?: InputMaybe<Scalars['u8']['input']>;
  max_countGTE?: InputMaybe<Scalars['u8']['input']>;
  max_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  max_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  max_countLT?: InputMaybe<Scalars['u8']['input']>;
  max_countLTE?: InputMaybe<Scalars['u8']['input']>;
  max_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  max_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  max_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S1_Eternum_WorldConfig_Troop_Damage_ConfigWhereInput = {
  damage_beta_large?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_largeEQ?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_largeGT?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_largeGTE?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_largeIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  damage_beta_largeLIKE?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_largeLT?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_largeLTE?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_largeNEQ?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_largeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  damage_beta_largeNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_small?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_smallEQ?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_smallGT?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_smallGTE?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_smallIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  damage_beta_smallLIKE?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_smallLT?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_smallLTE?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_smallNEQ?: InputMaybe<Scalars['u64']['input']>;
  damage_beta_smallNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  damage_beta_smallNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  damage_biome_bonus_num?: InputMaybe<Scalars['u16']['input']>;
  damage_biome_bonus_numEQ?: InputMaybe<Scalars['u16']['input']>;
  damage_biome_bonus_numGT?: InputMaybe<Scalars['u16']['input']>;
  damage_biome_bonus_numGTE?: InputMaybe<Scalars['u16']['input']>;
  damage_biome_bonus_numIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  damage_biome_bonus_numLIKE?: InputMaybe<Scalars['u16']['input']>;
  damage_biome_bonus_numLT?: InputMaybe<Scalars['u16']['input']>;
  damage_biome_bonus_numLTE?: InputMaybe<Scalars['u16']['input']>;
  damage_biome_bonus_numNEQ?: InputMaybe<Scalars['u16']['input']>;
  damage_biome_bonus_numNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  damage_biome_bonus_numNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  damage_c0?: InputMaybe<Scalars['u128']['input']>;
  damage_c0EQ?: InputMaybe<Scalars['u128']['input']>;
  damage_c0GT?: InputMaybe<Scalars['u128']['input']>;
  damage_c0GTE?: InputMaybe<Scalars['u128']['input']>;
  damage_c0IN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  damage_c0LIKE?: InputMaybe<Scalars['u128']['input']>;
  damage_c0LT?: InputMaybe<Scalars['u128']['input']>;
  damage_c0LTE?: InputMaybe<Scalars['u128']['input']>;
  damage_c0NEQ?: InputMaybe<Scalars['u128']['input']>;
  damage_c0NOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  damage_c0NOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  damage_delta?: InputMaybe<Scalars['u128']['input']>;
  damage_deltaEQ?: InputMaybe<Scalars['u128']['input']>;
  damage_deltaGT?: InputMaybe<Scalars['u128']['input']>;
  damage_deltaGTE?: InputMaybe<Scalars['u128']['input']>;
  damage_deltaIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  damage_deltaLIKE?: InputMaybe<Scalars['u128']['input']>;
  damage_deltaLT?: InputMaybe<Scalars['u128']['input']>;
  damage_deltaLTE?: InputMaybe<Scalars['u128']['input']>;
  damage_deltaNEQ?: InputMaybe<Scalars['u128']['input']>;
  damage_deltaNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  damage_deltaNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  damage_scaling_factor?: InputMaybe<Scalars['u128']['input']>;
  damage_scaling_factorEQ?: InputMaybe<Scalars['u128']['input']>;
  damage_scaling_factorGT?: InputMaybe<Scalars['u128']['input']>;
  damage_scaling_factorGTE?: InputMaybe<Scalars['u128']['input']>;
  damage_scaling_factorIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  damage_scaling_factorLIKE?: InputMaybe<Scalars['u128']['input']>;
  damage_scaling_factorLT?: InputMaybe<Scalars['u128']['input']>;
  damage_scaling_factorLTE?: InputMaybe<Scalars['u128']['input']>;
  damage_scaling_factorNEQ?: InputMaybe<Scalars['u128']['input']>;
  damage_scaling_factorNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  damage_scaling_factorNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  t1_damage_value?: InputMaybe<Scalars['u128']['input']>;
  t1_damage_valueEQ?: InputMaybe<Scalars['u128']['input']>;
  t1_damage_valueGT?: InputMaybe<Scalars['u128']['input']>;
  t1_damage_valueGTE?: InputMaybe<Scalars['u128']['input']>;
  t1_damage_valueIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  t1_damage_valueLIKE?: InputMaybe<Scalars['u128']['input']>;
  t1_damage_valueLT?: InputMaybe<Scalars['u128']['input']>;
  t1_damage_valueLTE?: InputMaybe<Scalars['u128']['input']>;
  t1_damage_valueNEQ?: InputMaybe<Scalars['u128']['input']>;
  t1_damage_valueNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  t1_damage_valueNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  t2_damage_multiplier?: InputMaybe<Scalars['u128']['input']>;
  t2_damage_multiplierEQ?: InputMaybe<Scalars['u128']['input']>;
  t2_damage_multiplierGT?: InputMaybe<Scalars['u128']['input']>;
  t2_damage_multiplierGTE?: InputMaybe<Scalars['u128']['input']>;
  t2_damage_multiplierIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  t2_damage_multiplierLIKE?: InputMaybe<Scalars['u128']['input']>;
  t2_damage_multiplierLT?: InputMaybe<Scalars['u128']['input']>;
  t2_damage_multiplierLTE?: InputMaybe<Scalars['u128']['input']>;
  t2_damage_multiplierNEQ?: InputMaybe<Scalars['u128']['input']>;
  t2_damage_multiplierNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  t2_damage_multiplierNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  t3_damage_multiplier?: InputMaybe<Scalars['u128']['input']>;
  t3_damage_multiplierEQ?: InputMaybe<Scalars['u128']['input']>;
  t3_damage_multiplierGT?: InputMaybe<Scalars['u128']['input']>;
  t3_damage_multiplierGTE?: InputMaybe<Scalars['u128']['input']>;
  t3_damage_multiplierIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  t3_damage_multiplierLIKE?: InputMaybe<Scalars['u128']['input']>;
  t3_damage_multiplierLT?: InputMaybe<Scalars['u128']['input']>;
  t3_damage_multiplierLTE?: InputMaybe<Scalars['u128']['input']>;
  t3_damage_multiplierNEQ?: InputMaybe<Scalars['u128']['input']>;
  t3_damage_multiplierNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  t3_damage_multiplierNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type S1_Eternum_WorldConfig_Troop_Limit_ConfigWhereInput = {
  explorer_guard_max_troop_count?: InputMaybe<Scalars['u32']['input']>;
  explorer_guard_max_troop_countEQ?: InputMaybe<Scalars['u32']['input']>;
  explorer_guard_max_troop_countGT?: InputMaybe<Scalars['u32']['input']>;
  explorer_guard_max_troop_countGTE?: InputMaybe<Scalars['u32']['input']>;
  explorer_guard_max_troop_countIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  explorer_guard_max_troop_countLIKE?: InputMaybe<Scalars['u32']['input']>;
  explorer_guard_max_troop_countLT?: InputMaybe<Scalars['u32']['input']>;
  explorer_guard_max_troop_countLTE?: InputMaybe<Scalars['u32']['input']>;
  explorer_guard_max_troop_countNEQ?: InputMaybe<Scalars['u32']['input']>;
  explorer_guard_max_troop_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  explorer_guard_max_troop_countNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  explorer_max_party_count?: InputMaybe<Scalars['u8']['input']>;
  explorer_max_party_countEQ?: InputMaybe<Scalars['u8']['input']>;
  explorer_max_party_countGT?: InputMaybe<Scalars['u8']['input']>;
  explorer_max_party_countGTE?: InputMaybe<Scalars['u8']['input']>;
  explorer_max_party_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  explorer_max_party_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  explorer_max_party_countLT?: InputMaybe<Scalars['u8']['input']>;
  explorer_max_party_countLTE?: InputMaybe<Scalars['u8']['input']>;
  explorer_max_party_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  explorer_max_party_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  explorer_max_party_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  guard_resurrection_delay?: InputMaybe<Scalars['u32']['input']>;
  guard_resurrection_delayEQ?: InputMaybe<Scalars['u32']['input']>;
  guard_resurrection_delayGT?: InputMaybe<Scalars['u32']['input']>;
  guard_resurrection_delayGTE?: InputMaybe<Scalars['u32']['input']>;
  guard_resurrection_delayIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  guard_resurrection_delayLIKE?: InputMaybe<Scalars['u32']['input']>;
  guard_resurrection_delayLT?: InputMaybe<Scalars['u32']['input']>;
  guard_resurrection_delayLTE?: InputMaybe<Scalars['u32']['input']>;
  guard_resurrection_delayNEQ?: InputMaybe<Scalars['u32']['input']>;
  guard_resurrection_delayNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  guard_resurrection_delayNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  mercenaries_troop_lower_bound?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_lower_boundEQ?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_lower_boundGT?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_lower_boundGTE?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_lower_boundIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  mercenaries_troop_lower_boundLIKE?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_lower_boundLT?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_lower_boundLTE?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_lower_boundNEQ?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_lower_boundNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  mercenaries_troop_lower_boundNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_upper_bound?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_upper_boundEQ?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_upper_boundGT?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_upper_boundGTE?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_upper_boundIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  mercenaries_troop_upper_boundLIKE?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_upper_boundLT?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_upper_boundLTE?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_upper_boundNEQ?: InputMaybe<Scalars['u64']['input']>;
  mercenaries_troop_upper_boundNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  mercenaries_troop_upper_boundNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S1_Eternum_WorldConfig_Troop_Stamina_ConfigWhereInput = {
  stamina_attack_max?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_maxEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_maxGT?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_maxGTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_maxIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_attack_maxLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_maxLT?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_maxLTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_maxNEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_maxNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_attack_maxNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_req?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_reqEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_reqGT?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_reqGTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_reqIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_attack_reqLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_reqLT?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_reqLTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_reqNEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_attack_reqNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_attack_reqNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_bonus_value?: InputMaybe<Scalars['u16']['input']>;
  stamina_bonus_valueEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_bonus_valueGT?: InputMaybe<Scalars['u16']['input']>;
  stamina_bonus_valueGTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_bonus_valueIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_bonus_valueLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_bonus_valueLT?: InputMaybe<Scalars['u16']['input']>;
  stamina_bonus_valueLTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_bonus_valueNEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_bonus_valueNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_bonus_valueNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_crossbowman_max?: InputMaybe<Scalars['u16']['input']>;
  stamina_crossbowman_maxEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_crossbowman_maxGT?: InputMaybe<Scalars['u16']['input']>;
  stamina_crossbowman_maxGTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_crossbowman_maxIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_crossbowman_maxLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_crossbowman_maxLT?: InputMaybe<Scalars['u16']['input']>;
  stamina_crossbowman_maxLTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_crossbowman_maxNEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_crossbowman_maxNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_crossbowman_maxNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_fish_cost?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_fish_costEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_fish_costGT?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_fish_costGTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_fish_costIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_explore_fish_costLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_fish_costLT?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_fish_costLTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_fish_costNEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_fish_costNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_explore_fish_costNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_stamina_cost?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_stamina_costEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_stamina_costGT?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_stamina_costGTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_stamina_costIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_explore_stamina_costLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_stamina_costLT?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_stamina_costLTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_stamina_costNEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_stamina_costNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_explore_stamina_costNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_wheat_cost?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_wheat_costEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_wheat_costGT?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_wheat_costGTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_wheat_costIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_explore_wheat_costLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_wheat_costLT?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_wheat_costLTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_wheat_costNEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_explore_wheat_costNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_explore_wheat_costNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_gain_per_tick?: InputMaybe<Scalars['u16']['input']>;
  stamina_gain_per_tickEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_gain_per_tickGT?: InputMaybe<Scalars['u16']['input']>;
  stamina_gain_per_tickGTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_gain_per_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_gain_per_tickLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_gain_per_tickLT?: InputMaybe<Scalars['u16']['input']>;
  stamina_gain_per_tickLTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_gain_per_tickNEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_gain_per_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_gain_per_tickNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_initial?: InputMaybe<Scalars['u16']['input']>;
  stamina_initialEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_initialGT?: InputMaybe<Scalars['u16']['input']>;
  stamina_initialGTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_initialIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_initialLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_initialLT?: InputMaybe<Scalars['u16']['input']>;
  stamina_initialLTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_initialNEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_initialNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_initialNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_knight_max?: InputMaybe<Scalars['u16']['input']>;
  stamina_knight_maxEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_knight_maxGT?: InputMaybe<Scalars['u16']['input']>;
  stamina_knight_maxGTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_knight_maxIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_knight_maxLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_knight_maxLT?: InputMaybe<Scalars['u16']['input']>;
  stamina_knight_maxLTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_knight_maxNEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_knight_maxNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_knight_maxNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_paladin_max?: InputMaybe<Scalars['u16']['input']>;
  stamina_paladin_maxEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_paladin_maxGT?: InputMaybe<Scalars['u16']['input']>;
  stamina_paladin_maxGTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_paladin_maxIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_paladin_maxLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_paladin_maxLT?: InputMaybe<Scalars['u16']['input']>;
  stamina_paladin_maxLTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_paladin_maxNEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_paladin_maxNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_paladin_maxNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_fish_cost?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_fish_costEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_fish_costGT?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_fish_costGTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_fish_costIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_travel_fish_costLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_fish_costLT?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_fish_costLTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_fish_costNEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_fish_costNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_travel_fish_costNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_stamina_cost?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_stamina_costEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_stamina_costGT?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_stamina_costGTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_stamina_costIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_travel_stamina_costLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_stamina_costLT?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_stamina_costLTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_stamina_costNEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_stamina_costNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_travel_stamina_costNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_wheat_cost?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_wheat_costEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_wheat_costGT?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_wheat_costGTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_wheat_costIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_travel_wheat_costLIKE?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_wheat_costLT?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_wheat_costLTE?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_wheat_costNEQ?: InputMaybe<Scalars['u16']['input']>;
  stamina_travel_wheat_costNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  stamina_travel_wheat_costNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
};

export type GetCapacitySpeedConfigQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCapacitySpeedConfigQuery = { __typename?: 'World__Query', s1EternumWorldConfigModels?: { __typename?: 's1_eternum_WorldConfigConnection', edges?: Array<{ __typename?: 's1_eternum_WorldConfigEdge', node?: { __typename?: 's1_eternum_WorldConfig', capacity_config?: { __typename?: 's1_eternum_CapacityConfig', donkey_capacity?: any | null } | null, speed_config?: { __typename?: 's1_eternum_SpeedConfig', donkey_sec_per_km?: any | null } | null } | null } | null> | null } | null };

export type GetEternumOwnerRealmIdsQueryVariables = Exact<{
  accountAddress: Scalars['ContractAddress']['input'];
}>;


export type GetEternumOwnerRealmIdsQuery = { __typename?: 'World__Query', s1EternumStructureModels?: { __typename?: 's1_eternum_StructureConnection', edges?: Array<{ __typename?: 's1_eternum_StructureEdge', node?: { __typename?: 's1_eternum_Structure', owner?: any | null, entity_id?: any | null, metadata?: { __typename?: 's1_eternum_StructureMetadata', realm_id?: any | null } | null } | null } | null> | null } | null };

export type GetEternumEntityOwnerQueryVariables = Exact<{
  entityOwnerIds: Array<Scalars['u32']['input']> | Scalars['u32']['input'];
}>;


export type GetEternumEntityOwnerQuery = { __typename?: 'World__Query', s1EternumResourceArrivalModels?: { __typename?: 's1_eternum_ResourceArrivalConnection', edges?: Array<{ __typename?: 's1_eternum_ResourceArrivalEdge', node?: { __typename?: 's1_eternum_ResourceArrival', structure_id?: any | null, slot_1?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_2?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_3?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_4?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_5?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_6?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_7?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_8?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_9?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_10?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_11?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_12?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_13?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_14?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_15?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_16?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_17?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_18?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_19?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_20?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_21?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_22?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_23?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null, slot_24?: Array<{ __typename?: 's1_eternum_u8u128', _0?: any | null, _1?: any | null } | null> | null } | null } | null> | null } | null };

export type GetAccountTokensQueryVariables = Exact<{
  accountAddress: Scalars['String']['input'];
}>;


export type GetAccountTokensQuery = { __typename?: 'World__Query', tokenBalances?: { __typename?: 'Token__BalanceConnection', edges?: Array<{ __typename?: 'Token__BalanceEdge', node?: { __typename?: 'Token__Balance', tokenMetadata: { __typename: 'ERC20__Token' } | { __typename: 'ERC721__Token', tokenId: string, metadataDescription?: string | null, imagePath: string, contractAddress: string, metadata: string } } | null } | null> | null } | null };

export type GetErc721MintsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetErc721MintsQuery = { __typename?: 'World__Query', tokenTransfers?: { __typename?: 'Token__TransferConnection', edges?: Array<{ __typename?: 'Token__TransferEdge', node?: { __typename?: 'Token__Transfer', tokenMetadata: { __typename: 'ERC20__Token' } | { __typename: 'ERC721__Token', tokenId: string, metadataDescription?: string | null, imagePath: string, contractAddress: string, metadata: string } } | null } | null> | null } | null };

export type EternumStatisticsQueryVariables = Exact<{ [key: string]: never; }>;


export type EternumStatisticsQuery = { __typename?: 'World__Query', s1EternumAddressNameModels?: { __typename?: 's1_eternum_AddressNameConnection', totalCount: number } | null, realms?: { __typename?: 's1_eternum_StructureConnection', totalCount: number } | null, hyperstructures?: { __typename?: 's1_eternum_StructureConnection', totalCount: number } | null, banks?: { __typename?: 's1_eternum_StructureConnection', totalCount: number } | null, mines?: { __typename?: 's1_eternum_StructureConnection', totalCount: number } | null, villages?: { __typename?: 's1_eternum_StructureConnection', totalCount: number } | null };

export type HasGameEndedQueryVariables = Exact<{ [key: string]: never; }>;


export type HasGameEndedQuery = { __typename?: 'World__Query', s1EternumGameEndedModels?: { __typename?: 's1_eternum_GameEndedConnection', edges?: Array<{ __typename?: 's1_eternum_GameEndedEdge', node?: { __typename?: 's1_eternum_GameEnded', winner_address?: any | null } | null } | null> | null } | null };

export type GetLeaderboardEntryQueryVariables = Exact<{
  accountAddress: Scalars['ContractAddress']['input'];
}>;


export type GetLeaderboardEntryQuery = { __typename?: 'World__Query', s1EternumLeaderboardEntryModels?: { __typename?: 's1_eternum_LeaderboardEntryConnection', edges?: Array<{ __typename?: 's1_eternum_LeaderboardEntryEdge', node?: { __typename?: 's1_eternum_LeaderboardEntry', address?: any | null, points?: any | null } | null } | null> | null } | null };

export type GetLeaderboardQueryVariables = Exact<{ [key: string]: never; }>;


export type GetLeaderboardQuery = { __typename?: 'World__Query', s1EternumLeaderboardModels?: { __typename?: 's1_eternum_LeaderboardConnection', edges?: Array<{ __typename?: 's1_eternum_LeaderboardEdge', node?: { __typename?: 's1_eternum_Leaderboard', total_points?: any | null, registration_end_timestamp?: any | null, distribution_started?: any | null, total_price_pool?: { __typename?: 's1_eternum_Optionu256', Some?: any | null, option?: any | null } | null } | null } | null> | null } | null };

export type GetHyperstructureContributionsQueryVariables = Exact<{
  accountAddress: Scalars['ContractAddress']['input'];
}>;


export type GetHyperstructureContributionsQuery = { __typename?: 'World__Query', s1EternumContributionModels?: { __typename?: 's1_eternum_ContributionConnection', edges?: Array<{ __typename?: 's1_eternum_ContributionEdge', node?: { __typename?: 's1_eternum_Contribution', hyperstructure_entity_id?: any | null, amount?: any | null } | null } | null> | null } | null };

export type GetEpochsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetEpochsQuery = { __typename?: 'World__Query', s1EternumEpochModels?: { __typename?: 's1_eternum_EpochConnection', edges?: Array<{ __typename?: 's1_eternum_EpochEdge', node?: { __typename?: 's1_eternum_Epoch', start_timestamp?: any | null, hyperstructure_entity_id?: any | null, index?: any | null, owners?: Array<{ __typename?: 's1_eternum_ContractAddressu16', _0?: any | null, _1?: any | null } | null> | null } | null } | null> | null } | null };

export type GetEntityPositionQueryVariables = Exact<{
  entityIds: Array<Scalars['u32']['input']> | Scalars['u32']['input'];
}>;


export type GetEntityPositionQuery = { __typename?: 'World__Query', s1EternumStructureModels?: { __typename?: 's1_eternum_StructureConnection', edges?: Array<{ __typename?: 's1_eternum_StructureEdge', node?: { __typename?: 's1_eternum_Structure', entity_id?: any | null, base?: { __typename?: 's1_eternum_StructureBase', coord_x?: any | null, coord_y?: any | null } | null, entity?: { __typename: 'World__Entity' } | null } | null } | null> | null } | null };

export type GetEntitiesResourcesQueryVariables = Exact<{
  entityIds: Array<Scalars['u32']['input']> | Scalars['u32']['input'];
}>;


export type GetEntitiesResourcesQuery = { __typename?: 'World__Query', s1EternumResourceModels?: { __typename?: 's1_eternum_ResourceConnection', edges?: Array<{ __typename?: 's1_eternum_ResourceEdge', node?: { __typename?: 's1_eternum_Resource', entity_id?: any | null, STONE_BALANCE?: any | null, COAL_BALANCE?: any | null, WOOD_BALANCE?: any | null, COPPER_BALANCE?: any | null, IRONWOOD_BALANCE?: any | null, OBSIDIAN_BALANCE?: any | null, GOLD_BALANCE?: any | null, SILVER_BALANCE?: any | null, MITHRAL_BALANCE?: any | null, ALCHEMICAL_SILVER_BALANCE?: any | null, COLD_IRON_BALANCE?: any | null, DEEP_CRYSTAL_BALANCE?: any | null, RUBY_BALANCE?: any | null, DIAMONDS_BALANCE?: any | null, HARTWOOD_BALANCE?: any | null, IGNIUM_BALANCE?: any | null, TWILIGHT_QUARTZ_BALANCE?: any | null, TRUE_ICE_BALANCE?: any | null, ADAMANTINE_BALANCE?: any | null, SAPPHIRE_BALANCE?: any | null, ETHEREAL_SILICA_BALANCE?: any | null, DRAGONHIDE_BALANCE?: any | null, LABOR_BALANCE?: any | null, EARTHEN_SHARD_BALANCE?: any | null, DONKEY_BALANCE?: any | null, KNIGHT_T1_BALANCE?: any | null, KNIGHT_T2_BALANCE?: any | null, KNIGHT_T3_BALANCE?: any | null, CROSSBOWMAN_T1_BALANCE?: any | null, CROSSBOWMAN_T2_BALANCE?: any | null, CROSSBOWMAN_T3_BALANCE?: any | null, PALADIN_T1_BALANCE?: any | null, PALADIN_T2_BALANCE?: any | null, PALADIN_T3_BALANCE?: any | null, WHEAT_BALANCE?: any | null, FISH_BALANCE?: any | null, LORDS_BALANCE?: any | null, STONE_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, COAL_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, WOOD_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, COPPER_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, IRONWOOD_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, OBSIDIAN_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, GOLD_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, SILVER_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, MITHRAL_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, ALCHEMICAL_SILVER_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, COLD_IRON_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, DEEP_CRYSTAL_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, RUBY_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, DIAMONDS_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, HARTWOOD_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, IGNIUM_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, TWILIGHT_QUARTZ_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, TRUE_ICE_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, ADAMANTINE_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, SAPPHIRE_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, ETHEREAL_SILICA_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, DRAGONHIDE_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, LABOR_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, EARTHEN_SHARD_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, DONKEY_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, KNIGHT_T1_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, KNIGHT_T2_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, KNIGHT_T3_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, CROSSBOWMAN_T1_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, CROSSBOWMAN_T2_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, CROSSBOWMAN_T3_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, PALADIN_T1_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, PALADIN_T2_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, PALADIN_T3_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, WHEAT_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, FISH_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null, LORDS_PRODUCTION?: { __typename?: 's1_eternum_Production', building_count?: any | null, production_rate?: any | null, output_amount_left?: any | null, last_updated_at?: any | null } | null } | null } | null> | null } | null };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: DocumentTypeDecoration<TResult, TVariables>['__apiType'];

  constructor(private value: string, public __meta__?: Record<string, any> | undefined) {
    super(value);
  }

  toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}

export const GetCapacitySpeedConfigDocument = new TypedDocumentString(`
    query getCapacitySpeedConfig {
  s1EternumWorldConfigModels {
    edges {
      node {
        capacity_config {
          donkey_capacity
        }
        speed_config {
          donkey_sec_per_km
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetCapacitySpeedConfigQuery, GetCapacitySpeedConfigQueryVariables>;
export const GetEternumOwnerRealmIdsDocument = new TypedDocumentString(`
    query getEternumOwnerRealmIds($accountAddress: ContractAddress!) {
  s1EternumStructureModels(where: {owner: $accountAddress}, limit: 8000) {
    edges {
      node {
        owner
        entity_id
        metadata {
          realm_id
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetEternumOwnerRealmIdsQuery, GetEternumOwnerRealmIdsQueryVariables>;
export const GetEternumEntityOwnerDocument = new TypedDocumentString(`
    query getEternumEntityOwner($entityOwnerIds: [u32!]!) {
  s1EternumResourceArrivalModels(
    where: {structure_idIN: $entityOwnerIds}
    limit: 10000
  ) {
    edges {
      node {
        structure_id
        slot_1 {
          _0
          _1
        }
        slot_2 {
          _0
          _1
        }
        slot_3 {
          _0
          _1
        }
        slot_4 {
          _0
          _1
        }
        slot_5 {
          _0
          _1
        }
        slot_6 {
          _0
          _1
        }
        slot_7 {
          _0
          _1
        }
        slot_8 {
          _0
          _1
        }
        slot_9 {
          _0
          _1
        }
        slot_10 {
          _0
          _1
        }
        slot_11 {
          _0
          _1
        }
        slot_12 {
          _0
          _1
        }
        slot_13 {
          _0
          _1
        }
        slot_14 {
          _0
          _1
        }
        slot_15 {
          _0
          _1
        }
        slot_16 {
          _0
          _1
        }
        slot_17 {
          _0
          _1
        }
        slot_18 {
          _0
          _1
        }
        slot_19 {
          _0
          _1
        }
        slot_20 {
          _0
          _1
        }
        slot_21 {
          _0
          _1
        }
        slot_22 {
          _0
          _1
        }
        slot_23 {
          _0
          _1
        }
        slot_24 {
          _0
          _1
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetEternumEntityOwnerQuery, GetEternumEntityOwnerQueryVariables>;
export const GetAccountTokensDocument = new TypedDocumentString(`
    query getAccountTokens($accountAddress: String!) {
  tokenBalances(accountAddress: $accountAddress, limit: 8000) {
    edges {
      node {
        tokenMetadata {
          __typename
          ... on ERC721__Token {
            tokenId
            metadataDescription
            imagePath
            contractAddress
            metadata
          }
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetAccountTokensQuery, GetAccountTokensQueryVariables>;
export const GetErc721MintsDocument = new TypedDocumentString(`
    query getERC721Mints {
  tokenTransfers(accountAddress: "0x0", limit: 8000) {
    edges {
      node {
        tokenMetadata {
          __typename
          ... on ERC721__Token {
            tokenId
            metadataDescription
            imagePath
            contractAddress
            metadata
          }
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetErc721MintsQuery, GetErc721MintsQueryVariables>;
export const EternumStatisticsDocument = new TypedDocumentString(`
    query eternumStatistics {
  s1EternumAddressNameModels {
    totalCount
  }
  realms: s1EternumStructureModels(where: {category: 1}) {
    totalCount
  }
  hyperstructures: s1EternumStructureModels(where: {category: 2}) {
    totalCount
  }
  banks: s1EternumStructureModels(where: {category: 3}) {
    totalCount
  }
  mines: s1EternumStructureModels(where: {category: 4}) {
    totalCount
  }
  villages: s1EternumStructureModels(where: {category: 5}) {
    totalCount
  }
}
    `) as unknown as TypedDocumentString<EternumStatisticsQuery, EternumStatisticsQueryVariables>;
export const HasGameEndedDocument = new TypedDocumentString(`
    query hasGameEnded {
  s1EternumGameEndedModels {
    edges {
      node {
        winner_address
      }
    }
  }
}
    `) as unknown as TypedDocumentString<HasGameEndedQuery, HasGameEndedQueryVariables>;
export const GetLeaderboardEntryDocument = new TypedDocumentString(`
    query getLeaderboardEntry($accountAddress: ContractAddress!) {
  s1EternumLeaderboardEntryModels(where: {address: $accountAddress}) {
    edges {
      node {
        address
        points
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetLeaderboardEntryQuery, GetLeaderboardEntryQueryVariables>;
export const GetLeaderboardDocument = new TypedDocumentString(`
    query getLeaderboard {
  s1EternumLeaderboardModels {
    edges {
      node {
        total_points
        registration_end_timestamp
        total_price_pool {
          Some
          option
        }
        distribution_started
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetLeaderboardQuery, GetLeaderboardQueryVariables>;
export const GetHyperstructureContributionsDocument = new TypedDocumentString(`
    query getHyperstructureContributions($accountAddress: ContractAddress!) {
  s1EternumContributionModels(
    where: {player_address: $accountAddress}
    limit: 1000
  ) {
    edges {
      node {
        hyperstructure_entity_id
        amount
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetHyperstructureContributionsQuery, GetHyperstructureContributionsQueryVariables>;
export const GetEpochsDocument = new TypedDocumentString(`
    query getEpochs {
  s1EternumEpochModels(limit: 1000) {
    edges {
      node {
        owners {
          _0
          _1
        }
        start_timestamp
        hyperstructure_entity_id
        index
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetEpochsQuery, GetEpochsQueryVariables>;
export const GetEntityPositionDocument = new TypedDocumentString(`
    query getEntityPosition($entityIds: [u32!]!) {
  s1EternumStructureModels(where: {entity_idIN: $entityIds}, limit: 8000) {
    edges {
      node {
        base {
          coord_x
          coord_y
        }
        entity_id
        entity {
          __typename
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetEntityPositionQuery, GetEntityPositionQueryVariables>;
export const GetEntitiesResourcesDocument = new TypedDocumentString(`
    query getEntitiesResources($entityIds: [u32!]!) {
  s1EternumResourceModels(where: {entity_idIN: $entityIds}, limit: 8000) {
    edges {
      node {
        entity_id
        STONE_BALANCE
        COAL_BALANCE
        WOOD_BALANCE
        COPPER_BALANCE
        IRONWOOD_BALANCE
        OBSIDIAN_BALANCE
        GOLD_BALANCE
        SILVER_BALANCE
        MITHRAL_BALANCE
        ALCHEMICAL_SILVER_BALANCE
        COLD_IRON_BALANCE
        DEEP_CRYSTAL_BALANCE
        RUBY_BALANCE
        DIAMONDS_BALANCE
        HARTWOOD_BALANCE
        IGNIUM_BALANCE
        TWILIGHT_QUARTZ_BALANCE
        TRUE_ICE_BALANCE
        ADAMANTINE_BALANCE
        SAPPHIRE_BALANCE
        ETHEREAL_SILICA_BALANCE
        DRAGONHIDE_BALANCE
        LABOR_BALANCE
        EARTHEN_SHARD_BALANCE
        DONKEY_BALANCE
        KNIGHT_T1_BALANCE
        KNIGHT_T2_BALANCE
        KNIGHT_T3_BALANCE
        CROSSBOWMAN_T1_BALANCE
        CROSSBOWMAN_T2_BALANCE
        CROSSBOWMAN_T3_BALANCE
        PALADIN_T1_BALANCE
        PALADIN_T2_BALANCE
        PALADIN_T3_BALANCE
        WHEAT_BALANCE
        FISH_BALANCE
        LORDS_BALANCE
        STONE_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        COAL_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        WOOD_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        COPPER_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        IRONWOOD_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        OBSIDIAN_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        GOLD_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        SILVER_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        MITHRAL_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        ALCHEMICAL_SILVER_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        COLD_IRON_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        DEEP_CRYSTAL_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        RUBY_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        DIAMONDS_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        HARTWOOD_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        IGNIUM_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        TWILIGHT_QUARTZ_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        TRUE_ICE_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        ADAMANTINE_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        SAPPHIRE_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        ETHEREAL_SILICA_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        DRAGONHIDE_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        LABOR_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        EARTHEN_SHARD_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        DONKEY_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        KNIGHT_T1_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        KNIGHT_T2_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        KNIGHT_T3_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        CROSSBOWMAN_T1_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        CROSSBOWMAN_T2_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        CROSSBOWMAN_T3_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        PALADIN_T1_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        PALADIN_T2_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        PALADIN_T3_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        WHEAT_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        FISH_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
        LORDS_PRODUCTION {
          building_count
          production_rate
          output_amount_left
          last_updated_at
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetEntitiesResourcesQuery, GetEntitiesResourcesQueryVariables>;