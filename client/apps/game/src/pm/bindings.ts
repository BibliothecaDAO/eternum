import type { SchemaType as ISchemaType } from "@dojoengine/sdk";

import { BigNumberish, CairoCustomEnum } from "starknet";

// Type definition for `conditional_tokens::conditional_tokens::models::Condition` struct
export interface Condition {
  condition_id: BigNumberish;
  outcome_slot_count: BigNumberish;
}

// Type definition for `conditional_tokens::conditional_tokens::models::PayoutDenominator` struct
export interface PayoutDenominator {
  condition_id: BigNumberish;
  value: BigNumberish;
}

// Type definition for `conditional_tokens::conditional_tokens::models::PayoutNumerator` struct
export interface PayoutNumerator {
  condition_id: BigNumberish;
  index: BigNumberish;
  value: BigNumberish;
}

// Type definition for `markets::core::events::UserMessage` struct
export interface UserMessage {
  identity: string;
  timestamp: BigNumberish;
  market_id: BigNumberish;
  message: string;
}

// Type definition for `markets::core::models::curve::CurveRange` struct
export interface CurveRange {
  start: BigNumberish;
  end: BigNumberish;
}

// Type definition for `markets::core::models::fees::ProtocolFees` struct
export interface ProtocolFees {
  id: BigNumberish;
  token_address: string;
  accumulated_fee: BigNumberish;
  claimed_fee: BigNumberish;
}

// Type definition for `markets::core::models::market::Market` struct
export interface Market {
  market_id: BigNumberish;
  creator: string;
  created_at: BigNumberish;
  question_id: BigNumberish;
  condition_id: BigNumberish;
  oracle: string;
  outcome_slot_count: BigNumberish;
  collateral_token: string;
  model: MarketModelEnum;
  typ: MarketTypeEnum;
  oracle_params: Array<BigNumberish>;
  oracle_extra_params: Array<BigNumberish>;
  start_at: BigNumberish;
  end_at: BigNumberish;
  resolve_at: BigNumberish;
  resolved_at: BigNumberish;
  oracle_fee: BigNumberish;
  oracle_value_type: OracleValueTypeEnum;
  creator_fee: BigNumberish;
}

// Type definition for `markets::core::models::market_model::MarketModelAmm` struct
export interface MarketModelAmm {
  initial_repartition: Array<BigNumberish>;
  funding_amount: BigNumberish;
}

// Type definition for `markets::core::models::market_model::MarketModelVault` struct
export interface MarketModelVault {
  initial_repartition: Array<BigNumberish>;
  funding_amount: BigNumberish;
  fee_curve: CurveEnum;
  fee_share_curve: CurveEnum;
}

// Type definition for `markets::core::models::market_position::MarketPosition` struct
export interface MarketPosition {
  position_id: BigNumberish;
  market_id: BigNumberish;
  index: BigNumberish;
}

// Type definition for `markets::core::models::market_type::Range` struct
export interface Range {
  low: BigNumberish;
  high: BigNumberish;
}

// Type definition for `markets::core::models::settings::CoreSettings` struct
export interface CoreSettings {
  id: BigNumberish;
  ctf: string;
  protocol_fee: BigNumberish;
  max_oracle_fee: BigNumberish;
  max_creator_fee: BigNumberish;
  max_vault_fee: BigNumberish;
}

// Type definition for `markets::core::models::vault::VaultDenominator` struct
export interface VaultDenominator {
  market_id: BigNumberish;
  value: BigNumberish;
}

// Type definition for `markets::core::models::vault::VaultFeesDenominator` struct
export interface VaultFeesDenominator {
  market_id: BigNumberish;
  value: BigNumberish;
}

// Type definition for `markets::core::models::vault::VaultNumerator` struct
export interface VaultNumerator {
  market_id: BigNumberish;
  index: BigNumberish;
  value: BigNumberish;
}

