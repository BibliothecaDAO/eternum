import type { RpcProvider } from "starknet";
export { rpcAt } from "./rpc";
export interface LedgerGameKey {
  chainId: string;
  gameId: number;
}
interface LedgerGame {
  start: number;
  end: number;
  registeredCount: number;
  cancelled: boolean;
  finalized: boolean;
  commitment: string;
}

/** Published Game field order, read at one confirmed head for all roster entries. */
export async function readLedgerGame(
  provider: RpcProvider,
  address: string,
  key: LedgerGameKey,
  head: number,
): Promise<LedgerGame> {
  const fields = await provider.callContract(
    { contractAddress: address, entrypoint: "get_game", calldata: [key.chainId, String(key.gameId)] },
    head,
  );
  if (fields.length !== 11 || BigInt(fields[1]!) !== 1n) throw new Error("invalid_ledger_game");
  return {
    start: ledgerInteger(fields[3]!),
    end: ledgerInteger(fields[4]!),
    registeredCount: ledgerInteger(fields[8]!),
    commitment: fields[7]!,
    cancelled: bool(fields[9]!),
    finalized: bool(fields[10]!),
  };
}

/** The registered wallets at the pinned L2 head, in the ledger's roster order. */
export async function readRegisteredWallets(
  provider: RpcProvider,
  address: string,
  key: LedgerGameKey,
  head: number,
  count: number,
): Promise<string[]> {
  const wallets: string[] = [];
  for (let index = 0; index < count; index++) {
    const fields = await provider.callContract(
      {
        contractAddress: address,
        entrypoint: "get_registered_owner",
        calldata: [key.chainId, String(key.gameId), String(index)],
      },
      head,
    );
    if (fields.length !== 1 || BigInt(fields[0]!) === 0n) throw new Error("invalid_registered_owner");
    wallets.push(fields[0]!);
  }
  return wallets;
}

export const ledgerInteger = (value: string): number => {
  const n = Number(BigInt(value));
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("invalid_ledger_integer");
  return n;
};
const bool = (value: string): boolean => {
  if (BigInt(value) !== 0n && BigInt(value) !== 1n) throw new Error("invalid_ledger_bool");
  return BigInt(value) === 1n;
};
