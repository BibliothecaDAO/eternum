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
  ContractAddress: { input: any; output: any; }
  Cursor: { input: any; output: any; }
  DateTime: { input: any; output: any; }
  Enum: { input: any; output: any; }
  bool: { input: any; output: any; }
  felt252: { input: any; output: any; }
  u16: { input: any; output: any; }
  u32: { input: any; output: any; }
  u64: { input: any; output: any; }
  u128: { input: any; output: any; }
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

export type Marketplace_MarketFeeModelOrder = {
  direction: OrderDirection;
  field: Marketplace_MarketFeeModelOrderField;
};

export enum Marketplace_MarketFeeModelOrderField {
  FeeDenominator = 'FEE_DENOMINATOR',
  FeeNumerator = 'FEE_NUMERATOR',
  FeeRecipient = 'FEE_RECIPIENT',
  FeeToken = 'FEE_TOKEN',
  Id = 'ID'
}

export type Marketplace_MarketFeeModelWhereInput = {
  fee_denominator?: InputMaybe<Scalars['u64']['input']>;
  fee_denominatorEQ?: InputMaybe<Scalars['u64']['input']>;
  fee_denominatorGT?: InputMaybe<Scalars['u64']['input']>;
  fee_denominatorGTE?: InputMaybe<Scalars['u64']['input']>;
  fee_denominatorIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  fee_denominatorLIKE?: InputMaybe<Scalars['u64']['input']>;
  fee_denominatorLT?: InputMaybe<Scalars['u64']['input']>;
  fee_denominatorLTE?: InputMaybe<Scalars['u64']['input']>;
  fee_denominatorNEQ?: InputMaybe<Scalars['u64']['input']>;
  fee_denominatorNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  fee_denominatorNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  fee_numerator?: InputMaybe<Scalars['u64']['input']>;
  fee_numeratorEQ?: InputMaybe<Scalars['u64']['input']>;
  fee_numeratorGT?: InputMaybe<Scalars['u64']['input']>;
  fee_numeratorGTE?: InputMaybe<Scalars['u64']['input']>;
  fee_numeratorIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  fee_numeratorLIKE?: InputMaybe<Scalars['u64']['input']>;
  fee_numeratorLT?: InputMaybe<Scalars['u64']['input']>;
  fee_numeratorLTE?: InputMaybe<Scalars['u64']['input']>;
  fee_numeratorNEQ?: InputMaybe<Scalars['u64']['input']>;
  fee_numeratorNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  fee_numeratorNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  fee_recipient?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_recipientEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_recipientGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_recipientGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_recipientIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  fee_recipientLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_recipientLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_recipientLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_recipientNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_recipientNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  fee_recipientNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_token?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_tokenEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_tokenGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_tokenGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_tokenIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  fee_tokenLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_tokenLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_tokenLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_tokenNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  fee_tokenNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  fee_tokenNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
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
};

export type Marketplace_MarketGlobalModelOrder = {
  direction: OrderDirection;
  field: Marketplace_MarketGlobalModelOrderField;
};

export enum Marketplace_MarketGlobalModelOrderField {
  CollectionCount = 'COLLECTION_COUNT',
  Id = 'ID',
  OrderCount = 'ORDER_COUNT',
  Owner = 'OWNER',
  Paused = 'PAUSED'
}