// Type definition for `markets::core::types::create_market::CreateMarketParams` struct
export interface CreateMarketParams {
  oracle: string;
  collateral_token: string;
  model: MarketModelEnum;
  oracle_params: Array<BigNumberish>;
  oracle_extra_params: Array<BigNumberish>;
  oracle_value_type: OracleValueTypeEnum;
  typ: MarketTypeEnum;
  start_at: BigNumberish;
  end_at: BigNumberish;
  resolve_at: BigNumberish;
  title: string;
  terms: string;
  creator_fee: BigNumberish;
}

// Type definition for `markets::oracle_registry::models::RegisteredOracle` struct
export interface RegisteredOracle {
  contract_address: string;
  name: string;
  description: string;
  oracle_parameters_schema: string;
  oracle_extra_parameters_schema: string;
}

// Type definition for `markets::token_registry::models::RegisteredToken` struct
export interface RegisteredToken {
  contract_address: string;
  name: string;
  symbol: string;
  decimals: BigNumberish;
}

// Type definition for `workspace::codegen::CodeGenModel` struct
export interface CodeGenModel {
  key: BigNumberish;
  value: BigNumberish;
  create_market_params: CreateMarketParams;
  ekubo_params: EkuboOraclePriceX128OverPeriod;
}

// Type definition for `workspace::mocks::dojo_oracle_storage::DojoOracleStorage` struct
export interface DojoOracleStorage {
  season_id: BigNumberish;
  another_field: BigNumberish;
  value_u256: BigNumberish;
  value_felt252: BigNumberish;
  value_ContractAddress: string;
}

// Type definition for `workspace::oracles::ekubo::ekubo_price_over_period::EkuboOraclePriceX128OverPeriod` struct
export interface EkuboOraclePriceX128OverPeriod {
  base_asset: string;
  quote_asset: string;
  start_time: BigNumberish;
  end_time: BigNumberish;
}

// Type definition for `conditional_tokens::conditional_tokens::events::ConditionPreparation` struct
export interface ConditionPreparation {
  condition_id: BigNumberish;
  oracle: string;
  question_id: BigNumberish;
  outcome_slot_count: BigNumberish;
}

// Type definition for `conditional_tokens::conditional_tokens::events::ConditionResolution` struct
export interface ConditionResolution {
  condition_id: BigNumberish;
  oracle: string;
  question_id: BigNumberish;
  outcome_slot_count: BigNumberish;
  payout_numerators: Array<BigNumberish>;
}

// Type definition for `conditional_tokens::conditional_tokens::events::PayoutRedemption` struct
export interface PayoutRedemption {
  redeemer: string;
  parent_collection_id: BigNumberish;
  condition_id: BigNumberish;
  collateral_token: string;
  index_sets: Array<BigNumberish>;
  payout: BigNumberish;
}

// Type definition for `conditional_tokens::conditional_tokens::events::PositionSplit` struct
export interface PositionSplit {
  stakeholder: string;
  parent_collection_id: BigNumberish;
  condition_id: BigNumberish;
  collateral_token: string;
  partition: Array<BigNumberish>;
  amount: BigNumberish;
}

// Type definition for `conditional_tokens::conditional_tokens::events::PositionsMerge` struct
export interface PositionsMerge {
  stakeholder: string;
  parent_collection_id: BigNumberish;
  condition_id: BigNumberish;
  collateral_token: string;
  partition: Array<BigNumberish>;
  amount: BigNumberish;
}

// Type definition for `markets::core::events::MarketBuy` struct
export interface MarketBuy {
  market_id: BigNumberish;
  outcome_index: BigNumberish;
  timestamp: BigNumberish;
  account_address: string;
  amount: BigNumberish;
  fees: BigNumberish;
  amount_in: BigNumberish;
  amount_out: BigNumberish;
}

// Type definition for `markets::core::events::MarketCreated` struct
export interface MarketCreated {
  market_id: BigNumberish;
  title: string;
  terms: string;
  oracle_parameters_schema: string;
  oracle_extra_parameters_schema: string;
  position_ids: Array<BigNumberish>;
}

// Type definition for `markets::core::events::VaultDenominatorEvent` struct
export interface VaultDenominatorEvent {
  market_id: BigNumberish;
  value: BigNumberish;
  timestamp: BigNumberish;
}

