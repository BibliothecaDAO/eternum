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

export type S0_Eternum_AcceptOrderOrder = {
  direction: OrderDirection;
  field: S0_Eternum_AcceptOrderOrderField;
};

export enum S0_Eternum_AcceptOrderOrderField {
  Id = 'ID',
  MakerId = 'MAKER_ID',
  TakerId = 'TAKER_ID',
  Timestamp = 'TIMESTAMP',
  TradeId = 'TRADE_ID'
}

export type S0_Eternum_AcceptOrderWhereInput = {
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

export type S0_Eternum_AcceptPartialOrderOrder = {
  direction: OrderDirection;
  field: S0_Eternum_AcceptPartialOrderOrderField;
};

export enum S0_Eternum_AcceptPartialOrderOrderField {
  MakerId = 'MAKER_ID',
  TakerId = 'TAKER_ID',
  Timestamp = 'TIMESTAMP',
  TradeId = 'TRADE_ID'
}

export type S0_Eternum_AcceptPartialOrderWhereInput = {
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

export type S0_Eternum_AddressNameOrder = {
  direction: OrderDirection;
  field: S0_Eternum_AddressNameOrderField;
};

export enum S0_Eternum_AddressNameOrderField {
  Address = 'ADDRESS',
  Name = 'NAME'
}

export type S0_Eternum_AddressNameWhereInput = {
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

export type S0_Eternum_ArmyOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ArmyOrderField;
};

export enum S0_Eternum_ArmyOrderField {
  BattleId = 'BATTLE_ID',
  BattleSide = 'BATTLE_SIDE',
  EntityId = 'ENTITY_ID',
  Troops = 'TROOPS'
}

export type S0_Eternum_ArmyWhereInput = {
  battle_id?: InputMaybe<Scalars['u32']['input']>;
  battle_idEQ?: InputMaybe<Scalars['u32']['input']>;
  battle_idGT?: InputMaybe<Scalars['u32']['input']>;
  battle_idGTE?: InputMaybe<Scalars['u32']['input']>;
  battle_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  battle_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  battle_idLT?: InputMaybe<Scalars['u32']['input']>;
  battle_idLTE?: InputMaybe<Scalars['u32']['input']>;
  battle_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  battle_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  battle_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  battle_side?: InputMaybe<Scalars['Enum']['input']>;
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
};

export type S0_Eternum_ArrivalTimeOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ArrivalTimeOrderField;
};

export enum S0_Eternum_ArrivalTimeOrderField {
  ArrivesAt = 'ARRIVES_AT',
  EntityId = 'ENTITY_ID'
}

export type S0_Eternum_ArrivalTimeWhereInput = {
  arrives_at?: InputMaybe<Scalars['u64']['input']>;
  arrives_atEQ?: InputMaybe<Scalars['u64']['input']>;
  arrives_atGT?: InputMaybe<Scalars['u64']['input']>;
  arrives_atGTE?: InputMaybe<Scalars['u64']['input']>;
  arrives_atIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  arrives_atLIKE?: InputMaybe<Scalars['u64']['input']>;
  arrives_atLT?: InputMaybe<Scalars['u64']['input']>;
  arrives_atLTE?: InputMaybe<Scalars['u64']['input']>;
  arrives_atNEQ?: InputMaybe<Scalars['u64']['input']>;
  arrives_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  arrives_atNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
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
};

export type S0_Eternum_BankConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_BankConfigOrderField;
};

export enum S0_Eternum_BankConfigOrderField {
  ConfigId = 'CONFIG_ID',
  LordsCost = 'LORDS_COST',
  LpFeeDenom = 'LP_FEE_DENOM',
  LpFeeNum = 'LP_FEE_NUM'
}

