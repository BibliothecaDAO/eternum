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
  BigDecimalVP: { input: any; output: any; }
  BigInt: { input: any; output: any; }
  Text: { input: any; output: any; }
};

export type ExecutionStrategy = {
  __typename?: 'ExecutionStrategy';
  address: Scalars['String']['output'];
  axiom_snapshot_address?: Maybe<Scalars['String']['output']>;
  axiom_snapshot_slot?: Maybe<Scalars['BigInt']['output']>;
  destination_address?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  quorum: Scalars['BigDecimalVP']['output'];
  timelock_delay: Scalars['BigInt']['output'];
  timelock_veto_guardian?: Maybe<Scalars['String']['output']>;
  treasury?: Maybe<Scalars['String']['output']>;
  treasury_chain?: Maybe<Scalars['Int']['output']>;
  type: Scalars['String']['output'];
};

export type ExecutionStrategy_Filter = {
  address?: InputMaybe<Scalars['String']['input']>;
  address_contains?: InputMaybe<Scalars['String']['input']>;
  address_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  address_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  address_not?: InputMaybe<Scalars['String']['input']>;
  address_not_contains?: InputMaybe<Scalars['String']['input']>;
  address_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  address_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  axiom_snapshot_address?: InputMaybe<Scalars['String']['input']>;
  axiom_snapshot_address_contains?: InputMaybe<Scalars['String']['input']>;
  axiom_snapshot_address_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  axiom_snapshot_address_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  axiom_snapshot_address_not?: InputMaybe<Scalars['String']['input']>;
  axiom_snapshot_address_not_contains?: InputMaybe<Scalars['String']['input']>;
  axiom_snapshot_address_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  axiom_snapshot_address_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  axiom_snapshot_slot?: InputMaybe<Scalars['BigInt']['input']>;
  axiom_snapshot_slot_gt?: InputMaybe<Scalars['BigInt']['input']>;
  axiom_snapshot_slot_gte?: InputMaybe<Scalars['BigInt']['input']>;
  axiom_snapshot_slot_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  axiom_snapshot_slot_lt?: InputMaybe<Scalars['BigInt']['input']>;
  axiom_snapshot_slot_lte?: InputMaybe<Scalars['BigInt']['input']>;
  axiom_snapshot_slot_not?: InputMaybe<Scalars['BigInt']['input']>;
  axiom_snapshot_slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  destination_address?: InputMaybe<Scalars['String']['input']>;
  destination_address_contains?: InputMaybe<Scalars['String']['input']>;
  destination_address_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  destination_address_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  destination_address_not?: InputMaybe<Scalars['String']['input']>;
  destination_address_not_contains?: InputMaybe<Scalars['String']['input']>;
  destination_address_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  destination_address_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  quorum?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  quorum_gt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  quorum_gte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  quorum_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  quorum_lt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  quorum_lte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  quorum_not?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  quorum_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  timelock_delay?: InputMaybe<Scalars['BigInt']['input']>;
  timelock_delay_gt?: InputMaybe<Scalars['BigInt']['input']>;
  timelock_delay_gte?: InputMaybe<Scalars['BigInt']['input']>;
  timelock_delay_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timelock_delay_lt?: InputMaybe<Scalars['BigInt']['input']>;
  timelock_delay_lte?: InputMaybe<Scalars['BigInt']['input']>;
  timelock_delay_not?: InputMaybe<Scalars['BigInt']['input']>;
  timelock_delay_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  timelock_veto_guardian?: InputMaybe<Scalars['String']['input']>;
  timelock_veto_guardian_contains?: InputMaybe<Scalars['String']['input']>;
  timelock_veto_guardian_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  timelock_veto_guardian_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  timelock_veto_guardian_not?: InputMaybe<Scalars['String']['input']>;
  timelock_veto_guardian_not_contains?: InputMaybe<Scalars['String']['input']>;
  timelock_veto_guardian_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  timelock_veto_guardian_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  treasury?: InputMaybe<Scalars['String']['input']>;
  treasury_chain?: InputMaybe<Scalars['Int']['input']>;
  treasury_chain_gt?: InputMaybe<Scalars['Int']['input']>;
  treasury_chain_gte?: InputMaybe<Scalars['Int']['input']>;
  treasury_chain_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  treasury_chain_lt?: InputMaybe<Scalars['Int']['input']>;
  treasury_chain_lte?: InputMaybe<Scalars['Int']['input']>;
  treasury_chain_not?: InputMaybe<Scalars['Int']['input']>;
  treasury_chain_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  treasury_contains?: InputMaybe<Scalars['String']['input']>;
  treasury_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  treasury_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  treasury_not?: InputMaybe<Scalars['String']['input']>;
  treasury_not_contains?: InputMaybe<Scalars['String']['input']>;
  treasury_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  treasury_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  type?: InputMaybe<Scalars['String']['input']>;
  type_contains?: InputMaybe<Scalars['String']['input']>;
  type_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  type_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  type_not?: InputMaybe<Scalars['String']['input']>;
  type_not_contains?: InputMaybe<Scalars['String']['input']>;
  type_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  type_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export enum ExecutionStrategy_OrderBy {
  Address = 'address',
  AxiomSnapshotAddress = 'axiom_snapshot_address',
  AxiomSnapshotSlot = 'axiom_snapshot_slot',
  DestinationAddress = 'destination_address',
  Id = 'id',
  Quorum = 'quorum',
  TimelockDelay = 'timelock_delay',
  TimelockVetoGuardian = 'timelock_veto_guardian',
  Treasury = 'treasury',
  TreasuryChain = 'treasury_chain',
  Type = 'type'
}

export type Leaderboard = {
  __typename?: 'Leaderboard';
  id: Scalars['String']['output'];
  proposal_count: Scalars['Int']['output'];
  space: Space;
  user: User;
  vote_count: Scalars['Int']['output'];
};

export type Leaderboard_Space_Filter = {
  authenticators?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  controller?: InputMaybe<Scalars['String']['input']>;
  controller_contains?: InputMaybe<Scalars['String']['input']>;
  controller_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  controller_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  controller_not?: InputMaybe<Scalars['String']['input']>;
  controller_not_contains?: InputMaybe<Scalars['String']['input']>;
  controller_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  controller_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  created?: InputMaybe<Scalars['Int']['input']>;
  created_gt?: InputMaybe<Scalars['Int']['input']>;
  created_gte?: InputMaybe<Scalars['Int']['input']>;
  created_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created_lt?: InputMaybe<Scalars['Int']['input']>;
  created_lte?: InputMaybe<Scalars['Int']['input']>;
  created_not?: InputMaybe<Scalars['Int']['input']>;
  created_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  max_voting_period?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_gt?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_gte?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  max_voting_period_lt?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_lte?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_not?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  metadata?: InputMaybe<Scalars['String']['input']>;
  metadata_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadata_not?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  min_voting_period?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_gt?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_gte?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  min_voting_period_lt?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_lte?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_not?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  next_strategy_index?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_gt?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_gte?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  next_strategy_index_lt?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_lte?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_not?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_threshold?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_gt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_gte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  proposal_threshold_lt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_lte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_not?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  proposer_count?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposer_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_indices?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indices_not?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indicies?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indicies_not?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_metadata?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  turbo?: InputMaybe<Scalars['Boolean']['input']>;
  turbo_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  turbo_not?: InputMaybe<Scalars['Boolean']['input']>;
  turbo_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy_not?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy_params_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_not_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  verified?: InputMaybe<Scalars['Boolean']['input']>;
  verified_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  verified_not?: InputMaybe<Scalars['Boolean']['input']>;
  verified_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  vote_count?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count_lt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_lte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voter_count?: InputMaybe<Scalars['Int']['input']>;
  voter_count_gt?: InputMaybe<Scalars['Int']['input']>;
  voter_count_gte?: InputMaybe<Scalars['Int']['input']>;
  voter_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voter_count_lt?: InputMaybe<Scalars['Int']['input']>;
  voter_count_lte?: InputMaybe<Scalars['Int']['input']>;
  voter_count_not?: InputMaybe<Scalars['Int']['input']>;
  voter_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_delay?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_gt?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_gte?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_delay_lt?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_lte?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_not?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_power_validation_strategy_metadata?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_metadata_not?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export type Leaderboard_User_Filter = {
  address_type?: InputMaybe<Scalars['Int']['input']>;
  address_type_gt?: InputMaybe<Scalars['Int']['input']>;
  address_type_gte?: InputMaybe<Scalars['Int']['input']>;
  address_type_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  address_type_lt?: InputMaybe<Scalars['Int']['input']>;
  address_type_lte?: InputMaybe<Scalars['Int']['input']>;
  address_type_not?: InputMaybe<Scalars['Int']['input']>;
  address_type_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created?: InputMaybe<Scalars['Int']['input']>;
  created_gt?: InputMaybe<Scalars['Int']['input']>;
  created_gte?: InputMaybe<Scalars['Int']['input']>;
  created_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created_lt?: InputMaybe<Scalars['Int']['input']>;
  created_lte?: InputMaybe<Scalars['Int']['input']>;
  created_not?: InputMaybe<Scalars['Int']['input']>;
  created_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  proposal_count?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count_lt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_lte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
};

export type Leaderboard_Filter = {
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  proposal_count?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  space?: InputMaybe<Scalars['String']['input']>;
  space_?: InputMaybe<Leaderboard_Space_Filter>;
  space_contains?: InputMaybe<Scalars['String']['input']>;
  space_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  space_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  space_not?: InputMaybe<Scalars['String']['input']>;
  space_not_contains?: InputMaybe<Scalars['String']['input']>;
  space_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  space_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  user?: InputMaybe<Scalars['String']['input']>;
  user_?: InputMaybe<Leaderboard_User_Filter>;
  user_contains?: InputMaybe<Scalars['String']['input']>;
  user_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  user_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  user_not?: InputMaybe<Scalars['String']['input']>;
  user_not_contains?: InputMaybe<Scalars['String']['input']>;
  user_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  user_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  vote_count?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count_lt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_lte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
};

export enum Leaderboard_OrderBy {
  Id = 'id',
  ProposalCount = 'proposal_count',
  Space = 'space',
  User = 'user',
  VoteCount = 'vote_count'
}

export enum OrderDirection {
  Asc = 'asc',
  Desc = 'desc'
}

export type Proposal = {
  __typename?: 'Proposal';
  author: User;
  axiom_snapshot_address?: Maybe<Scalars['String']['output']>;
  axiom_snapshot_slot?: Maybe<Scalars['BigInt']['output']>;
  cancelled: Scalars['Boolean']['output'];
  completed: Scalars['Boolean']['output'];
  created: Scalars['Int']['output'];
  edited?: Maybe<Scalars['Int']['output']>;
  executed: Scalars['Boolean']['output'];
  execution_destination?: Maybe<Scalars['String']['output']>;
  execution_hash: Scalars['String']['output'];
  execution_ready: Scalars['Boolean']['output'];
  execution_strategy: Scalars['String']['output'];
  execution_strategy_type: Scalars['String']['output'];
  execution_time: Scalars['Int']['output'];
  execution_tx?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  max_end: Scalars['Int']['output'];
  metadata?: Maybe<ProposalMetadataItem>;
  min_end: Scalars['Int']['output'];
  proposal_id: Scalars['Int']['output'];
  quorum: Scalars['BigInt']['output'];
  scores_1: Scalars['BigDecimalVP']['output'];
  scores_2: Scalars['BigDecimalVP']['output'];
  scores_3: Scalars['BigDecimalVP']['output'];
  scores_total: Scalars['BigDecimalVP']['output'];
  snapshot: Scalars['Int']['output'];
  space: Space;
  start: Scalars['Int']['output'];
  strategies: Array<Maybe<Scalars['String']['output']>>;
  strategies_indices: Array<Maybe<Scalars['Int']['output']>>;
  strategies_indicies: Array<Maybe<Scalars['Int']['output']>>;
  strategies_params: Array<Maybe<Scalars['String']['output']>>;
  timelock_delay?: Maybe<Scalars['Int']['output']>;
  timelock_veto_guardian?: Maybe<Scalars['String']['output']>;
  tx: Scalars['String']['output'];
  type: Scalars['String']['output'];
  veto_tx?: Maybe<Scalars['String']['output']>;
  vetoed: Scalars['Boolean']['output'];
  vote_count: Scalars['Int']['output'];
};

export type ProposalMetadataItem = {
  __typename?: 'ProposalMetadataItem';
  body?: Maybe<Scalars['Text']['output']>;
  choices: Array<Maybe<Scalars['String']['output']>>;
  discussion?: Maybe<Scalars['Text']['output']>;
  execution?: Maybe<Scalars['Text']['output']>;
  id: Scalars['String']['output'];
  labels: Array<Maybe<Scalars['String']['output']>>;
  title?: Maybe<Scalars['Text']['output']>;
};

export type ProposalMetadataItem_Filter = {
  body_contains?: InputMaybe<Scalars['String']['input']>;
  body_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  body_not_contains?: InputMaybe<Scalars['String']['input']>;
  body_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  choices?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  choices_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  choices_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  choices_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  discussion_contains?: InputMaybe<Scalars['String']['input']>;
  discussion_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  discussion_not_contains?: InputMaybe<Scalars['String']['input']>;
  discussion_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  execution_contains?: InputMaybe<Scalars['String']['input']>;
  execution_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  execution_not_contains?: InputMaybe<Scalars['String']['input']>;
  execution_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  title_contains?: InputMaybe<Scalars['String']['input']>;
  title_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  title_not_contains?: InputMaybe<Scalars['String']['input']>;
  title_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
};

export enum ProposalMetadataItem_OrderBy {
  Body = 'body',
  Discussion = 'discussion',
  Execution = 'execution',
  Id = 'id',
  Title = 'title'
}

export type Proposal_ProposalMetadataItem_Filter = {
  body_contains?: InputMaybe<Scalars['String']['input']>;
  body_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  body_not_contains?: InputMaybe<Scalars['String']['input']>;
  body_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  choices?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  choices_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  choices_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  choices_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  discussion_contains?: InputMaybe<Scalars['String']['input']>;
  discussion_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  discussion_not_contains?: InputMaybe<Scalars['String']['input']>;
  discussion_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  execution_contains?: InputMaybe<Scalars['String']['input']>;
  execution_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  execution_not_contains?: InputMaybe<Scalars['String']['input']>;
  execution_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  title_contains?: InputMaybe<Scalars['String']['input']>;
  title_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  title_not_contains?: InputMaybe<Scalars['String']['input']>;
  title_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
};

export type Proposal_Space_Filter = {
  authenticators?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  controller?: InputMaybe<Scalars['String']['input']>;
  controller_contains?: InputMaybe<Scalars['String']['input']>;
  controller_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  controller_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  controller_not?: InputMaybe<Scalars['String']['input']>;
  controller_not_contains?: InputMaybe<Scalars['String']['input']>;
  controller_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  controller_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  created?: InputMaybe<Scalars['Int']['input']>;
  created_gt?: InputMaybe<Scalars['Int']['input']>;
  created_gte?: InputMaybe<Scalars['Int']['input']>;
  created_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created_lt?: InputMaybe<Scalars['Int']['input']>;
  created_lte?: InputMaybe<Scalars['Int']['input']>;
  created_not?: InputMaybe<Scalars['Int']['input']>;
  created_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  max_voting_period?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_gt?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_gte?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  max_voting_period_lt?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_lte?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_not?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  metadata?: InputMaybe<Scalars['String']['input']>;
  metadata_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadata_not?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  min_voting_period?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_gt?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_gte?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  min_voting_period_lt?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_lte?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_not?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  next_strategy_index?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_gt?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_gte?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  next_strategy_index_lt?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_lte?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_not?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_threshold?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_gt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_gte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  proposal_threshold_lt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_lte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_not?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  proposer_count?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposer_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_indices?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indices_not?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indicies?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indicies_not?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_metadata?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  turbo?: InputMaybe<Scalars['Boolean']['input']>;
  turbo_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  turbo_not?: InputMaybe<Scalars['Boolean']['input']>;
  turbo_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy_not?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy_params_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_not_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  verified?: InputMaybe<Scalars['Boolean']['input']>;
  verified_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  verified_not?: InputMaybe<Scalars['Boolean']['input']>;
  verified_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  vote_count?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count_lt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_lte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voter_count?: InputMaybe<Scalars['Int']['input']>;
  voter_count_gt?: InputMaybe<Scalars['Int']['input']>;
  voter_count_gte?: InputMaybe<Scalars['Int']['input']>;
  voter_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voter_count_lt?: InputMaybe<Scalars['Int']['input']>;
  voter_count_lte?: InputMaybe<Scalars['Int']['input']>;
  voter_count_not?: InputMaybe<Scalars['Int']['input']>;
  voter_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_delay?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_gt?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_gte?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_delay_lt?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_lte?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_not?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_power_validation_strategy_metadata?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_metadata_not?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export type Proposal_User_Filter = {
  address_type?: InputMaybe<Scalars['Int']['input']>;
  address_type_gt?: InputMaybe<Scalars['Int']['input']>;
  address_type_gte?: InputMaybe<Scalars['Int']['input']>;
  address_type_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  address_type_lt?: InputMaybe<Scalars['Int']['input']>;
  address_type_lte?: InputMaybe<Scalars['Int']['input']>;
  address_type_not?: InputMaybe<Scalars['Int']['input']>;
  address_type_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created?: InputMaybe<Scalars['Int']['input']>;
  created_gt?: InputMaybe<Scalars['Int']['input']>;
  created_gte?: InputMaybe<Scalars['Int']['input']>;
  created_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created_lt?: InputMaybe<Scalars['Int']['input']>;
  created_lte?: InputMaybe<Scalars['Int']['input']>;
  created_not?: InputMaybe<Scalars['Int']['input']>;
  created_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  proposal_count?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count_lt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_lte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
};

export type Proposal_Filter = {
  author?: InputMaybe<Scalars['String']['input']>;
  author_?: InputMaybe<Proposal_User_Filter>;
  author_contains?: InputMaybe<Scalars['String']['input']>;
  author_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  author_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  author_not?: InputMaybe<Scalars['String']['input']>;
  author_not_contains?: InputMaybe<Scalars['String']['input']>;
  author_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  author_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  axiom_snapshot_address?: InputMaybe<Scalars['String']['input']>;
  axiom_snapshot_address_contains?: InputMaybe<Scalars['String']['input']>;
  axiom_snapshot_address_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  axiom_snapshot_address_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  axiom_snapshot_address_not?: InputMaybe<Scalars['String']['input']>;
  axiom_snapshot_address_not_contains?: InputMaybe<Scalars['String']['input']>;
  axiom_snapshot_address_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  axiom_snapshot_address_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  axiom_snapshot_slot?: InputMaybe<Scalars['BigInt']['input']>;
  axiom_snapshot_slot_gt?: InputMaybe<Scalars['BigInt']['input']>;
  axiom_snapshot_slot_gte?: InputMaybe<Scalars['BigInt']['input']>;
  axiom_snapshot_slot_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  axiom_snapshot_slot_lt?: InputMaybe<Scalars['BigInt']['input']>;
  axiom_snapshot_slot_lte?: InputMaybe<Scalars['BigInt']['input']>;
  axiom_snapshot_slot_not?: InputMaybe<Scalars['BigInt']['input']>;
  axiom_snapshot_slot_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  cancelled?: InputMaybe<Scalars['Boolean']['input']>;
  cancelled_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  cancelled_not?: InputMaybe<Scalars['Boolean']['input']>;
  cancelled_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  completed?: InputMaybe<Scalars['Boolean']['input']>;
  completed_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  completed_not?: InputMaybe<Scalars['Boolean']['input']>;
  completed_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  created?: InputMaybe<Scalars['Int']['input']>;
  created_gt?: InputMaybe<Scalars['Int']['input']>;
  created_gte?: InputMaybe<Scalars['Int']['input']>;
  created_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created_lt?: InputMaybe<Scalars['Int']['input']>;
  created_lte?: InputMaybe<Scalars['Int']['input']>;
  created_not?: InputMaybe<Scalars['Int']['input']>;
  created_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  edited?: InputMaybe<Scalars['Int']['input']>;
  edited_gt?: InputMaybe<Scalars['Int']['input']>;
  edited_gte?: InputMaybe<Scalars['Int']['input']>;
  edited_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  edited_lt?: InputMaybe<Scalars['Int']['input']>;
  edited_lte?: InputMaybe<Scalars['Int']['input']>;
  edited_not?: InputMaybe<Scalars['Int']['input']>;
  edited_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  executed?: InputMaybe<Scalars['Boolean']['input']>;
  executed_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  executed_not?: InputMaybe<Scalars['Boolean']['input']>;
  executed_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  execution_destination?: InputMaybe<Scalars['String']['input']>;
  execution_destination_contains?: InputMaybe<Scalars['String']['input']>;
  execution_destination_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  execution_destination_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  execution_destination_not?: InputMaybe<Scalars['String']['input']>;
  execution_destination_not_contains?: InputMaybe<Scalars['String']['input']>;
  execution_destination_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  execution_destination_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  execution_hash?: InputMaybe<Scalars['String']['input']>;
  execution_hash_contains?: InputMaybe<Scalars['String']['input']>;
  execution_hash_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  execution_hash_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  execution_hash_not?: InputMaybe<Scalars['String']['input']>;
  execution_hash_not_contains?: InputMaybe<Scalars['String']['input']>;
  execution_hash_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  execution_hash_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  execution_ready?: InputMaybe<Scalars['Boolean']['input']>;
  execution_ready_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  execution_ready_not?: InputMaybe<Scalars['Boolean']['input']>;
  execution_ready_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  execution_strategy?: InputMaybe<Scalars['String']['input']>;
  execution_strategy_contains?: InputMaybe<Scalars['String']['input']>;
  execution_strategy_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  execution_strategy_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  execution_strategy_not?: InputMaybe<Scalars['String']['input']>;
  execution_strategy_not_contains?: InputMaybe<Scalars['String']['input']>;
  execution_strategy_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  execution_strategy_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  execution_strategy_type?: InputMaybe<Scalars['String']['input']>;
  execution_strategy_type_contains?: InputMaybe<Scalars['String']['input']>;
  execution_strategy_type_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  execution_strategy_type_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  execution_strategy_type_not?: InputMaybe<Scalars['String']['input']>;
  execution_strategy_type_not_contains?: InputMaybe<Scalars['String']['input']>;
  execution_strategy_type_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  execution_strategy_type_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  execution_time?: InputMaybe<Scalars['Int']['input']>;
  execution_time_gt?: InputMaybe<Scalars['Int']['input']>;
  execution_time_gte?: InputMaybe<Scalars['Int']['input']>;
  execution_time_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  execution_time_lt?: InputMaybe<Scalars['Int']['input']>;
  execution_time_lte?: InputMaybe<Scalars['Int']['input']>;
  execution_time_not?: InputMaybe<Scalars['Int']['input']>;
  execution_time_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  execution_tx?: InputMaybe<Scalars['String']['input']>;
  execution_tx_contains?: InputMaybe<Scalars['String']['input']>;
  execution_tx_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  execution_tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  execution_tx_not?: InputMaybe<Scalars['String']['input']>;
  execution_tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  execution_tx_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  execution_tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  max_end?: InputMaybe<Scalars['Int']['input']>;
  max_end_gt?: InputMaybe<Scalars['Int']['input']>;
  max_end_gte?: InputMaybe<Scalars['Int']['input']>;
  max_end_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  max_end_lt?: InputMaybe<Scalars['Int']['input']>;
  max_end_lte?: InputMaybe<Scalars['Int']['input']>;
  max_end_not?: InputMaybe<Scalars['Int']['input']>;
  max_end_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  metadata?: InputMaybe<Scalars['String']['input']>;
  metadata_?: InputMaybe<Proposal_ProposalMetadataItem_Filter>;
  metadata_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadata_not?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  min_end?: InputMaybe<Scalars['Int']['input']>;
  min_end_gt?: InputMaybe<Scalars['Int']['input']>;
  min_end_gte?: InputMaybe<Scalars['Int']['input']>;
  min_end_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  min_end_lt?: InputMaybe<Scalars['Int']['input']>;
  min_end_lte?: InputMaybe<Scalars['Int']['input']>;
  min_end_not?: InputMaybe<Scalars['Int']['input']>;
  min_end_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_id?: InputMaybe<Scalars['Int']['input']>;
  proposal_id_gt?: InputMaybe<Scalars['Int']['input']>;
  proposal_id_gte?: InputMaybe<Scalars['Int']['input']>;
  proposal_id_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_id_lt?: InputMaybe<Scalars['Int']['input']>;
  proposal_id_lte?: InputMaybe<Scalars['Int']['input']>;
  proposal_id_not?: InputMaybe<Scalars['Int']['input']>;
  proposal_id_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  quorum?: InputMaybe<Scalars['BigInt']['input']>;
  quorum_gt?: InputMaybe<Scalars['BigInt']['input']>;
  quorum_gte?: InputMaybe<Scalars['BigInt']['input']>;
  quorum_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  quorum_lt?: InputMaybe<Scalars['BigInt']['input']>;
  quorum_lte?: InputMaybe<Scalars['BigInt']['input']>;
  quorum_not?: InputMaybe<Scalars['BigInt']['input']>;
  quorum_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigInt']['input']>>>;
  scores_1?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_1_gt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_1_gte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_1_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  scores_1_lt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_1_lte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_1_not?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_1_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  scores_2?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_2_gt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_2_gte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_2_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  scores_2_lt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_2_lte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_2_not?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_2_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  scores_3?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_3_gt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_3_gte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_3_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  scores_3_lt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_3_lte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_3_not?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_3_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  scores_total?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_total_gt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_total_gte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_total_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  scores_total_lt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_total_lte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_total_not?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  scores_total_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  snapshot?: InputMaybe<Scalars['Int']['input']>;
  snapshot_gt?: InputMaybe<Scalars['Int']['input']>;
  snapshot_gte?: InputMaybe<Scalars['Int']['input']>;
  snapshot_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  snapshot_lt?: InputMaybe<Scalars['Int']['input']>;
  snapshot_lte?: InputMaybe<Scalars['Int']['input']>;
  snapshot_not?: InputMaybe<Scalars['Int']['input']>;
  snapshot_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  space?: InputMaybe<Scalars['String']['input']>;
  space_?: InputMaybe<Proposal_Space_Filter>;
  space_contains?: InputMaybe<Scalars['String']['input']>;
  space_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  space_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  space_not?: InputMaybe<Scalars['String']['input']>;
  space_not_contains?: InputMaybe<Scalars['String']['input']>;
  space_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  space_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  start?: InputMaybe<Scalars['Int']['input']>;
  start_gt?: InputMaybe<Scalars['Int']['input']>;
  start_gte?: InputMaybe<Scalars['Int']['input']>;
  start_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  start_lt?: InputMaybe<Scalars['Int']['input']>;
  start_lte?: InputMaybe<Scalars['Int']['input']>;
  start_not?: InputMaybe<Scalars['Int']['input']>;
  start_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_indices?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indices_not?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indicies?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indicies_not?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  timelock_delay?: InputMaybe<Scalars['Int']['input']>;
  timelock_delay_gt?: InputMaybe<Scalars['Int']['input']>;
  timelock_delay_gte?: InputMaybe<Scalars['Int']['input']>;
  timelock_delay_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  timelock_delay_lt?: InputMaybe<Scalars['Int']['input']>;
  timelock_delay_lte?: InputMaybe<Scalars['Int']['input']>;
  timelock_delay_not?: InputMaybe<Scalars['Int']['input']>;
  timelock_delay_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  timelock_veto_guardian?: InputMaybe<Scalars['String']['input']>;
  timelock_veto_guardian_contains?: InputMaybe<Scalars['String']['input']>;
  timelock_veto_guardian_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  timelock_veto_guardian_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  timelock_veto_guardian_not?: InputMaybe<Scalars['String']['input']>;
  timelock_veto_guardian_not_contains?: InputMaybe<Scalars['String']['input']>;
  timelock_veto_guardian_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  timelock_veto_guardian_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  type?: InputMaybe<Scalars['String']['input']>;
  type_contains?: InputMaybe<Scalars['String']['input']>;
  type_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  type_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  type_not?: InputMaybe<Scalars['String']['input']>;
  type_not_contains?: InputMaybe<Scalars['String']['input']>;
  type_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  type_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  veto_tx?: InputMaybe<Scalars['String']['input']>;
  veto_tx_contains?: InputMaybe<Scalars['String']['input']>;
  veto_tx_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  veto_tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  veto_tx_not?: InputMaybe<Scalars['String']['input']>;
  veto_tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  veto_tx_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  veto_tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  vetoed?: InputMaybe<Scalars['Boolean']['input']>;
  vetoed_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  vetoed_not?: InputMaybe<Scalars['Boolean']['input']>;
  vetoed_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  vote_count?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count_lt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_lte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
};

export enum Proposal_OrderBy {
  Author = 'author',
  AxiomSnapshotAddress = 'axiom_snapshot_address',
  AxiomSnapshotSlot = 'axiom_snapshot_slot',
  Cancelled = 'cancelled',
  Completed = 'completed',
  Created = 'created',
  Edited = 'edited',
  Executed = 'executed',
  ExecutionDestination = 'execution_destination',
  ExecutionHash = 'execution_hash',
  ExecutionReady = 'execution_ready',
  ExecutionStrategy = 'execution_strategy',
  ExecutionStrategyType = 'execution_strategy_type',
  ExecutionTime = 'execution_time',
  ExecutionTx = 'execution_tx',
  Id = 'id',
  MaxEnd = 'max_end',
  Metadata = 'metadata',
  MinEnd = 'min_end',
  ProposalId = 'proposal_id',
  Quorum = 'quorum',
  Scores_1 = 'scores_1',
  Scores_2 = 'scores_2',
  Scores_3 = 'scores_3',
  ScoresTotal = 'scores_total',
  Snapshot = 'snapshot',
  Space = 'space',
  Start = 'start',
  TimelockDelay = 'timelock_delay',
  TimelockVetoGuardian = 'timelock_veto_guardian',
  Tx = 'tx',
  Type = 'type',
  VetoTx = 'veto_tx',
  Vetoed = 'vetoed',
  VoteCount = 'vote_count'
}

export type Query = {
  __typename?: 'Query';
  _checkpoint?: Maybe<_Checkpoint>;
  _checkpoints?: Maybe<Array<Maybe<_Checkpoint>>>;
  _metadata?: Maybe<_Metadata>;
  _metadatas?: Maybe<Array<Maybe<_Metadata>>>;
  executionstrategies?: Maybe<Array<Maybe<ExecutionStrategy>>>;
  executionstrategy?: Maybe<ExecutionStrategy>;
  leaderboard?: Maybe<Leaderboard>;
  leaderboards?: Maybe<Array<Maybe<Leaderboard>>>;
  proposal?: Maybe<Proposal>;
  proposalmetadataitem?: Maybe<ProposalMetadataItem>;
  proposalmetadataitems?: Maybe<Array<Maybe<ProposalMetadataItem>>>;
  proposals?: Maybe<Array<Maybe<Proposal>>>;
  space?: Maybe<Space>;
  spacemetadataitem?: Maybe<SpaceMetadataItem>;
  spacemetadataitems?: Maybe<Array<Maybe<SpaceMetadataItem>>>;
  spaces?: Maybe<Array<Maybe<Space>>>;
  strategiesparsedmetadatadataitem?: Maybe<StrategiesParsedMetadataDataItem>;
  strategiesparsedmetadatadataitems?: Maybe<Array<Maybe<StrategiesParsedMetadataDataItem>>>;
  strategiesparsedmetadataitem?: Maybe<StrategiesParsedMetadataItem>;
  strategiesparsedmetadataitems?: Maybe<Array<Maybe<StrategiesParsedMetadataItem>>>;
  user?: Maybe<User>;
  users?: Maybe<Array<Maybe<User>>>;
  vote?: Maybe<Vote>;
  votemetadataitem?: Maybe<VoteMetadataItem>;
  votemetadataitems?: Maybe<Array<Maybe<VoteMetadataItem>>>;
  votes?: Maybe<Array<Maybe<Vote>>>;
  votingpowervalidationstrategiesparsedmetadataitem?: Maybe<VotingPowerValidationStrategiesParsedMetadataItem>;
  votingpowervalidationstrategiesparsedmetadataitems?: Maybe<Array<Maybe<VotingPowerValidationStrategiesParsedMetadataItem>>>;
};


export type Query_CheckpointArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
};


export type Query_CheckpointsArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<_Checkpoint_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<_Checkpoint_Filter>;
};


export type Query_MetadataArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
};


