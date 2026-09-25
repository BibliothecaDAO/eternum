import type { FoldRow } from "../types";

export type Row = Record<string, unknown>;
export const integer = (value: unknown): bigint => {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint")
    throw new Error("Missing native integer");
  return BigInt(value);
};
export const number = (value: unknown): number => {
  const result = Number(integer(value));
  if (!Number.isSafeInteger(result)) throw new Error("Native value exceeds safe integer range");
  return result;
};
export const address = (value: unknown): string => `0x${integer(value).toString(16)}`;
export const record = (value: unknown): Row => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Missing native record");
  return value as Row;
};
export const gameRows = (rows: FoldRow[], gameId: unknown): Row[] =>
  rows.filter(({ value }) => integer(value.game_id) === integer(gameId)).map(({ value }) => value);
export const required = (rows: FoldRow[], gameId: unknown, model: string): Row => {
  const result = gameRows(rows, gameId)[0];
  if (!result) throw new Error(`Missing native ${model} for game ${String(gameId)}`);
  return result;
};