export type Marketplace_MarketGlobalModelWhereInput = {
  collection_count?: InputMaybe<Scalars['u32']['input']>;
  collection_countEQ?: InputMaybe<Scalars['u32']['input']>;
  collection_countGT?: InputMaybe<Scalars['u32']['input']>;
  collection_countGTE?: InputMaybe<Scalars['u32']['input']>;
  collection_countIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  collection_countLIKE?: InputMaybe<Scalars['u32']['input']>;
  collection_countLT?: InputMaybe<Scalars['u32']['input']>;
  collection_countLTE?: InputMaybe<Scalars['u32']['input']>;
  collection_countNEQ?: InputMaybe<Scalars['u32']['input']>;
  collection_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  collection_countNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
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
  order_count?: InputMaybe<Scalars['u64']['input']>;
  order_countEQ?: InputMaybe<Scalars['u64']['input']>;
  order_countGT?: InputMaybe<Scalars['u64']['input']>;
  order_countGTE?: InputMaybe<Scalars['u64']['input']>;
  order_countIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  order_countLIKE?: InputMaybe<Scalars['u64']['input']>;
  order_countLT?: InputMaybe<Scalars['u64']['input']>;
  order_countLTE?: InputMaybe<Scalars['u64']['input']>;
  order_countNEQ?: InputMaybe<Scalars['u64']['input']>;
  order_countNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  order_countNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
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
  paused?: InputMaybe<Scalars['bool']['input']>;
};

export type Marketplace_MarketOrderEventOrder = {
  direction: OrderDirection;
  field: Marketplace_MarketOrderEventOrderField;
};

export enum Marketplace_MarketOrderEventOrderField {
  MarketOrder = 'MARKET_ORDER',
  OrderId = 'ORDER_ID',
  State = 'STATE'
}

export type Marketplace_MarketOrderEventWhereInput = {
  market_order?: InputMaybe<Marketplace_MarketOrderEvent_Market_OrderWhereInput>;
  order_id?: InputMaybe<Scalars['u64']['input']>;
  order_idEQ?: InputMaybe<Scalars['u64']['input']>;
  order_idGT?: InputMaybe<Scalars['u64']['input']>;
  order_idGTE?: InputMaybe<Scalars['u64']['input']>;
  order_idIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  order_idLIKE?: InputMaybe<Scalars['u64']['input']>;
  order_idLT?: InputMaybe<Scalars['u64']['input']>;
  order_idLTE?: InputMaybe<Scalars['u64']['input']>;
  order_idNEQ?: InputMaybe<Scalars['u64']['input']>;
  order_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  order_idNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  state?: InputMaybe<Scalars['Enum']['input']>;
};

export type Marketplace_MarketOrderEvent_Market_OrderWhereInput = {
  active?: InputMaybe<Scalars['bool']['input']>;
  collection_id?: InputMaybe<Scalars['u16']['input']>;
  collection_idEQ?: InputMaybe<Scalars['u16']['input']>;
  collection_idGT?: InputMaybe<Scalars['u16']['input']>;
  collection_idGTE?: InputMaybe<Scalars['u16']['input']>;
  collection_idIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  collection_idLIKE?: InputMaybe<Scalars['u16']['input']>;
  collection_idLT?: InputMaybe<Scalars['u16']['input']>;
  collection_idLTE?: InputMaybe<Scalars['u16']['input']>;
  collection_idNEQ?: InputMaybe<Scalars['u16']['input']>;
  collection_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  collection_idNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  expiration?: InputMaybe<Scalars['u32']['input']>;
  expirationEQ?: InputMaybe<Scalars['u32']['input']>;
  expirationGT?: InputMaybe<Scalars['u32']['input']>;
  expirationGTE?: InputMaybe<Scalars['u32']['input']>;
  expirationIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  expirationLIKE?: InputMaybe<Scalars['u32']['input']>;
  expirationLT?: InputMaybe<Scalars['u32']['input']>;
  expirationLTE?: InputMaybe<Scalars['u32']['input']>;
  expirationNEQ?: InputMaybe<Scalars['u32']['input']>;
  expirationNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  expirationNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
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
  price?: InputMaybe<Scalars['u128']['input']>;
  priceEQ?: InputMaybe<Scalars['u128']['input']>;
  priceGT?: InputMaybe<Scalars['u128']['input']>;
  priceGTE?: InputMaybe<Scalars['u128']['input']>;
  priceIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  priceLIKE?: InputMaybe<Scalars['u128']['input']>;
  priceLT?: InputMaybe<Scalars['u128']['input']>;
  priceLTE?: InputMaybe<Scalars['u128']['input']>;
  priceNEQ?: InputMaybe<Scalars['u128']['input']>;
  priceNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  priceNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  token_id?: InputMaybe<Scalars['u16']['input']>;
  token_idEQ?: InputMaybe<Scalars['u16']['input']>;
  token_idGT?: InputMaybe<Scalars['u16']['input']>;
  token_idGTE?: InputMaybe<Scalars['u16']['input']>;
  token_idIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  token_idLIKE?: InputMaybe<Scalars['u16']['input']>;
  token_idLT?: InputMaybe<Scalars['u16']['input']>;
  token_idLTE?: InputMaybe<Scalars['u16']['input']>;
  token_idNEQ?: InputMaybe<Scalars['u16']['input']>;
  token_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  token_idNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
};

