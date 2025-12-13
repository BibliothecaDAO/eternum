import BigNumber from "bignumber.js";
import { BigNumberish, CairoCustomEnum, shortString } from "starknet";
import {
  ConditionResolution,
  CurveRange,
  Market,
  MarketCreated,
  MarketModelVault,
  RegisteredToken,
  VaultDenominator,
  VaultFeesDenominator,
  VaultNumerator,
} from "./bindings";
import { formatUnits, replaceAndFormat } from "./utils";

export type MarketOutcome = {
  index: number;
  label: string;
  name: string;
  odds: string;
  gain: number;
};

export type MarketClassInterface = Market &
  MarketCreated & { vaultDenominator?: VaultDenominator } & {
    vaultNumerators?: VaultNumerator[];
  } & { odds?: string[] } & { conditionResolution?: ConditionResolution };

export class MarketClass implements MarketClassInterface {
  market: Market;
  market_id: string;
  creator: string;
  created_at: number;
  question_id: BigNumberish;
  condition_id: BigNumberish;
  oracle: string;
  outcome_slot_count: number;
  collateral_token: string;
  model: CairoCustomEnum;
  typ: CairoCustomEnum;
  oracle_params: BigNumberish[];
  oracle_extra_params: BigNumberish[];
  start_at: number;
  end_at: number;
  resolve_at: number;
  resolved_at: number;
  title: string;
  terms: string;
  oracle_fee: number;
  oracle_value_type: CairoCustomEnum;
  creator_fee: number;
  oracle_parameters_schema: string;
  oracle_extra_parameters_schema: string;
  position_ids: BigNumberish[];
  vaultDenominator?: VaultDenominator;
  vaultNumerators?: VaultNumerator[];
  conditionResolution?: ConditionResolution;
  vaultFeesDenominator?: VaultFeesDenominator;
  //
  odds?: string[];
  collateralToken: RegisteredToken;

  constructor({
    market,
    marketCreated,
    collateralToken,
    vaultDenominator,
    vaultNumerators,
    conditionResolution,
    vaultFeesDenominator,
  }: {
    market: Market;
    marketCreated: MarketCreated;
    collateralToken: RegisteredToken;
    vaultDenominator?: VaultDenominator;
    vaultNumerators?: VaultNumerator[];
    conditionResolution?: ConditionResolution;
    vaultFeesDenominator?: VaultFeesDenominator;
  }) {
    this.market = market;
    // market
    this.market_id = market.market_id.toString();
    this.creator = market.creator;
    this.created_at = Number(market.created_at);
    this.question_id = market.question_id;
    this.condition_id = market.condition_id;
    this.oracle = market.oracle;
    this.outcome_slot_count = Number(market.outcome_slot_count);
    this.collateral_token = market.collateral_token;
    this.model = market.model;
    this.typ = market.typ;
    this.oracle_params = market.oracle_params;
    this.oracle_extra_params = market.oracle_extra_params;
    this.start_at = Number(market.start_at);
    this.end_at = Number(market.end_at);
    this.resolve_at = Number(market.resolve_at);
    this.resolved_at = Number(market.resolved_at);
    this.oracle_fee = Number(market.oracle_fee);
    this.oracle_value_type = market.oracle_value_type;
    this.creator_fee = Number(market.creator_fee);
    // market created
    this.title = replaceAndFormat(marketCreated.title);
    this.terms = replaceAndFormat(marketCreated.terms);
    this.oracle_parameters_schema = marketCreated.oracle_parameters_schema;
    this.oracle_extra_parameters_schema = marketCreated.oracle_extra_parameters_schema;
    this.position_ids = marketCreated.position_ids;
    // others
    this.vaultDenominator = vaultDenominator;
    this.vaultNumerators = vaultNumerators;
    this.conditionResolution = conditionResolution;
    this.vaultFeesDenominator = vaultFeesDenominator;
    //
    this.collateralToken = collateralToken;
    this.odds = (vaultNumerators || []).map((numerator) => {
      return (Number((BigInt(numerator.value) * 10_000n) / BigInt(vaultDenominator?.value || 1)) / 100).toFixed(2);
    });
  }

  isResolved() {
    return this.resolved_at > 0;
  }

  isResolvable() {
    return Date.now() > this.resolve_at * 1_000;
  }

  isEnded() {
    return Date.now() > this.end_at * 1_000;
  }

  typBinary() {
    return this.typ.variant["Binary"];
  }
  typBinaryScalar() {
    return this.typBinary() && this.typ.variant["Binary"].variant["Scalar"];
  }