// Type definition for `markets::core::events::VaultNumeratorEvent` struct
export interface VaultNumeratorEvent {
  market_id: BigNumberish;
  index: BigNumberish;
  value: BigNumberish;
  timestamp: BigNumberish;
}

// Type definition for `markets::oracles::types::contract_call::ContractCall` struct
export interface ContractCall {
  contract_address: string;
  entrypoint: string;
  calldata: Array<BigNumberish>;
}

// Type definition for `markets::oracles::types::dojo_model_reader::DojoModelReader` struct
export interface DojoModelReader {
  world_address: string;
  namespace: BigNumberish;
  model_name: BigNumberish;
  hashed_keys: BigNumberish;
  member_selector: BigNumberish;
}

// Type definition for `openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleAdminChanged` struct
export interface RoleAdminChanged {
  role: BigNumberish;
  previous_admin_role: BigNumberish;
  new_admin_role: BigNumberish;
}

// Type definition for `openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGranted` struct
export interface RoleGranted {
  role: BigNumberish;
  account: string;
  sender: string;
}

// Type definition for `openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGrantedWithDelay` struct
export interface RoleGrantedWithDelay {
  role: BigNumberish;
  account: string;
  sender: string;
  delay: BigNumberish;
}

// Type definition for `openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleRevoked` struct
export interface RoleRevoked {
  role: BigNumberish;
  account: string;
  sender: string;
}

// Type definition for `openzeppelin_security::pausable::PausableComponent::Paused` struct
export interface Paused {
  account: string;
}

// Type definition for `openzeppelin_security::pausable::PausableComponent::Unpaused` struct
export interface Unpaused {
  account: string;
}

// Type definition for `openzeppelin_token::erc1155::erc1155::ERC1155Component::ApprovalForAll` struct
export interface ApprovalForAll {
  owner: string;
  operator: string;
  approved: boolean;
}

// Type definition for `openzeppelin_token::erc1155::erc1155::ERC1155Component::TransferBatch` struct
export interface TransferBatch {
  operator: string;
  from: string;
  to: string;
  ids: Array<BigNumberish>;
  values: Array<BigNumberish>;
}

// Type definition for `openzeppelin_token::erc1155::erc1155::ERC1155Component::TransferSingle` struct
export interface TransferSingle {
  operator: string;
  from: string;
  to: string;
  id: BigNumberish;
  value: BigNumberish;
}

// Type definition for `openzeppelin_token::erc1155::erc1155::ERC1155Component::URI` struct
export interface URI {
  value: string;
  id: BigNumberish;
}

// Type definition for `openzeppelin_token::erc20::erc20::ERC20Component::Approval` struct
export interface Approval {
  owner: string;
  spender: string;
  value: BigNumberish;
}

// Type definition for `openzeppelin_token::erc20::erc20::ERC20Component::Transfer` struct
export interface Transfer {
  from: string;
  to: string;
  value: BigNumberish;
}

// Type definition for `workspace::oracles::dojo::dojo_oracle::DojoOracleExtraParams` struct
export interface DojoOracleExtraParams {
  edition_id: BigNumberish;
}

// Type definition for `workspace::oracles::starknet::starknet_oracle::StarknetOracleExtraParams` struct
export interface StarknetOracleExtraParams {
  edition_id: BigNumberish;
}

// Type definition for `workspace::oracles::starknet::starknet_oracle::StarknetOracleParams` struct
export interface StarknetOracleParams {
  resolve_check_calls: Array<ContractCall>;
  resolve_value_call: ContractCall;
}

// Type definition for `markets::core::models::curve::Curve` enum
export const curve = ["Linear"] as const;
export type Curve = {
  Linear: CurveRange;
};
export type CurveEnum = CairoCustomEnum;

// Type definition for `markets::core::models::market_model::MarketModel` enum
export const marketModel = ["Vault", "Amm"] as const;
export type MarketModel = {
  Vault: MarketModelVault;
  Amm: MarketModelAmm;
};
export type MarketModelEnum = CairoCustomEnum;

