import { CallData, hash, type Abi } from "starknet";
import ledger from "../../../contracts/l2/ledger/schema/abi.json";
import { eventFields, response } from "./abi";

export const ledgerAbi: Abi = ledger;
export const ledgerCall = (entrypoint: string, args: Record<string, unknown>) =>
  new CallData(ledgerAbi).compile(entrypoint, args as never);

/** The stored default returned by get_slot before open_slot, in the committed output layout. */
export const absentLedgerSlot = () =>
  response(ledgerAbi, "get_slot", {
    season_id: 0,
    exists: false,
    preset_id: 0,
    close: 0,
    end: 0,
    pool: { low: 0, high: 0 },
    registered_count: 0,
    cancelled: false,
  });

export function ledgerEvent(name: string, values: Record<string, unknown>) {
  const types = ledgerAbi.filter((entry) => entry.type === "event");
  const referenced = new Set(
    types.flatMap((entry) => entry.variants?.map((variant: { type: string }) => variant.type) ?? []),
  );
  function find(entry: (typeof types)[number], prefix: string[]): ReturnType<typeof eventFields> | undefined {
    if (entry.kind === "struct" && entry.name.endsWith(`::${name}`))
      return eventFields(ledgerAbi, { prefix, members: entry.members }, values);
    for (const variant of entry.variants ?? []) {
      const nested = types.find((type) => type.name === variant.type);
      if (!nested) throw new Error(`Missing event type: ${variant.type}`);
      const result = find(
        nested,
        variant.kind === "flat" ? prefix : [...prefix, hash.getSelectorFromName(variant.name)],
      );
      if (result) return result;
    }
  }
  for (const root of types.filter((entry) => !referenced.has(entry.name))) {
    const result = find(root, []);
    if (result) return result;
  }
  throw new Error(`Missing ledger event: ${name}`);
}