export type S0_Eternum_BankConfigWhereInput = {
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
  lords_cost?: InputMaybe<Scalars['u128']['input']>;
  lords_costEQ?: InputMaybe<Scalars['u128']['input']>;
  lords_costGT?: InputMaybe<Scalars['u128']['input']>;
  lords_costGTE?: InputMaybe<Scalars['u128']['input']>;
  lords_costIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lords_costLIKE?: InputMaybe<Scalars['u128']['input']>;
  lords_costLT?: InputMaybe<Scalars['u128']['input']>;
  lords_costLTE?: InputMaybe<Scalars['u128']['input']>;
  lords_costNEQ?: InputMaybe<Scalars['u128']['input']>;
  lords_costNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lords_costNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_denom?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_denomEQ?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_denomGT?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_denomGTE?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_denomIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lp_fee_denomLIKE?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_denomLT?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_denomLTE?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_denomNEQ?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_denomNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lp_fee_denomNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_num?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_numEQ?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_numGT?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_numGTE?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_numIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lp_fee_numLIKE?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_numLT?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_numLTE?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_numNEQ?: InputMaybe<Scalars['u128']['input']>;
  lp_fee_numNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lp_fee_numNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type S0_Eternum_BankOrder = {
  direction: OrderDirection;
  field: S0_Eternum_BankOrderField;
};

export enum S0_Eternum_BankOrderField {
  EntityId = 'ENTITY_ID',
  Exists = 'EXISTS',
  OwnerBridgeFeeDptPercent = 'OWNER_BRIDGE_FEE_DPT_PERCENT',
  OwnerBridgeFeeWtdrPercent = 'OWNER_BRIDGE_FEE_WTDR_PERCENT',
  OwnerFeeDenom = 'OWNER_FEE_DENOM',
  OwnerFeeNum = 'OWNER_FEE_NUM'
}

export type S0_Eternum_BankWhereInput = {
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
  exists?: InputMaybe<Scalars['bool']['input']>;
  owner_bridge_fee_dpt_percent?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_dpt_percentEQ?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_dpt_percentGT?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_dpt_percentGTE?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_dpt_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  owner_bridge_fee_dpt_percentLIKE?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_dpt_percentLT?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_dpt_percentLTE?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_dpt_percentNEQ?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_dpt_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  owner_bridge_fee_dpt_percentNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_wtdr_percent?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_wtdr_percentEQ?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_wtdr_percentGT?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_wtdr_percentGTE?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_wtdr_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  owner_bridge_fee_wtdr_percentLIKE?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_wtdr_percentLT?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_wtdr_percentLTE?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_wtdr_percentNEQ?: InputMaybe<Scalars['u16']['input']>;
  owner_bridge_fee_wtdr_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  owner_bridge_fee_wtdr_percentNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  owner_fee_denom?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_denomEQ?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_denomGT?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_denomGTE?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_denomIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  owner_fee_denomLIKE?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_denomLT?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_denomLTE?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_denomNEQ?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_denomNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  owner_fee_denomNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_num?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_numEQ?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_numGT?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_numGTE?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_numIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  owner_fee_numLIKE?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_numLT?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_numLTE?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_numNEQ?: InputMaybe<Scalars['u128']['input']>;
  owner_fee_numNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  owner_fee_numNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type S0_Eternum_BattleClaimDataOrder = {
  direction: OrderDirection;
  field: S0_Eternum_BattleClaimDataOrderField;
};

export enum S0_Eternum_BattleClaimDataOrderField {
  ClaimeeAddress = 'CLAIMEE_ADDRESS',
  ClaimeeName = 'CLAIMEE_NAME',
  Claimer = 'CLAIMER',
  ClaimerArmyEntityId = 'CLAIMER_ARMY_ENTITY_ID',
  ClaimerName = 'CLAIMER_NAME',
  EventId = 'EVENT_ID',
  Id = 'ID',
  StructureEntityId = 'STRUCTURE_ENTITY_ID',
  StructureType = 'STRUCTURE_TYPE',
  Timestamp = 'TIMESTAMP',
  X = 'X',
  Y = 'Y'
}

export type S0_Eternum_BattleClaimDataWhereInput = {
  claimee_address?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimee_addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimee_addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimee_addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimee_addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  claimee_addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimee_addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimee_addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimee_addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimee_addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  claimee_addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimee_name?: InputMaybe<Scalars['felt252']['input']>;
  claimee_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  claimee_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  claimee_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  claimee_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  claimee_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  claimee_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  claimee_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  claimee_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  claimee_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  claimee_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  claimer?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimerEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimerGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimerGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimerIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  claimerLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimerLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimerLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimerNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimerNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  claimerNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  claimer_army_entity_id?: InputMaybe<Scalars['u32']['input']>;
  claimer_army_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  claimer_army_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  claimer_army_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  claimer_army_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  claimer_army_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  claimer_army_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  claimer_army_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  claimer_army_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  claimer_army_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  claimer_army_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  claimer_name?: InputMaybe<Scalars['felt252']['input']>;
  claimer_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  claimer_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  claimer_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  claimer_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  claimer_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  claimer_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  claimer_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  claimer_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  claimer_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  claimer_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  event_id?: InputMaybe<Scalars['Enum']['input']>;
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
  structure_entity_id?: InputMaybe<Scalars['u32']['input']>;
  structure_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  structure_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  structure_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  structure_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  structure_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  structure_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  structure_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  structure_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  structure_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  structure_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  structure_type?: InputMaybe<Scalars['Enum']['input']>;
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

export type S0_Eternum_BattleConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_BattleConfigOrderField;
};

export enum S0_Eternum_BattleConfigOrderField {
  BattleDelaySeconds = 'BATTLE_DELAY_SECONDS',
  ConfigId = 'CONFIG_ID',
  HyperstructureImmunityTicks = 'HYPERSTRUCTURE_IMMUNITY_TICKS',
  RegularImmunityTicks = 'REGULAR_IMMUNITY_TICKS'
}

export type S0_Eternum_BattleConfigWhereInput = {
  battle_delay_seconds?: InputMaybe<Scalars['u64']['input']>;
  battle_delay_secondsEQ?: InputMaybe<Scalars['u64']['input']>;
  battle_delay_secondsGT?: InputMaybe<Scalars['u64']['input']>;
  battle_delay_secondsGTE?: InputMaybe<Scalars['u64']['input']>;
  battle_delay_secondsIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  battle_delay_secondsLIKE?: InputMaybe<Scalars['u64']['input']>;
  battle_delay_secondsLT?: InputMaybe<Scalars['u64']['input']>;
  battle_delay_secondsLTE?: InputMaybe<Scalars['u64']['input']>;
  battle_delay_secondsNEQ?: InputMaybe<Scalars['u64']['input']>;
  battle_delay_secondsNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  battle_delay_secondsNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
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

export type S0_Eternum_BattleJoinDataOrder = {
  direction: OrderDirection;
  field: S0_Eternum_BattleJoinDataOrderField;
};

export enum S0_Eternum_BattleJoinDataOrderField {
  BattleEntityId = 'BATTLE_ENTITY_ID',
  DurationLeft = 'DURATION_LEFT',
  EventId = 'EVENT_ID',
  Id = 'ID',
  Joiner = 'JOINER',
  JoinerArmyEntityId = 'JOINER_ARMY_ENTITY_ID',
  JoinerName = 'JOINER_NAME',
  JoinerSide = 'JOINER_SIDE',
  Timestamp = 'TIMESTAMP',
  X = 'X',
  Y = 'Y'
}

export type S0_Eternum_BattleJoinDataWhereInput = {
  battle_entity_id?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  battle_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  battle_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  duration_left?: InputMaybe<Scalars['u64']['input']>;
  duration_leftEQ?: InputMaybe<Scalars['u64']['input']>;
  duration_leftGT?: InputMaybe<Scalars['u64']['input']>;
  duration_leftGTE?: InputMaybe<Scalars['u64']['input']>;
  duration_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  duration_leftLIKE?: InputMaybe<Scalars['u64']['input']>;
  duration_leftLT?: InputMaybe<Scalars['u64']['input']>;
  duration_leftLTE?: InputMaybe<Scalars['u64']['input']>;
  duration_leftNEQ?: InputMaybe<Scalars['u64']['input']>;
  duration_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  duration_leftNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  event_id?: InputMaybe<Scalars['Enum']['input']>;
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
  joiner?: InputMaybe<Scalars['ContractAddress']['input']>;
  joinerEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  joinerGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  joinerGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  joinerIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  joinerLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  joinerLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  joinerLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  joinerNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  joinerNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  joinerNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  joiner_army_entity_id?: InputMaybe<Scalars['u32']['input']>;
  joiner_army_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  joiner_army_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  joiner_army_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  joiner_army_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  joiner_army_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  joiner_army_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  joiner_army_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  joiner_army_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  joiner_army_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  joiner_army_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  joiner_name?: InputMaybe<Scalars['felt252']['input']>;
  joiner_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  joiner_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  joiner_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  joiner_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  joiner_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  joiner_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  joiner_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  joiner_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  joiner_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  joiner_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  joiner_side?: InputMaybe<Scalars['Enum']['input']>;
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

export type S0_Eternum_BattleLeaveDataOrder = {
  direction: OrderDirection;
  field: S0_Eternum_BattleLeaveDataOrderField;
};

export enum S0_Eternum_BattleLeaveDataOrderField {
  BattleEntityId = 'BATTLE_ENTITY_ID',
  DurationLeft = 'DURATION_LEFT',
  EventId = 'EVENT_ID',
  Id = 'ID',
  Leaver = 'LEAVER',
  LeaverArmyEntityId = 'LEAVER_ARMY_ENTITY_ID',
  LeaverName = 'LEAVER_NAME',
  LeaverSide = 'LEAVER_SIDE',
  Timestamp = 'TIMESTAMP',
  X = 'X',
  Y = 'Y'
}

export type S0_Eternum_BattleLeaveDataWhereInput = {
  battle_entity_id?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  battle_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  battle_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  duration_left?: InputMaybe<Scalars['u64']['input']>;
  duration_leftEQ?: InputMaybe<Scalars['u64']['input']>;
  duration_leftGT?: InputMaybe<Scalars['u64']['input']>;
  duration_leftGTE?: InputMaybe<Scalars['u64']['input']>;
  duration_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  duration_leftLIKE?: InputMaybe<Scalars['u64']['input']>;
  duration_leftLT?: InputMaybe<Scalars['u64']['input']>;
  duration_leftLTE?: InputMaybe<Scalars['u64']['input']>;
  duration_leftNEQ?: InputMaybe<Scalars['u64']['input']>;
  duration_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  duration_leftNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  event_id?: InputMaybe<Scalars['Enum']['input']>;
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
  leaver?: InputMaybe<Scalars['ContractAddress']['input']>;
  leaverEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  leaverGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  leaverGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  leaverIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  leaverLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  leaverLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  leaverLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  leaverNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  leaverNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  leaverNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  leaver_army_entity_id?: InputMaybe<Scalars['u32']['input']>;
  leaver_army_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  leaver_army_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  leaver_army_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  leaver_army_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  leaver_army_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  leaver_army_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  leaver_army_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  leaver_army_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  leaver_army_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  leaver_army_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  leaver_name?: InputMaybe<Scalars['felt252']['input']>;
  leaver_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  leaver_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  leaver_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  leaver_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  leaver_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  leaver_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  leaver_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  leaver_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  leaver_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  leaver_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  leaver_side?: InputMaybe<Scalars['Enum']['input']>;
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

export type S0_Eternum_BattleOrder = {
  direction: OrderDirection;
  field: S0_Eternum_BattleOrderField;
};

export enum S0_Eternum_BattleOrderField {
  AttackersResourcesEscrowId = 'ATTACKERS_RESOURCES_ESCROW_ID',
  AttackArmy = 'ATTACK_ARMY',
  AttackArmyHealth = 'ATTACK_ARMY_HEALTH',
  AttackArmyLifetime = 'ATTACK_ARMY_LIFETIME',
  AttackDelta = 'ATTACK_DELTA',
  DefenceArmy = 'DEFENCE_ARMY',
  DefenceArmyHealth = 'DEFENCE_ARMY_HEALTH',
  DefenceArmyLifetime = 'DEFENCE_ARMY_LIFETIME',
  DefenceDelta = 'DEFENCE_DELTA',
  DefendersResourcesEscrowId = 'DEFENDERS_RESOURCES_ESCROW_ID',
  DurationLeft = 'DURATION_LEFT',
  EntityId = 'ENTITY_ID',
  LastUpdated = 'LAST_UPDATED',
  StartAt = 'START_AT'
}

export type S0_Eternum_BattlePillageDataOrder = {
  direction: OrderDirection;
  field: S0_Eternum_BattlePillageDataOrderField;
};

export enum S0_Eternum_BattlePillageDataOrderField {
  AttackerLostTroops = 'ATTACKER_LOST_TROOPS',
  DestroyedBuildingCategory = 'DESTROYED_BUILDING_CATEGORY',
  EventId = 'EVENT_ID',
  Id = 'ID',
  PillagedResources = 'PILLAGED_RESOURCES',
  PillagedStructureEntityId = 'PILLAGED_STRUCTURE_ENTITY_ID',
  PillagedStructureOwner = 'PILLAGED_STRUCTURE_OWNER',
  PillagedStructureOwnerName = 'PILLAGED_STRUCTURE_OWNER_NAME',
  Pillager = 'PILLAGER',
  PillagerArmyEntityId = 'PILLAGER_ARMY_ENTITY_ID',
  PillagerName = 'PILLAGER_NAME',
  PillagerRealmEntityId = 'PILLAGER_REALM_ENTITY_ID',
  StructureLostTroops = 'STRUCTURE_LOST_TROOPS',
  StructureType = 'STRUCTURE_TYPE',
  Timestamp = 'TIMESTAMP',
  Winner = 'WINNER',
  X = 'X',
  Y = 'Y'
}

export type S0_Eternum_BattlePillageDataWhereInput = {
  destroyed_building_category?: InputMaybe<Scalars['Enum']['input']>;
  event_id?: InputMaybe<Scalars['Enum']['input']>;
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
  pillaged_structure_entity_id?: InputMaybe<Scalars['u32']['input']>;
  pillaged_structure_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  pillaged_structure_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  pillaged_structure_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  pillaged_structure_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  pillaged_structure_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  pillaged_structure_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  pillaged_structure_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  pillaged_structure_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  pillaged_structure_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  pillaged_structure_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  pillaged_structure_owner?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillaged_structure_ownerEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillaged_structure_ownerGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillaged_structure_ownerGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillaged_structure_ownerIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  pillaged_structure_ownerLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillaged_structure_ownerLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillaged_structure_ownerLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillaged_structure_ownerNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillaged_structure_ownerNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  pillaged_structure_ownerNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillaged_structure_owner_name?: InputMaybe<Scalars['felt252']['input']>;
  pillaged_structure_owner_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  pillaged_structure_owner_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  pillaged_structure_owner_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  pillaged_structure_owner_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  pillaged_structure_owner_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  pillaged_structure_owner_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  pillaged_structure_owner_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  pillaged_structure_owner_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  pillaged_structure_owner_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  pillaged_structure_owner_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  pillager?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillagerEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillagerGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillagerGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillagerIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  pillagerLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillagerLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillagerLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillagerNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillagerNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  pillagerNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  pillager_army_entity_id?: InputMaybe<Scalars['u32']['input']>;
  pillager_army_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  pillager_army_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  pillager_army_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  pillager_army_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  pillager_army_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  pillager_army_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  pillager_army_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  pillager_army_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  pillager_army_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  pillager_army_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  pillager_name?: InputMaybe<Scalars['felt252']['input']>;
  pillager_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  pillager_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  pillager_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  pillager_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  pillager_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  pillager_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  pillager_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  pillager_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  pillager_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  pillager_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  pillager_realm_entity_id?: InputMaybe<Scalars['u32']['input']>;
  pillager_realm_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  pillager_realm_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  pillager_realm_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  pillager_realm_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  pillager_realm_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  pillager_realm_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  pillager_realm_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  pillager_realm_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  pillager_realm_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  pillager_realm_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  structure_type?: InputMaybe<Scalars['Enum']['input']>;
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
  winner?: InputMaybe<Scalars['Enum']['input']>;
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

export type S0_Eternum_BattleStartDataOrder = {
  direction: OrderDirection;
  field: S0_Eternum_BattleStartDataOrderField;
};

export enum S0_Eternum_BattleStartDataOrderField {
  Attacker = 'ATTACKER',
  AttackerArmyEntityId = 'ATTACKER_ARMY_ENTITY_ID',
  AttackerName = 'ATTACKER_NAME',
  BattleEntityId = 'BATTLE_ENTITY_ID',
  Defender = 'DEFENDER',
  DefenderArmyEntityId = 'DEFENDER_ARMY_ENTITY_ID',
  DefenderName = 'DEFENDER_NAME',
  DurationLeft = 'DURATION_LEFT',
  EventId = 'EVENT_ID',
  Id = 'ID',
  StructureType = 'STRUCTURE_TYPE',
  Timestamp = 'TIMESTAMP',
  X = 'X',
  Y = 'Y'
}

export type S0_Eternum_BattleStartDataWhereInput = {
  attacker?: InputMaybe<Scalars['ContractAddress']['input']>;
  attackerEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  attackerGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  attackerGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  attackerIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  attackerLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  attackerLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  attackerLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  attackerNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  attackerNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  attackerNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  attacker_army_entity_id?: InputMaybe<Scalars['u32']['input']>;
  attacker_army_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  attacker_army_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  attacker_army_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  attacker_army_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  attacker_army_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  attacker_army_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  attacker_army_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  attacker_army_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  attacker_army_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  attacker_army_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  attacker_name?: InputMaybe<Scalars['felt252']['input']>;
  attacker_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  attacker_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  attacker_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  attacker_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  attacker_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  attacker_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  attacker_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  attacker_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  attacker_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  attacker_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  battle_entity_id?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  battle_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  battle_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  battle_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  defender?: InputMaybe<Scalars['ContractAddress']['input']>;
  defenderEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  defenderGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  defenderGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  defenderIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  defenderLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  defenderLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  defenderLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  defenderNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  defenderNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  defenderNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  defender_army_entity_id?: InputMaybe<Scalars['u32']['input']>;
  defender_army_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  defender_army_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  defender_army_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  defender_army_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  defender_army_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  defender_army_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  defender_army_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  defender_army_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  defender_army_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  defender_army_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  defender_name?: InputMaybe<Scalars['felt252']['input']>;
  defender_nameEQ?: InputMaybe<Scalars['felt252']['input']>;
  defender_nameGT?: InputMaybe<Scalars['felt252']['input']>;
  defender_nameGTE?: InputMaybe<Scalars['felt252']['input']>;
  defender_nameIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  defender_nameLIKE?: InputMaybe<Scalars['felt252']['input']>;
  defender_nameLT?: InputMaybe<Scalars['felt252']['input']>;
  defender_nameLTE?: InputMaybe<Scalars['felt252']['input']>;
  defender_nameNEQ?: InputMaybe<Scalars['felt252']['input']>;
  defender_nameNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  defender_nameNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  duration_left?: InputMaybe<Scalars['u64']['input']>;
  duration_leftEQ?: InputMaybe<Scalars['u64']['input']>;
  duration_leftGT?: InputMaybe<Scalars['u64']['input']>;
  duration_leftGTE?: InputMaybe<Scalars['u64']['input']>;
  duration_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  duration_leftLIKE?: InputMaybe<Scalars['u64']['input']>;
  duration_leftLT?: InputMaybe<Scalars['u64']['input']>;
  duration_leftLTE?: InputMaybe<Scalars['u64']['input']>;
  duration_leftNEQ?: InputMaybe<Scalars['u64']['input']>;
  duration_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  duration_leftNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  event_id?: InputMaybe<Scalars['Enum']['input']>;
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
  structure_type?: InputMaybe<Scalars['Enum']['input']>;
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

export type S0_Eternum_BattleWhereInput = {
  attack_delta?: InputMaybe<Scalars['u64']['input']>;
  attack_deltaEQ?: InputMaybe<Scalars['u64']['input']>;
  attack_deltaGT?: InputMaybe<Scalars['u64']['input']>;
  attack_deltaGTE?: InputMaybe<Scalars['u64']['input']>;
  attack_deltaIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  attack_deltaLIKE?: InputMaybe<Scalars['u64']['input']>;
  attack_deltaLT?: InputMaybe<Scalars['u64']['input']>;
  attack_deltaLTE?: InputMaybe<Scalars['u64']['input']>;
  attack_deltaNEQ?: InputMaybe<Scalars['u64']['input']>;
  attack_deltaNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  attack_deltaNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  attackers_resources_escrow_id?: InputMaybe<Scalars['u32']['input']>;
  attackers_resources_escrow_idEQ?: InputMaybe<Scalars['u32']['input']>;
  attackers_resources_escrow_idGT?: InputMaybe<Scalars['u32']['input']>;
  attackers_resources_escrow_idGTE?: InputMaybe<Scalars['u32']['input']>;
  attackers_resources_escrow_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  attackers_resources_escrow_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  attackers_resources_escrow_idLT?: InputMaybe<Scalars['u32']['input']>;
  attackers_resources_escrow_idLTE?: InputMaybe<Scalars['u32']['input']>;
  attackers_resources_escrow_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  attackers_resources_escrow_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  attackers_resources_escrow_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  defence_delta?: InputMaybe<Scalars['u64']['input']>;
  defence_deltaEQ?: InputMaybe<Scalars['u64']['input']>;
  defence_deltaGT?: InputMaybe<Scalars['u64']['input']>;
  defence_deltaGTE?: InputMaybe<Scalars['u64']['input']>;
  defence_deltaIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  defence_deltaLIKE?: InputMaybe<Scalars['u64']['input']>;
  defence_deltaLT?: InputMaybe<Scalars['u64']['input']>;
  defence_deltaLTE?: InputMaybe<Scalars['u64']['input']>;
  defence_deltaNEQ?: InputMaybe<Scalars['u64']['input']>;
  defence_deltaNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  defence_deltaNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  defenders_resources_escrow_id?: InputMaybe<Scalars['u32']['input']>;
  defenders_resources_escrow_idEQ?: InputMaybe<Scalars['u32']['input']>;
  defenders_resources_escrow_idGT?: InputMaybe<Scalars['u32']['input']>;
  defenders_resources_escrow_idGTE?: InputMaybe<Scalars['u32']['input']>;
  defenders_resources_escrow_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  defenders_resources_escrow_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  defenders_resources_escrow_idLT?: InputMaybe<Scalars['u32']['input']>;
  defenders_resources_escrow_idLTE?: InputMaybe<Scalars['u32']['input']>;
  defenders_resources_escrow_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  defenders_resources_escrow_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  defenders_resources_escrow_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  duration_left?: InputMaybe<Scalars['u64']['input']>;
  duration_leftEQ?: InputMaybe<Scalars['u64']['input']>;
  duration_leftGT?: InputMaybe<Scalars['u64']['input']>;
  duration_leftGTE?: InputMaybe<Scalars['u64']['input']>;
  duration_leftIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  duration_leftLIKE?: InputMaybe<Scalars['u64']['input']>;
  duration_leftLT?: InputMaybe<Scalars['u64']['input']>;
  duration_leftLTE?: InputMaybe<Scalars['u64']['input']>;
  duration_leftNEQ?: InputMaybe<Scalars['u64']['input']>;
  duration_leftNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  duration_leftNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
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
  last_updated?: InputMaybe<Scalars['u64']['input']>;
  last_updatedEQ?: InputMaybe<Scalars['u64']['input']>;
  last_updatedGT?: InputMaybe<Scalars['u64']['input']>;
  last_updatedGTE?: InputMaybe<Scalars['u64']['input']>;
  last_updatedIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  last_updatedLIKE?: InputMaybe<Scalars['u64']['input']>;
  last_updatedLT?: InputMaybe<Scalars['u64']['input']>;
  last_updatedLTE?: InputMaybe<Scalars['u64']['input']>;
  last_updatedNEQ?: InputMaybe<Scalars['u64']['input']>;
  last_updatedNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  last_updatedNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
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

export type S0_Eternum_BuildingCategoryPopConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_BuildingCategoryPopConfigOrderField;
};

export enum S0_Eternum_BuildingCategoryPopConfigOrderField {
  BuildingCategory = 'BUILDING_CATEGORY',
  Capacity = 'CAPACITY',
  ConfigId = 'CONFIG_ID',
  Population = 'POPULATION'
}

export type S0_Eternum_BuildingCategoryPopConfigWhereInput = {
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

export type S0_Eternum_BuildingConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_BuildingConfigOrderField;
};

export enum S0_Eternum_BuildingConfigOrderField {
  Category = 'CATEGORY',
  ConfigId = 'CONFIG_ID',
  ResourceCostCount = 'RESOURCE_COST_COUNT',
  ResourceCostId = 'RESOURCE_COST_ID',
  ResourceType = 'RESOURCE_TYPE'
}

export type S0_Eternum_BuildingConfigWhereInput = {
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

export type S0_Eternum_BuildingGeneralConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_BuildingGeneralConfigOrderField;
};

export enum S0_Eternum_BuildingGeneralConfigOrderField {
  BaseCostPercentIncrease = 'BASE_COST_PERCENT_INCREASE',
  ConfigId = 'CONFIG_ID'
}

export type S0_Eternum_BuildingGeneralConfigWhereInput = {
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
};

export type S0_Eternum_BuildingOrder = {
  direction: OrderDirection;
  field: S0_Eternum_BuildingOrderField;
};

export enum S0_Eternum_BuildingOrderField {
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

export type S0_Eternum_BuildingQuantityv2Order = {
  direction: OrderDirection;
  field: S0_Eternum_BuildingQuantityv2OrderField;
};

export enum S0_Eternum_BuildingQuantityv2OrderField {
  Category = 'CATEGORY',
  EntityId = 'ENTITY_ID',
  Value = 'VALUE'
}

export type S0_Eternum_BuildingQuantityv2WhereInput = {
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
  value?: InputMaybe<Scalars['u8']['input']>;
  valueEQ?: InputMaybe<Scalars['u8']['input']>;
  valueGT?: InputMaybe<Scalars['u8']['input']>;
  valueGTE?: InputMaybe<Scalars['u8']['input']>;
  valueIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  valueLIKE?: InputMaybe<Scalars['u8']['input']>;
  valueLT?: InputMaybe<Scalars['u8']['input']>;
  valueLTE?: InputMaybe<Scalars['u8']['input']>;
  valueNEQ?: InputMaybe<Scalars['u8']['input']>;
  valueNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  valueNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S0_Eternum_BuildingWhereInput = {
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

export type S0_Eternum_BurnDonkeyOrder = {
  direction: OrderDirection;
  field: S0_Eternum_BurnDonkeyOrderField;
};

export enum S0_Eternum_BurnDonkeyOrderField {
  Amount = 'AMOUNT',
  EntityId = 'ENTITY_ID',
  PlayerAddress = 'PLAYER_ADDRESS',
  Timestamp = 'TIMESTAMP'
}

export type S0_Eternum_BurnDonkeyWhereInput = {
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

export type S0_Eternum_CancelOrderOrder = {
  direction: OrderDirection;
  field: S0_Eternum_CancelOrderOrderField;
};

export enum S0_Eternum_CancelOrderOrderField {
  MakerId = 'MAKER_ID',
  TakerId = 'TAKER_ID',
  Timestamp = 'TIMESTAMP',
  TradeId = 'TRADE_ID'
}

export type S0_Eternum_CancelOrderWhereInput = {
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

export type S0_Eternum_CapacityCategoryOrder = {
  direction: OrderDirection;
  field: S0_Eternum_CapacityCategoryOrderField;
};

export enum S0_Eternum_CapacityCategoryOrderField {
  Category = 'CATEGORY',
  EntityId = 'ENTITY_ID'
}

export type S0_Eternum_CapacityCategoryWhereInput = {
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
};

export type S0_Eternum_CapacityConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_CapacityConfigOrderField;
};

export enum S0_Eternum_CapacityConfigOrderField {
  Category = 'CATEGORY',
  WeightGram = 'WEIGHT_GRAM'
}

export type S0_Eternum_CapacityConfigWhereInput = {
  category?: InputMaybe<Scalars['Enum']['input']>;
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

export type S0_Eternum_ContributionOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ContributionOrderField;
};

export enum S0_Eternum_ContributionOrderField {
  Amount = 'AMOUNT',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  PlayerAddress = 'PLAYER_ADDRESS',
  ResourceType = 'RESOURCE_TYPE'
}

export type S0_Eternum_ContributionWhereInput = {
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

export type S0_Eternum_CreateGuildOrder = {
  direction: OrderDirection;
  field: S0_Eternum_CreateGuildOrderField;
};

export enum S0_Eternum_CreateGuildOrderField {
  GuildEntityId = 'GUILD_ENTITY_ID',
  GuildName = 'GUILD_NAME',
  Timestamp = 'TIMESTAMP'
}

export type S0_Eternum_CreateGuildWhereInput = {
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

export type S0_Eternum_CreateOrderOrder = {
  direction: OrderDirection;
  field: S0_Eternum_CreateOrderOrderField;
};

export enum S0_Eternum_CreateOrderOrderField {
  MakerId = 'MAKER_ID',
  TakerId = 'TAKER_ID',
  Timestamp = 'TIMESTAMP',
  TradeId = 'TRADE_ID'
}

export type S0_Eternum_CreateOrderWhereInput = {
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

export type S0_Eternum_DetachedResourceOrder = {
  direction: OrderDirection;
  field: S0_Eternum_DetachedResourceOrderField;
};

export enum S0_Eternum_DetachedResourceOrderField {
  EntityId = 'ENTITY_ID',
  Index = 'INDEX',
  ResourceAmount = 'RESOURCE_AMOUNT',
  ResourceType = 'RESOURCE_TYPE'
}

export type S0_Eternum_DetachedResourceWhereInput = {
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

export type S0_Eternum_EntityNameOrder = {
  direction: OrderDirection;
  field: S0_Eternum_EntityNameOrderField;
};

export enum S0_Eternum_EntityNameOrderField {
  EntityId = 'ENTITY_ID',
  Name = 'NAME'
}

export type S0_Eternum_EntityNameWhereInput = {
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

export type S0_Eternum_EntityOwnerOrder = {
  direction: OrderDirection;
  field: S0_Eternum_EntityOwnerOrderField;
};

export enum S0_Eternum_EntityOwnerOrderField {
  EntityId = 'ENTITY_ID',
  EntityOwnerId = 'ENTITY_OWNER_ID'
}

export type S0_Eternum_EntityOwnerWhereInput = {
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
  entity_owner_id?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_owner_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_owner_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S0_Eternum_EpochOrder = {
  direction: OrderDirection;
  field: S0_Eternum_EpochOrderField;
};

export enum S0_Eternum_EpochOrderField {
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  Index = 'INDEX',
  Owners = 'OWNERS',
  StartTimestamp = 'START_TIMESTAMP'
}

export type S0_Eternum_EpochWhereInput = {
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

export type S0_Eternum_FragmentMineDiscoveredOrder = {
  direction: OrderDirection;
  field: S0_Eternum_FragmentMineDiscoveredOrderField;
};

export enum S0_Eternum_FragmentMineDiscoveredOrderField {
  DiscoveredAt = 'DISCOVERED_AT',
  EntityOwnerId = 'ENTITY_OWNER_ID',
  MineEntityId = 'MINE_ENTITY_ID',
  ProductionDeadlineTick = 'PRODUCTION_DEADLINE_TICK'
}

export type S0_Eternum_FragmentMineDiscoveredWhereInput = {
  discovered_at?: InputMaybe<Scalars['u64']['input']>;
  discovered_atEQ?: InputMaybe<Scalars['u64']['input']>;
  discovered_atGT?: InputMaybe<Scalars['u64']['input']>;
  discovered_atGTE?: InputMaybe<Scalars['u64']['input']>;
  discovered_atIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  discovered_atLIKE?: InputMaybe<Scalars['u64']['input']>;
  discovered_atLT?: InputMaybe<Scalars['u64']['input']>;
  discovered_atLTE?: InputMaybe<Scalars['u64']['input']>;
  discovered_atNEQ?: InputMaybe<Scalars['u64']['input']>;
  discovered_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  discovered_atNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  entity_owner_id?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_owner_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_owner_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  mine_entity_id?: InputMaybe<Scalars['u32']['input']>;
  mine_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  mine_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  mine_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  mine_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  mine_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  mine_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  mine_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  mine_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  mine_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  mine_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  production_deadline_tick?: InputMaybe<Scalars['u64']['input']>;
  production_deadline_tickEQ?: InputMaybe<Scalars['u64']['input']>;
  production_deadline_tickGT?: InputMaybe<Scalars['u64']['input']>;
  production_deadline_tickGTE?: InputMaybe<Scalars['u64']['input']>;
  production_deadline_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_deadline_tickLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_deadline_tickLT?: InputMaybe<Scalars['u64']['input']>;
  production_deadline_tickLTE?: InputMaybe<Scalars['u64']['input']>;
  production_deadline_tickNEQ?: InputMaybe<Scalars['u64']['input']>;
  production_deadline_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  production_deadline_tickNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S0_Eternum_GameEndedOrder = {
  direction: OrderDirection;
  field: S0_Eternum_GameEndedOrderField;
};

export enum S0_Eternum_GameEndedOrderField {
  Timestamp = 'TIMESTAMP',
  WinnerAddress = 'WINNER_ADDRESS'
}

export type S0_Eternum_GameEndedWhereInput = {
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

export type S0_Eternum_GuildMemberOrder = {
  direction: OrderDirection;
  field: S0_Eternum_GuildMemberOrderField;
};

export enum S0_Eternum_GuildMemberOrderField {
  Address = 'ADDRESS',
  GuildEntityId = 'GUILD_ENTITY_ID'
}

export type S0_Eternum_GuildMemberWhereInput = {
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

export type S0_Eternum_GuildOrder = {
  direction: OrderDirection;
  field: S0_Eternum_GuildOrderField;
};

export enum S0_Eternum_GuildOrderField {
  EntityId = 'ENTITY_ID',
  IsPublic = 'IS_PUBLIC',
  MemberCount = 'MEMBER_COUNT'
}

export type S0_Eternum_GuildWhereInput = {
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
};

export type S0_Eternum_GuildWhitelistOrder = {
  direction: OrderDirection;
  field: S0_Eternum_GuildWhitelistOrderField;
};

export enum S0_Eternum_GuildWhitelistOrderField {
  Address = 'ADDRESS',
  GuildEntityId = 'GUILD_ENTITY_ID',
  IsWhitelisted = 'IS_WHITELISTED'
}

export type S0_Eternum_GuildWhitelistWhereInput = {
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

export type S0_Eternum_HealthOrder = {
  direction: OrderDirection;
  field: S0_Eternum_HealthOrderField;
};

export enum S0_Eternum_HealthOrderField {
  Current = 'CURRENT',
  EntityId = 'ENTITY_ID',
  Lifetime = 'LIFETIME'
}

export type S0_Eternum_HealthWhereInput = {
  current?: InputMaybe<Scalars['u128']['input']>;
  currentEQ?: InputMaybe<Scalars['u128']['input']>;
  currentGT?: InputMaybe<Scalars['u128']['input']>;
  currentGTE?: InputMaybe<Scalars['u128']['input']>;
  currentIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  currentLIKE?: InputMaybe<Scalars['u128']['input']>;
  currentLT?: InputMaybe<Scalars['u128']['input']>;
  currentLTE?: InputMaybe<Scalars['u128']['input']>;
  currentNEQ?: InputMaybe<Scalars['u128']['input']>;
  currentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  currentNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
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
  lifetime?: InputMaybe<Scalars['u128']['input']>;
  lifetimeEQ?: InputMaybe<Scalars['u128']['input']>;
  lifetimeGT?: InputMaybe<Scalars['u128']['input']>;
  lifetimeGTE?: InputMaybe<Scalars['u128']['input']>;
  lifetimeIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lifetimeLIKE?: InputMaybe<Scalars['u128']['input']>;
  lifetimeLT?: InputMaybe<Scalars['u128']['input']>;
  lifetimeLTE?: InputMaybe<Scalars['u128']['input']>;
  lifetimeNEQ?: InputMaybe<Scalars['u128']['input']>;
  lifetimeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  lifetimeNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type S0_Eternum_HyperstructureCoOwnersChangeOrder = {
  direction: OrderDirection;
  field: S0_Eternum_HyperstructureCoOwnersChangeOrderField;
};

export enum S0_Eternum_HyperstructureCoOwnersChangeOrderField {
  CoOwners = 'CO_OWNERS',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  Id = 'ID',
  Timestamp = 'TIMESTAMP'
}

export type S0_Eternum_HyperstructureCoOwnersChangeWhereInput = {
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

export type S0_Eternum_HyperstructureConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_HyperstructureConfigOrderField;
};

export enum S0_Eternum_HyperstructureConfigOrderField {
  ConfigId = 'CONFIG_ID',
  PointsForWin = 'POINTS_FOR_WIN',
  PointsOnCompletion = 'POINTS_ON_COMPLETION',
  PointsPerCycle = 'POINTS_PER_CYCLE',
  TimeBetweenSharesChange = 'TIME_BETWEEN_SHARES_CHANGE'
}

export type S0_Eternum_HyperstructureConfigWhereInput = {
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

export type S0_Eternum_HyperstructureContributionOrder = {
  direction: OrderDirection;
  field: S0_Eternum_HyperstructureContributionOrderField;
};

export enum S0_Eternum_HyperstructureContributionOrderField {
  Contributions = 'CONTRIBUTIONS',
  ContributorEntityId = 'CONTRIBUTOR_ENTITY_ID',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  Id = 'ID',
  Timestamp = 'TIMESTAMP'
}

export type S0_Eternum_HyperstructureContributionWhereInput = {
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

export type S0_Eternum_HyperstructureFinishedOrder = {
  direction: OrderDirection;
  field: S0_Eternum_HyperstructureFinishedOrderField;
};

export enum S0_Eternum_HyperstructureFinishedOrderField {
  ContributorEntityId = 'CONTRIBUTOR_ENTITY_ID',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  HyperstructureOwnerName = 'HYPERSTRUCTURE_OWNER_NAME',
  Id = 'ID',
  Timestamp = 'TIMESTAMP'
}

export type S0_Eternum_HyperstructureFinishedWhereInput = {
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

export type S0_Eternum_HyperstructureOrder = {
  direction: OrderDirection;
  field: S0_Eternum_HyperstructureOrderField;
};

export enum S0_Eternum_HyperstructureOrderField {
  Access = 'ACCESS',
  Completed = 'COMPLETED',
  CurrentEpoch = 'CURRENT_EPOCH',
  EntityId = 'ENTITY_ID',
  LastUpdatedBy = 'LAST_UPDATED_BY',
  LastUpdatedTimestamp = 'LAST_UPDATED_TIMESTAMP',
  Randomness = 'RANDOMNESS'
}

export type S0_Eternum_HyperstructureResourceConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_HyperstructureResourceConfigOrderField;
};

export enum S0_Eternum_HyperstructureResourceConfigOrderField {
  ConfigId = 'CONFIG_ID',
  MaxAmount = 'MAX_AMOUNT',
  MinAmount = 'MIN_AMOUNT',
  ResourceTier = 'RESOURCE_TIER'
}

export type S0_Eternum_HyperstructureResourceConfigWhereInput = {
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

export type S0_Eternum_HyperstructureStartedOrder = {
  direction: OrderDirection;
  field: S0_Eternum_HyperstructureStartedOrderField;
};

export enum S0_Eternum_HyperstructureStartedOrderField {
  CreatorAddressName = 'CREATOR_ADDRESS_NAME',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  Id = 'ID',
  Timestamp = 'TIMESTAMP'
}

export type S0_Eternum_HyperstructureStartedWhereInput = {
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

export type S0_Eternum_HyperstructureWhereInput = {
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

export type S0_Eternum_JoinGuildOrder = {
  direction: OrderDirection;
  field: S0_Eternum_JoinGuildOrderField;
};

export enum S0_Eternum_JoinGuildOrderField {
  Address = 'ADDRESS',
  GuildEntityId = 'GUILD_ENTITY_ID',
  GuildName = 'GUILD_NAME',
  Timestamp = 'TIMESTAMP'
}

export type S0_Eternum_JoinGuildWhereInput = {
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

export type S0_Eternum_LeaderboardEntryOrder = {
  direction: OrderDirection;
  field: S0_Eternum_LeaderboardEntryOrderField;
};

export enum S0_Eternum_LeaderboardEntryOrderField {
  Address = 'ADDRESS',
  Points = 'POINTS'
}

export type S0_Eternum_LeaderboardEntryWhereInput = {
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

export type S0_Eternum_LeaderboardOrder = {
  direction: OrderDirection;
  field: S0_Eternum_LeaderboardOrderField;
};

export enum S0_Eternum_LeaderboardOrderField {
  ConfigId = 'CONFIG_ID',
  DistributionStarted = 'DISTRIBUTION_STARTED',
  RegistrationEndTimestamp = 'REGISTRATION_END_TIMESTAMP',
  TotalPoints = 'TOTAL_POINTS',
  TotalPricePool = 'TOTAL_PRICE_POOL'
}

export type S0_Eternum_LeaderboardRegisterContributionOrder = {
  direction: OrderDirection;
  field: S0_Eternum_LeaderboardRegisterContributionOrderField;
};

export enum S0_Eternum_LeaderboardRegisterContributionOrderField {
  Address = 'ADDRESS',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  Registered = 'REGISTERED'
}

export type S0_Eternum_LeaderboardRegisterContributionWhereInput = {
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

export type S0_Eternum_LeaderboardRegisterShareOrder = {
  direction: OrderDirection;
  field: S0_Eternum_LeaderboardRegisterShareOrderField;
};

export enum S0_Eternum_LeaderboardRegisterShareOrderField {
  Address = 'ADDRESS',
  Epoch = 'EPOCH',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  Registered = 'REGISTERED'
}

export type S0_Eternum_LeaderboardRegisterShareWhereInput = {
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

export type S0_Eternum_LeaderboardRegisteredOrder = {
  direction: OrderDirection;
  field: S0_Eternum_LeaderboardRegisteredOrderField;
};

export enum S0_Eternum_LeaderboardRegisteredOrderField {
  Address = 'ADDRESS',
  Registered = 'REGISTERED'
}

export type S0_Eternum_LeaderboardRegisteredWhereInput = {
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

export type S0_Eternum_LeaderboardRewardClaimedOrder = {
  direction: OrderDirection;
  field: S0_Eternum_LeaderboardRewardClaimedOrderField;
};

export enum S0_Eternum_LeaderboardRewardClaimedOrderField {
  Address = 'ADDRESS',
  Claimed = 'CLAIMED'
}

export type S0_Eternum_LeaderboardRewardClaimedWhereInput = {
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

export type S0_Eternum_LeaderboardWhereInput = {
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
};

export type S0_Eternum_LevelingConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_LevelingConfigOrderField;
};

export enum S0_Eternum_LevelingConfigOrderField {
  BaseMultiplier = 'BASE_MULTIPLIER',
  ConfigId = 'CONFIG_ID',
  CostPercentageScaled = 'COST_PERCENTAGE_SCALED',
  DecayInterval = 'DECAY_INTERVAL',
  DecayScaled = 'DECAY_SCALED',
  FishBaseAmount = 'FISH_BASE_AMOUNT',
  MaxLevel = 'MAX_LEVEL',
  Resource_1CostCount = 'RESOURCE_1_COST_COUNT',
  Resource_1CostId = 'RESOURCE_1_COST_ID',
  Resource_2CostCount = 'RESOURCE_2_COST_COUNT',
  Resource_2CostId = 'RESOURCE_2_COST_ID',
  Resource_3CostCount = 'RESOURCE_3_COST_COUNT',
  Resource_3CostId = 'RESOURCE_3_COST_ID',
  WheatBaseAmount = 'WHEAT_BASE_AMOUNT'
}

export type S0_Eternum_LevelingConfigWhereInput = {
  base_multiplier?: InputMaybe<Scalars['u128']['input']>;
  base_multiplierEQ?: InputMaybe<Scalars['u128']['input']>;
  base_multiplierGT?: InputMaybe<Scalars['u128']['input']>;
  base_multiplierGTE?: InputMaybe<Scalars['u128']['input']>;
  base_multiplierIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  base_multiplierLIKE?: InputMaybe<Scalars['u128']['input']>;
  base_multiplierLT?: InputMaybe<Scalars['u128']['input']>;
  base_multiplierLTE?: InputMaybe<Scalars['u128']['input']>;
  base_multiplierNEQ?: InputMaybe<Scalars['u128']['input']>;
  base_multiplierNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  base_multiplierNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
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
  cost_percentage_scaled?: InputMaybe<Scalars['u128']['input']>;
  cost_percentage_scaledEQ?: InputMaybe<Scalars['u128']['input']>;
  cost_percentage_scaledGT?: InputMaybe<Scalars['u128']['input']>;
  cost_percentage_scaledGTE?: InputMaybe<Scalars['u128']['input']>;
  cost_percentage_scaledIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  cost_percentage_scaledLIKE?: InputMaybe<Scalars['u128']['input']>;
  cost_percentage_scaledLT?: InputMaybe<Scalars['u128']['input']>;
  cost_percentage_scaledLTE?: InputMaybe<Scalars['u128']['input']>;
  cost_percentage_scaledNEQ?: InputMaybe<Scalars['u128']['input']>;
  cost_percentage_scaledNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  cost_percentage_scaledNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  decay_interval?: InputMaybe<Scalars['u64']['input']>;
  decay_intervalEQ?: InputMaybe<Scalars['u64']['input']>;
  decay_intervalGT?: InputMaybe<Scalars['u64']['input']>;
  decay_intervalGTE?: InputMaybe<Scalars['u64']['input']>;
  decay_intervalIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  decay_intervalLIKE?: InputMaybe<Scalars['u64']['input']>;
  decay_intervalLT?: InputMaybe<Scalars['u64']['input']>;
  decay_intervalLTE?: InputMaybe<Scalars['u64']['input']>;
  decay_intervalNEQ?: InputMaybe<Scalars['u64']['input']>;
  decay_intervalNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  decay_intervalNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  decay_scaled?: InputMaybe<Scalars['u128']['input']>;
  decay_scaledEQ?: InputMaybe<Scalars['u128']['input']>;
  decay_scaledGT?: InputMaybe<Scalars['u128']['input']>;
  decay_scaledGTE?: InputMaybe<Scalars['u128']['input']>;
  decay_scaledIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  decay_scaledLIKE?: InputMaybe<Scalars['u128']['input']>;
  decay_scaledLT?: InputMaybe<Scalars['u128']['input']>;
  decay_scaledLTE?: InputMaybe<Scalars['u128']['input']>;
  decay_scaledNEQ?: InputMaybe<Scalars['u128']['input']>;
  decay_scaledNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  decay_scaledNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  fish_base_amount?: InputMaybe<Scalars['u128']['input']>;
  fish_base_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  fish_base_amountGT?: InputMaybe<Scalars['u128']['input']>;
  fish_base_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  fish_base_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  fish_base_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  fish_base_amountLT?: InputMaybe<Scalars['u128']['input']>;
  fish_base_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  fish_base_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  fish_base_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  fish_base_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  max_level?: InputMaybe<Scalars['u64']['input']>;
  max_levelEQ?: InputMaybe<Scalars['u64']['input']>;
  max_levelGT?: InputMaybe<Scalars['u64']['input']>;
  max_levelGTE?: InputMaybe<Scalars['u64']['input']>;
  max_levelIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  max_levelLIKE?: InputMaybe<Scalars['u64']['input']>;
  max_levelLT?: InputMaybe<Scalars['u64']['input']>;
  max_levelLTE?: InputMaybe<Scalars['u64']['input']>;
  max_levelNEQ?: InputMaybe<Scalars['u64']['input']>;
  max_levelNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  max_levelNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  resource_1_cost_count?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_countEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_countGT?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_countGTE?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_countIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_1_cost_countLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_countLT?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_countLTE?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_countNEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_1_cost_countNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_id?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_idEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_idGT?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_idGTE?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_1_cost_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_idLT?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_idLTE?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_1_cost_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_1_cost_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_count?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_countEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_countGT?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_countGTE?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_countIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_2_cost_countLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_countLT?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_countLTE?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_countNEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_2_cost_countNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_id?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_idEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_idGT?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_idGTE?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_2_cost_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_idLT?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_idLTE?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_2_cost_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_2_cost_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_count?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_countEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_countGT?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_countGTE?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_countIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_3_cost_countLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_countLT?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_countLTE?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_countNEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_3_cost_countNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_id?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_idEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_idGT?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_idGTE?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_3_cost_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_idLT?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_idLTE?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  resource_3_cost_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  resource_3_cost_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  wheat_base_amount?: InputMaybe<Scalars['u128']['input']>;
  wheat_base_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  wheat_base_amountGT?: InputMaybe<Scalars['u128']['input']>;
  wheat_base_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  wheat_base_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  wheat_base_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  wheat_base_amountLT?: InputMaybe<Scalars['u128']['input']>;
  wheat_base_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  wheat_base_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  wheat_base_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  wheat_base_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type S0_Eternum_LiquidityEventOrder = {
  direction: OrderDirection;
  field: S0_Eternum_LiquidityEventOrderField;
};

export enum S0_Eternum_LiquidityEventOrderField {
  Add = 'ADD',
  BankEntityId = 'BANK_ENTITY_ID',
  EntityId = 'ENTITY_ID',
  LordsAmount = 'LORDS_AMOUNT',
  ResourceAmount = 'RESOURCE_AMOUNT',
  ResourcePrice = 'RESOURCE_PRICE',
  ResourceType = 'RESOURCE_TYPE',
  Timestamp = 'TIMESTAMP'
}

export type S0_Eternum_LiquidityEventWhereInput = {
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

export type S0_Eternum_LiquidityOrder = {
  direction: OrderDirection;
  field: S0_Eternum_LiquidityOrderField;
};

export enum S0_Eternum_LiquidityOrderField {
  BankEntityId = 'BANK_ENTITY_ID',
  Player = 'PLAYER',
  ResourceType = 'RESOURCE_TYPE',
  Shares = 'SHARES'
}

export type S0_Eternum_LiquidityWhereInput = {
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
};

export type S0_Eternum_MapConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_MapConfigOrderField;
};

export enum S0_Eternum_MapConfigOrderField {
  ConfigId = 'CONFIG_ID',
  RewardResourceAmount = 'REWARD_RESOURCE_AMOUNT',
  ShardsMinesFailProbability = 'SHARDS_MINES_FAIL_PROBABILITY'
}

export type S0_Eternum_MapConfigWhereInput = {
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
  reward_resource_amount?: InputMaybe<Scalars['u128']['input']>;
  reward_resource_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  reward_resource_amountGT?: InputMaybe<Scalars['u128']['input']>;
  reward_resource_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  reward_resource_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  reward_resource_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  reward_resource_amountLT?: InputMaybe<Scalars['u128']['input']>;
  reward_resource_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  reward_resource_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  reward_resource_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  reward_resource_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  shards_mines_fail_probability?: InputMaybe<Scalars['u128']['input']>;
  shards_mines_fail_probabilityEQ?: InputMaybe<Scalars['u128']['input']>;
  shards_mines_fail_probabilityGT?: InputMaybe<Scalars['u128']['input']>;
  shards_mines_fail_probabilityGTE?: InputMaybe<Scalars['u128']['input']>;
  shards_mines_fail_probabilityIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  shards_mines_fail_probabilityLIKE?: InputMaybe<Scalars['u128']['input']>;
  shards_mines_fail_probabilityLT?: InputMaybe<Scalars['u128']['input']>;
  shards_mines_fail_probabilityLTE?: InputMaybe<Scalars['u128']['input']>;
  shards_mines_fail_probabilityNEQ?: InputMaybe<Scalars['u128']['input']>;
  shards_mines_fail_probabilityNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  shards_mines_fail_probabilityNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
};

export type S0_Eternum_MapExploredOrder = {
  direction: OrderDirection;
  field: S0_Eternum_MapExploredOrderField;
};

export enum S0_Eternum_MapExploredOrderField {
  Biome = 'BIOME',
  Col = 'COL',
  EntityId = 'ENTITY_ID',
  EntityOwnerId = 'ENTITY_OWNER_ID',
  Id = 'ID',
  Reward = 'REWARD',
  Row = 'ROW',
  Timestamp = 'TIMESTAMP'
}

export type S0_Eternum_MapExploredWhereInput = {
  biome?: InputMaybe<Scalars['Enum']['input']>;
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
  entity_owner_id?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idGT?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_owner_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idLT?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_owner_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_owner_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
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

export type S0_Eternum_MarketOrder = {
  direction: OrderDirection;
  field: S0_Eternum_MarketOrderField;
};

export enum S0_Eternum_MarketOrderField {
  BankEntityId = 'BANK_ENTITY_ID',
  LordsAmount = 'LORDS_AMOUNT',
  ResourceAmount = 'RESOURCE_AMOUNT',
  ResourceType = 'RESOURCE_TYPE',
  TotalShares = 'TOTAL_SHARES'
}

export type S0_Eternum_MarketWhereInput = {
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
};

export type S0_Eternum_MercenariesConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_MercenariesConfigOrderField;
};

export enum S0_Eternum_MercenariesConfigOrderField {
  ConfigId = 'CONFIG_ID',
  CrossbowmenLowerBound = 'CROSSBOWMEN_LOWER_BOUND',
  CrossbowmenUpperBound = 'CROSSBOWMEN_UPPER_BOUND',
  KnightsLowerBound = 'KNIGHTS_LOWER_BOUND',
  KnightsUpperBound = 'KNIGHTS_UPPER_BOUND',
  PaladinsLowerBound = 'PALADINS_LOWER_BOUND',
  PaladinsUpperBound = 'PALADINS_UPPER_BOUND',
  Rewards = 'REWARDS'
}

export type S0_Eternum_MercenariesConfigWhereInput = {
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
  crossbowmen_lower_bound?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_lower_boundEQ?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_lower_boundGT?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_lower_boundGTE?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_lower_boundIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  crossbowmen_lower_boundLIKE?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_lower_boundLT?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_lower_boundLTE?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_lower_boundNEQ?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_lower_boundNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  crossbowmen_lower_boundNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_upper_bound?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_upper_boundEQ?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_upper_boundGT?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_upper_boundGTE?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_upper_boundIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  crossbowmen_upper_boundLIKE?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_upper_boundLT?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_upper_boundLTE?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_upper_boundNEQ?: InputMaybe<Scalars['u64']['input']>;
  crossbowmen_upper_boundNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  crossbowmen_upper_boundNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  knights_lower_bound?: InputMaybe<Scalars['u64']['input']>;
  knights_lower_boundEQ?: InputMaybe<Scalars['u64']['input']>;
  knights_lower_boundGT?: InputMaybe<Scalars['u64']['input']>;
  knights_lower_boundGTE?: InputMaybe<Scalars['u64']['input']>;
  knights_lower_boundIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  knights_lower_boundLIKE?: InputMaybe<Scalars['u64']['input']>;
  knights_lower_boundLT?: InputMaybe<Scalars['u64']['input']>;
  knights_lower_boundLTE?: InputMaybe<Scalars['u64']['input']>;
  knights_lower_boundNEQ?: InputMaybe<Scalars['u64']['input']>;
  knights_lower_boundNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  knights_lower_boundNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  knights_upper_bound?: InputMaybe<Scalars['u64']['input']>;
  knights_upper_boundEQ?: InputMaybe<Scalars['u64']['input']>;
  knights_upper_boundGT?: InputMaybe<Scalars['u64']['input']>;
  knights_upper_boundGTE?: InputMaybe<Scalars['u64']['input']>;
  knights_upper_boundIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  knights_upper_boundLIKE?: InputMaybe<Scalars['u64']['input']>;
  knights_upper_boundLT?: InputMaybe<Scalars['u64']['input']>;
  knights_upper_boundLTE?: InputMaybe<Scalars['u64']['input']>;
  knights_upper_boundNEQ?: InputMaybe<Scalars['u64']['input']>;
  knights_upper_boundNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  knights_upper_boundNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  paladins_lower_bound?: InputMaybe<Scalars['u64']['input']>;
  paladins_lower_boundEQ?: InputMaybe<Scalars['u64']['input']>;
  paladins_lower_boundGT?: InputMaybe<Scalars['u64']['input']>;
  paladins_lower_boundGTE?: InputMaybe<Scalars['u64']['input']>;
  paladins_lower_boundIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  paladins_lower_boundLIKE?: InputMaybe<Scalars['u64']['input']>;
  paladins_lower_boundLT?: InputMaybe<Scalars['u64']['input']>;
  paladins_lower_boundLTE?: InputMaybe<Scalars['u64']['input']>;
  paladins_lower_boundNEQ?: InputMaybe<Scalars['u64']['input']>;
  paladins_lower_boundNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  paladins_lower_boundNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  paladins_upper_bound?: InputMaybe<Scalars['u64']['input']>;
  paladins_upper_boundEQ?: InputMaybe<Scalars['u64']['input']>;
  paladins_upper_boundGT?: InputMaybe<Scalars['u64']['input']>;
  paladins_upper_boundGTE?: InputMaybe<Scalars['u64']['input']>;
  paladins_upper_boundIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  paladins_upper_boundLIKE?: InputMaybe<Scalars['u64']['input']>;
  paladins_upper_boundLT?: InputMaybe<Scalars['u64']['input']>;
  paladins_upper_boundLTE?: InputMaybe<Scalars['u64']['input']>;
  paladins_upper_boundNEQ?: InputMaybe<Scalars['u64']['input']>;
  paladins_upper_boundNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  paladins_upper_boundNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S0_Eternum_MessageOrder = {
  direction: OrderDirection;
  field: S0_Eternum_MessageOrderField;
};

export enum S0_Eternum_MessageOrderField {
  Channel = 'CHANNEL',
  Content = 'CONTENT',
  Identity = 'IDENTITY',
  Salt = 'SALT',
  Timestamp = 'TIMESTAMP'
}

export type S0_Eternum_MessageWhereInput = {
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

export type S0_Eternum_MovableOrder = {
  direction: OrderDirection;
  field: S0_Eternum_MovableOrderField;
};

export enum S0_Eternum_MovableOrderField {
  Blocked = 'BLOCKED',
  EntityId = 'ENTITY_ID',
  IntermediateCoordX = 'INTERMEDIATE_COORD_X',
  IntermediateCoordY = 'INTERMEDIATE_COORD_Y',
  RoundTrip = 'ROUND_TRIP',
  SecPerKm = 'SEC_PER_KM',
  StartCoordX = 'START_COORD_X',
  StartCoordY = 'START_COORD_Y'
}

export type S0_Eternum_MovableWhereInput = {
  blocked?: InputMaybe<Scalars['bool']['input']>;
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
  intermediate_coord_x?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_xEQ?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_xGT?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_xGTE?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_xIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  intermediate_coord_xLIKE?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_xLT?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_xLTE?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_xNEQ?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_xNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  intermediate_coord_xNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_y?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_yEQ?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_yGT?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_yGTE?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_yIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  intermediate_coord_yLIKE?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_yLT?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_yLTE?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_yNEQ?: InputMaybe<Scalars['u32']['input']>;
  intermediate_coord_yNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  intermediate_coord_yNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  round_trip?: InputMaybe<Scalars['bool']['input']>;
  sec_per_km?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmEQ?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmGT?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmGTE?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  sec_per_kmLIKE?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmLT?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmLTE?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmNEQ?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  sec_per_kmNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  start_coord_x?: InputMaybe<Scalars['u32']['input']>;
  start_coord_xEQ?: InputMaybe<Scalars['u32']['input']>;
  start_coord_xGT?: InputMaybe<Scalars['u32']['input']>;
  start_coord_xGTE?: InputMaybe<Scalars['u32']['input']>;
  start_coord_xIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  start_coord_xLIKE?: InputMaybe<Scalars['u32']['input']>;
  start_coord_xLT?: InputMaybe<Scalars['u32']['input']>;
  start_coord_xLTE?: InputMaybe<Scalars['u32']['input']>;
  start_coord_xNEQ?: InputMaybe<Scalars['u32']['input']>;
  start_coord_xNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  start_coord_xNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  start_coord_y?: InputMaybe<Scalars['u32']['input']>;
  start_coord_yEQ?: InputMaybe<Scalars['u32']['input']>;
  start_coord_yGT?: InputMaybe<Scalars['u32']['input']>;
  start_coord_yGTE?: InputMaybe<Scalars['u32']['input']>;
  start_coord_yIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  start_coord_yLIKE?: InputMaybe<Scalars['u32']['input']>;
  start_coord_yLT?: InputMaybe<Scalars['u32']['input']>;
  start_coord_yLTE?: InputMaybe<Scalars['u32']['input']>;
  start_coord_yNEQ?: InputMaybe<Scalars['u32']['input']>;
  start_coord_yNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  start_coord_yNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S0_Eternum_OrdersOrder = {
  direction: OrderDirection;
  field: S0_Eternum_OrdersOrderField;
};

export enum S0_Eternum_OrdersOrderField {
  HyperstructureCount = 'HYPERSTRUCTURE_COUNT',
  OrderId = 'ORDER_ID'
}

export type S0_Eternum_OrdersWhereInput = {
  hyperstructure_count?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_countEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_countGT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_countGTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_countIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_countLIKE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_countLT?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_countLTE?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_countNEQ?: InputMaybe<Scalars['u32']['input']>;
  hyperstructure_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  hyperstructure_countNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  order_id?: InputMaybe<Scalars['u32']['input']>;
  order_idEQ?: InputMaybe<Scalars['u32']['input']>;
  order_idGT?: InputMaybe<Scalars['u32']['input']>;
  order_idGTE?: InputMaybe<Scalars['u32']['input']>;
  order_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  order_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  order_idLT?: InputMaybe<Scalars['u32']['input']>;
  order_idLTE?: InputMaybe<Scalars['u32']['input']>;
  order_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  order_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  order_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S0_Eternum_OwnedResourcesTrackerOrder = {
  direction: OrderDirection;
  field: S0_Eternum_OwnedResourcesTrackerOrderField;
};

export enum S0_Eternum_OwnedResourcesTrackerOrderField {
  EntityId = 'ENTITY_ID',
  ResourceTypes = 'RESOURCE_TYPES'
}

export type S0_Eternum_OwnedResourcesTrackerWhereInput = {
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
  resource_types?: InputMaybe<Scalars['u256']['input']>;
  resource_typesEQ?: InputMaybe<Scalars['u256']['input']>;
  resource_typesGT?: InputMaybe<Scalars['u256']['input']>;
  resource_typesGTE?: InputMaybe<Scalars['u256']['input']>;
  resource_typesIN?: InputMaybe<Array<InputMaybe<Scalars['u256']['input']>>>;
  resource_typesLIKE?: InputMaybe<Scalars['u256']['input']>;
  resource_typesLT?: InputMaybe<Scalars['u256']['input']>;
  resource_typesLTE?: InputMaybe<Scalars['u256']['input']>;
  resource_typesNEQ?: InputMaybe<Scalars['u256']['input']>;
  resource_typesNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u256']['input']>>>;
  resource_typesNOTLIKE?: InputMaybe<Scalars['u256']['input']>;
};

export type S0_Eternum_OwnerOrder = {
  direction: OrderDirection;
  field: S0_Eternum_OwnerOrderField;
};

export enum S0_Eternum_OwnerOrderField {
  Address = 'ADDRESS',
  EntityId = 'ENTITY_ID'
}

export type S0_Eternum_OwnerWhereInput = {
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
};

export type S0_Eternum_PopulationConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_PopulationConfigOrderField;
};

export enum S0_Eternum_PopulationConfigOrderField {
  BasePopulation = 'BASE_POPULATION',
  ConfigId = 'CONFIG_ID'
}

export type S0_Eternum_PopulationConfigWhereInput = {
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
};

export type S0_Eternum_PopulationOrder = {
  direction: OrderDirection;
  field: S0_Eternum_PopulationOrderField;
};

export enum S0_Eternum_PopulationOrderField {
  Capacity = 'CAPACITY',
  EntityId = 'ENTITY_ID',
  Population = 'POPULATION'
}

export type S0_Eternum_PopulationWhereInput = {
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

export type S0_Eternum_PositionOrder = {
  direction: OrderDirection;
  field: S0_Eternum_PositionOrderField;
};

export enum S0_Eternum_PositionOrderField {
  EntityId = 'ENTITY_ID',
  X = 'X',
  Y = 'Y'
}

export type S0_Eternum_PositionWhereInput = {
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

export type S0_Eternum_ProductionConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ProductionConfigOrderField;
};

export enum S0_Eternum_ProductionConfigOrderField {
  Amount = 'AMOUNT',
  InputCount = 'INPUT_COUNT',
  OutputCount = 'OUTPUT_COUNT',
  ResourceType = 'RESOURCE_TYPE'
}

export type S0_Eternum_ProductionConfigWhereInput = {
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
  input_count?: InputMaybe<Scalars['u128']['input']>;
  input_countEQ?: InputMaybe<Scalars['u128']['input']>;
  input_countGT?: InputMaybe<Scalars['u128']['input']>;
  input_countGTE?: InputMaybe<Scalars['u128']['input']>;
  input_countIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  input_countLIKE?: InputMaybe<Scalars['u128']['input']>;
  input_countLT?: InputMaybe<Scalars['u128']['input']>;
  input_countLTE?: InputMaybe<Scalars['u128']['input']>;
  input_countNEQ?: InputMaybe<Scalars['u128']['input']>;
  input_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  input_countNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_count?: InputMaybe<Scalars['u128']['input']>;
  output_countEQ?: InputMaybe<Scalars['u128']['input']>;
  output_countGT?: InputMaybe<Scalars['u128']['input']>;
  output_countGTE?: InputMaybe<Scalars['u128']['input']>;
  output_countIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_countLIKE?: InputMaybe<Scalars['u128']['input']>;
  output_countLT?: InputMaybe<Scalars['u128']['input']>;
  output_countLTE?: InputMaybe<Scalars['u128']['input']>;
  output_countNEQ?: InputMaybe<Scalars['u128']['input']>;
  output_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  output_countNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
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

export type S0_Eternum_ProductionDeadlineOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ProductionDeadlineOrderField;
};

export enum S0_Eternum_ProductionDeadlineOrderField {
  DeadlineTick = 'DEADLINE_TICK',
  EntityId = 'ENTITY_ID'
}

export type S0_Eternum_ProductionDeadlineWhereInput = {
  deadline_tick?: InputMaybe<Scalars['u64']['input']>;
  deadline_tickEQ?: InputMaybe<Scalars['u64']['input']>;
  deadline_tickGT?: InputMaybe<Scalars['u64']['input']>;
  deadline_tickGTE?: InputMaybe<Scalars['u64']['input']>;
  deadline_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  deadline_tickLIKE?: InputMaybe<Scalars['u64']['input']>;
  deadline_tickLT?: InputMaybe<Scalars['u64']['input']>;
  deadline_tickLTE?: InputMaybe<Scalars['u64']['input']>;
  deadline_tickNEQ?: InputMaybe<Scalars['u64']['input']>;
  deadline_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  deadline_tickNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
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
};

export type S0_Eternum_ProductionInputOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ProductionInputOrderField;
};

export enum S0_Eternum_ProductionInputOrderField {
  Index = 'INDEX',
  InputResourceAmount = 'INPUT_RESOURCE_AMOUNT',
  InputResourceType = 'INPUT_RESOURCE_TYPE',
  OutputResourceType = 'OUTPUT_RESOURCE_TYPE'
}

export type S0_Eternum_ProductionInputWhereInput = {
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
  input_resource_amount?: InputMaybe<Scalars['u128']['input']>;
  input_resource_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  input_resource_amountGT?: InputMaybe<Scalars['u128']['input']>;
  input_resource_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  input_resource_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  input_resource_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  input_resource_amountLT?: InputMaybe<Scalars['u128']['input']>;
  input_resource_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  input_resource_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  input_resource_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  input_resource_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  input_resource_type?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  input_resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  input_resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  output_resource_type?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  output_resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  output_resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S0_Eternum_ProductionOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ProductionOrderField;
};

export enum S0_Eternum_ProductionOrderField {
  BuildingCount = 'BUILDING_COUNT',
  ConsumptionRate = 'CONSUMPTION_RATE',
  EntityId = 'ENTITY_ID',
  InputFinishTick = 'INPUT_FINISH_TICK',
  LastUpdatedTick = 'LAST_UPDATED_TICK',
  ProductionRate = 'PRODUCTION_RATE',
  ResourceType = 'RESOURCE_TYPE'
}

export type S0_Eternum_ProductionOutputOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ProductionOutputOrderField;
};

export enum S0_Eternum_ProductionOutputOrderField {
  Index = 'INDEX',
  InputResourceType = 'INPUT_RESOURCE_TYPE',
  OutputResourceType = 'OUTPUT_RESOURCE_TYPE'
}

export type S0_Eternum_ProductionOutputWhereInput = {
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
  input_resource_type?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  input_resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  input_resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  input_resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  output_resource_type?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeGT?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  output_resource_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeLT?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  output_resource_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  output_resource_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S0_Eternum_ProductionWhereInput = {
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
  consumption_rate?: InputMaybe<Scalars['u128']['input']>;
  consumption_rateEQ?: InputMaybe<Scalars['u128']['input']>;
  consumption_rateGT?: InputMaybe<Scalars['u128']['input']>;
  consumption_rateGTE?: InputMaybe<Scalars['u128']['input']>;
  consumption_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  consumption_rateLIKE?: InputMaybe<Scalars['u128']['input']>;
  consumption_rateLT?: InputMaybe<Scalars['u128']['input']>;
  consumption_rateLTE?: InputMaybe<Scalars['u128']['input']>;
  consumption_rateNEQ?: InputMaybe<Scalars['u128']['input']>;
  consumption_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  consumption_rateNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
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
  input_finish_tick?: InputMaybe<Scalars['u64']['input']>;
  input_finish_tickEQ?: InputMaybe<Scalars['u64']['input']>;
  input_finish_tickGT?: InputMaybe<Scalars['u64']['input']>;
  input_finish_tickGTE?: InputMaybe<Scalars['u64']['input']>;
  input_finish_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  input_finish_tickLIKE?: InputMaybe<Scalars['u64']['input']>;
  input_finish_tickLT?: InputMaybe<Scalars['u64']['input']>;
  input_finish_tickLTE?: InputMaybe<Scalars['u64']['input']>;
  input_finish_tickNEQ?: InputMaybe<Scalars['u64']['input']>;
  input_finish_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  input_finish_tickNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  last_updated_tick?: InputMaybe<Scalars['u64']['input']>;
  last_updated_tickEQ?: InputMaybe<Scalars['u64']['input']>;
  last_updated_tickGT?: InputMaybe<Scalars['u64']['input']>;
  last_updated_tickGTE?: InputMaybe<Scalars['u64']['input']>;
  last_updated_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  last_updated_tickLIKE?: InputMaybe<Scalars['u64']['input']>;
  last_updated_tickLT?: InputMaybe<Scalars['u64']['input']>;
  last_updated_tickLTE?: InputMaybe<Scalars['u64']['input']>;
  last_updated_tickNEQ?: InputMaybe<Scalars['u64']['input']>;
  last_updated_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  last_updated_tickNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  production_rate?: InputMaybe<Scalars['u128']['input']>;
  production_rateEQ?: InputMaybe<Scalars['u128']['input']>;
  production_rateGT?: InputMaybe<Scalars['u128']['input']>;
  production_rateGTE?: InputMaybe<Scalars['u128']['input']>;
  production_rateIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  production_rateLIKE?: InputMaybe<Scalars['u128']['input']>;
  production_rateLT?: InputMaybe<Scalars['u128']['input']>;
  production_rateLTE?: InputMaybe<Scalars['u128']['input']>;
  production_rateNEQ?: InputMaybe<Scalars['u128']['input']>;
  production_rateNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  production_rateNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
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

export type S0_Eternum_ProgressOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ProgressOrderField;
};

export enum S0_Eternum_ProgressOrderField {
  Amount = 'AMOUNT',
  HyperstructureEntityId = 'HYPERSTRUCTURE_ENTITY_ID',
  ResourceType = 'RESOURCE_TYPE'
}

export type S0_Eternum_ProgressWhereInput = {
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

export type S0_Eternum_ProtecteeOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ProtecteeOrderField;
};

export enum S0_Eternum_ProtecteeOrderField {
  ArmyId = 'ARMY_ID',
  ProtecteeId = 'PROTECTEE_ID'
}

export type S0_Eternum_ProtecteeWhereInput = {
  army_id?: InputMaybe<Scalars['u32']['input']>;
  army_idEQ?: InputMaybe<Scalars['u32']['input']>;
  army_idGT?: InputMaybe<Scalars['u32']['input']>;
  army_idGTE?: InputMaybe<Scalars['u32']['input']>;
  army_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  army_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  army_idLT?: InputMaybe<Scalars['u32']['input']>;
  army_idLTE?: InputMaybe<Scalars['u32']['input']>;
  army_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  army_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  army_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  protectee_id?: InputMaybe<Scalars['u32']['input']>;
  protectee_idEQ?: InputMaybe<Scalars['u32']['input']>;
  protectee_idGT?: InputMaybe<Scalars['u32']['input']>;
  protectee_idGTE?: InputMaybe<Scalars['u32']['input']>;
  protectee_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  protectee_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  protectee_idLT?: InputMaybe<Scalars['u32']['input']>;
  protectee_idLTE?: InputMaybe<Scalars['u32']['input']>;
  protectee_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  protectee_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  protectee_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S0_Eternum_ProtectorOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ProtectorOrderField;
};

export enum S0_Eternum_ProtectorOrderField {
  ArmyId = 'ARMY_ID',
  EntityId = 'ENTITY_ID'
}

export type S0_Eternum_ProtectorWhereInput = {
  army_id?: InputMaybe<Scalars['u32']['input']>;
  army_idEQ?: InputMaybe<Scalars['u32']['input']>;
  army_idGT?: InputMaybe<Scalars['u32']['input']>;
  army_idGTE?: InputMaybe<Scalars['u32']['input']>;
  army_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  army_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  army_idLT?: InputMaybe<Scalars['u32']['input']>;
  army_idLTE?: InputMaybe<Scalars['u32']['input']>;
  army_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  army_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  army_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
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
};

export type S0_Eternum_QuantityOrder = {
  direction: OrderDirection;
  field: S0_Eternum_QuantityOrderField;
};

export enum S0_Eternum_QuantityOrderField {
  EntityId = 'ENTITY_ID',
  Value = 'VALUE'
}

export type S0_Eternum_QuantityTrackerOrder = {
  direction: OrderDirection;
  field: S0_Eternum_QuantityTrackerOrderField;
};

export enum S0_Eternum_QuantityTrackerOrderField {
  Count = 'COUNT',
  EntityId = 'ENTITY_ID'
}

export type S0_Eternum_QuantityTrackerWhereInput = {
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

export type S0_Eternum_QuantityWhereInput = {
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

export type S0_Eternum_QuestBonusOrder = {
  direction: OrderDirection;
  field: S0_Eternum_QuestBonusOrderField;
};

export enum S0_Eternum_QuestBonusOrderField {
  Claimed = 'CLAIMED',
  EntityId = 'ENTITY_ID',
  ResourceType = 'RESOURCE_TYPE'
}

export type S0_Eternum_QuestBonusWhereInput = {
  claimed?: InputMaybe<Scalars['bool']['input']>;
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

export type S0_Eternum_QuestConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_QuestConfigOrderField;
};

export enum S0_Eternum_QuestConfigOrderField {
  ConfigId = 'CONFIG_ID',
  ProductionMaterialMultiplier = 'PRODUCTION_MATERIAL_MULTIPLIER'
}

export type S0_Eternum_QuestConfigWhereInput = {
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
  production_material_multiplier?: InputMaybe<Scalars['u16']['input']>;
  production_material_multiplierEQ?: InputMaybe<Scalars['u16']['input']>;
  production_material_multiplierGT?: InputMaybe<Scalars['u16']['input']>;
  production_material_multiplierGTE?: InputMaybe<Scalars['u16']['input']>;
  production_material_multiplierIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  production_material_multiplierLIKE?: InputMaybe<Scalars['u16']['input']>;
  production_material_multiplierLT?: InputMaybe<Scalars['u16']['input']>;
  production_material_multiplierLTE?: InputMaybe<Scalars['u16']['input']>;
  production_material_multiplierNEQ?: InputMaybe<Scalars['u16']['input']>;
  production_material_multiplierNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  production_material_multiplierNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
};

export type S0_Eternum_QuestOrder = {
  direction: OrderDirection;
  field: S0_Eternum_QuestOrderField;
};

export enum S0_Eternum_QuestOrderField {
  Completed = 'COMPLETED',
  ConfigId = 'CONFIG_ID',
  EntityId = 'ENTITY_ID'
}

export type S0_Eternum_QuestRewardConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_QuestRewardConfigOrderField;
};

export enum S0_Eternum_QuestRewardConfigOrderField {
  DetachedResourceCount = 'DETACHED_RESOURCE_COUNT',
  DetachedResourceId = 'DETACHED_RESOURCE_ID',
  QuestId = 'QUEST_ID'
}

export type S0_Eternum_QuestRewardConfigWhereInput = {
  detached_resource_count?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_countEQ?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_countGT?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_countGTE?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_countIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  detached_resource_countLIKE?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_countLT?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_countLTE?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_countNEQ?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  detached_resource_countNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_id?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_idEQ?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_idGT?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_idGTE?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  detached_resource_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_idLT?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_idLTE?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  detached_resource_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  detached_resource_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  quest_id?: InputMaybe<Scalars['u32']['input']>;
  quest_idEQ?: InputMaybe<Scalars['u32']['input']>;
  quest_idGT?: InputMaybe<Scalars['u32']['input']>;
  quest_idGTE?: InputMaybe<Scalars['u32']['input']>;
  quest_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  quest_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  quest_idLT?: InputMaybe<Scalars['u32']['input']>;
  quest_idLTE?: InputMaybe<Scalars['u32']['input']>;
  quest_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  quest_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  quest_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S0_Eternum_QuestWhereInput = {
  completed?: InputMaybe<Scalars['bool']['input']>;
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
};

export type S0_Eternum_RealmLevelConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_RealmLevelConfigOrderField;
};

export enum S0_Eternum_RealmLevelConfigOrderField {
  Level = 'LEVEL',
  RequiredResourcesId = 'REQUIRED_RESOURCES_ID',
  RequiredResourceCount = 'REQUIRED_RESOURCE_COUNT'
}

export type S0_Eternum_RealmLevelConfigWhereInput = {
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

export type S0_Eternum_RealmMaxLevelConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_RealmMaxLevelConfigOrderField;
};

export enum S0_Eternum_RealmMaxLevelConfigOrderField {
  ConfigId = 'CONFIG_ID',
  MaxLevel = 'MAX_LEVEL'
}

export type S0_Eternum_RealmMaxLevelConfigWhereInput = {
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
  max_level?: InputMaybe<Scalars['u8']['input']>;
  max_levelEQ?: InputMaybe<Scalars['u8']['input']>;
  max_levelGT?: InputMaybe<Scalars['u8']['input']>;
  max_levelGTE?: InputMaybe<Scalars['u8']['input']>;
  max_levelIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  max_levelLIKE?: InputMaybe<Scalars['u8']['input']>;
  max_levelLT?: InputMaybe<Scalars['u8']['input']>;
  max_levelLTE?: InputMaybe<Scalars['u8']['input']>;
  max_levelNEQ?: InputMaybe<Scalars['u8']['input']>;
  max_levelNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  max_levelNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S0_Eternum_RealmOrder = {
  direction: OrderDirection;
  field: S0_Eternum_RealmOrderField;
};

export enum S0_Eternum_RealmOrderField {
  EntityId = 'ENTITY_ID',
  HasWonder = 'HAS_WONDER',
  Level = 'LEVEL',
  Order = 'ORDER',
  ProducedResources = 'PRODUCED_RESOURCES',
  RealmId = 'REALM_ID',
  SettlerAddress = 'SETTLER_ADDRESS'
}

export type S0_Eternum_RealmWhereInput = {
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
  has_wonder?: InputMaybe<Scalars['bool']['input']>;
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
  realm_id?: InputMaybe<Scalars['u32']['input']>;
  realm_idEQ?: InputMaybe<Scalars['u32']['input']>;
  realm_idGT?: InputMaybe<Scalars['u32']['input']>;
  realm_idGTE?: InputMaybe<Scalars['u32']['input']>;
  realm_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  realm_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  realm_idLT?: InputMaybe<Scalars['u32']['input']>;
  realm_idLTE?: InputMaybe<Scalars['u32']['input']>;
  realm_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  realm_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  realm_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  settler_address?: InputMaybe<Scalars['ContractAddress']['input']>;
  settler_addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  settler_addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  settler_addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  settler_addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  settler_addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  settler_addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  settler_addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  settler_addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  settler_addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  settler_addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
};

export type S0_Eternum_ResourceAllowanceOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ResourceAllowanceOrderField;
};

export enum S0_Eternum_ResourceAllowanceOrderField {
  Amount = 'AMOUNT',
  ApprovedEntityId = 'APPROVED_ENTITY_ID',
  OwnerEntityId = 'OWNER_ENTITY_ID',
  ResourceType = 'RESOURCE_TYPE'
}

export type S0_Eternum_ResourceAllowanceWhereInput = {
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

export type S0_Eternum_ResourceBridgeConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ResourceBridgeConfigOrderField;
};

export enum S0_Eternum_ResourceBridgeConfigOrderField {
  ConfigId = 'CONFIG_ID',
  DepositPaused = 'DEPOSIT_PAUSED',
  WithdrawPaused = 'WITHDRAW_PAUSED'
}

export type S0_Eternum_ResourceBridgeConfigWhereInput = {
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
  deposit_paused?: InputMaybe<Scalars['bool']['input']>;
  withdraw_paused?: InputMaybe<Scalars['bool']['input']>;
};

export type S0_Eternum_ResourceBridgeFeeSplitConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ResourceBridgeFeeSplitConfigOrderField;
};

export enum S0_Eternum_ResourceBridgeFeeSplitConfigOrderField {
  ClientFeeOnDptPercent = 'CLIENT_FEE_ON_DPT_PERCENT',
  ClientFeeOnWtdrPercent = 'CLIENT_FEE_ON_WTDR_PERCENT',
  ConfigId = 'CONFIG_ID',
  MaxBankFeeDptPercent = 'MAX_BANK_FEE_DPT_PERCENT',
  MaxBankFeeWtdrPercent = 'MAX_BANK_FEE_WTDR_PERCENT',
  SeasonPoolFeeOnDptPercent = 'SEASON_POOL_FEE_ON_DPT_PERCENT',
  SeasonPoolFeeOnWtdrPercent = 'SEASON_POOL_FEE_ON_WTDR_PERCENT',
  SeasonPoolFeeRecipient = 'SEASON_POOL_FEE_RECIPIENT',
  VelordsFeeOnDptPercent = 'VELORDS_FEE_ON_DPT_PERCENT',
  VelordsFeeOnWtdrPercent = 'VELORDS_FEE_ON_WTDR_PERCENT',
  VelordsFeeRecipient = 'VELORDS_FEE_RECIPIENT'
}

export type S0_Eternum_ResourceBridgeFeeSplitConfigWhereInput = {
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
  max_bank_fee_dpt_percent?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_dpt_percentEQ?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_dpt_percentGT?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_dpt_percentGTE?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_dpt_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  max_bank_fee_dpt_percentLIKE?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_dpt_percentLT?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_dpt_percentLTE?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_dpt_percentNEQ?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_dpt_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  max_bank_fee_dpt_percentNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_wtdr_percent?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_wtdr_percentEQ?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_wtdr_percentGT?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_wtdr_percentGTE?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_wtdr_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  max_bank_fee_wtdr_percentLIKE?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_wtdr_percentLT?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_wtdr_percentLTE?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_wtdr_percentNEQ?: InputMaybe<Scalars['u16']['input']>;
  max_bank_fee_wtdr_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  max_bank_fee_wtdr_percentNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
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

export type S0_Eternum_ResourceBridgeWhitelistConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ResourceBridgeWhitelistConfigOrderField;
};

export enum S0_Eternum_ResourceBridgeWhitelistConfigOrderField {
  ResourceType = 'RESOURCE_TYPE',
  Token = 'TOKEN'
}

export type S0_Eternum_ResourceBridgeWhitelistConfigWhereInput = {
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

export type S0_Eternum_ResourceCostOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ResourceCostOrderField;
};

export enum S0_Eternum_ResourceCostOrderField {
  Amount = 'AMOUNT',
  EntityId = 'ENTITY_ID',
  Index = 'INDEX',
  ResourceType = 'RESOURCE_TYPE'
}

export type S0_Eternum_ResourceCostWhereInput = {
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

export type S0_Eternum_ResourceOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ResourceOrderField;
};

export enum S0_Eternum_ResourceOrderField {
  Balance = 'BALANCE',
  EntityId = 'ENTITY_ID',
  ResourceType = 'RESOURCE_TYPE'
}

export type S0_Eternum_ResourceTransferLockOrder = {
  direction: OrderDirection;
  field: S0_Eternum_ResourceTransferLockOrderField;
};

export enum S0_Eternum_ResourceTransferLockOrderField {
  EntityId = 'ENTITY_ID',
  ReleaseAt = 'RELEASE_AT',
  StartAt = 'START_AT'
}

export type S0_Eternum_ResourceTransferLockWhereInput = {
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
  release_at?: InputMaybe<Scalars['u64']['input']>;
  release_atEQ?: InputMaybe<Scalars['u64']['input']>;
  release_atGT?: InputMaybe<Scalars['u64']['input']>;
  release_atGTE?: InputMaybe<Scalars['u64']['input']>;
  release_atIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  release_atLIKE?: InputMaybe<Scalars['u64']['input']>;
  release_atLT?: InputMaybe<Scalars['u64']['input']>;
  release_atLTE?: InputMaybe<Scalars['u64']['input']>;
  release_atNEQ?: InputMaybe<Scalars['u64']['input']>;
  release_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  release_atNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
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

export type S0_Eternum_ResourceWhereInput = {
  balance?: InputMaybe<Scalars['u128']['input']>;
  balanceEQ?: InputMaybe<Scalars['u128']['input']>;
  balanceGT?: InputMaybe<Scalars['u128']['input']>;
  balanceGTE?: InputMaybe<Scalars['u128']['input']>;
  balanceIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  balanceLIKE?: InputMaybe<Scalars['u128']['input']>;
  balanceLT?: InputMaybe<Scalars['u128']['input']>;
  balanceLTE?: InputMaybe<Scalars['u128']['input']>;
  balanceNEQ?: InputMaybe<Scalars['u128']['input']>;
  balanceNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  balanceNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
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

export type S0_Eternum_SeasonAddressesConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_SeasonAddressesConfigOrderField;
};

export enum S0_Eternum_SeasonAddressesConfigOrderField {
  ConfigId = 'CONFIG_ID',
  LordsAddress = 'LORDS_ADDRESS',
  RealmsAddress = 'REALMS_ADDRESS',
  SeasonPassAddress = 'SEASON_PASS_ADDRESS'
}

export type S0_Eternum_SeasonAddressesConfigWhereInput = {
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

export type S0_Eternum_SeasonBridgeConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_SeasonBridgeConfigOrderField;
};

export enum S0_Eternum_SeasonBridgeConfigOrderField {
  CloseAfterEndSeconds = 'CLOSE_AFTER_END_SECONDS',
  ConfigId = 'CONFIG_ID'
}

export type S0_Eternum_SeasonBridgeConfigWhereInput = {
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
};

export type S0_Eternum_SeasonOrder = {
  direction: OrderDirection;
  field: S0_Eternum_SeasonOrderField;
};

export enum S0_Eternum_SeasonOrderField {
  ConfigId = 'CONFIG_ID',
  EndedAt = 'ENDED_AT',
  IsOver = 'IS_OVER',
  StartAt = 'START_AT'
}

export type S0_Eternum_SeasonWhereInput = {
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

export type S0_Eternum_SettleRealmDataOrder = {
  direction: OrderDirection;
  field: S0_Eternum_SettleRealmDataOrderField;
};

export enum S0_Eternum_SettleRealmDataOrderField {
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

export type S0_Eternum_SettleRealmDataWhereInput = {
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

export type S0_Eternum_SettlementConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_SettlementConfigOrderField;
};

export enum S0_Eternum_SettlementConfigOrderField {
  BaseDistance = 'BASE_DISTANCE',
  Center = 'CENTER',
  ConfigId = 'CONFIG_ID',
  CurrentLayer = 'CURRENT_LAYER',
  CurrentPointOnSide = 'CURRENT_POINT_ON_SIDE',
  CurrentSide = 'CURRENT_SIDE',
  MinFirstLayerDistance = 'MIN_FIRST_LAYER_DISTANCE',
  PointsPlaced = 'POINTS_PLACED'
}

export type S0_Eternum_SettlementConfigWhereInput = {
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

export type S0_Eternum_SpeedConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_SpeedConfigOrderField;
};

export enum S0_Eternum_SpeedConfigOrderField {
  ConfigId = 'CONFIG_ID',
  EntityType = 'ENTITY_TYPE',
  SecPerKm = 'SEC_PER_KM',
  SpeedConfigId = 'SPEED_CONFIG_ID'
}

export type S0_Eternum_SpeedConfigWhereInput = {
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
  entity_type?: InputMaybe<Scalars['u32']['input']>;
  entity_typeEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_typeGT?: InputMaybe<Scalars['u32']['input']>;
  entity_typeGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_typeLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_typeLT?: InputMaybe<Scalars['u32']['input']>;
  entity_typeLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_typeNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_typeNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  sec_per_km?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmEQ?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmGT?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmGTE?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  sec_per_kmLIKE?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmLT?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmLTE?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmNEQ?: InputMaybe<Scalars['u16']['input']>;
  sec_per_kmNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  sec_per_kmNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  speed_config_id?: InputMaybe<Scalars['u32']['input']>;
  speed_config_idEQ?: InputMaybe<Scalars['u32']['input']>;
  speed_config_idGT?: InputMaybe<Scalars['u32']['input']>;
  speed_config_idGTE?: InputMaybe<Scalars['u32']['input']>;
  speed_config_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  speed_config_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  speed_config_idLT?: InputMaybe<Scalars['u32']['input']>;
  speed_config_idLTE?: InputMaybe<Scalars['u32']['input']>;
  speed_config_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  speed_config_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  speed_config_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type S0_Eternum_StaminaConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_StaminaConfigOrderField;
};

export enum S0_Eternum_StaminaConfigOrderField {
  ConfigId = 'CONFIG_ID',
  MaxStamina = 'MAX_STAMINA',
  UnitType = 'UNIT_TYPE'
}

export type S0_Eternum_StaminaConfigWhereInput = {
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
  max_stamina?: InputMaybe<Scalars['u16']['input']>;
  max_staminaEQ?: InputMaybe<Scalars['u16']['input']>;
  max_staminaGT?: InputMaybe<Scalars['u16']['input']>;
  max_staminaGTE?: InputMaybe<Scalars['u16']['input']>;
  max_staminaIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  max_staminaLIKE?: InputMaybe<Scalars['u16']['input']>;
  max_staminaLT?: InputMaybe<Scalars['u16']['input']>;
  max_staminaLTE?: InputMaybe<Scalars['u16']['input']>;
  max_staminaNEQ?: InputMaybe<Scalars['u16']['input']>;
  max_staminaNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  max_staminaNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  unit_type?: InputMaybe<Scalars['u8']['input']>;
  unit_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  unit_typeGT?: InputMaybe<Scalars['u8']['input']>;
  unit_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  unit_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  unit_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  unit_typeLT?: InputMaybe<Scalars['u8']['input']>;
  unit_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  unit_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  unit_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  unit_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S0_Eternum_StaminaOrder = {
  direction: OrderDirection;
  field: S0_Eternum_StaminaOrderField;
};

export enum S0_Eternum_StaminaOrderField {
  Amount = 'AMOUNT',
  EntityId = 'ENTITY_ID',
  LastRefillTick = 'LAST_REFILL_TICK'
}

export type S0_Eternum_StaminaRefillConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_StaminaRefillConfigOrderField;
};

export enum S0_Eternum_StaminaRefillConfigOrderField {
  AmountPerTick = 'AMOUNT_PER_TICK',
  ConfigId = 'CONFIG_ID',
  StartBoostTickCount = 'START_BOOST_TICK_COUNT'
}

export type S0_Eternum_StaminaRefillConfigWhereInput = {
  amount_per_tick?: InputMaybe<Scalars['u16']['input']>;
  amount_per_tickEQ?: InputMaybe<Scalars['u16']['input']>;
  amount_per_tickGT?: InputMaybe<Scalars['u16']['input']>;
  amount_per_tickGTE?: InputMaybe<Scalars['u16']['input']>;
  amount_per_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  amount_per_tickLIKE?: InputMaybe<Scalars['u16']['input']>;
  amount_per_tickLT?: InputMaybe<Scalars['u16']['input']>;
  amount_per_tickLTE?: InputMaybe<Scalars['u16']['input']>;
  amount_per_tickNEQ?: InputMaybe<Scalars['u16']['input']>;
  amount_per_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  amount_per_tickNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
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
  start_boost_tick_count?: InputMaybe<Scalars['u8']['input']>;
  start_boost_tick_countEQ?: InputMaybe<Scalars['u8']['input']>;
  start_boost_tick_countGT?: InputMaybe<Scalars['u8']['input']>;
  start_boost_tick_countGTE?: InputMaybe<Scalars['u8']['input']>;
  start_boost_tick_countIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  start_boost_tick_countLIKE?: InputMaybe<Scalars['u8']['input']>;
  start_boost_tick_countLT?: InputMaybe<Scalars['u8']['input']>;
  start_boost_tick_countLTE?: InputMaybe<Scalars['u8']['input']>;
  start_boost_tick_countNEQ?: InputMaybe<Scalars['u8']['input']>;
  start_boost_tick_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  start_boost_tick_countNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S0_Eternum_StaminaWhereInput = {
  amount?: InputMaybe<Scalars['u16']['input']>;
  amountEQ?: InputMaybe<Scalars['u16']['input']>;
  amountGT?: InputMaybe<Scalars['u16']['input']>;
  amountGTE?: InputMaybe<Scalars['u16']['input']>;
  amountIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  amountLIKE?: InputMaybe<Scalars['u16']['input']>;
  amountLT?: InputMaybe<Scalars['u16']['input']>;
  amountLTE?: InputMaybe<Scalars['u16']['input']>;
  amountNEQ?: InputMaybe<Scalars['u16']['input']>;
  amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  amountNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
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
  last_refill_tick?: InputMaybe<Scalars['u64']['input']>;
  last_refill_tickEQ?: InputMaybe<Scalars['u64']['input']>;
  last_refill_tickGT?: InputMaybe<Scalars['u64']['input']>;
  last_refill_tickGTE?: InputMaybe<Scalars['u64']['input']>;
  last_refill_tickIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  last_refill_tickLIKE?: InputMaybe<Scalars['u64']['input']>;
  last_refill_tickLT?: InputMaybe<Scalars['u64']['input']>;
  last_refill_tickLTE?: InputMaybe<Scalars['u64']['input']>;
  last_refill_tickNEQ?: InputMaybe<Scalars['u64']['input']>;
  last_refill_tickNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  last_refill_tickNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S0_Eternum_StatusOrder = {
  direction: OrderDirection;
  field: S0_Eternum_StatusOrderField;
};

export enum S0_Eternum_StatusOrderField {
  TradeId = 'TRADE_ID',
  Value = 'VALUE'
}

export type S0_Eternum_StatusWhereInput = {
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

export type S0_Eternum_StructureCountOrder = {
  direction: OrderDirection;
  field: S0_Eternum_StructureCountOrderField;
};

export enum S0_Eternum_StructureCountOrderField {
  Coord = 'COORD',
  Count = 'COUNT'
}

export type S0_Eternum_StructureCountWhereInput = {
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
};

export type S0_Eternum_StructureOrder = {
  direction: OrderDirection;
  field: S0_Eternum_StructureOrderField;
};

export enum S0_Eternum_StructureOrderField {
  Category = 'CATEGORY',
  CreatedAt = 'CREATED_AT',
  EntityId = 'ENTITY_ID'
}

export type S0_Eternum_StructureWhereInput = {
  category?: InputMaybe<Scalars['Enum']['input']>;
  created_at?: InputMaybe<Scalars['u64']['input']>;
  created_atEQ?: InputMaybe<Scalars['u64']['input']>;
  created_atGT?: InputMaybe<Scalars['u64']['input']>;
  created_atGTE?: InputMaybe<Scalars['u64']['input']>;
  created_atIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  created_atLIKE?: InputMaybe<Scalars['u64']['input']>;
  created_atLT?: InputMaybe<Scalars['u64']['input']>;
  created_atLTE?: InputMaybe<Scalars['u64']['input']>;
  created_atNEQ?: InputMaybe<Scalars['u64']['input']>;
  created_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  created_atNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
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
};

export type S0_Eternum_SwapEventOrder = {
  direction: OrderDirection;
  field: S0_Eternum_SwapEventOrderField;
};

export enum S0_Eternum_SwapEventOrderField {
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

export type S0_Eternum_SwapEventWhereInput = {
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

export type S0_Eternum_TickConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_TickConfigOrderField;
};

export enum S0_Eternum_TickConfigOrderField {
  ConfigId = 'CONFIG_ID',
  TickId = 'TICK_ID',
  TickIntervalInSeconds = 'TICK_INTERVAL_IN_SECONDS'
}

export type S0_Eternum_TickConfigWhereInput = {
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
  tick_id?: InputMaybe<Scalars['u8']['input']>;
  tick_idEQ?: InputMaybe<Scalars['u8']['input']>;
  tick_idGT?: InputMaybe<Scalars['u8']['input']>;
  tick_idGTE?: InputMaybe<Scalars['u8']['input']>;
  tick_idIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  tick_idLIKE?: InputMaybe<Scalars['u8']['input']>;
  tick_idLT?: InputMaybe<Scalars['u8']['input']>;
  tick_idLTE?: InputMaybe<Scalars['u8']['input']>;
  tick_idNEQ?: InputMaybe<Scalars['u8']['input']>;
  tick_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  tick_idNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  tick_interval_in_seconds?: InputMaybe<Scalars['u64']['input']>;
  tick_interval_in_secondsEQ?: InputMaybe<Scalars['u64']['input']>;
  tick_interval_in_secondsGT?: InputMaybe<Scalars['u64']['input']>;
  tick_interval_in_secondsGTE?: InputMaybe<Scalars['u64']['input']>;
  tick_interval_in_secondsIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  tick_interval_in_secondsLIKE?: InputMaybe<Scalars['u64']['input']>;
  tick_interval_in_secondsLT?: InputMaybe<Scalars['u64']['input']>;
  tick_interval_in_secondsLTE?: InputMaybe<Scalars['u64']['input']>;
  tick_interval_in_secondsNEQ?: InputMaybe<Scalars['u64']['input']>;
  tick_interval_in_secondsNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  tick_interval_in_secondsNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S0_Eternum_TileOrder = {
  direction: OrderDirection;
  field: S0_Eternum_TileOrderField;
};

export enum S0_Eternum_TileOrderField {
  Biome = 'BIOME',
  Col = 'COL',
  ExploredAt = 'EXPLORED_AT',
  ExploredById = 'EXPLORED_BY_ID',
  Row = 'ROW'
}

export type S0_Eternum_TileWhereInput = {
  biome?: InputMaybe<Scalars['Enum']['input']>;
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
  explored_at?: InputMaybe<Scalars['u64']['input']>;
  explored_atEQ?: InputMaybe<Scalars['u64']['input']>;
  explored_atGT?: InputMaybe<Scalars['u64']['input']>;
  explored_atGTE?: InputMaybe<Scalars['u64']['input']>;
  explored_atIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  explored_atLIKE?: InputMaybe<Scalars['u64']['input']>;
  explored_atLT?: InputMaybe<Scalars['u64']['input']>;
  explored_atLTE?: InputMaybe<Scalars['u64']['input']>;
  explored_atNEQ?: InputMaybe<Scalars['u64']['input']>;
  explored_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  explored_atNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  explored_by_id?: InputMaybe<Scalars['u32']['input']>;
  explored_by_idEQ?: InputMaybe<Scalars['u32']['input']>;
  explored_by_idGT?: InputMaybe<Scalars['u32']['input']>;
  explored_by_idGTE?: InputMaybe<Scalars['u32']['input']>;
  explored_by_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  explored_by_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  explored_by_idLT?: InputMaybe<Scalars['u32']['input']>;
  explored_by_idLTE?: InputMaybe<Scalars['u32']['input']>;
  explored_by_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  explored_by_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  explored_by_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
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

export type S0_Eternum_TradeOrder = {
  direction: OrderDirection;
  field: S0_Eternum_TradeOrderField;
};

export enum S0_Eternum_TradeOrderField {
  ExpiresAt = 'EXPIRES_AT',
  MakerGivesResourcesHash = 'MAKER_GIVES_RESOURCES_HASH',
  MakerGivesResourcesId = 'MAKER_GIVES_RESOURCES_ID',
  MakerGivesResourcesOriginId = 'MAKER_GIVES_RESOURCES_ORIGIN_ID',
  MakerGivesResourcesWeight = 'MAKER_GIVES_RESOURCES_WEIGHT',
  MakerId = 'MAKER_ID',
  TakerGivesResourcesHash = 'TAKER_GIVES_RESOURCES_HASH',
  TakerGivesResourcesId = 'TAKER_GIVES_RESOURCES_ID',
  TakerGivesResourcesOriginId = 'TAKER_GIVES_RESOURCES_ORIGIN_ID',
  TakerGivesResourcesWeight = 'TAKER_GIVES_RESOURCES_WEIGHT',
  TakerId = 'TAKER_ID',
  TradeId = 'TRADE_ID'
}

export type S0_Eternum_TradeWhereInput = {
  expires_at?: InputMaybe<Scalars['u64']['input']>;
  expires_atEQ?: InputMaybe<Scalars['u64']['input']>;
  expires_atGT?: InputMaybe<Scalars['u64']['input']>;
  expires_atGTE?: InputMaybe<Scalars['u64']['input']>;
  expires_atIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  expires_atLIKE?: InputMaybe<Scalars['u64']['input']>;
  expires_atLT?: InputMaybe<Scalars['u64']['input']>;
  expires_atLTE?: InputMaybe<Scalars['u64']['input']>;
  expires_atNEQ?: InputMaybe<Scalars['u64']['input']>;
  expires_atNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  expires_atNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  maker_gives_resources_hash?: InputMaybe<Scalars['felt252']['input']>;
  maker_gives_resources_hashEQ?: InputMaybe<Scalars['felt252']['input']>;
  maker_gives_resources_hashGT?: InputMaybe<Scalars['felt252']['input']>;
  maker_gives_resources_hashGTE?: InputMaybe<Scalars['felt252']['input']>;
  maker_gives_resources_hashIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  maker_gives_resources_hashLIKE?: InputMaybe<Scalars['felt252']['input']>;
  maker_gives_resources_hashLT?: InputMaybe<Scalars['felt252']['input']>;
  maker_gives_resources_hashLTE?: InputMaybe<Scalars['felt252']['input']>;
  maker_gives_resources_hashNEQ?: InputMaybe<Scalars['felt252']['input']>;
  maker_gives_resources_hashNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  maker_gives_resources_hashNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  maker_gives_resources_id?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_idEQ?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_idGT?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_idGTE?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maker_gives_resources_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_idLT?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_idLTE?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maker_gives_resources_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_origin_id?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_origin_idEQ?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_origin_idGT?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_origin_idGTE?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_origin_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maker_gives_resources_origin_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_origin_idLT?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_origin_idLTE?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_origin_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_origin_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  maker_gives_resources_origin_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  maker_gives_resources_weight?: InputMaybe<Scalars['u128']['input']>;
  maker_gives_resources_weightEQ?: InputMaybe<Scalars['u128']['input']>;
  maker_gives_resources_weightGT?: InputMaybe<Scalars['u128']['input']>;
  maker_gives_resources_weightGTE?: InputMaybe<Scalars['u128']['input']>;
  maker_gives_resources_weightIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  maker_gives_resources_weightLIKE?: InputMaybe<Scalars['u128']['input']>;
  maker_gives_resources_weightLT?: InputMaybe<Scalars['u128']['input']>;
  maker_gives_resources_weightLTE?: InputMaybe<Scalars['u128']['input']>;
  maker_gives_resources_weightNEQ?: InputMaybe<Scalars['u128']['input']>;
  maker_gives_resources_weightNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  maker_gives_resources_weightNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
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
  taker_gives_resources_hash?: InputMaybe<Scalars['felt252']['input']>;
  taker_gives_resources_hashEQ?: InputMaybe<Scalars['felt252']['input']>;
  taker_gives_resources_hashGT?: InputMaybe<Scalars['felt252']['input']>;
  taker_gives_resources_hashGTE?: InputMaybe<Scalars['felt252']['input']>;
  taker_gives_resources_hashIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  taker_gives_resources_hashLIKE?: InputMaybe<Scalars['felt252']['input']>;
  taker_gives_resources_hashLT?: InputMaybe<Scalars['felt252']['input']>;
  taker_gives_resources_hashLTE?: InputMaybe<Scalars['felt252']['input']>;
  taker_gives_resources_hashNEQ?: InputMaybe<Scalars['felt252']['input']>;
  taker_gives_resources_hashNOTIN?: InputMaybe<Array<InputMaybe<Scalars['felt252']['input']>>>;
  taker_gives_resources_hashNOTLIKE?: InputMaybe<Scalars['felt252']['input']>;
  taker_gives_resources_id?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_idEQ?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_idGT?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_idGTE?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  taker_gives_resources_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_idLT?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_idLTE?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  taker_gives_resources_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_origin_id?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_origin_idEQ?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_origin_idGT?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_origin_idGTE?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_origin_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  taker_gives_resources_origin_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_origin_idLT?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_origin_idLTE?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_origin_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_origin_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  taker_gives_resources_origin_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  taker_gives_resources_weight?: InputMaybe<Scalars['u128']['input']>;
  taker_gives_resources_weightEQ?: InputMaybe<Scalars['u128']['input']>;
  taker_gives_resources_weightGT?: InputMaybe<Scalars['u128']['input']>;
  taker_gives_resources_weightGTE?: InputMaybe<Scalars['u128']['input']>;
  taker_gives_resources_weightIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  taker_gives_resources_weightLIKE?: InputMaybe<Scalars['u128']['input']>;
  taker_gives_resources_weightLT?: InputMaybe<Scalars['u128']['input']>;
  taker_gives_resources_weightLTE?: InputMaybe<Scalars['u128']['input']>;
  taker_gives_resources_weightNEQ?: InputMaybe<Scalars['u128']['input']>;
  taker_gives_resources_weightNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  taker_gives_resources_weightNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
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

export type S0_Eternum_TransferOrder = {
  direction: OrderDirection;
  field: S0_Eternum_TransferOrderField;
};

export enum S0_Eternum_TransferOrderField {
  RecipientEntityId = 'RECIPIENT_ENTITY_ID',
  Resources = 'RESOURCES',
  SenderEntityId = 'SENDER_ENTITY_ID',
  SendingRealmId = 'SENDING_REALM_ID',
  Timestamp = 'TIMESTAMP'
}

export type S0_Eternum_TransferWhereInput = {
  recipient_entity_id?: InputMaybe<Scalars['u32']['input']>;
  recipient_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  recipient_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  recipient_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  recipient_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  recipient_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  recipient_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  recipient_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  recipient_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  recipient_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  recipient_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  sender_entity_id?: InputMaybe<Scalars['u32']['input']>;
  sender_entity_idEQ?: InputMaybe<Scalars['u32']['input']>;
  sender_entity_idGT?: InputMaybe<Scalars['u32']['input']>;
  sender_entity_idGTE?: InputMaybe<Scalars['u32']['input']>;
  sender_entity_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  sender_entity_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  sender_entity_idLT?: InputMaybe<Scalars['u32']['input']>;
  sender_entity_idLTE?: InputMaybe<Scalars['u32']['input']>;
  sender_entity_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  sender_entity_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  sender_entity_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
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

export type S0_Eternum_TravelFoodCostConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_TravelFoodCostConfigOrderField;
};

export enum S0_Eternum_TravelFoodCostConfigOrderField {
  ConfigId = 'CONFIG_ID',
  ExploreFishBurnAmount = 'EXPLORE_FISH_BURN_AMOUNT',
  ExploreWheatBurnAmount = 'EXPLORE_WHEAT_BURN_AMOUNT',
  TravelFishBurnAmount = 'TRAVEL_FISH_BURN_AMOUNT',
  TravelWheatBurnAmount = 'TRAVEL_WHEAT_BURN_AMOUNT',
  UnitType = 'UNIT_TYPE'
}

export type S0_Eternum_TravelFoodCostConfigWhereInput = {
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
  explore_fish_burn_amount?: InputMaybe<Scalars['u128']['input']>;
  explore_fish_burn_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  explore_fish_burn_amountGT?: InputMaybe<Scalars['u128']['input']>;
  explore_fish_burn_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  explore_fish_burn_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  explore_fish_burn_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  explore_fish_burn_amountLT?: InputMaybe<Scalars['u128']['input']>;
  explore_fish_burn_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  explore_fish_burn_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  explore_fish_burn_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  explore_fish_burn_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  explore_wheat_burn_amount?: InputMaybe<Scalars['u128']['input']>;
  explore_wheat_burn_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  explore_wheat_burn_amountGT?: InputMaybe<Scalars['u128']['input']>;
  explore_wheat_burn_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  explore_wheat_burn_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  explore_wheat_burn_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  explore_wheat_burn_amountLT?: InputMaybe<Scalars['u128']['input']>;
  explore_wheat_burn_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  explore_wheat_burn_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  explore_wheat_burn_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  explore_wheat_burn_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  travel_fish_burn_amount?: InputMaybe<Scalars['u128']['input']>;
  travel_fish_burn_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  travel_fish_burn_amountGT?: InputMaybe<Scalars['u128']['input']>;
  travel_fish_burn_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  travel_fish_burn_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  travel_fish_burn_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  travel_fish_burn_amountLT?: InputMaybe<Scalars['u128']['input']>;
  travel_fish_burn_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  travel_fish_burn_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  travel_fish_burn_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  travel_fish_burn_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  travel_wheat_burn_amount?: InputMaybe<Scalars['u128']['input']>;
  travel_wheat_burn_amountEQ?: InputMaybe<Scalars['u128']['input']>;
  travel_wheat_burn_amountGT?: InputMaybe<Scalars['u128']['input']>;
  travel_wheat_burn_amountGTE?: InputMaybe<Scalars['u128']['input']>;
  travel_wheat_burn_amountIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  travel_wheat_burn_amountLIKE?: InputMaybe<Scalars['u128']['input']>;
  travel_wheat_burn_amountLT?: InputMaybe<Scalars['u128']['input']>;
  travel_wheat_burn_amountLTE?: InputMaybe<Scalars['u128']['input']>;
  travel_wheat_burn_amountNEQ?: InputMaybe<Scalars['u128']['input']>;
  travel_wheat_burn_amountNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  travel_wheat_burn_amountNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  unit_type?: InputMaybe<Scalars['u8']['input']>;
  unit_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  unit_typeGT?: InputMaybe<Scalars['u8']['input']>;
  unit_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  unit_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  unit_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  unit_typeLT?: InputMaybe<Scalars['u8']['input']>;
  unit_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  unit_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  unit_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  unit_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S0_Eternum_TravelOrder = {
  direction: OrderDirection;
  field: S0_Eternum_TravelOrderField;
};

export enum S0_Eternum_TravelOrderField {
  DestinationCoordX = 'DESTINATION_COORD_X',
  DestinationCoordY = 'DESTINATION_COORD_Y',
  EntityId = 'ENTITY_ID',
  Owner = 'OWNER',
  Timestamp = 'TIMESTAMP',
  TravelPath = 'TRAVEL_PATH',
  TravelTime = 'TRAVEL_TIME'
}

export type S0_Eternum_TravelStaminaCostConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_TravelStaminaCostConfigOrderField;
};

export enum S0_Eternum_TravelStaminaCostConfigOrderField {
  ConfigId = 'CONFIG_ID',
  Cost = 'COST',
  TravelType = 'TRAVEL_TYPE'
}

export type S0_Eternum_TravelStaminaCostConfigWhereInput = {
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
  cost?: InputMaybe<Scalars['u16']['input']>;
  costEQ?: InputMaybe<Scalars['u16']['input']>;
  costGT?: InputMaybe<Scalars['u16']['input']>;
  costGTE?: InputMaybe<Scalars['u16']['input']>;
  costIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  costLIKE?: InputMaybe<Scalars['u16']['input']>;
  costLT?: InputMaybe<Scalars['u16']['input']>;
  costLTE?: InputMaybe<Scalars['u16']['input']>;
  costNEQ?: InputMaybe<Scalars['u16']['input']>;
  costNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  costNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  travel_type?: InputMaybe<Scalars['u8']['input']>;
  travel_typeEQ?: InputMaybe<Scalars['u8']['input']>;
  travel_typeGT?: InputMaybe<Scalars['u8']['input']>;
  travel_typeGTE?: InputMaybe<Scalars['u8']['input']>;
  travel_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  travel_typeLIKE?: InputMaybe<Scalars['u8']['input']>;
  travel_typeLT?: InputMaybe<Scalars['u8']['input']>;
  travel_typeLTE?: InputMaybe<Scalars['u8']['input']>;
  travel_typeNEQ?: InputMaybe<Scalars['u8']['input']>;
  travel_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  travel_typeNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S0_Eternum_TravelWhereInput = {
  destination_coord_x?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_xEQ?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_xGT?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_xGTE?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_xIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  destination_coord_xLIKE?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_xLT?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_xLTE?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_xNEQ?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_xNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  destination_coord_xNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_y?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_yEQ?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_yGT?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_yGTE?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_yIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  destination_coord_yLIKE?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_yLT?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_yLTE?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_yNEQ?: InputMaybe<Scalars['u32']['input']>;
  destination_coord_yNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  destination_coord_yNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
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
  travel_time?: InputMaybe<Scalars['u64']['input']>;
  travel_timeEQ?: InputMaybe<Scalars['u64']['input']>;
  travel_timeGT?: InputMaybe<Scalars['u64']['input']>;
  travel_timeGTE?: InputMaybe<Scalars['u64']['input']>;
  travel_timeIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  travel_timeLIKE?: InputMaybe<Scalars['u64']['input']>;
  travel_timeLT?: InputMaybe<Scalars['u64']['input']>;
  travel_timeLTE?: InputMaybe<Scalars['u64']['input']>;
  travel_timeNEQ?: InputMaybe<Scalars['u64']['input']>;
  travel_timeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  travel_timeNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type S0_Eternum_TroopConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_TroopConfigOrderField;
};

export enum S0_Eternum_TroopConfigOrderField {
  AdvantagePercent = 'ADVANTAGE_PERCENT',
  ArmyExtraPerBuilding = 'ARMY_EXTRA_PER_BUILDING',
  ArmyFreePerStructure = 'ARMY_FREE_PER_STRUCTURE',
  ArmyMaxPerStructure = 'ARMY_MAX_PER_STRUCTURE',
  BattleLeaveSlashDenom = 'BATTLE_LEAVE_SLASH_DENOM',
  BattleLeaveSlashNum = 'BATTLE_LEAVE_SLASH_NUM',
  BattleMaxTimeSeconds = 'BATTLE_MAX_TIME_SECONDS',
  BattleTimeScale = 'BATTLE_TIME_SCALE',
  ConfigId = 'CONFIG_ID',
  CrossbowmanStrength = 'CROSSBOWMAN_STRENGTH',
  DisadvantagePercent = 'DISADVANTAGE_PERCENT',
  Health = 'HEALTH',
  KnightStrength = 'KNIGHT_STRENGTH',
  MaxTroopCount = 'MAX_TROOP_COUNT',
  PaladinStrength = 'PALADIN_STRENGTH',
  PillageHealthDivisor = 'PILLAGE_HEALTH_DIVISOR'
}

export type S0_Eternum_TroopConfigWhereInput = {
  advantage_percent?: InputMaybe<Scalars['u16']['input']>;
  advantage_percentEQ?: InputMaybe<Scalars['u16']['input']>;
  advantage_percentGT?: InputMaybe<Scalars['u16']['input']>;
  advantage_percentGTE?: InputMaybe<Scalars['u16']['input']>;
  advantage_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  advantage_percentLIKE?: InputMaybe<Scalars['u16']['input']>;
  advantage_percentLT?: InputMaybe<Scalars['u16']['input']>;
  advantage_percentLTE?: InputMaybe<Scalars['u16']['input']>;
  advantage_percentNEQ?: InputMaybe<Scalars['u16']['input']>;
  advantage_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  advantage_percentNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  army_extra_per_building?: InputMaybe<Scalars['u8']['input']>;
  army_extra_per_buildingEQ?: InputMaybe<Scalars['u8']['input']>;
  army_extra_per_buildingGT?: InputMaybe<Scalars['u8']['input']>;
  army_extra_per_buildingGTE?: InputMaybe<Scalars['u8']['input']>;
  army_extra_per_buildingIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  army_extra_per_buildingLIKE?: InputMaybe<Scalars['u8']['input']>;
  army_extra_per_buildingLT?: InputMaybe<Scalars['u8']['input']>;
  army_extra_per_buildingLTE?: InputMaybe<Scalars['u8']['input']>;
  army_extra_per_buildingNEQ?: InputMaybe<Scalars['u8']['input']>;
  army_extra_per_buildingNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  army_extra_per_buildingNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  army_free_per_structure?: InputMaybe<Scalars['u8']['input']>;
  army_free_per_structureEQ?: InputMaybe<Scalars['u8']['input']>;
  army_free_per_structureGT?: InputMaybe<Scalars['u8']['input']>;
  army_free_per_structureGTE?: InputMaybe<Scalars['u8']['input']>;
  army_free_per_structureIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  army_free_per_structureLIKE?: InputMaybe<Scalars['u8']['input']>;
  army_free_per_structureLT?: InputMaybe<Scalars['u8']['input']>;
  army_free_per_structureLTE?: InputMaybe<Scalars['u8']['input']>;
  army_free_per_structureNEQ?: InputMaybe<Scalars['u8']['input']>;
  army_free_per_structureNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  army_free_per_structureNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  army_max_per_structure?: InputMaybe<Scalars['u8']['input']>;
  army_max_per_structureEQ?: InputMaybe<Scalars['u8']['input']>;
  army_max_per_structureGT?: InputMaybe<Scalars['u8']['input']>;
  army_max_per_structureGTE?: InputMaybe<Scalars['u8']['input']>;
  army_max_per_structureIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  army_max_per_structureLIKE?: InputMaybe<Scalars['u8']['input']>;
  army_max_per_structureLT?: InputMaybe<Scalars['u8']['input']>;
  army_max_per_structureLTE?: InputMaybe<Scalars['u8']['input']>;
  army_max_per_structureNEQ?: InputMaybe<Scalars['u8']['input']>;
  army_max_per_structureNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  army_max_per_structureNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_denom?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_denomEQ?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_denomGT?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_denomGTE?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_denomIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  battle_leave_slash_denomLIKE?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_denomLT?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_denomLTE?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_denomNEQ?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_denomNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  battle_leave_slash_denomNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_num?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_numEQ?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_numGT?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_numGTE?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_numIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  battle_leave_slash_numLIKE?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_numLT?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_numLTE?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_numNEQ?: InputMaybe<Scalars['u8']['input']>;
  battle_leave_slash_numNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  battle_leave_slash_numNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  battle_max_time_seconds?: InputMaybe<Scalars['u64']['input']>;
  battle_max_time_secondsEQ?: InputMaybe<Scalars['u64']['input']>;
  battle_max_time_secondsGT?: InputMaybe<Scalars['u64']['input']>;
  battle_max_time_secondsGTE?: InputMaybe<Scalars['u64']['input']>;
  battle_max_time_secondsIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  battle_max_time_secondsLIKE?: InputMaybe<Scalars['u64']['input']>;
  battle_max_time_secondsLT?: InputMaybe<Scalars['u64']['input']>;
  battle_max_time_secondsLTE?: InputMaybe<Scalars['u64']['input']>;
  battle_max_time_secondsNEQ?: InputMaybe<Scalars['u64']['input']>;
  battle_max_time_secondsNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  battle_max_time_secondsNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  battle_time_scale?: InputMaybe<Scalars['u16']['input']>;
  battle_time_scaleEQ?: InputMaybe<Scalars['u16']['input']>;
  battle_time_scaleGT?: InputMaybe<Scalars['u16']['input']>;
  battle_time_scaleGTE?: InputMaybe<Scalars['u16']['input']>;
  battle_time_scaleIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  battle_time_scaleLIKE?: InputMaybe<Scalars['u16']['input']>;
  battle_time_scaleLT?: InputMaybe<Scalars['u16']['input']>;
  battle_time_scaleLTE?: InputMaybe<Scalars['u16']['input']>;
  battle_time_scaleNEQ?: InputMaybe<Scalars['u16']['input']>;
  battle_time_scaleNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  battle_time_scaleNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
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
  crossbowman_strength?: InputMaybe<Scalars['u16']['input']>;
  crossbowman_strengthEQ?: InputMaybe<Scalars['u16']['input']>;
  crossbowman_strengthGT?: InputMaybe<Scalars['u16']['input']>;
  crossbowman_strengthGTE?: InputMaybe<Scalars['u16']['input']>;
  crossbowman_strengthIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  crossbowman_strengthLIKE?: InputMaybe<Scalars['u16']['input']>;
  crossbowman_strengthLT?: InputMaybe<Scalars['u16']['input']>;
  crossbowman_strengthLTE?: InputMaybe<Scalars['u16']['input']>;
  crossbowman_strengthNEQ?: InputMaybe<Scalars['u16']['input']>;
  crossbowman_strengthNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  crossbowman_strengthNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  disadvantage_percent?: InputMaybe<Scalars['u16']['input']>;
  disadvantage_percentEQ?: InputMaybe<Scalars['u16']['input']>;
  disadvantage_percentGT?: InputMaybe<Scalars['u16']['input']>;
  disadvantage_percentGTE?: InputMaybe<Scalars['u16']['input']>;
  disadvantage_percentIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  disadvantage_percentLIKE?: InputMaybe<Scalars['u16']['input']>;
  disadvantage_percentLT?: InputMaybe<Scalars['u16']['input']>;
  disadvantage_percentLTE?: InputMaybe<Scalars['u16']['input']>;
  disadvantage_percentNEQ?: InputMaybe<Scalars['u16']['input']>;
  disadvantage_percentNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  disadvantage_percentNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  health?: InputMaybe<Scalars['u32']['input']>;
  healthEQ?: InputMaybe<Scalars['u32']['input']>;
  healthGT?: InputMaybe<Scalars['u32']['input']>;
  healthGTE?: InputMaybe<Scalars['u32']['input']>;
  healthIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  healthLIKE?: InputMaybe<Scalars['u32']['input']>;
  healthLT?: InputMaybe<Scalars['u32']['input']>;
  healthLTE?: InputMaybe<Scalars['u32']['input']>;
  healthNEQ?: InputMaybe<Scalars['u32']['input']>;
  healthNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  healthNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  knight_strength?: InputMaybe<Scalars['u8']['input']>;
  knight_strengthEQ?: InputMaybe<Scalars['u8']['input']>;
  knight_strengthGT?: InputMaybe<Scalars['u8']['input']>;
  knight_strengthGTE?: InputMaybe<Scalars['u8']['input']>;
  knight_strengthIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  knight_strengthLIKE?: InputMaybe<Scalars['u8']['input']>;
  knight_strengthLT?: InputMaybe<Scalars['u8']['input']>;
  knight_strengthLTE?: InputMaybe<Scalars['u8']['input']>;
  knight_strengthNEQ?: InputMaybe<Scalars['u8']['input']>;
  knight_strengthNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  knight_strengthNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  max_troop_count?: InputMaybe<Scalars['u64']['input']>;
  max_troop_countEQ?: InputMaybe<Scalars['u64']['input']>;
  max_troop_countGT?: InputMaybe<Scalars['u64']['input']>;
  max_troop_countGTE?: InputMaybe<Scalars['u64']['input']>;
  max_troop_countIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  max_troop_countLIKE?: InputMaybe<Scalars['u64']['input']>;
  max_troop_countLT?: InputMaybe<Scalars['u64']['input']>;
  max_troop_countLTE?: InputMaybe<Scalars['u64']['input']>;
  max_troop_countNEQ?: InputMaybe<Scalars['u64']['input']>;
  max_troop_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  max_troop_countNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  paladin_strength?: InputMaybe<Scalars['u8']['input']>;
  paladin_strengthEQ?: InputMaybe<Scalars['u8']['input']>;
  paladin_strengthGT?: InputMaybe<Scalars['u8']['input']>;
  paladin_strengthGTE?: InputMaybe<Scalars['u8']['input']>;
  paladin_strengthIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  paladin_strengthLIKE?: InputMaybe<Scalars['u8']['input']>;
  paladin_strengthLT?: InputMaybe<Scalars['u8']['input']>;
  paladin_strengthLTE?: InputMaybe<Scalars['u8']['input']>;
  paladin_strengthNEQ?: InputMaybe<Scalars['u8']['input']>;
  paladin_strengthNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  paladin_strengthNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
  pillage_health_divisor?: InputMaybe<Scalars['u8']['input']>;
  pillage_health_divisorEQ?: InputMaybe<Scalars['u8']['input']>;
  pillage_health_divisorGT?: InputMaybe<Scalars['u8']['input']>;
  pillage_health_divisorGTE?: InputMaybe<Scalars['u8']['input']>;
  pillage_health_divisorIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  pillage_health_divisorLIKE?: InputMaybe<Scalars['u8']['input']>;
  pillage_health_divisorLT?: InputMaybe<Scalars['u8']['input']>;
  pillage_health_divisorLTE?: InputMaybe<Scalars['u8']['input']>;
  pillage_health_divisorNEQ?: InputMaybe<Scalars['u8']['input']>;
  pillage_health_divisorNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u8']['input']>>>;
  pillage_health_divisorNOTLIKE?: InputMaybe<Scalars['u8']['input']>;
};

export type S0_Eternum_TrophyCreationOrder = {
  direction: OrderDirection;
  field: S0_Eternum_TrophyCreationOrderField;
};

export enum S0_Eternum_TrophyCreationOrderField {
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

export type S0_Eternum_TrophyCreationWhereInput = {
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

export type S0_Eternum_TrophyProgressionOrder = {
  direction: OrderDirection;
  field: S0_Eternum_TrophyProgressionOrderField;
};

export enum S0_Eternum_TrophyProgressionOrderField {
  Count = 'COUNT',
  PlayerId = 'PLAYER_ID',
  TaskId = 'TASK_ID',
  Time = 'TIME'
}

export type S0_Eternum_TrophyProgressionWhereInput = {
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

export type S0_Eternum_VrfConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_VrfConfigOrderField;
};

export enum S0_Eternum_VrfConfigOrderField {
  ConfigId = 'CONFIG_ID',
  VrfProviderAddress = 'VRF_PROVIDER_ADDRESS'
}

export type S0_Eternum_VrfConfigWhereInput = {
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

export type S0_Eternum_WeightConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_WeightConfigOrderField;
};

export enum S0_Eternum_WeightConfigOrderField {
  ConfigId = 'CONFIG_ID',
  EntityType = 'ENTITY_TYPE',
  WeightConfigId = 'WEIGHT_CONFIG_ID',
  WeightGram = 'WEIGHT_GRAM'
}

export type S0_Eternum_WeightConfigWhereInput = {
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
  entity_type?: InputMaybe<Scalars['u32']['input']>;
  entity_typeEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_typeGT?: InputMaybe<Scalars['u32']['input']>;
  entity_typeGTE?: InputMaybe<Scalars['u32']['input']>;
  entity_typeIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_typeLIKE?: InputMaybe<Scalars['u32']['input']>;
  entity_typeLT?: InputMaybe<Scalars['u32']['input']>;
  entity_typeLTE?: InputMaybe<Scalars['u32']['input']>;
  entity_typeNEQ?: InputMaybe<Scalars['u32']['input']>;
  entity_typeNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  entity_typeNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
  weight_config_id?: InputMaybe<Scalars['u32']['input']>;
  weight_config_idEQ?: InputMaybe<Scalars['u32']['input']>;
  weight_config_idGT?: InputMaybe<Scalars['u32']['input']>;
  weight_config_idGTE?: InputMaybe<Scalars['u32']['input']>;
  weight_config_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  weight_config_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  weight_config_idLT?: InputMaybe<Scalars['u32']['input']>;
  weight_config_idLTE?: InputMaybe<Scalars['u32']['input']>;
  weight_config_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  weight_config_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  weight_config_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
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

export type S0_Eternum_WeightOrder = {
  direction: OrderDirection;
  field: S0_Eternum_WeightOrderField;
};

export enum S0_Eternum_WeightOrderField {
  EntityId = 'ENTITY_ID',
  Value = 'VALUE'
}

export type S0_Eternum_WeightWhereInput = {
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

export type S0_Eternum_WorldConfigOrder = {
  direction: OrderDirection;
  field: S0_Eternum_WorldConfigOrderField;
};

export enum S0_Eternum_WorldConfigOrderField {
  AdminAddress = 'ADMIN_ADDRESS',
  ConfigId = 'CONFIG_ID',
  RealmL2Contract = 'REALM_L2_CONTRACT'
}

export type S0_Eternum_WorldConfigWhereInput = {
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
  realm_l2_contract?: InputMaybe<Scalars['ContractAddress']['input']>;
  realm_l2_contractEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  realm_l2_contractGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  realm_l2_contractGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  realm_l2_contractIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  realm_l2_contractLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  realm_l2_contractLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  realm_l2_contractLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  realm_l2_contractNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  realm_l2_contractNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  realm_l2_contractNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
};

export type GetCapacitySpeedConfigQueryVariables = Exact<{
  category: Scalars['Enum']['input'];
  entityType: Scalars['u32']['input'];
}>;


export type GetCapacitySpeedConfigQuery = { __typename?: 'World__Query', s0EternumCapacityConfigModels?: { __typename?: 's0_eternum_CapacityConfigConnection', edges?: Array<{ __typename?: 's0_eternum_CapacityConfigEdge', node?: { __typename?: 's0_eternum_CapacityConfig', weight_gram?: any | null } | null } | null> | null } | null, s0EternumSpeedConfigModels?: { __typename?: 's0_eternum_SpeedConfigConnection', edges?: Array<{ __typename?: 's0_eternum_SpeedConfigEdge', node?: { __typename?: 's0_eternum_SpeedConfig', sec_per_km?: any | null } | null } | null> | null } | null };

export type GetEternumOwnerRealmIdsQueryVariables = Exact<{
  accountAddress: Scalars['ContractAddress']['input'];
}>;


export type GetEternumOwnerRealmIdsQuery = { __typename?: 'World__Query', s0EternumOwnerModels?: { __typename?: 's0_eternum_OwnerConnection', edges?: Array<{ __typename?: 's0_eternum_OwnerEdge', node?: { __typename?: 's0_eternum_Owner', address?: any | null, entity_id?: any | null, entity?: { __typename?: 'World__Entity', models?: Array<{ __typename: 's0_eternum_AcceptOrder' } | { __typename: 's0_eternum_AcceptPartialOrder' } | { __typename: 's0_eternum_AddressName' } | { __typename: 's0_eternum_Army' } | { __typename: 's0_eternum_ArrivalTime' } | { __typename: 's0_eternum_Bank' } | { __typename: 's0_eternum_BankConfig' } | { __typename: 's0_eternum_Battle' } | { __typename: 's0_eternum_BattleClaimData' } | { __typename: 's0_eternum_BattleConfig' } | { __typename: 's0_eternum_BattleJoinData' } | { __typename: 's0_eternum_BattleLeaveData' } | { __typename: 's0_eternum_BattlePillageData' } | { __typename: 's0_eternum_BattleStartData' } | { __typename: 's0_eternum_Building' } | { __typename: 's0_eternum_BuildingCategoryPopConfig' } | { __typename: 's0_eternum_BuildingConfig' } | { __typename: 's0_eternum_BuildingGeneralConfig' } | { __typename: 's0_eternum_BuildingQuantityv2' } | { __typename: 's0_eternum_BurnDonkey' } | { __typename: 's0_eternum_CancelOrder' } | { __typename: 's0_eternum_CapacityCategory' } | { __typename: 's0_eternum_CapacityConfig' } | { __typename: 's0_eternum_Contribution' } | { __typename: 's0_eternum_CreateGuild' } | { __typename: 's0_eternum_CreateOrder' } | { __typename: 's0_eternum_DetachedResource' } | { __typename: 's0_eternum_EntityName' } | { __typename: 's0_eternum_EntityOwner' } | { __typename: 's0_eternum_Epoch' } | { __typename: 's0_eternum_FragmentMineDiscovered' } | { __typename: 's0_eternum_GameEnded' } | { __typename: 's0_eternum_Guild' } | { __typename: 's0_eternum_GuildMember' } | { __typename: 's0_eternum_GuildWhitelist' } | { __typename: 's0_eternum_Health' } | { __typename: 's0_eternum_Hyperstructure' } | { __typename: 's0_eternum_HyperstructureCoOwnersChange' } | { __typename: 's0_eternum_HyperstructureConfig' } | { __typename: 's0_eternum_HyperstructureContribution' } | { __typename: 's0_eternum_HyperstructureFinished' } | { __typename: 's0_eternum_HyperstructureResourceConfig' } | { __typename: 's0_eternum_HyperstructureStarted' } | { __typename: 's0_eternum_JoinGuild' } | { __typename: 's0_eternum_Leaderboard' } | { __typename: 's0_eternum_LeaderboardEntry' } | { __typename: 's0_eternum_LeaderboardRegisterContribution' } | { __typename: 's0_eternum_LeaderboardRegisterShare' } | { __typename: 's0_eternum_LeaderboardRegistered' } | { __typename: 's0_eternum_LeaderboardRewardClaimed' } | { __typename: 's0_eternum_LevelingConfig' } | { __typename: 's0_eternum_Liquidity' } | { __typename: 's0_eternum_LiquidityEvent' } | { __typename: 's0_eternum_MapConfig' } | { __typename: 's0_eternum_MapExplored' } | { __typename: 's0_eternum_Market' } | { __typename: 's0_eternum_MercenariesConfig' } | { __typename: 's0_eternum_Message' } | { __typename: 's0_eternum_Movable' } | { __typename: 's0_eternum_Orders' } | { __typename: 's0_eternum_OwnedResourcesTracker' } | { __typename: 's0_eternum_Owner' } | { __typename: 's0_eternum_Population' } | { __typename: 's0_eternum_PopulationConfig' } | { __typename: 's0_eternum_Position' } | { __typename: 's0_eternum_Production' } | { __typename: 's0_eternum_ProductionConfig' } | { __typename: 's0_eternum_ProductionDeadline' } | { __typename: 's0_eternum_ProductionInput' } | { __typename: 's0_eternum_ProductionOutput' } | { __typename: 's0_eternum_Progress' } | { __typename: 's0_eternum_Protectee' } | { __typename: 's0_eternum_Protector' } | { __typename: 's0_eternum_Quantity' } | { __typename: 's0_eternum_QuantityTracker' } | { __typename: 's0_eternum_Quest' } | { __typename: 's0_eternum_QuestBonus' } | { __typename: 's0_eternum_QuestConfig' } | { __typename: 's0_eternum_QuestRewardConfig' } | { __typename: 's0_eternum_Realm', realm_id?: any | null } | { __typename: 's0_eternum_RealmLevelConfig' } | { __typename: 's0_eternum_RealmMaxLevelConfig' } | { __typename: 's0_eternum_Resource' } | { __typename: 's0_eternum_ResourceAllowance' } | { __typename: 's0_eternum_ResourceBridgeConfig' } | { __typename: 's0_eternum_ResourceBridgeFeeSplitConfig' } | { __typename: 's0_eternum_ResourceBridgeWhitelistConfig' } | { __typename: 's0_eternum_ResourceCost' } | { __typename: 's0_eternum_ResourceTransferLock' } | { __typename: 's0_eternum_Season' } | { __typename: 's0_eternum_SeasonAddressesConfig' } | { __typename: 's0_eternum_SeasonBridgeConfig' } | { __typename: 's0_eternum_SettleRealmData' } | { __typename: 's0_eternum_SettlementConfig' } | { __typename: 's0_eternum_SpeedConfig' } | { __typename: 's0_eternum_Stamina' } | { __typename: 's0_eternum_StaminaConfig' } | { __typename: 's0_eternum_StaminaRefillConfig' } | { __typename: 's0_eternum_Status' } | { __typename: 's0_eternum_Structure' } | { __typename: 's0_eternum_StructureCount' } | { __typename: 's0_eternum_SwapEvent' } | { __typename: 's0_eternum_TickConfig' } | { __typename: 's0_eternum_Tile' } | { __typename: 's0_eternum_Trade' } | { __typename: 's0_eternum_Transfer' } | { __typename: 's0_eternum_Travel' } | { __typename: 's0_eternum_TravelFoodCostConfig' } | { __typename: 's0_eternum_TravelStaminaCostConfig' } | { __typename: 's0_eternum_TroopConfig' } | { __typename: 's0_eternum_TrophyCreation' } | { __typename: 's0_eternum_TrophyProgression' } | { __typename: 's0_eternum_VRFConfig' } | { __typename: 's0_eternum_Weight' } | { __typename: 's0_eternum_WeightConfig' } | { __typename: 's0_eternum_WorldConfig' } | null> | null } | null } | null } | null> | null } | null };

export type GetEternumEntityOwnerQueryVariables = Exact<{
  entityOwnerIds: Array<Scalars['u32']['input']> | Scalars['u32']['input'];
}>;


export type GetEternumEntityOwnerQuery = { __typename?: 'World__Query', s0EternumEntityOwnerModels?: { __typename?: 's0_eternum_EntityOwnerConnection', edges?: Array<{ __typename?: 's0_eternum_EntityOwnerEdge', node?: { __typename?: 's0_eternum_EntityOwner', entity_id?: any | null, entity_owner_id?: any | null, entity?: { __typename?: 'World__Entity', models?: Array<{ __typename: 's0_eternum_AcceptOrder' } | { __typename: 's0_eternum_AcceptPartialOrder' } | { __typename: 's0_eternum_AddressName' } | { __typename: 's0_eternum_Army' } | { __typename: 's0_eternum_ArrivalTime', arrives_at?: any | null } | { __typename: 's0_eternum_Bank' } | { __typename: 's0_eternum_BankConfig' } | { __typename: 's0_eternum_Battle' } | { __typename: 's0_eternum_BattleClaimData' } | { __typename: 's0_eternum_BattleConfig' } | { __typename: 's0_eternum_BattleJoinData' } | { __typename: 's0_eternum_BattleLeaveData' } | { __typename: 's0_eternum_BattlePillageData' } | { __typename: 's0_eternum_BattleStartData' } | { __typename: 's0_eternum_Building' } | { __typename: 's0_eternum_BuildingCategoryPopConfig' } | { __typename: 's0_eternum_BuildingConfig' } | { __typename: 's0_eternum_BuildingGeneralConfig' } | { __typename: 's0_eternum_BuildingQuantityv2' } | { __typename: 's0_eternum_BurnDonkey' } | { __typename: 's0_eternum_CancelOrder' } | { __typename: 's0_eternum_CapacityCategory' } | { __typename: 's0_eternum_CapacityConfig' } | { __typename: 's0_eternum_Contribution' } | { __typename: 's0_eternum_CreateGuild' } | { __typename: 's0_eternum_CreateOrder' } | { __typename: 's0_eternum_DetachedResource' } | { __typename: 's0_eternum_EntityName' } | { __typename: 's0_eternum_EntityOwner' } | { __typename: 's0_eternum_Epoch' } | { __typename: 's0_eternum_FragmentMineDiscovered' } | { __typename: 's0_eternum_GameEnded' } | { __typename: 's0_eternum_Guild' } | { __typename: 's0_eternum_GuildMember' } | { __typename: 's0_eternum_GuildWhitelist' } | { __typename: 's0_eternum_Health' } | { __typename: 's0_eternum_Hyperstructure' } | { __typename: 's0_eternum_HyperstructureCoOwnersChange' } | { __typename: 's0_eternum_HyperstructureConfig' } | { __typename: 's0_eternum_HyperstructureContribution' } | { __typename: 's0_eternum_HyperstructureFinished' } | { __typename: 's0_eternum_HyperstructureResourceConfig' } | { __typename: 's0_eternum_HyperstructureStarted' } | { __typename: 's0_eternum_JoinGuild' } | { __typename: 's0_eternum_Leaderboard' } | { __typename: 's0_eternum_LeaderboardEntry' } | { __typename: 's0_eternum_LeaderboardRegisterContribution' } | { __typename: 's0_eternum_LeaderboardRegisterShare' } | { __typename: 's0_eternum_LeaderboardRegistered' } | { __typename: 's0_eternum_LeaderboardRewardClaimed' } | { __typename: 's0_eternum_LevelingConfig' } | { __typename: 's0_eternum_Liquidity' } | { __typename: 's0_eternum_LiquidityEvent' } | { __typename: 's0_eternum_MapConfig' } | { __typename: 's0_eternum_MapExplored' } | { __typename: 's0_eternum_Market' } | { __typename: 's0_eternum_MercenariesConfig' } | { __typename: 's0_eternum_Message' } | { __typename: 's0_eternum_Movable' } | { __typename: 's0_eternum_Orders' } | { __typename: 's0_eternum_OwnedResourcesTracker', resource_types?: any | null } | { __typename: 's0_eternum_Owner' } | { __typename: 's0_eternum_Population' } | { __typename: 's0_eternum_PopulationConfig' } | { __typename: 's0_eternum_Position', x?: any | null, y?: any | null } | { __typename: 's0_eternum_Production' } | { __typename: 's0_eternum_ProductionConfig' } | { __typename: 's0_eternum_ProductionDeadline' } | { __typename: 's0_eternum_ProductionInput' } | { __typename: 's0_eternum_ProductionOutput' } | { __typename: 's0_eternum_Progress' } | { __typename: 's0_eternum_Protectee' } | { __typename: 's0_eternum_Protector' } | { __typename: 's0_eternum_Quantity' } | { __typename: 's0_eternum_QuantityTracker' } | { __typename: 's0_eternum_Quest' } | { __typename: 's0_eternum_QuestBonus' } | { __typename: 's0_eternum_QuestConfig' } | { __typename: 's0_eternum_QuestRewardConfig' } | { __typename: 's0_eternum_Realm' } | { __typename: 's0_eternum_RealmLevelConfig' } | { __typename: 's0_eternum_RealmMaxLevelConfig' } | { __typename: 's0_eternum_Resource' } | { __typename: 's0_eternum_ResourceAllowance' } | { __typename: 's0_eternum_ResourceBridgeConfig' } | { __typename: 's0_eternum_ResourceBridgeFeeSplitConfig' } | { __typename: 's0_eternum_ResourceBridgeWhitelistConfig' } | { __typename: 's0_eternum_ResourceCost' } | { __typename: 's0_eternum_ResourceTransferLock' } | { __typename: 's0_eternum_Season' } | { __typename: 's0_eternum_SeasonAddressesConfig' } | { __typename: 's0_eternum_SeasonBridgeConfig' } | { __typename: 's0_eternum_SettleRealmData' } | { __typename: 's0_eternum_SettlementConfig' } | { __typename: 's0_eternum_SpeedConfig' } | { __typename: 's0_eternum_Stamina' } | { __typename: 's0_eternum_StaminaConfig' } | { __typename: 's0_eternum_StaminaRefillConfig' } | { __typename: 's0_eternum_Status' } | { __typename: 's0_eternum_Structure' } | { __typename: 's0_eternum_StructureCount' } | { __typename: 's0_eternum_SwapEvent' } | { __typename: 's0_eternum_TickConfig' } | { __typename: 's0_eternum_Tile' } | { __typename: 's0_eternum_Trade' } | { __typename: 's0_eternum_Transfer' } | { __typename: 's0_eternum_Travel' } | { __typename: 's0_eternum_TravelFoodCostConfig' } | { __typename: 's0_eternum_TravelStaminaCostConfig' } | { __typename: 's0_eternum_TroopConfig' } | { __typename: 's0_eternum_TrophyCreation' } | { __typename: 's0_eternum_TrophyProgression' } | { __typename: 's0_eternum_VRFConfig' } | { __typename: 's0_eternum_Weight', value?: any | null } | { __typename: 's0_eternum_WeightConfig' } | { __typename: 's0_eternum_WorldConfig' } | null> | null } | null } | null } | null> | null } | null };

export type GetAccountTokensQueryVariables = Exact<{
  accountAddress: Scalars['String']['input'];
}>;


export type GetAccountTokensQuery = { __typename?: 'World__Query', tokenBalances?: { __typename?: 'Token__BalanceConnection', edges?: Array<{ __typename?: 'Token__BalanceEdge', node?: { __typename?: 'Token__Balance', tokenMetadata: { __typename: 'ERC20__Token' } | { __typename: 'ERC721__Token', tokenId: string, metadataDescription?: string | null, imagePath: string, contractAddress: string, metadata: string } } | null } | null> | null } | null };

export type GetErc721MintsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetErc721MintsQuery = { __typename?: 'World__Query', tokenTransfers?: { __typename?: 'Token__TransferConnection', edges?: Array<{ __typename?: 'Token__TransferEdge', node?: { __typename?: 'Token__Transfer', tokenMetadata: { __typename: 'ERC20__Token' } | { __typename: 'ERC721__Token', tokenId: string, metadataDescription?: string | null, imagePath: string, contractAddress: string, metadata: string } } | null } | null> | null } | null };

export type EternumStatisticsQueryVariables = Exact<{ [key: string]: never; }>;


export type EternumStatisticsQuery = { __typename?: 'World__Query', s0EternumAddressNameModels?: { __typename?: 's0_eternum_AddressNameConnection', totalCount: number } | null, s0EternumHyperstructureModels?: { __typename?: 's0_eternum_HyperstructureConnection', totalCount: number } | null, s0EternumRealmModels?: { __typename?: 's0_eternum_RealmConnection', totalCount: number } | null, s0EternumFragmentMineDiscoveredModels?: { __typename?: 's0_eternum_FragmentMineDiscoveredConnection', totalCount: number } | null };

export type GetEntityPositionQueryVariables = Exact<{
  entityIds: Array<Scalars['u32']['input']> | Scalars['u32']['input'];
}>;


export type GetEntityPositionQuery = { __typename?: 'World__Query', s0EternumPositionModels?: { __typename?: 's0_eternum_PositionConnection', edges?: Array<{ __typename?: 's0_eternum_PositionEdge', node?: { __typename?: 's0_eternum_Position', x?: any | null, y?: any | null, entity_id?: any | null, entity?: { __typename: 'World__Entity' } | null } | null } | null> | null } | null };

export type GetEntitiesResourcesQueryVariables = Exact<{
  entityIds: Array<Scalars['u32']['input']> | Scalars['u32']['input'];
}>;


export type GetEntitiesResourcesQuery = { __typename?: 'World__Query', s0EternumResourceModels?: { __typename?: 's0_eternum_ResourceConnection', edges?: Array<{ __typename?: 's0_eternum_ResourceEdge', node?: { __typename?: 's0_eternum_Resource', entity_id?: any | null, resource_type?: any | null, balance?: any | null, entity?: { __typename: 'World__Entity' } | null } | null } | null> | null } | null };

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
    query getCapacitySpeedConfig($category: Enum!, $entityType: u32!) {
  s0EternumCapacityConfigModels(where: {category: $category}) {
    edges {
      node {
        weight_gram
      }
    }
  }
  s0EternumSpeedConfigModels(where: {entity_type: $entityType}) {
    edges {
      node {
        sec_per_km
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetCapacitySpeedConfigQuery, GetCapacitySpeedConfigQueryVariables>;
export const GetEternumOwnerRealmIdsDocument = new TypedDocumentString(`
    query getEternumOwnerRealmIds($accountAddress: ContractAddress!) {
  s0EternumOwnerModels(where: {address: $accountAddress}, limit: 1000) {
    edges {
      node {
        address
        entity_id
        entity {
          models {
            __typename
            ... on s0_eternum_Realm {
              realm_id
            }
          }
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetEternumOwnerRealmIdsQuery, GetEternumOwnerRealmIdsQueryVariables>;
export const GetEternumEntityOwnerDocument = new TypedDocumentString(`
    query getEternumEntityOwner($entityOwnerIds: [u32!]!) {
  s0EternumEntityOwnerModels(
    where: {entity_owner_idIN: $entityOwnerIds}
    limit: 200
  ) {
    edges {
      node {
        entity_id
        entity_owner_id
        entity {
          models {
            __typename
            ... on s0_eternum_OwnedResourcesTracker {
              resource_types
            }
            ... on s0_eternum_Position {
              x
              y
            }
            ... on s0_eternum_ArrivalTime {
              arrives_at
            }
            ... on s0_eternum_Weight {
              value
            }
          }
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
  s0EternumAddressNameModels {
    totalCount
  }
  s0EternumHyperstructureModels {
    totalCount
  }
  s0EternumRealmModels {
    totalCount
  }
  s0EternumFragmentMineDiscoveredModels {
    totalCount
  }
}
    `) as unknown as TypedDocumentString<EternumStatisticsQuery, EternumStatisticsQueryVariables>;
export const GetEntityPositionDocument = new TypedDocumentString(`
    query getEntityPosition($entityIds: [u32!]!) {
  s0EternumPositionModels(where: {entity_idIN: $entityIds}) {
    edges {
      node {
        x
        y
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
  s0EternumResourceModels(where: {entity_idIN: $entityIds}, limit: 8000) {
    edges {
      node {
        entity_id
        resource_type
        balance
        entity {
          __typename
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetEntitiesResourcesQuery, GetEntitiesResourcesQueryVariables>;