// Type definition for `markets::core::models::market_type::CompValueOperator` enum
export const compValueOperator = ["Eq", "Lt", "Gt", "Lte", "Gte"] as const;
export type CompValueOperator = {
  Eq: BigNumberish;
  Lt: BigNumberish;
  Gt: BigNumberish;
  Lte: BigNumberish;
  Gte: BigNumberish;
};
export type CompValueOperatorEnum = CairoCustomEnum;

// Type definition for `markets::core::models::market_type::MarketType` enum
export const marketType = ["Binary", "Categorical"] as const;
export type MarketType = {
  Binary: MarketTypeBinaryEnum;
  Categorical: MarketTypeCategoricalEnum;
};
export type MarketTypeEnum = CairoCustomEnum;

// Type definition for `markets::core::models::market_type::MarketTypeBinary` enum
export const marketTypeBinary = ["Value", "Range", "Scalar"] as const;
export type MarketTypeBinary = {
  Value: CompValueOperatorEnum;
  Range: Range;
  Scalar: Range;
};
export type MarketTypeBinaryEnum = CairoCustomEnum;

// Type definition for `markets::core::models::market_type::MarketTypeCategorical` enum
export const marketTypeCategorical = ["ValueEq", "Ranges"] as const;
export type MarketTypeCategorical = {
  ValueEq: Array<BigNumberish>;
  Ranges: Array<BigNumberish>;
};
export type MarketTypeCategoricalEnum = CairoCustomEnum;

// Type definition for `markets::oracles::types::oracle_value_type::OracleValueType` enum
export const oracleValueType = ["u256", "ContractAddress", "felt252"] as const;
export type OracleValueType = { [key in (typeof oracleValueType)[number]]: string };
export type OracleValueTypeEnum = CairoCustomEnum;