export type Marketplace_MarketOrderModelOrder = {
  direction: OrderDirection;
  field: Marketplace_MarketOrderModelOrderField;
};

export enum Marketplace_MarketOrderModelOrderField {
  Order = 'ORDER',
  OrderId = 'ORDER_ID'
}

export type Marketplace_MarketOrderModelWhereInput = {
  order?: InputMaybe<Marketplace_MarketOrderModel_OrderWhereInput>;
  order_id?: InputMaybe<Scalars['u64']['input']>;
  order_idEQ?: InputMaybe<Scalars['u64']['input']>;
  order_idGT?: InputMaybe<Scalars['u64']['input']>;
  order_idGTE?: InputMaybe<Scalars['u64']['input']>;
  order_idIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  order_idLIKE?: InputMaybe<Scalars['u64']['input']>;
  order_idLT?: InputMaybe<Scalars['u64']['input']>;
  order_idLTE?: InputMaybe<Scalars['u64']['input']>;
  order_idNEQ?: InputMaybe<Scalars['u64']['input']>;
  order_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  order_idNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
};

export type Marketplace_MarketOrderModel_OrderWhereInput = {
  active?: InputMaybe<Scalars['bool']['input']>;
  collection_id?: InputMaybe<Scalars['u16']['input']>;
  collection_idEQ?: InputMaybe<Scalars['u16']['input']>;
  collection_idGT?: InputMaybe<Scalars['u16']['input']>;
  collection_idGTE?: InputMaybe<Scalars['u16']['input']>;
  collection_idIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  collection_idLIKE?: InputMaybe<Scalars['u16']['input']>;
  collection_idLT?: InputMaybe<Scalars['u16']['input']>;
  collection_idLTE?: InputMaybe<Scalars['u16']['input']>;
  collection_idNEQ?: InputMaybe<Scalars['u16']['input']>;
  collection_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  collection_idNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
  expiration?: InputMaybe<Scalars['u32']['input']>;
  expirationEQ?: InputMaybe<Scalars['u32']['input']>;
  expirationGT?: InputMaybe<Scalars['u32']['input']>;
  expirationGTE?: InputMaybe<Scalars['u32']['input']>;
  expirationIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  expirationLIKE?: InputMaybe<Scalars['u32']['input']>;
  expirationLT?: InputMaybe<Scalars['u32']['input']>;
  expirationLTE?: InputMaybe<Scalars['u32']['input']>;
  expirationNEQ?: InputMaybe<Scalars['u32']['input']>;
  expirationNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  expirationNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
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
  price?: InputMaybe<Scalars['u128']['input']>;
  priceEQ?: InputMaybe<Scalars['u128']['input']>;
  priceGT?: InputMaybe<Scalars['u128']['input']>;
  priceGTE?: InputMaybe<Scalars['u128']['input']>;
  priceIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  priceLIKE?: InputMaybe<Scalars['u128']['input']>;
  priceLT?: InputMaybe<Scalars['u128']['input']>;
  priceLTE?: InputMaybe<Scalars['u128']['input']>;
  priceNEQ?: InputMaybe<Scalars['u128']['input']>;
  priceNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u128']['input']>>>;
  priceNOTLIKE?: InputMaybe<Scalars['u128']['input']>;
  token_id?: InputMaybe<Scalars['u16']['input']>;
  token_idEQ?: InputMaybe<Scalars['u16']['input']>;
  token_idGT?: InputMaybe<Scalars['u16']['input']>;
  token_idGTE?: InputMaybe<Scalars['u16']['input']>;
  token_idIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  token_idLIKE?: InputMaybe<Scalars['u16']['input']>;
  token_idLT?: InputMaybe<Scalars['u16']['input']>;
  token_idLTE?: InputMaybe<Scalars['u16']['input']>;
  token_idNEQ?: InputMaybe<Scalars['u16']['input']>;
  token_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  token_idNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
};

