import { CairoCustomEnum } from "starknet";

import type { RegisteredToken } from "@/pm/bindings";
import { MarketClass } from "@/pm/class";
import type { MarketWithDetailsRow, VaultNumeratorRow } from "@/pm/hooks/queries";
import { replaceAndFormat } from "@/pm/utils";

const getRowValue = (row: MarketWithDetailsRow, key: string): string | undefined =>
  (row as unknown as Record<string, string | undefined>)[key];

export const normalizeHexAddress = (value: unknown): string | null => {
  if (value == null) return null;
  try {
    const bigValue = typeof value === "string" ? BigInt(value) : BigInt(value as number);
    return `0x${bigValue.toString(16).toLowerCase().padStart(64, "0")}`;
  } catch {
    return null;
  }
};

function buildMarketTypeEnum(row: MarketWithDetailsRow): CairoCustomEnum {
  const rowAny = row as unknown as Record<string, string | undefined>;

  if (rowAny["typ.Binary"] !== null && rowAny["typ.Binary"] !== undefined) {
    return new CairoCustomEnum({ Binary: {} });
  }

  if (rowAny["typ.Categorical.ValueEq"]) {
    const rawValueEq = JSON.parse(rowAny["typ.Categorical.ValueEq"]);
    const valueEq = rawValueEq.map((value: string | number) => BigInt(value));
    return new CairoCustomEnum({
      Categorical: new CairoCustomEnum({ ValueEq: valueEq }),
    });
  }

  if (rowAny["typ.Categorical.Ranges"]) {
    const rawRanges = JSON.parse(rowAny["typ.Categorical.Ranges"]);
    const ranges = rawRanges.map((value: string | number) => BigInt(value));
    return new CairoCustomEnum({
      Categorical: new CairoCustomEnum({ Ranges: ranges }),
    });
  }

  return new CairoCustomEnum({
    Categorical: new CairoCustomEnum({ ValueEq: [] }),
  });
}

export function transformMarketRowToClass(
  row: MarketWithDetailsRow,
  numerators: VaultNumeratorRow[],
  getRegisteredToken: (address: string | undefined) => RegisteredToken,
): MarketClass | null {
  if (!row.title) return null;

  const collateralToken = getRegisteredToken(row.collateral_token);

  const oracleParams = row.oracle_params ? JSON.parse(row.oracle_params) : [];
  const vaultModel = {
    initial_repartition: getRowValue(row, "model.Vault.initial_repartition")
      ? JSON.parse(getRowValue(row, "model.Vault.initial_repartition")!)
      : [],
    funding_amount: BigInt(getRowValue(row, "model.Vault.funding_amount") ?? 0),
    fee_curve: new CairoCustomEnum({
      Range: {
        start: BigInt(getRowValue(row, "model.Vault.fee_curve.Range.start") ?? 0),
        end: BigInt(getRowValue(row, "model.Vault.fee_curve.Range.end") ?? 0),
      },
    }),
    fee_share_curve: new CairoCustomEnum({
      Range: {
        start: BigInt(getRowValue(row, "model.Vault.fee_share_curve.Range.start") ?? 0),
        end: BigInt(getRowValue(row, "model.Vault.fee_share_curve.Range.end") ?? 0),
      },
    }),
  };

  const market = {
    market_id: BigInt(row.market_id),
    creator: row.creator,
    created_at: BigInt(row.created_at),
    question_id: BigInt(row.question_id),
    condition_id: BigInt(row.condition_id),
    oracle: row.oracle,
    outcome_slot_count: row.outcome_slot_count,
    collateral_token: row.collateral_token,
    model: new CairoCustomEnum({ Vault: vaultModel }),
    typ: buildMarketTypeEnum(row),
    oracle_params: oracleParams,
    oracle_extra_params: [],
    oracle_value_type: row.oracle_value_type,
    start_at: BigInt(row.start_at),
    end_at: BigInt(row.end_at),
    resolve_at: BigInt(row.resolve_at),
    resolved_at: BigInt(row.resolved_at),
    oracle_fee: row.oracle_fee,
    creator_fee: row.creator_fee,
  };

  const marketCreated = {
    market_id: BigInt(row.market_id),
    title: replaceAndFormat(row.title),
    terms: replaceAndFormat(row.terms ?? ""),
    position_ids: row.position_ids ? JSON.parse(row.position_ids) : [],
  };

  const vaultDenominator = row.denominator
    ? { market_id: BigInt(row.market_id), value: BigInt(row.denominator) }
    : undefined;

  const vaultNumerators = numerators.map((entry) => ({
    market_id: BigInt(entry.market_id),
    index: entry.index,
    value: BigInt(entry.value),
  }));

  return new MarketClass({
    market: market as never,
    marketCreated: marketCreated as never,
    collateralToken,
    vaultDenominator: vaultDenominator as never,
    vaultNumerators: vaultNumerators as never[],
  });
}