export interface SchemaType extends ISchemaType {
  workspace: {
    Condition: Condition;
    PayoutDenominator: PayoutDenominator;
    PayoutNumerator: PayoutNumerator;
    UserMessage: UserMessage;
    CurveRange: CurveRange;
    ProtocolFees: ProtocolFees;
    Market: Market;
    MarketModelAmm: MarketModelAmm;
    MarketModelVault: MarketModelVault;
    MarketPosition: MarketPosition;
    Range: Range;
    CoreSettings: CoreSettings;
    VaultDenominator: VaultDenominator;
    VaultFeesDenominator: VaultFeesDenominator;
    VaultNumerator: VaultNumerator;
    CreateMarketParams: CreateMarketParams;
    RegisteredOracle: RegisteredOracle;
    RegisteredToken: RegisteredToken;
    CodeGenModel: CodeGenModel;
    DojoOracleStorage: DojoOracleStorage;
    EkuboOraclePriceX128OverPeriod: EkuboOraclePriceX128OverPeriod;
    ConditionPreparation: ConditionPreparation;
    ConditionResolution: ConditionResolution;
    PayoutRedemption: PayoutRedemption;
    PositionSplit: PositionSplit;
    PositionsMerge: PositionsMerge;
    MarketBuy: MarketBuy;
    MarketCreated: MarketCreated;
    VaultDenominatorEvent: VaultDenominatorEvent;
    VaultNumeratorEvent: VaultNumeratorEvent;
    ContractCall: ContractCall;
    DojoModelReader: DojoModelReader;
    RoleAdminChanged: RoleAdminChanged;
    RoleGranted: RoleGranted;
    RoleGrantedWithDelay: RoleGrantedWithDelay;
    RoleRevoked: RoleRevoked;
    Paused: Paused;
    Unpaused: Unpaused;
    ApprovalForAll: ApprovalForAll;
    TransferBatch: TransferBatch;
    TransferSingle: TransferSingle;
    URI: URI;
    Approval: Approval;
    Transfer: Transfer;
    DojoOracleExtraParams: DojoOracleExtraParams;
    StarknetOracleExtraParams: StarknetOracleExtraParams;
    StarknetOracleParams: StarknetOracleParams;
  };
}
export const schema: SchemaType = {
  workspace: {
    Condition: {
      condition_id: 0,
      outcome_slot_count: 0,
    },
    PayoutDenominator: {
      condition_id: 0,
      value: 0,
    },
    PayoutNumerator: {
      condition_id: 0,
      index: 0,
      value: 0,
    },
    UserMessage: {
      identity: "",
      timestamp: 0,
      market_id: 0,
      message: "",
    },
    CurveRange: {
      start: 0,
      end: 0,
    },
    ProtocolFees: {
      id: 0,
      token_address: "",
      accumulated_fee: 0,
      claimed_fee: 0,
    },
    Market: {
      market_id: 0,
      creator: "",
      created_at: 0,
      question_id: 0,
      condition_id: 0,
      oracle: "",
      outcome_slot_count: 0,
      collateral_token: "",
      model: new CairoCustomEnum({
        Vault: {
          initial_repartition: [0],
          funding_amount: 0,
          fee_curve: new CairoCustomEnum({
            Linear: { start: 0, end: 0 },
          }),
          fee_share_curve: new CairoCustomEnum({
            Linear: { start: 0, end: 0 },
          }),
        },
        Amm: undefined,
      }),
      typ: new CairoCustomEnum({
        Binary: new CairoCustomEnum({
          Value: new CairoCustomEnum({
            Eq: 0,
            Lt: undefined,
            Gt: undefined,
            Lte: undefined,
            Gte: undefined,
          }),
          Range: undefined,
          Scalar: undefined,
        }),
        Categorical: undefined,
      }),
      oracle_params: [0],
      oracle_extra_params: [0],
      start_at: 0,
      end_at: 0,
      resolve_at: 0,
      resolved_at: 0,
      oracle_fee: 0,
      oracle_value_type: new CairoCustomEnum({
        u256: "",
        ContractAddress: undefined,
        felt252: undefined,
      }),
      creator_fee: 0,
    },
    MarketModelAmm: {
      initial_repartition: [0],
      funding_amount: 0,
    },
    MarketModelVault: {
      initial_repartition: [0],
      funding_amount: 0,
      fee_curve: new CairoCustomEnum({
        Linear: { start: 0, end: 0 },
      }),
      fee_share_curve: new CairoCustomEnum({
        Linear: { start: 0, end: 0 },
      }),
    },
    MarketPosition: {
      position_id: 0,
      market_id: 0,
      index: 0,
    },
    Range: {
      low: 0,
      high: 0,
    },
    CoreSettings: {
      id: 0,
      ctf: "",
      protocol_fee: 0,
      max_oracle_fee: 0,
      max_creator_fee: 0,
      max_vault_fee: 0,
    },
    VaultDenominator: {
      market_id: 0,
      value: 0,
    },
    VaultFeesDenominator: {
      market_id: 0,
      value: 0,
    },
    VaultNumerator: {
      market_id: 0,
      index: 0,
      value: 0,
    },
    CreateMarketParams: {
      oracle: "",
      collateral_token: "",
      model: new CairoCustomEnum({
        Vault: {
          initial_repartition: [0],
          funding_amount: 0,
          fee_curve: new CairoCustomEnum({
            Linear: { start: 0, end: 0 },
          }),
          fee_share_curve: new CairoCustomEnum({
            Linear: { start: 0, end: 0 },
          }),
        },
        Amm: undefined,
      }),
      oracle_params: [0],
      oracle_extra_params: [0],
      oracle_value_type: new CairoCustomEnum({
        u256: "",
        ContractAddress: undefined,
        felt252: undefined,
      }),
      typ: new CairoCustomEnum({
        Binary: new CairoCustomEnum({
          Value: new CairoCustomEnum({
            Eq: 0,
            Lt: undefined,
            Gt: undefined,
            Lte: undefined,
            Gte: undefined,
          }),
          Range: undefined,
          Scalar: undefined,
        }),
        Categorical: undefined,
      }),
      start_at: 0,
      end_at: 0,
      resolve_at: 0,
      title: "",
      terms: "",
      creator_fee: 0,
    },
    RegisteredOracle: {
      contract_address: "",
      name: "",
      description: "",
      oracle_parameters_schema: "",
      oracle_extra_parameters_schema: "",
    },
    RegisteredToken: {
      contract_address: "",
      name: "",
      symbol: "",
      decimals: 0,
    },
    CodeGenModel: {
      key: 0,
      value: 0,
      create_market_params: {
        oracle: "",
        collateral_token: "",
        model: new CairoCustomEnum({
          Vault: {
            initial_repartition: [0],
            funding_amount: 0,
            fee_curve: new CairoCustomEnum({
              Linear: { start: 0, end: 0 },
            }),
            fee_share_curve: new CairoCustomEnum({
              Linear: { start: 0, end: 0 },
            }),
          },
          Amm: undefined,
        }),
        oracle_params: [0],
        oracle_extra_params: [0],
        oracle_value_type: new CairoCustomEnum({
          u256: "",
          ContractAddress: undefined,
          felt252: undefined,
        }),
        typ: new CairoCustomEnum({
          Binary: new CairoCustomEnum({
            Value: new CairoCustomEnum({
              Eq: 0,
              Lt: undefined,
              Gt: undefined,
              Lte: undefined,
              Gte: undefined,
            }),
            Range: undefined,
            Scalar: undefined,
          }),
          Categorical: undefined,
        }),
        start_at: 0,
        end_at: 0,
        resolve_at: 0,
        title: "",
        terms: "",
        creator_fee: 0,
      },
      ekubo_params: { base_asset: "", quote_asset: "", start_time: 0, end_time: 0 },
    },
    DojoOracleStorage: {
      season_id: 0,
      another_field: 0,
      value_u256: 0,
      value_felt252: 0,
      value_ContractAddress: "",
    },
    EkuboOraclePriceX128OverPeriod: {
      base_asset: "",
      quote_asset: "",
      start_time: 0,
      end_time: 0,
    },
    ConditionPreparation: {
      condition_id: 0,
      oracle: "",
      question_id: 0,
      outcome_slot_count: 0,
    },
    ConditionResolution: {
      condition_id: 0,
      oracle: "",
      question_id: 0,
      outcome_slot_count: 0,
      payout_numerators: [0],
    },
    PayoutRedemption: {
      redeemer: "",
      parent_collection_id: 0,
      condition_id: 0,
      collateral_token: "",
      index_sets: [0],
      payout: 0,
    },
    PositionSplit: {
      stakeholder: "",
      parent_collection_id: 0,
      condition_id: 0,
      collateral_token: "",
      partition: [0],
      amount: 0,
    },
    PositionsMerge: {
      stakeholder: "",
      parent_collection_id: 0,
      condition_id: 0,
      collateral_token: "",
      partition: [0],
      amount: 0,
    },
    MarketBuy: {
      market_id: 0,
      outcome_index: 0,
      timestamp: 0,
      account_address: "",
      amount: 0,
      fees: 0,
      amount_in: 0,
      amount_out: 0,
    },
    MarketCreated: {
      market_id: 0,
      title: "",
      terms: "",
      oracle_parameters_schema: "",
      oracle_extra_parameters_schema: "",
      position_ids: [0],
    },
    VaultDenominatorEvent: {
      market_id: 0,
      value: 0,
      timestamp: 0,
    },
    VaultNumeratorEvent: {
      market_id: 0,
      index: 0,
      value: 0,
      timestamp: 0,
    },
    ContractCall: {
      contract_address: "",
      entrypoint: "",
      calldata: [0],
    },
    DojoModelReader: {
      world_address: "",
      namespace: 0,
      model_name: 0,
      hashed_keys: 0,
      member_selector: 0,
    },
    RoleAdminChanged: {
      role: 0,
      previous_admin_role: 0,
      new_admin_role: 0,
    },
    RoleGranted: {
      role: 0,
      account: "",
      sender: "",
    },
    RoleGrantedWithDelay: {
      role: 0,
      account: "",
      sender: "",
      delay: 0,
    },
    RoleRevoked: {
      role: 0,
      account: "",
      sender: "",
    },
    Paused: {
      account: "",
    },
    Unpaused: {
      account: "",
    },
    ApprovalForAll: {
      owner: "",
      operator: "",
      approved: false,
    },
    TransferBatch: {
      operator: "",
      from: "",
      to: "",
      ids: [0],
      values: [0],
    },
    TransferSingle: {
      operator: "",
      from: "",
      to: "",
      id: 0,
      value: 0,
    },
    URI: {
      value: "",
      id: 0,
    },
    Approval: {
      owner: "",
      spender: "",
      value: 0,
    },
    Transfer: {
      from: "",
      to: "",
      value: 0,
    },
    DojoOracleExtraParams: {
      edition_id: 0,
    },
    StarknetOracleExtraParams: {
      edition_id: 0,
    },
    StarknetOracleParams: {
      resolve_check_calls: [{ contract_address: "", entrypoint: "", calldata: [0] }],
      resolve_value_call: { contract_address: "", entrypoint: "", calldata: [0] },
    },
  },
};
export enum ModelsMapping {
  Condition = "conditional_tokens-Condition",
  PayoutDenominator = "conditional_tokens-PayoutDenominator",
  PayoutNumerator = "conditional_tokens-PayoutNumerator",
  UserMessage = "markets-UserMessage",
  Curve = "markets-Curve",
  CurveRange = "markets-CurveRange",
  ProtocolFees = "markets-ProtocolFees",
  Market = "markets-Market",
  MarketModel = "markets-MarketModel",
  MarketModelAmm = "markets-MarketModelAmm",
  MarketModelVault = "markets-MarketModelVault",
  MarketPosition = "markets-MarketPosition",
  CompValueOperator = "markets-CompValueOperator",
  MarketType = "markets-MarketType",
  MarketTypeBinary = "markets-MarketTypeBinary",
  MarketTypeCategorical = "markets-MarketTypeCategorical",
  Range = "markets-Range",
  CoreSettings = "markets-CoreSettings",
  VaultDenominator = "markets-VaultDenominator",
  VaultFeesDenominator = "markets-VaultFeesDenominator",
  VaultNumerator = "markets-VaultNumerator",
  CreateMarketParams = "markets-CreateMarketParams",
  RegisteredOracle = "markets-RegisteredOracle",
  OracleValueType = "markets-OracleValueType",
  RegisteredToken = "markets-RegisteredToken",
  CodeGenModel = "workspace-CodeGenModel",
  DojoOracleStorage = "workspace-DojoOracleStorage",
  EkuboOraclePriceX128OverPeriod = "workspace-EkuboOraclePriceX128OverPeriod",
  ConditionPreparation = "conditional_tokens-ConditionPreparation",
  ConditionResolution = "conditional_tokens-ConditionResolution",
  PayoutRedemption = "conditional_tokens-PayoutRedemption",
  PositionSplit = "conditional_tokens-PositionSplit",
  PositionsMerge = "conditional_tokens-PositionsMerge",
  MarketBuy = "markets-MarketBuy",
  MarketCreated = "markets-MarketCreated",
  VaultDenominatorEvent = "markets-VaultDenominatorEvent",
  VaultNumeratorEvent = "markets-VaultNumeratorEvent",
  ContractCall = "markets-ContractCall",
  DojoModelReader = "markets-DojoModelReader",
  RoleAdminChanged = "openzeppelin_access-RoleAdminChanged",
  RoleGranted = "openzeppelin_access-RoleGranted",
  RoleGrantedWithDelay = "openzeppelin_access-RoleGrantedWithDelay",
  RoleRevoked = "openzeppelin_access-RoleRevoked",
  Paused = "openzeppelin_security-Paused",
  Unpaused = "openzeppelin_security-Unpaused",
  ApprovalForAll = "openzeppelin_token-ApprovalForAll",
  TransferBatch = "openzeppelin_token-TransferBatch",
  TransferSingle = "openzeppelin_token-TransferSingle",
  URI = "openzeppelin_token-URI",
  Approval = "openzeppelin_token-Approval",
  Transfer = "openzeppelin_token-Transfer",
  DojoOracleExtraParams = "workspace-DojoOracleExtraParams",
  StarknetOracleExtraParams = "workspace-StarknetOracleExtraParams",
  StarknetOracleParams = "workspace-StarknetOracleParams",
}