export type Query_MetadatasArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<_Metadata_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<_Metadata_Filter>;
};


export type QueryExecutionstrategiesArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ExecutionStrategy_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<ExecutionStrategy_Filter>;
};


export type QueryExecutionstrategyArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
};


export type QueryLeaderboardArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
};


export type QueryLeaderboardsArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Leaderboard_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<Leaderboard_Filter>;
};


export type QueryProposalArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
};


export type QueryProposalmetadataitemArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
};


export type QueryProposalmetadataitemsArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ProposalMetadataItem_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<ProposalMetadataItem_Filter>;
};


export type QueryProposalsArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Proposal_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<Proposal_Filter>;
};


export type QuerySpaceArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
};


export type QuerySpacemetadataitemArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
};


export type QuerySpacemetadataitemsArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<SpaceMetadataItem_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<SpaceMetadataItem_Filter>;
};


export type QuerySpacesArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Space_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<Space_Filter>;
};


export type QueryStrategiesparsedmetadatadataitemArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
};


export type QueryStrategiesparsedmetadatadataitemsArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<StrategiesParsedMetadataDataItem_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<StrategiesParsedMetadataDataItem_Filter>;
};


export type QueryStrategiesparsedmetadataitemArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
};


export type QueryStrategiesparsedmetadataitemsArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<StrategiesParsedMetadataItem_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<StrategiesParsedMetadataItem_Filter>;
};