export type Marketplace_MarketTokenOrderModelOrder = {
  direction: OrderDirection;
  field: Marketplace_MarketTokenOrderModelOrderField;
};

export enum Marketplace_MarketTokenOrderModelOrderField {
  CollectionAddress = 'COLLECTION_ADDRESS',
  OrderId = 'ORDER_ID',
  TokenId = 'TOKEN_ID'
}

export type Marketplace_MarketTokenOrderModelWhereInput = {
  collection_address?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  collection_addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  collection_addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  order_id?: InputMaybe<Scalars['u64']['input']>;
  order_idEQ?: InputMaybe<Scalars['u64']['input']>;
  order_idGT?: InputMaybe<Scalars['u64']['input']>;
  order_idGTE?: InputMaybe<Scalars['u64']['input']>;
  order_idIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  order_idLIKE?: InputMaybe<Scalars['u64']['input']>;
  order_idLT?: InputMaybe<Scalars['u64']['input']>;
  order_idLTE?: InputMaybe<Scalars['u64']['input']>;
  order_idNEQ?: InputMaybe<Scalars['u64']['input']>;
  order_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u64']['input']>>>;
  order_idNOTLIKE?: InputMaybe<Scalars['u64']['input']>;
  token_id?: InputMaybe<Scalars['u16']['input']>;
  token_idEQ?: InputMaybe<Scalars['u16']['input']>;
  token_idGT?: InputMaybe<Scalars['u16']['input']>;
  token_idGTE?: InputMaybe<Scalars['u16']['input']>;
  token_idIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  token_idLIKE?: InputMaybe<Scalars['u16']['input']>;
  token_idLT?: InputMaybe<Scalars['u16']['input']>;
  token_idLTE?: InputMaybe<Scalars['u16']['input']>;
  token_idNEQ?: InputMaybe<Scalars['u16']['input']>;
  token_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u16']['input']>>>;
  token_idNOTLIKE?: InputMaybe<Scalars['u16']['input']>;
};

export type Marketplace_MarketWhitelistModelOrder = {
  direction: OrderDirection;
  field: Marketplace_MarketWhitelistModelOrderField;
};

export enum Marketplace_MarketWhitelistModelOrderField {
  CollectionAddress = 'COLLECTION_ADDRESS',
  CollectionId = 'COLLECTION_ID'
}

export type Marketplace_MarketWhitelistModelWhereInput = {
  collection_address?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressGT?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressGTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  collection_addressLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressLT?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressLTE?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressNEQ?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_addressNOTIN?: InputMaybe<Array<InputMaybe<Scalars['ContractAddress']['input']>>>;
  collection_addressNOTLIKE?: InputMaybe<Scalars['ContractAddress']['input']>;
  collection_id?: InputMaybe<Scalars['u32']['input']>;
  collection_idEQ?: InputMaybe<Scalars['u32']['input']>;
  collection_idGT?: InputMaybe<Scalars['u32']['input']>;
  collection_idGTE?: InputMaybe<Scalars['u32']['input']>;
  collection_idIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  collection_idLIKE?: InputMaybe<Scalars['u32']['input']>;
  collection_idLT?: InputMaybe<Scalars['u32']['input']>;
  collection_idLTE?: InputMaybe<Scalars['u32']['input']>;
  collection_idNEQ?: InputMaybe<Scalars['u32']['input']>;
  collection_idNOTIN?: InputMaybe<Array<InputMaybe<Scalars['u32']['input']>>>;
  collection_idNOTLIKE?: InputMaybe<Scalars['u32']['input']>;
};

