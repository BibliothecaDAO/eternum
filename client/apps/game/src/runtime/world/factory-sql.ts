import { decodePaddedFeltAscii, extractNameFelt, fetchFactoryRows } from "../../../../../../common/factory/endpoints";

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};
const normalizeValue = (value: unknown): bigint | null => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.floor(value));

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }

  return null;
};

const normalizeAddress = (value: unknown): string | null => {
  if (value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      const asBigInt =
        trimmed.startsWith("0x") || trimmed.startsWith("0X")
          ? BigInt(trimmed)
          : /^[0-9]+$/.test(trimmed)
            ? BigInt(trimmed)
            : null;

      if (asBigInt == null || asBigInt <= 0n) return null;
      return `0x${asBigInt.toString(16)}`;
    } catch {
      return null;
    }
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `0x${BigInt(Math.floor(value)).toString(16)}`;
  }

  if (typeof value === "bigint" && value > 0n) {
    return `0x${value.toString(16)}`;
  }

  return null;
};

export const extractContractAddress = (row: Record<string, unknown>): string | null => {
  const direct = normalizeAddress(row.contract_address ?? row["data.address"]);
  if (direct) {
    return direct;
  }

  const data = asRecord(row.data);
  if (data) {
    return normalizeAddress(data.contract_address);
  }

  return null;
};

const findGameNumber = (record: Record<string, unknown>, depth = 0): bigint | null => {
  if (depth > 3) return null;

  for (const key of ["game_number", "gameNumber"]) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const parsed = normalizeValue(record[key]);
      if (parsed !== null) return parsed;
    }
  }

  if (Object.prototype.hasOwnProperty.call(record, "data")) {
    const nested = asRecord(record.data);
    if (nested) {
      return findGameNumber(nested, depth + 1);
    }
  }

  return null;
};

export const extractGameNumberFromRow = (row: Record<string, unknown>): bigint | null => {
  return findGameNumber(row);
};