export type QueryUserArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
};


export type QueryUsersArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<User_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<User_Filter>;
};


export type QueryVoteArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
};


export type QueryVotemetadataitemArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
};


export type QueryVotemetadataitemsArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<VoteMetadataItem_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<VoteMetadataItem_Filter>;
};


export type QueryVotesArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Vote_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<Vote_Filter>;
};


export type QueryVotingpowervalidationstrategiesparsedmetadataitemArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['String']['input'];
};


export type QueryVotingpowervalidationstrategiesparsedmetadataitemsArgs = {
  block?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<VotingPowerValidationStrategiesParsedMetadataItem_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<VotingPowerValidationStrategiesParsedMetadataItem_Filter>;
};

export type Space = {
  __typename?: 'Space';
  authenticators: Array<Maybe<Scalars['String']['output']>>;
  controller: Scalars['String']['output'];
  created: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  max_voting_period: Scalars['Int']['output'];
  metadata?: Maybe<SpaceMetadataItem>;
  min_voting_period: Scalars['Int']['output'];
  next_strategy_index: Scalars['Int']['output'];
  proposal_count: Scalars['Int']['output'];
  proposal_threshold: Scalars['BigDecimalVP']['output'];
  proposals: Array<Maybe<Proposal>>;
  proposer_count: Scalars['Int']['output'];
  strategies: Array<Maybe<Scalars['String']['output']>>;
  strategies_indices: Array<Maybe<Scalars['Int']['output']>>;
  strategies_indicies: Array<Maybe<Scalars['Int']['output']>>;
  strategies_metadata: Array<Maybe<Scalars['String']['output']>>;
  strategies_params: Array<Maybe<Scalars['String']['output']>>;
  strategies_parsed_metadata: Array<Maybe<StrategiesParsedMetadataItem>>;
  turbo: Scalars['Boolean']['output'];
  tx: Scalars['String']['output'];
  validation_strategy: Scalars['String']['output'];
  validation_strategy_params: Scalars['Text']['output'];
  verified: Scalars['Boolean']['output'];
  vote_count: Scalars['Int']['output'];
  voter_count: Scalars['Int']['output'];
  voting_delay: Scalars['Int']['output'];
  voting_power_validation_strategies_parsed_metadata: Array<Maybe<VotingPowerValidationStrategiesParsedMetadataItem>>;
  voting_power_validation_strategy_metadata: Scalars['String']['output'];
  voting_power_validation_strategy_strategies: Array<Maybe<Scalars['String']['output']>>;
  voting_power_validation_strategy_strategies_params: Array<Maybe<Scalars['String']['output']>>;
};