  typCategorical() {
    return this.typ.variant["Categorical"];
  }
  typCategoricalRanges() {
    return this.typ.variant["Categorical"].variant["Ranges"];
  }
  typCategoricalValueEq() {
    return this.typ.variant["Categorical"].variant["ValueEq"];
  }

  getMarketOutcomes(): MarketOutcome[] {
    if (!this.odds) return [];
    if (!this.typ) return [];

    const outcomesText = this.getMarketTextOutcomes();

    switch (this.typ.activeVariant()) {
      case "Binary":
        return [
          {
            index: 0,
            name: outcomesText[0],
            odds: this.odds[0],
            gain: Math.ceil((Number(this.odds[1] || 0) / Number(this.odds[0] || 1)) * 100),
          },
          {
            index: 1,
            name: outcomesText[1],
            odds: this.odds[1],
            gain: Math.ceil((Number(this.odds[0] || 0) / Number(this.odds[1] || 1)) * 100),
          },
        ];
      case "Categorical":
        return this.odds.map((odds, idx) => {
          return {
            index: idx,
            name: outcomesText[idx],

            odds: odds,
            gain: 0,
          };
        });
    }
    console.log("getMarketOutcomes: no results");
    return [];
  }

  getMarketTextOutcomes(): string[] {
    switch (this.typ.activeVariant()) {
      case "Binary":
        if (this.typBinaryScalar()) {
          return ["LOW", "HIGH"];
        }
        return ["YES", "NO"];
      case "Categorical":
        switch (this.typ.variant["Categorical"].activeVariant()) {
          case "ValueEq":
            const valueEq = this.typ.variant["Categorical"].variant["ValueEq"];
            // bad parsing -> not an enum
            // if (this.oracle_value_type.variant["u256"]) {
            // @ts-ignore
            if (this.oracle_value_type === "u256") {
              return [...valueEq.map((v: any) => `0x${v.toString(16)}`), "None of previous"];
            }

            // if (this.oracle_value_type.variant["ContractAddress"]) {
            // @ts-ignore
            if (this.oracle_value_type === "ContractAddress") {
              return [...valueEq.map((v: any) => `0x${v.toString(16)}`), "None of previous"];
            }
            // if (this.oracle_value_type.variant["felt252"]) {
            // @ts-ignore
            if (this.oracle_value_type === "felt252") {
              return [...valueEq.map((v: any) => shortString.decodeShortString(v)), "None of previous"];
            }
            break;

          case "Ranges":
            const values = this.typ.variant["Categorical"].variant["Ranges"].map((i: bigint) => {
              // console.log(i, (i / 10n ** 18n).toString());
              const bn = BigNumber(i.toString()).dividedBy(10 ** 18);

              if (bn.lt(10)) {
                return bn.toFixed(2);
              } else if (bn.lt(1_000)) {
                return bn.toFixed(0);
              } else if (bn.gt(10_000)) {
                return `${bn.dividedBy(1_000).toFixed(0)}k`;
              } else {
                return bn.toFixed(0);
              }
            });
            const outcomes = [];

            for (let i = 0; i < values.length; i++) {
              if (i === 0) {
                outcomes.push(`<${values[i]}`);
              } else {
                outcomes.push(`${values[i - 1]}-${values[i]}`);
              }
            }
            outcomes.push(`>${values[values.length - 1]}`);

            return outcomes;
        }
    }
    return [];
  }

  getVaultFees() {
    if (!this.vaultFeesDenominator) {
      return 0n;
    }

    return BigInt(this.vaultFeesDenominator.value);
  }

  getModelFees(date: number): number {
    // range
    const marketModelVault = this.model.unwrap() as MarketModelVault;
    const curveLinear = marketModelVault.fee_curve.unwrap() as CurveRange;

    return Math.ceil(
      range(this.start_at, this.end_at, Number(curveLinear.start), Number(curveLinear.end), Math.ceil(date / 1_000)),
    );
  }

  getTvl() {
    return formatUnits(BigInt(this.vaultDenominator?.value || 0), Number(this.collateralToken.decimals), 2);
  }
}

const lerp = (x: number, y: number, a: number) => x * (1 - a) + y * a;
const invlerp = (x: number, y: number, a: number) => clamp((a - x) / (y - x));
const clamp = (a: number, min = 0, max = 1) => Math.min(max, Math.max(min, a));
const range = (x1: number, y1: number, x2: number, y2: number, a: number) => lerp(x2, y2, invlerp(x1, y1, a));
