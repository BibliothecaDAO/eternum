import { CallData, hash, type Abi } from "starknet";
import schema from "../../../contracts/l3/world-native/schema/schema.json";

export const gamesAbi: Abi = [...schema.games.entrypoints, ...Object.values(schema.types)];
type Field = { name: string; type: string };
type Layout = { prefix: string[]; members: (Field & { kind: string })[] };

// Serialization inputs are projected from generated output/event fields, never a second layout.
function serialize(abi: Abi, fields: Field[], values: Record<string, unknown>) {
  return new CallData([
    ...abi,
    { type: "function", name: "serialize_fixture", inputs: fields, outputs: [], state_mutability: "view" },
  ]).compile("serialize_fixture", values as never);
}
export function response(abi: Abi, entrypoint: string, value: unknown) {
  const entries = abi.flatMap((item) => (item.type === "interface" ? item.items : [item]));
  const entry = entries.find((item) => item.type === "function" && item.name === entrypoint);
  if (!entry || entry.outputs.length !== 1) throw new Error(`Missing single-output entry: ${entrypoint}`);
  return serialize(abi, [{ name: "value", type: entry.outputs[0].type }], { value });
}
export function eventFields(abi: Abi, layout: Layout, values: Record<string, unknown>) {
  if (
    Object.keys(values).sort().join() !==
    layout.members
      .map(({ name }) => name)
      .sort()
      .join()
  )
    throw new Error("Event fixture fields differ from the committed schema");
  const part = (kind: string) => {
    const fields = layout.members.filter((member) => member.kind === kind);
    return serialize(abi, fields, Object.fromEntries(fields.map(({ name }) => [name, values[name]]))).map(hex);
  };
  return { keys: [...layout.prefix, ...part("key")], data: part("data") };
}
export function gamesEvent(name: string, values: Record<string, unknown>) {
  const layout = schema.games.events.find((event) => event.name === name);
  if (!layout) throw new Error(`Missing Games event: ${name}`);
  return eventFields(gamesAbi, layout, values);
}
export const hex = (felt: string) => `0x${BigInt(felt).toString(16)}`;

// Project the generated direct event layouts into an ABI container for RPC fixtures.
// Nested aliases still share these generated member definitions; no event fields are repeated here.
export const gamesEventAbi: Abi = (() => {
  const layouts = schema.games.events.filter(
    (event) => event.prefix.length === 1 && BigInt(event.prefix[0]!) === BigInt(hash.getSelectorFromName(event.name)),
  );
  if (!layouts.some((event) => event.name === "RowSet")) throw new Error("Missing direct RowSet layout");
  return [
    {
      type: "event",
      name: "fixture::Event",
      kind: "enum",
      variants: layouts.map((layout) => ({ name: layout.name, type: `fixture::${layout.name}`, kind: "nested" })),
    },
    ...layouts.map((layout) => ({
      type: "event",
      name: `fixture::${layout.name}`,
      kind: "struct",
      members: layout.members,
    })),
  ];
})();
export function withdrawalEvent(gameId: number, claimId: string, account: string, amount: number) {
  const model = schema.models.find((model) => model.name === "LordsWithdrawal");
  const layout = schema.games.events.find(
    (event) =>
      event.name === "RowSet" &&
      event.prefix.length === 1 &&
      BigInt(event.prefix[0]!) === BigInt(hash.getSelectorFromName(event.name)),
  );
  if (!model || !layout) throw new Error("Missing generated withdrawal layout");
  const keys = serialize(gamesAbi, model.keys, { game_id: gameId, claim_id: claimId });
  const values = serialize(gamesAbi, model.members, { account, amount });
  return eventFields(gamesAbi, layout, { version: 1, model: model.identity, keys, values });
}