export type SpaceMetadataItem = {
  __typename?: 'SpaceMetadataItem';
  about: Scalars['String']['output'];
  avatar: Scalars['String']['output'];
  cover: Scalars['String']['output'];
  delegations: Array<Maybe<Scalars['String']['output']>>;
  discord: Scalars['String']['output'];
  executors: Array<Maybe<Scalars['String']['output']>>;
  executors_destinations: Array<Maybe<Scalars['String']['output']>>;
  executors_strategies: Array<Maybe<ExecutionStrategy>>;
  executors_types: Array<Maybe<Scalars['String']['output']>>;
  external_url: Scalars['String']['output'];
  github: Scalars['String']['output'];
  id: Scalars['String']['output'];
  labels: Array<Maybe<Scalars['String']['output']>>;
  name: Scalars['String']['output'];
  treasuries: Array<Maybe<Scalars['String']['output']>>;
  twitter: Scalars['String']['output'];
  voting_power_symbol: Scalars['String']['output'];
  wallet: Scalars['String']['output'];
};

export type SpaceMetadataItem_Filter = {
  about?: InputMaybe<Scalars['String']['input']>;
  about_contains?: InputMaybe<Scalars['String']['input']>;
  about_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  about_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  about_not?: InputMaybe<Scalars['String']['input']>;
  about_not_contains?: InputMaybe<Scalars['String']['input']>;
  about_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  about_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  avatar?: InputMaybe<Scalars['String']['input']>;
  avatar_contains?: InputMaybe<Scalars['String']['input']>;
  avatar_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  avatar_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  avatar_not?: InputMaybe<Scalars['String']['input']>;
  avatar_not_contains?: InputMaybe<Scalars['String']['input']>;
  avatar_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  avatar_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  cover?: InputMaybe<Scalars['String']['input']>;
  cover_contains?: InputMaybe<Scalars['String']['input']>;
  cover_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  cover_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  cover_not?: InputMaybe<Scalars['String']['input']>;
  cover_not_contains?: InputMaybe<Scalars['String']['input']>;
  cover_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  cover_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  delegations?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  delegations_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  delegations_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  delegations_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  discord?: InputMaybe<Scalars['String']['input']>;
  discord_contains?: InputMaybe<Scalars['String']['input']>;
  discord_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  discord_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  discord_not?: InputMaybe<Scalars['String']['input']>;
  discord_not_contains?: InputMaybe<Scalars['String']['input']>;
  discord_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  discord_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_destinations?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_destinations_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_destinations_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_destinations_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_types?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_types_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_types_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_types_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  external_url?: InputMaybe<Scalars['String']['input']>;
  external_url_contains?: InputMaybe<Scalars['String']['input']>;
  external_url_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  external_url_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  external_url_not?: InputMaybe<Scalars['String']['input']>;
  external_url_not_contains?: InputMaybe<Scalars['String']['input']>;
  external_url_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  external_url_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  github?: InputMaybe<Scalars['String']['input']>;
  github_contains?: InputMaybe<Scalars['String']['input']>;
  github_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  github_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  github_not?: InputMaybe<Scalars['String']['input']>;
  github_not_contains?: InputMaybe<Scalars['String']['input']>;
  github_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  github_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name?: InputMaybe<Scalars['String']['input']>;
  name_contains?: InputMaybe<Scalars['String']['input']>;
  name_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name_not?: InputMaybe<Scalars['String']['input']>;
  name_not_contains?: InputMaybe<Scalars['String']['input']>;
  name_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  treasuries?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  treasuries_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  treasuries_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  treasuries_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  twitter?: InputMaybe<Scalars['String']['input']>;
  twitter_contains?: InputMaybe<Scalars['String']['input']>;
  twitter_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  twitter_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  twitter_not?: InputMaybe<Scalars['String']['input']>;
  twitter_not_contains?: InputMaybe<Scalars['String']['input']>;
  twitter_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  twitter_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_symbol?: InputMaybe<Scalars['String']['input']>;
  voting_power_symbol_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_symbol_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_symbol_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_symbol_not?: InputMaybe<Scalars['String']['input']>;
  voting_power_symbol_not_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_symbol_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_symbol_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  wallet?: InputMaybe<Scalars['String']['input']>;
  wallet_contains?: InputMaybe<Scalars['String']['input']>;
  wallet_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  wallet_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  wallet_not?: InputMaybe<Scalars['String']['input']>;
  wallet_not_contains?: InputMaybe<Scalars['String']['input']>;
  wallet_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  wallet_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export enum SpaceMetadataItem_OrderBy {
  About = 'about',
  Avatar = 'avatar',
  Cover = 'cover',
  Discord = 'discord',
  ExternalUrl = 'external_url',
  Github = 'github',
  Id = 'id',
  Name = 'name',
  Twitter = 'twitter',
  VotingPowerSymbol = 'voting_power_symbol',
  Wallet = 'wallet'
}

export type Space_SpaceMetadataItem_Filter = {
  about?: InputMaybe<Scalars['String']['input']>;
  about_contains?: InputMaybe<Scalars['String']['input']>;
  about_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  about_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  about_not?: InputMaybe<Scalars['String']['input']>;
  about_not_contains?: InputMaybe<Scalars['String']['input']>;
  about_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  about_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  avatar?: InputMaybe<Scalars['String']['input']>;
  avatar_contains?: InputMaybe<Scalars['String']['input']>;
  avatar_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  avatar_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  avatar_not?: InputMaybe<Scalars['String']['input']>;
  avatar_not_contains?: InputMaybe<Scalars['String']['input']>;
  avatar_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  avatar_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  cover?: InputMaybe<Scalars['String']['input']>;
  cover_contains?: InputMaybe<Scalars['String']['input']>;
  cover_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  cover_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  cover_not?: InputMaybe<Scalars['String']['input']>;
  cover_not_contains?: InputMaybe<Scalars['String']['input']>;
  cover_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  cover_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  delegations?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  delegations_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  delegations_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  delegations_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  discord?: InputMaybe<Scalars['String']['input']>;
  discord_contains?: InputMaybe<Scalars['String']['input']>;
  discord_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  discord_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  discord_not?: InputMaybe<Scalars['String']['input']>;
  discord_not_contains?: InputMaybe<Scalars['String']['input']>;
  discord_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  discord_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_destinations?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_destinations_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_destinations_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_destinations_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_types?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_types_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_types_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  executors_types_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  external_url?: InputMaybe<Scalars['String']['input']>;
  external_url_contains?: InputMaybe<Scalars['String']['input']>;
  external_url_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  external_url_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  external_url_not?: InputMaybe<Scalars['String']['input']>;
  external_url_not_contains?: InputMaybe<Scalars['String']['input']>;
  external_url_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  external_url_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  github?: InputMaybe<Scalars['String']['input']>;
  github_contains?: InputMaybe<Scalars['String']['input']>;
  github_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  github_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  github_not?: InputMaybe<Scalars['String']['input']>;
  github_not_contains?: InputMaybe<Scalars['String']['input']>;
  github_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  github_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  labels_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name?: InputMaybe<Scalars['String']['input']>;
  name_contains?: InputMaybe<Scalars['String']['input']>;
  name_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name_not?: InputMaybe<Scalars['String']['input']>;
  name_not_contains?: InputMaybe<Scalars['String']['input']>;
  name_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  treasuries?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  treasuries_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  treasuries_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  treasuries_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  twitter?: InputMaybe<Scalars['String']['input']>;
  twitter_contains?: InputMaybe<Scalars['String']['input']>;
  twitter_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  twitter_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  twitter_not?: InputMaybe<Scalars['String']['input']>;
  twitter_not_contains?: InputMaybe<Scalars['String']['input']>;
  twitter_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  twitter_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_symbol?: InputMaybe<Scalars['String']['input']>;
  voting_power_symbol_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_symbol_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_symbol_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_symbol_not?: InputMaybe<Scalars['String']['input']>;
  voting_power_symbol_not_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_symbol_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_symbol_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  wallet?: InputMaybe<Scalars['String']['input']>;
  wallet_contains?: InputMaybe<Scalars['String']['input']>;
  wallet_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  wallet_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  wallet_not?: InputMaybe<Scalars['String']['input']>;
  wallet_not_contains?: InputMaybe<Scalars['String']['input']>;
  wallet_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  wallet_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export type Space_Filter = {
  authenticators?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  controller?: InputMaybe<Scalars['String']['input']>;
  controller_contains?: InputMaybe<Scalars['String']['input']>;
  controller_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  controller_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  controller_not?: InputMaybe<Scalars['String']['input']>;
  controller_not_contains?: InputMaybe<Scalars['String']['input']>;
  controller_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  controller_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  created?: InputMaybe<Scalars['Int']['input']>;
  created_gt?: InputMaybe<Scalars['Int']['input']>;
  created_gte?: InputMaybe<Scalars['Int']['input']>;
  created_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created_lt?: InputMaybe<Scalars['Int']['input']>;
  created_lte?: InputMaybe<Scalars['Int']['input']>;
  created_not?: InputMaybe<Scalars['Int']['input']>;
  created_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  max_voting_period?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_gt?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_gte?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  max_voting_period_lt?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_lte?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_not?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  metadata?: InputMaybe<Scalars['String']['input']>;
  metadata_?: InputMaybe<Space_SpaceMetadataItem_Filter>;
  metadata_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadata_not?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  min_voting_period?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_gt?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_gte?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  min_voting_period_lt?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_lte?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_not?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  next_strategy_index?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_gt?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_gte?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  next_strategy_index_lt?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_lte?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_not?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_threshold?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_gt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_gte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  proposal_threshold_lt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_lte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_not?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  proposer_count?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposer_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_indices?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indices_not?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indicies?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indicies_not?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_metadata?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  turbo?: InputMaybe<Scalars['Boolean']['input']>;
  turbo_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  turbo_not?: InputMaybe<Scalars['Boolean']['input']>;
  turbo_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy_not?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy_params_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_not_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  verified?: InputMaybe<Scalars['Boolean']['input']>;
  verified_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  verified_not?: InputMaybe<Scalars['Boolean']['input']>;
  verified_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  vote_count?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count_lt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_lte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voter_count?: InputMaybe<Scalars['Int']['input']>;
  voter_count_gt?: InputMaybe<Scalars['Int']['input']>;
  voter_count_gte?: InputMaybe<Scalars['Int']['input']>;
  voter_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voter_count_lt?: InputMaybe<Scalars['Int']['input']>;
  voter_count_lte?: InputMaybe<Scalars['Int']['input']>;
  voter_count_not?: InputMaybe<Scalars['Int']['input']>;
  voter_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_delay?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_gt?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_gte?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_delay_lt?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_lte?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_not?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_power_validation_strategy_metadata?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_metadata_not?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export enum Space_OrderBy {
  Controller = 'controller',
  Created = 'created',
  Id = 'id',
  MaxVotingPeriod = 'max_voting_period',
  Metadata = 'metadata',
  MinVotingPeriod = 'min_voting_period',
  NextStrategyIndex = 'next_strategy_index',
  ProposalCount = 'proposal_count',
  ProposalThreshold = 'proposal_threshold',
  ProposerCount = 'proposer_count',
  Turbo = 'turbo',
  Tx = 'tx',
  ValidationStrategy = 'validation_strategy',
  ValidationStrategyParams = 'validation_strategy_params',
  Verified = 'verified',
  VoteCount = 'vote_count',
  VoterCount = 'voter_count',
  VotingDelay = 'voting_delay',
  VotingPowerValidationStrategyMetadata = 'voting_power_validation_strategy_metadata'
}

export type StrategiesParsedMetadataDataItem = {
  __typename?: 'StrategiesParsedMetadataDataItem';
  decimals: Scalars['Int']['output'];
  description: Scalars['String']['output'];
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  payload?: Maybe<Scalars['String']['output']>;
  symbol: Scalars['String']['output'];
  token?: Maybe<Scalars['String']['output']>;
};

export type StrategiesParsedMetadataDataItem_Filter = {
  decimals?: InputMaybe<Scalars['Int']['input']>;
  decimals_gt?: InputMaybe<Scalars['Int']['input']>;
  decimals_gte?: InputMaybe<Scalars['Int']['input']>;
  decimals_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  decimals_lt?: InputMaybe<Scalars['Int']['input']>;
  decimals_lte?: InputMaybe<Scalars['Int']['input']>;
  decimals_not?: InputMaybe<Scalars['Int']['input']>;
  decimals_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  description?: InputMaybe<Scalars['String']['input']>;
  description_contains?: InputMaybe<Scalars['String']['input']>;
  description_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  description_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  description_not?: InputMaybe<Scalars['String']['input']>;
  description_not_contains?: InputMaybe<Scalars['String']['input']>;
  description_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  description_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name?: InputMaybe<Scalars['String']['input']>;
  name_contains?: InputMaybe<Scalars['String']['input']>;
  name_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name_not?: InputMaybe<Scalars['String']['input']>;
  name_not_contains?: InputMaybe<Scalars['String']['input']>;
  name_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  payload?: InputMaybe<Scalars['String']['input']>;
  payload_contains?: InputMaybe<Scalars['String']['input']>;
  payload_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  payload_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  payload_not?: InputMaybe<Scalars['String']['input']>;
  payload_not_contains?: InputMaybe<Scalars['String']['input']>;
  payload_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  payload_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  symbol?: InputMaybe<Scalars['String']['input']>;
  symbol_contains?: InputMaybe<Scalars['String']['input']>;
  symbol_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  symbol_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  symbol_not?: InputMaybe<Scalars['String']['input']>;
  symbol_not_contains?: InputMaybe<Scalars['String']['input']>;
  symbol_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  symbol_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  token?: InputMaybe<Scalars['String']['input']>;
  token_contains?: InputMaybe<Scalars['String']['input']>;
  token_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  token_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  token_not?: InputMaybe<Scalars['String']['input']>;
  token_not_contains?: InputMaybe<Scalars['String']['input']>;
  token_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  token_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export enum StrategiesParsedMetadataDataItem_OrderBy {
  Decimals = 'decimals',
  Description = 'description',
  Id = 'id',
  Name = 'name',
  Payload = 'payload',
  Symbol = 'symbol',
  Token = 'token'
}

export type StrategiesParsedMetadataItem = {
  __typename?: 'StrategiesParsedMetadataItem';
  data?: Maybe<StrategiesParsedMetadataDataItem>;
  id: Scalars['String']['output'];
  index: Scalars['Int']['output'];
  space: Space;
};

export type StrategiesParsedMetadataItem_Space_Filter = {
  authenticators?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  controller?: InputMaybe<Scalars['String']['input']>;
  controller_contains?: InputMaybe<Scalars['String']['input']>;
  controller_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  controller_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  controller_not?: InputMaybe<Scalars['String']['input']>;
  controller_not_contains?: InputMaybe<Scalars['String']['input']>;
  controller_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  controller_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  created?: InputMaybe<Scalars['Int']['input']>;
  created_gt?: InputMaybe<Scalars['Int']['input']>;
  created_gte?: InputMaybe<Scalars['Int']['input']>;
  created_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created_lt?: InputMaybe<Scalars['Int']['input']>;
  created_lte?: InputMaybe<Scalars['Int']['input']>;
  created_not?: InputMaybe<Scalars['Int']['input']>;
  created_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  max_voting_period?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_gt?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_gte?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  max_voting_period_lt?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_lte?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_not?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  metadata?: InputMaybe<Scalars['String']['input']>;
  metadata_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadata_not?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  min_voting_period?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_gt?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_gte?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  min_voting_period_lt?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_lte?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_not?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  next_strategy_index?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_gt?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_gte?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  next_strategy_index_lt?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_lte?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_not?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_threshold?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_gt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_gte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  proposal_threshold_lt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_lte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_not?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  proposer_count?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposer_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_indices?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indices_not?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indicies?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indicies_not?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_metadata?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  turbo?: InputMaybe<Scalars['Boolean']['input']>;
  turbo_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  turbo_not?: InputMaybe<Scalars['Boolean']['input']>;
  turbo_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy_not?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy_params_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_not_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  verified?: InputMaybe<Scalars['Boolean']['input']>;
  verified_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  verified_not?: InputMaybe<Scalars['Boolean']['input']>;
  verified_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  vote_count?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count_lt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_lte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voter_count?: InputMaybe<Scalars['Int']['input']>;
  voter_count_gt?: InputMaybe<Scalars['Int']['input']>;
  voter_count_gte?: InputMaybe<Scalars['Int']['input']>;
  voter_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voter_count_lt?: InputMaybe<Scalars['Int']['input']>;
  voter_count_lte?: InputMaybe<Scalars['Int']['input']>;
  voter_count_not?: InputMaybe<Scalars['Int']['input']>;
  voter_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_delay?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_gt?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_gte?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_delay_lt?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_lte?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_not?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_power_validation_strategy_metadata?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_metadata_not?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export type StrategiesParsedMetadataItem_StrategiesParsedMetadataDataItem_Filter = {
  decimals?: InputMaybe<Scalars['Int']['input']>;
  decimals_gt?: InputMaybe<Scalars['Int']['input']>;
  decimals_gte?: InputMaybe<Scalars['Int']['input']>;
  decimals_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  decimals_lt?: InputMaybe<Scalars['Int']['input']>;
  decimals_lte?: InputMaybe<Scalars['Int']['input']>;
  decimals_not?: InputMaybe<Scalars['Int']['input']>;
  decimals_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  description?: InputMaybe<Scalars['String']['input']>;
  description_contains?: InputMaybe<Scalars['String']['input']>;
  description_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  description_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  description_not?: InputMaybe<Scalars['String']['input']>;
  description_not_contains?: InputMaybe<Scalars['String']['input']>;
  description_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  description_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name?: InputMaybe<Scalars['String']['input']>;
  name_contains?: InputMaybe<Scalars['String']['input']>;
  name_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name_not?: InputMaybe<Scalars['String']['input']>;
  name_not_contains?: InputMaybe<Scalars['String']['input']>;
  name_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  payload?: InputMaybe<Scalars['String']['input']>;
  payload_contains?: InputMaybe<Scalars['String']['input']>;
  payload_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  payload_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  payload_not?: InputMaybe<Scalars['String']['input']>;
  payload_not_contains?: InputMaybe<Scalars['String']['input']>;
  payload_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  payload_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  symbol?: InputMaybe<Scalars['String']['input']>;
  symbol_contains?: InputMaybe<Scalars['String']['input']>;
  symbol_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  symbol_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  symbol_not?: InputMaybe<Scalars['String']['input']>;
  symbol_not_contains?: InputMaybe<Scalars['String']['input']>;
  symbol_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  symbol_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  token?: InputMaybe<Scalars['String']['input']>;
  token_contains?: InputMaybe<Scalars['String']['input']>;
  token_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  token_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  token_not?: InputMaybe<Scalars['String']['input']>;
  token_not_contains?: InputMaybe<Scalars['String']['input']>;
  token_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  token_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export type StrategiesParsedMetadataItem_Filter = {
  data?: InputMaybe<Scalars['String']['input']>;
  data_?: InputMaybe<StrategiesParsedMetadataItem_StrategiesParsedMetadataDataItem_Filter>;
  data_contains?: InputMaybe<Scalars['String']['input']>;
  data_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  data_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  data_not?: InputMaybe<Scalars['String']['input']>;
  data_not_contains?: InputMaybe<Scalars['String']['input']>;
  data_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  data_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  index?: InputMaybe<Scalars['Int']['input']>;
  index_gt?: InputMaybe<Scalars['Int']['input']>;
  index_gte?: InputMaybe<Scalars['Int']['input']>;
  index_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  index_lt?: InputMaybe<Scalars['Int']['input']>;
  index_lte?: InputMaybe<Scalars['Int']['input']>;
  index_not?: InputMaybe<Scalars['Int']['input']>;
  index_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  space?: InputMaybe<Scalars['String']['input']>;
  space_?: InputMaybe<StrategiesParsedMetadataItem_Space_Filter>;
  space_contains?: InputMaybe<Scalars['String']['input']>;
  space_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  space_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  space_not?: InputMaybe<Scalars['String']['input']>;
  space_not_contains?: InputMaybe<Scalars['String']['input']>;
  space_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  space_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export enum StrategiesParsedMetadataItem_OrderBy {
  Data = 'data',
  Id = 'id',
  Index = 'index',
  Space = 'space'
}

export type User = {
  __typename?: 'User';
  address_type: Scalars['Int']['output'];
  created: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  proposal_count: Scalars['Int']['output'];
  proposals: Array<Maybe<Proposal>>;
  vote_count: Scalars['Int']['output'];
  votes: Array<Maybe<Vote>>;
};

export type User_Filter = {
  address_type?: InputMaybe<Scalars['Int']['input']>;
  address_type_gt?: InputMaybe<Scalars['Int']['input']>;
  address_type_gte?: InputMaybe<Scalars['Int']['input']>;
  address_type_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  address_type_lt?: InputMaybe<Scalars['Int']['input']>;
  address_type_lte?: InputMaybe<Scalars['Int']['input']>;
  address_type_not?: InputMaybe<Scalars['Int']['input']>;
  address_type_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created?: InputMaybe<Scalars['Int']['input']>;
  created_gt?: InputMaybe<Scalars['Int']['input']>;
  created_gte?: InputMaybe<Scalars['Int']['input']>;
  created_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created_lt?: InputMaybe<Scalars['Int']['input']>;
  created_lte?: InputMaybe<Scalars['Int']['input']>;
  created_not?: InputMaybe<Scalars['Int']['input']>;
  created_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  proposal_count?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count_lt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_lte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
};

export enum User_OrderBy {
  AddressType = 'address_type',
  Created = 'created',
  Id = 'id',
  ProposalCount = 'proposal_count',
  VoteCount = 'vote_count'
}

export type Vote = {
  __typename?: 'Vote';
  choice: Scalars['Int']['output'];
  created: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  metadata?: Maybe<VoteMetadataItem>;
  proposal: Scalars['Int']['output'];
  space: Space;
  tx: Scalars['String']['output'];
  voter: User;
  vp: Scalars['BigDecimalVP']['output'];
};

export type VoteMetadataItem = {
  __typename?: 'VoteMetadataItem';
  id: Scalars['String']['output'];
  reason: Scalars['Text']['output'];
};

export type VoteMetadataItem_Filter = {
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  reason_contains?: InputMaybe<Scalars['String']['input']>;
  reason_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  reason_not_contains?: InputMaybe<Scalars['String']['input']>;
  reason_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
};

export enum VoteMetadataItem_OrderBy {
  Id = 'id',
  Reason = 'reason'
}

export type Vote_Space_Filter = {
  authenticators?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  controller?: InputMaybe<Scalars['String']['input']>;
  controller_contains?: InputMaybe<Scalars['String']['input']>;
  controller_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  controller_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  controller_not?: InputMaybe<Scalars['String']['input']>;
  controller_not_contains?: InputMaybe<Scalars['String']['input']>;
  controller_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  controller_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  created?: InputMaybe<Scalars['Int']['input']>;
  created_gt?: InputMaybe<Scalars['Int']['input']>;
  created_gte?: InputMaybe<Scalars['Int']['input']>;
  created_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created_lt?: InputMaybe<Scalars['Int']['input']>;
  created_lte?: InputMaybe<Scalars['Int']['input']>;
  created_not?: InputMaybe<Scalars['Int']['input']>;
  created_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  max_voting_period?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_gt?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_gte?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  max_voting_period_lt?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_lte?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_not?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  metadata?: InputMaybe<Scalars['String']['input']>;
  metadata_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadata_not?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  min_voting_period?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_gt?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_gte?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  min_voting_period_lt?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_lte?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_not?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  next_strategy_index?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_gt?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_gte?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  next_strategy_index_lt?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_lte?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_not?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_threshold?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_gt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_gte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  proposal_threshold_lt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_lte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_not?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  proposer_count?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposer_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_indices?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indices_not?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indicies?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indicies_not?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_metadata?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  turbo?: InputMaybe<Scalars['Boolean']['input']>;
  turbo_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  turbo_not?: InputMaybe<Scalars['Boolean']['input']>;
  turbo_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy_not?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy_params_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_not_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  verified?: InputMaybe<Scalars['Boolean']['input']>;
  verified_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  verified_not?: InputMaybe<Scalars['Boolean']['input']>;
  verified_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  vote_count?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count_lt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_lte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voter_count?: InputMaybe<Scalars['Int']['input']>;
  voter_count_gt?: InputMaybe<Scalars['Int']['input']>;
  voter_count_gte?: InputMaybe<Scalars['Int']['input']>;
  voter_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voter_count_lt?: InputMaybe<Scalars['Int']['input']>;
  voter_count_lte?: InputMaybe<Scalars['Int']['input']>;
  voter_count_not?: InputMaybe<Scalars['Int']['input']>;
  voter_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_delay?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_gt?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_gte?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_delay_lt?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_lte?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_not?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_power_validation_strategy_metadata?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_metadata_not?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export type Vote_User_Filter = {
  address_type?: InputMaybe<Scalars['Int']['input']>;
  address_type_gt?: InputMaybe<Scalars['Int']['input']>;
  address_type_gte?: InputMaybe<Scalars['Int']['input']>;
  address_type_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  address_type_lt?: InputMaybe<Scalars['Int']['input']>;
  address_type_lte?: InputMaybe<Scalars['Int']['input']>;
  address_type_not?: InputMaybe<Scalars['Int']['input']>;
  address_type_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created?: InputMaybe<Scalars['Int']['input']>;
  created_gt?: InputMaybe<Scalars['Int']['input']>;
  created_gte?: InputMaybe<Scalars['Int']['input']>;
  created_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created_lt?: InputMaybe<Scalars['Int']['input']>;
  created_lte?: InputMaybe<Scalars['Int']['input']>;
  created_not?: InputMaybe<Scalars['Int']['input']>;
  created_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  proposal_count?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count_lt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_lte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
};

export type Vote_VoteMetadataItem_Filter = {
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  reason_contains?: InputMaybe<Scalars['String']['input']>;
  reason_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  reason_not_contains?: InputMaybe<Scalars['String']['input']>;
  reason_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
};

export type Vote_Filter = {
  choice?: InputMaybe<Scalars['Int']['input']>;
  choice_gt?: InputMaybe<Scalars['Int']['input']>;
  choice_gte?: InputMaybe<Scalars['Int']['input']>;
  choice_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  choice_lt?: InputMaybe<Scalars['Int']['input']>;
  choice_lte?: InputMaybe<Scalars['Int']['input']>;
  choice_not?: InputMaybe<Scalars['Int']['input']>;
  choice_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created?: InputMaybe<Scalars['Int']['input']>;
  created_gt?: InputMaybe<Scalars['Int']['input']>;
  created_gte?: InputMaybe<Scalars['Int']['input']>;
  created_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created_lt?: InputMaybe<Scalars['Int']['input']>;
  created_lte?: InputMaybe<Scalars['Int']['input']>;
  created_not?: InputMaybe<Scalars['Int']['input']>;
  created_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadata?: InputMaybe<Scalars['String']['input']>;
  metadata_?: InputMaybe<Vote_VoteMetadataItem_Filter>;
  metadata_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadata_not?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  proposal?: InputMaybe<Scalars['Int']['input']>;
  proposal_gt?: InputMaybe<Scalars['Int']['input']>;
  proposal_gte?: InputMaybe<Scalars['Int']['input']>;
  proposal_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_lt?: InputMaybe<Scalars['Int']['input']>;
  proposal_lte?: InputMaybe<Scalars['Int']['input']>;
  proposal_not?: InputMaybe<Scalars['Int']['input']>;
  proposal_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  space?: InputMaybe<Scalars['String']['input']>;
  space_?: InputMaybe<Vote_Space_Filter>;
  space_contains?: InputMaybe<Scalars['String']['input']>;
  space_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  space_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  space_not?: InputMaybe<Scalars['String']['input']>;
  space_not_contains?: InputMaybe<Scalars['String']['input']>;
  space_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  space_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voter?: InputMaybe<Scalars['String']['input']>;
  voter_?: InputMaybe<Vote_User_Filter>;
  voter_contains?: InputMaybe<Scalars['String']['input']>;
  voter_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voter_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voter_not?: InputMaybe<Scalars['String']['input']>;
  voter_not_contains?: InputMaybe<Scalars['String']['input']>;
  voter_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voter_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  vp?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  vp_gt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  vp_gte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  vp_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  vp_lt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  vp_lte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  vp_not?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  vp_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
};

export enum Vote_OrderBy {
  Choice = 'choice',
  Created = 'created',
  Id = 'id',
  Metadata = 'metadata',
  Proposal = 'proposal',
  Space = 'space',
  Tx = 'tx',
  Voter = 'voter',
  Vp = 'vp'
}

export type VotingPowerValidationStrategiesParsedMetadataItem = {
  __typename?: 'VotingPowerValidationStrategiesParsedMetadataItem';
  data?: Maybe<StrategiesParsedMetadataDataItem>;
  id: Scalars['String']['output'];
  index: Scalars['Int']['output'];
  space: Space;
};

export type VotingPowerValidationStrategiesParsedMetadataItem_Space_Filter = {
  authenticators?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  authenticators_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  controller?: InputMaybe<Scalars['String']['input']>;
  controller_contains?: InputMaybe<Scalars['String']['input']>;
  controller_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  controller_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  controller_not?: InputMaybe<Scalars['String']['input']>;
  controller_not_contains?: InputMaybe<Scalars['String']['input']>;
  controller_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  controller_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  created?: InputMaybe<Scalars['Int']['input']>;
  created_gt?: InputMaybe<Scalars['Int']['input']>;
  created_gte?: InputMaybe<Scalars['Int']['input']>;
  created_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  created_lt?: InputMaybe<Scalars['Int']['input']>;
  created_lte?: InputMaybe<Scalars['Int']['input']>;
  created_not?: InputMaybe<Scalars['Int']['input']>;
  created_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  max_voting_period?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_gt?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_gte?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  max_voting_period_lt?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_lte?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_not?: InputMaybe<Scalars['Int']['input']>;
  max_voting_period_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  metadata?: InputMaybe<Scalars['String']['input']>;
  metadata_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  metadata_not?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains?: InputMaybe<Scalars['String']['input']>;
  metadata_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadata_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  min_voting_period?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_gt?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_gte?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  min_voting_period_lt?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_lte?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_not?: InputMaybe<Scalars['Int']['input']>;
  min_voting_period_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  next_strategy_index?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_gt?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_gte?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  next_strategy_index_lt?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_lte?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_not?: InputMaybe<Scalars['Int']['input']>;
  next_strategy_index_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposal_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposal_threshold?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_gt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_gte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  proposal_threshold_lt?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_lte?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_not?: InputMaybe<Scalars['BigDecimalVP']['input']>;
  proposal_threshold_not_in?: InputMaybe<Array<InputMaybe<Scalars['BigDecimalVP']['input']>>>;
  proposer_count?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_gt?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_gte?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  proposer_count_lt?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_lte?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_not?: InputMaybe<Scalars['Int']['input']>;
  proposer_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_indices?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indices_not?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indicies?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_indicies_not?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  strategies_metadata?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_metadata_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  strategies_params_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  turbo?: InputMaybe<Scalars['Boolean']['input']>;
  turbo_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  turbo_not?: InputMaybe<Scalars['Boolean']['input']>;
  turbo_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  tx?: InputMaybe<Scalars['String']['input']>;
  tx_contains?: InputMaybe<Scalars['String']['input']>;
  tx_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  tx_not?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains?: InputMaybe<Scalars['String']['input']>;
  tx_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  tx_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy_not?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  validation_strategy_params_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_not_contains?: InputMaybe<Scalars['String']['input']>;
  validation_strategy_params_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  verified?: InputMaybe<Scalars['Boolean']['input']>;
  verified_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  verified_not?: InputMaybe<Scalars['Boolean']['input']>;
  verified_not_in?: InputMaybe<Array<InputMaybe<Scalars['Boolean']['input']>>>;
  vote_count?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_gte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  vote_count_lt?: InputMaybe<Scalars['Int']['input']>;
  vote_count_lte?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not?: InputMaybe<Scalars['Int']['input']>;
  vote_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voter_count?: InputMaybe<Scalars['Int']['input']>;
  voter_count_gt?: InputMaybe<Scalars['Int']['input']>;
  voter_count_gte?: InputMaybe<Scalars['Int']['input']>;
  voter_count_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voter_count_lt?: InputMaybe<Scalars['Int']['input']>;
  voter_count_lte?: InputMaybe<Scalars['Int']['input']>;
  voter_count_not?: InputMaybe<Scalars['Int']['input']>;
  voter_count_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_delay?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_gt?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_gte?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_delay_lt?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_lte?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_not?: InputMaybe<Scalars['Int']['input']>;
  voting_delay_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  voting_power_validation_strategy_metadata?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_metadata_not?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_contains?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  voting_power_validation_strategy_metadata_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_not?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  voting_power_validation_strategy_strategies_params_not_contains?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export type VotingPowerValidationStrategiesParsedMetadataItem_StrategiesParsedMetadataDataItem_Filter = {
  decimals?: InputMaybe<Scalars['Int']['input']>;
  decimals_gt?: InputMaybe<Scalars['Int']['input']>;
  decimals_gte?: InputMaybe<Scalars['Int']['input']>;
  decimals_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  decimals_lt?: InputMaybe<Scalars['Int']['input']>;
  decimals_lte?: InputMaybe<Scalars['Int']['input']>;
  decimals_not?: InputMaybe<Scalars['Int']['input']>;
  decimals_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  description?: InputMaybe<Scalars['String']['input']>;
  description_contains?: InputMaybe<Scalars['String']['input']>;
  description_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  description_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  description_not?: InputMaybe<Scalars['String']['input']>;
  description_not_contains?: InputMaybe<Scalars['String']['input']>;
  description_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  description_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name?: InputMaybe<Scalars['String']['input']>;
  name_contains?: InputMaybe<Scalars['String']['input']>;
  name_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  name_not?: InputMaybe<Scalars['String']['input']>;
  name_not_contains?: InputMaybe<Scalars['String']['input']>;
  name_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  name_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  payload?: InputMaybe<Scalars['String']['input']>;
  payload_contains?: InputMaybe<Scalars['String']['input']>;
  payload_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  payload_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  payload_not?: InputMaybe<Scalars['String']['input']>;
  payload_not_contains?: InputMaybe<Scalars['String']['input']>;
  payload_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  payload_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  symbol?: InputMaybe<Scalars['String']['input']>;
  symbol_contains?: InputMaybe<Scalars['String']['input']>;
  symbol_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  symbol_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  symbol_not?: InputMaybe<Scalars['String']['input']>;
  symbol_not_contains?: InputMaybe<Scalars['String']['input']>;
  symbol_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  symbol_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  token?: InputMaybe<Scalars['String']['input']>;
  token_contains?: InputMaybe<Scalars['String']['input']>;
  token_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  token_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  token_not?: InputMaybe<Scalars['String']['input']>;
  token_not_contains?: InputMaybe<Scalars['String']['input']>;
  token_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  token_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export type VotingPowerValidationStrategiesParsedMetadataItem_Filter = {
  data?: InputMaybe<Scalars['String']['input']>;
  data_?: InputMaybe<VotingPowerValidationStrategiesParsedMetadataItem_StrategiesParsedMetadataDataItem_Filter>;
  data_contains?: InputMaybe<Scalars['String']['input']>;
  data_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  data_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  data_not?: InputMaybe<Scalars['String']['input']>;
  data_not_contains?: InputMaybe<Scalars['String']['input']>;
  data_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  data_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id?: InputMaybe<Scalars['String']['input']>;
  id_contains?: InputMaybe<Scalars['String']['input']>;
  id_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id_not?: InputMaybe<Scalars['String']['input']>;
  id_not_contains?: InputMaybe<Scalars['String']['input']>;
  id_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  index?: InputMaybe<Scalars['Int']['input']>;
  index_gt?: InputMaybe<Scalars['Int']['input']>;
  index_gte?: InputMaybe<Scalars['Int']['input']>;
  index_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  index_lt?: InputMaybe<Scalars['Int']['input']>;
  index_lte?: InputMaybe<Scalars['Int']['input']>;
  index_not?: InputMaybe<Scalars['Int']['input']>;
  index_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  space?: InputMaybe<Scalars['String']['input']>;
  space_?: InputMaybe<VotingPowerValidationStrategiesParsedMetadataItem_Space_Filter>;
  space_contains?: InputMaybe<Scalars['String']['input']>;
  space_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  space_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  space_not?: InputMaybe<Scalars['String']['input']>;
  space_not_contains?: InputMaybe<Scalars['String']['input']>;
  space_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  space_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export enum VotingPowerValidationStrategiesParsedMetadataItem_OrderBy {
  Data = 'data',
  Id = 'id',
  Index = 'index',
  Space = 'space'
}

/** Contract and Block where its event is found. */
export type _Checkpoint = {
  __typename?: '_Checkpoint';
  block_number: Scalars['Int']['output'];
  contract_address: Scalars['String']['output'];
  /** id computed as last 5 bytes of sha256(contract+block) */
  id: Scalars['ID']['output'];
};

export type _Checkpoint_Filter = {
  block_number?: InputMaybe<Scalars['Int']['input']>;
  block_number_gt?: InputMaybe<Scalars['Int']['input']>;
  block_number_gte?: InputMaybe<Scalars['Int']['input']>;
  block_number_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  block_number_lt?: InputMaybe<Scalars['Int']['input']>;
  block_number_lte?: InputMaybe<Scalars['Int']['input']>;
  block_number_not?: InputMaybe<Scalars['Int']['input']>;
  block_number_not_in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  contract_address?: InputMaybe<Scalars['String']['input']>;
  contract_address_contains?: InputMaybe<Scalars['String']['input']>;
  contract_address_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  contract_address_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  contract_address_not?: InputMaybe<Scalars['String']['input']>;
  contract_address_not_contains?: InputMaybe<Scalars['String']['input']>;
  contract_address_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  contract_address_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export enum _Checkpoint_OrderBy {
  BlockNumber = 'block_number',
  ContractAddress = 'contract_address',
  Id = 'id'
}

/** Core metadata values used internally by Checkpoint */
export type _Metadata = {
  __typename?: '_Metadata';
  /** example: last_indexed_block */
  id: Scalars['ID']['output'];
  value?: Maybe<Scalars['String']['output']>;
};

export type _Metadata_Filter = {
  id?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  value?: InputMaybe<Scalars['String']['input']>;
  value_contains?: InputMaybe<Scalars['String']['input']>;
  value_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  value_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  value_not?: InputMaybe<Scalars['String']['input']>;
  value_not_contains?: InputMaybe<Scalars['String']['input']>;
  value_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  value_not_in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export enum _Metadata_OrderBy {
  Id = 'id',
  Value = 'value'
}

export type ProposalFieldsFragment = { __typename?: 'Proposal', id: string, proposal_id: number, quorum: any, execution_hash: string, start: number, min_end: number, max_end: number, snapshot: number, scores_1: any, scores_2: any, scores_3: any, scores_total: any, execution_time: number, execution_strategy: string, execution_strategy_type: string, execution_destination?: string | null, timelock_veto_guardian?: string | null, strategies_indices: Array<number | null>, strategies: Array<string | null>, strategies_params: Array<string | null>, created: number, edited?: number | null, tx: string, execution_tx?: string | null, veto_tx?: string | null, vote_count: number, execution_ready: boolean, executed: boolean, vetoed: boolean, completed: boolean, cancelled: boolean, space: { __typename?: 'Space', id: string, controller: string, authenticators: Array<string | null>, metadata?: { __typename?: 'SpaceMetadataItem', id: string, name: string, avatar: string, voting_power_symbol: string, treasuries: Array<string | null>, executors: Array<string | null>, executors_types: Array<string | null>, executors_strategies: Array<{ __typename?: 'ExecutionStrategy', id: string, address: string, destination_address?: string | null, type: string, treasury_chain?: number | null, treasury?: string | null } | null> } | null, strategies_parsed_metadata: Array<{ __typename?: 'StrategiesParsedMetadataItem', index: number, data?: { __typename?: 'StrategiesParsedMetadataDataItem', id: string, name: string, description: string, decimals: number, symbol: string, token?: string | null, payload?: string | null } | null } | null> }, author: { __typename?: 'User', id: string, address_type: number }, metadata?: { __typename?: 'ProposalMetadataItem', id: string, title?: any | null, body?: any | null, discussion?: any | null, execution?: any | null, choices: Array<string | null>, labels: Array<string | null> } | null } & { ' $fragmentName'?: 'ProposalFieldsFragment' };

export type ProposalQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type ProposalQuery = { __typename?: 'Query', proposal?: (
    { __typename?: 'Proposal' }
    & { ' $fragmentRefs'?: { 'ProposalFieldsFragment': ProposalFieldsFragment } }
  ) | null };

export type ProposalsQueryVariables = Exact<{
  first: Scalars['Int']['input'];
  skip: Scalars['Int']['input'];
  where?: InputMaybe<Proposal_Filter>;
}>;


export type ProposalsQuery = { __typename?: 'Query', proposals?: Array<(
    { __typename?: 'Proposal' }
    & { ' $fragmentRefs'?: { 'ProposalFieldsFragment': ProposalFieldsFragment } }
  ) | null> | null };

export type VoteFieldsFragment = { __typename?: 'Vote', id: string, proposal: number, choice: number, vp: any, created: number, tx: string, voter: { __typename?: 'User', id: string }, space: { __typename?: 'Space', id: string }, metadata?: { __typename?: 'VoteMetadataItem', reason: any } | null } & { ' $fragmentName'?: 'VoteFieldsFragment' };

export type UserVotesQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  spaceIds?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>>;
  voter?: InputMaybe<Scalars['String']['input']>;
}>;


export type UserVotesQuery = { __typename?: 'Query', votes?: Array<(
    { __typename?: 'Vote' }
    & { ' $fragmentRefs'?: { 'VoteFieldsFragment': VoteFieldsFragment } }
  ) | null> | null };

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
export const ProposalFieldsFragmentDoc = new TypedDocumentString(`
    fragment proposalFields on Proposal {
  id
  proposal_id
  space {
    id
    controller
    authenticators
    metadata {
      id
      name
      avatar
      voting_power_symbol
      treasuries
      executors
      executors_types
      executors_strategies {
        id
        address
        destination_address
        type
        treasury_chain
        treasury
      }
    }
    strategies_parsed_metadata {
      index
      data {
        id
        name
        description
        decimals
        symbol
        token
        payload
      }
    }
  }
  author {
    id
    address_type
  }
  quorum
  execution_hash
  metadata {
    id
    title
    body
    discussion
    execution
    choices
    labels
  }
  start
  min_end
  max_end
  snapshot
  scores_1
  scores_2
  scores_3
  scores_total
  execution_time
  execution_strategy
  execution_strategy_type
  execution_destination
  timelock_veto_guardian
  strategies_indices
  strategies
  strategies_params
  created
  edited
  tx
  execution_tx
  veto_tx
  vote_count
  execution_ready
  executed
  vetoed
  completed
  cancelled
}
    `, {"fragmentName":"proposalFields"}) as unknown as TypedDocumentString<ProposalFieldsFragment, unknown>;
export const VoteFieldsFragmentDoc = new TypedDocumentString(`
    fragment voteFields on Vote {
  id
  voter {
    id
  }
  space {
    id
  }
  metadata {
    reason
  }
  proposal
  choice
  vp
  created
  tx
}
    `, {"fragmentName":"voteFields"}) as unknown as TypedDocumentString<VoteFieldsFragment, unknown>;
export const ProposalDocument = new TypedDocumentString(`
    query Proposal($id: String!) {
  proposal(id: $id) {
    ...proposalFields
  }
}
    fragment proposalFields on Proposal {
  id
  proposal_id
  space {
    id
    controller
    authenticators
    metadata {
      id
      name
      avatar
      voting_power_symbol
      treasuries
      executors
      executors_types
      executors_strategies {
        id
        address
        destination_address
        type
        treasury_chain
        treasury
      }
    }
    strategies_parsed_metadata {
      index
      data {
        id
        name
        description
        decimals
        symbol
        token
        payload
      }
    }
  }
  author {
    id
    address_type
  }
  quorum
  execution_hash
  metadata {
    id
    title
    body
    discussion
    execution
    choices
    labels
  }
  start
  min_end
  max_end
  snapshot
  scores_1
  scores_2
  scores_3
  scores_total
  execution_time
  execution_strategy
  execution_strategy_type
  execution_destination
  timelock_veto_guardian
  strategies_indices
  strategies
  strategies_params
  created
  edited
  tx
  execution_tx
  veto_tx
  vote_count
  execution_ready
  executed
  vetoed
  completed
  cancelled
}`) as unknown as TypedDocumentString<ProposalQuery, ProposalQueryVariables>;
export const ProposalsDocument = new TypedDocumentString(`
    query Proposals($first: Int!, $skip: Int!, $where: Proposal_filter) {
  proposals(
    first: $first
    skip: $skip
    where: $where
    orderBy: created
    orderDirection: desc
  ) {
    ...proposalFields
  }
}
    fragment proposalFields on Proposal {
  id
  proposal_id
  space {
    id
    controller
    authenticators
    metadata {
      id
      name
      avatar
      voting_power_symbol
      treasuries
      executors
      executors_types
      executors_strategies {
        id
        address
        destination_address
        type
        treasury_chain
        treasury
      }
    }
    strategies_parsed_metadata {
      index
      data {
        id
        name
        description
        decimals
        symbol
        token
        payload
      }
    }
  }
  author {
    id
    address_type
  }
  quorum
  execution_hash
  metadata {
    id
    title
    body
    discussion
    execution
    choices
    labels
  }
  start
  min_end
  max_end
  snapshot
  scores_1
  scores_2
  scores_3
  scores_total
  execution_time
  execution_strategy
  execution_strategy_type
  execution_destination
  timelock_veto_guardian
  strategies_indices
  strategies
  strategies_params
  created
  edited
  tx
  execution_tx
  veto_tx
  vote_count
  execution_ready
  executed
  vetoed
  completed
  cancelled
}`) as unknown as TypedDocumentString<ProposalsQuery, ProposalsQueryVariables>;
export const UserVotesDocument = new TypedDocumentString(`
    query UserVotes($first: Int, $skip: Int, $spaceIds: [String], $voter: String) {
  votes(
    first: $first
    skip: $skip
    orderBy: proposal
    orderDirection: desc
    where: {space_in: $spaceIds, voter: $voter}
  ) {
    ...voteFields
  }
}
    fragment voteFields on Vote {
  id
  voter {
    id
  }
  space {
    id
  }
  metadata {
    reason
  }
  proposal
  choice
  vp
  created
  tx
}`) as unknown as TypedDocumentString<UserVotesQuery, UserVotesQueryVariables>;