export type GetAccountTokensQueryVariables = Exact<{
  accountAddress: Scalars['String']['input'];
  offset: Scalars['Int']['input'];
  limit: Scalars['Int']['input'];
}>;


export type GetAccountTokensQuery = { __typename?: 'World__Query', tokenBalances?: { __typename?: 'Token__BalanceConnection', edges?: Array<{ __typename?: 'Token__BalanceEdge', node?: { __typename?: 'Token__Balance', tokenMetadata: { __typename: 'ERC20__Token' } | { __typename: 'ERC721__Token', tokenId: string, metadataDescription?: string | null, imagePath: string, contractAddress: string, metadata: string } | { __typename: 'ERC1155__Token' } } | null } | null> | null } | null };

export type GetAllTokensQueryVariables = Exact<{
  offset: Scalars['Int']['input'];
  limit: Scalars['Int']['input'];
  contractAddress: Scalars['String']['input'];
}>;


export type GetAllTokensQuery = { __typename?: 'World__Query', tokens: { __typename?: 'TokenConnection', totalCount: number, edges?: Array<{ __typename?: 'TokenEdge', node?: { __typename?: 'Token', tokenMetadata: { __typename: 'ERC20__Token' } | { __typename: 'ERC721__Token', tokenId: string, metadataDescription?: string | null, imagePath: string, contractAddress: string, metadata: string } | { __typename: 'ERC1155__Token' } } | null } | null> | null } };

export type GetMarketOrdersQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMarketOrdersQuery = { __typename?: 'World__Query', marketplaceMarketOrderModelModels?: { __typename?: 'marketplace_MarketOrderModelConnection', edges?: Array<{ __typename?: 'marketplace_MarketOrderModelEdge', node?: { __typename?: 'marketplace_MarketOrderModel', order_id?: any | null, order?: { __typename?: 'marketplace_MarketOrder', active?: any | null, token_id?: any | null, collection_id?: any | null, owner?: any | null, price?: any | null, expiration?: any | null } | null } | null } | null> | null } | null };

export type GetErc721MintsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetErc721MintsQuery = { __typename?: 'World__Query', tokenTransfers?: { __typename?: 'Token__TransferConnection', edges?: Array<{ __typename?: 'Token__TransferEdge', node?: { __typename?: 'Token__Transfer', tokenMetadata: { __typename: 'ERC20__Token' } | { __typename: 'ERC721__Token', tokenId: string, metadataDescription?: string | null, imagePath: string, contractAddress: string, metadata: string } | { __typename: 'ERC1155__Token' } } | null } | null> | null } | null };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: DocumentTypeDecoration<TResult, TVariables>['__apiType'];
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}

export const GetAccountTokensDocument = new TypedDocumentString(`
    query getAccountTokens($accountAddress: String!, $offset: Int!, $limit: Int!) {
  tokenBalances(accountAddress: $accountAddress, limit: $limit, offset: $offset) {
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
export const GetAllTokensDocument = new TypedDocumentString(`
    query getAllTokens($offset: Int!, $limit: Int!, $contractAddress: String!) {
  tokens(limit: $limit, offset: $offset, contractAddress: $contractAddress) {
    totalCount
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
    `) as unknown as TypedDocumentString<GetAllTokensQuery, GetAllTokensQueryVariables>;
export const GetMarketOrdersDocument = new TypedDocumentString(`
    query getMarketOrders {
  marketplaceMarketOrderModelModels(
    where: {order: {active: true, collection_id: 1}}
    limit: 1000
  ) {
    edges {
      node {
        order_id
        order {
          active
          token_id
          collection_id
          owner
          price
          expiration
        }
      }
    }
  }
}
    `) as unknown as TypedDocumentString<GetMarketOrdersQuery, GetMarketOrdersQueryVariables>;
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