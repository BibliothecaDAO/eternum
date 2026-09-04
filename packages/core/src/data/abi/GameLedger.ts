import type { Abi } from "starknet";

export interface GameLedgerGame {
  cancelled: boolean;
  dust: bigint;
  end: number;
  exists: boolean;
  finalized: boolean;
  pool: bigint;
  presetId: number;
  protocolCut: bigint;
  registeredCount: number;
  start: number;
}

const GAME_LEDGER_ABI = [
  { type: "impl", name: "GameLedgerImpl", interface_name: "game_ledger::contract::IGameLedger" },
  {
    type: "struct",
    name: "core::integer::u256",
    members: [
      { name: "low", type: "core::integer::u128" },
      { name: "high", type: "core::integer::u128" },
    ],
  },
  {
    type: "struct",
    name: "game_ledger::types::Game",
    members: [
      { name: "exists", type: "core::bool" },
      { name: "preset_id", type: "core::integer::u32" },
      { name: "start", type: "core::integer::u64" },
      { name: "end", type: "core::integer::u64" },
      { name: "pool", type: "core::integer::u256" },
      { name: "registered_count", type: "core::integer::u16" },
      { name: "cancelled", type: "core::bool" },
      { name: "finalized", type: "core::bool" },
      { name: "protocol_cut", type: "core::integer::u256" },
      { name: "dust", type: "core::integer::u256" },
    ],
  },
  {
    type: "interface",
    name: "game_ledger::contract::IGameLedger",
    items: [
      {
        type: "function",
        name: "get_game",
        inputs: [{ name: "game_id", type: "core::integer::u32" }],
        outputs: [{ type: "game_ledger::types::Game" }],
        state_mutability: "view",
      },
    ],
  },
] as const satisfies Abi;

export function decodeGameLedgerGame(result: readonly string[]): GameLedgerGame {
  const expectedFelts = gameResultFeltCount();
  if (result.length !== expectedFelts) {
    throw new Error(`GameLedger.get_game returned ${result.length} felts; expected ${expectedFelts}`);
  }
  return {
    exists: parseBoolean(result[0], "exists"),
    presetId: parseSafeNumber(result[1], "preset_id"),
    start: parseSafeNumber(result[2], "start"),
    end: parseSafeNumber(result[3], "end"),
    pool: parseU256(result[4], result[5], "pool"),
    registeredCount: parseSafeNumber(result[6], "registered_count"),
    cancelled: parseBoolean(result[7], "cancelled"),
    finalized: parseBoolean(result[8], "finalized"),
    protocolCut: parseU256(result[9], result[10], "protocol_cut"),
    dust: parseU256(result[11], result[12], "dust"),
  };
}

function gameResultFeltCount(): number {
  const game = GAME_LEDGER_ABI.find(
    (entry): entry is Extract<(typeof GAME_LEDGER_ABI)[number], { type: "struct" }> =>
      entry.type === "struct" && entry.name === "game_ledger::types::Game",
  );
  if (!game) throw new Error("Vendored GameLedger ABI does not define Game");
  return game.members.reduce((count, member) => count + (member.type === "core::integer::u256" ? 2 : 1), 0);
}

function parseBoolean(value: string | undefined, field: string): boolean {
  if (value !== "0x0" && value !== "0x1" && value !== "0" && value !== "1") {
    throw new Error(`GameLedger.get_game returned an invalid ${field}: ${String(value)}`);
  }
  return BigInt(value) === 1n;
}

function parseSafeNumber(value: string | undefined, field: string): number {
  if (value === undefined) throw new Error(`GameLedger.get_game omitted ${field}`);
  const parsed = Number(BigInt(value));
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`GameLedger.get_game returned an invalid ${field}: ${value}`);
  }
  return parsed;
}

function parseU256(low: string | undefined, high: string | undefined, field: string): bigint {
  if (low === undefined || high === undefined) throw new Error(`GameLedger.get_game omitted ${field}`);
  return BigInt(low) + (BigInt(high) << 128n);
}
