import { RpcProvider } from "starknet";
import * as schema from "../src/schema";

interface SeedFactoryStateParams {
  factoryAddress: string;
  rpcUrl: string;
  seedBlockNumber: bigint | null;
  txDb: any;
}

const DEFAULT_FACTORY_FEE_AMOUNT = 997n;
const ZERO_ADDRESS = "0x0";

let seedPromise: Promise<void> | null = null;

export async function ensureFactoryStateSeeded(params: SeedFactoryStateParams) {
  if (!seedPromise) {
    seedPromise = seedFactoryState(params).catch((error) => {
      seedPromise = null;
      throw error;
    });
  }

  await seedPromise;
}

async function seedFactoryState(params: SeedFactoryStateParams) {
  if (params.seedBlockNumber === null) {
    return;
  }

  const provider = new RpcProvider({ nodeUrl: params.rpcUrl });
  const factoryState = await loadFactoryState(provider, params.factoryAddress, params.seedBlockNumber);

  if (!factoryState) {
    return;
  }

  const { feeAmount, feeTo, pairAddresses } = factoryState;

  await params.txDb
    .insert(schema.factories)
    .values({
      factoryAddress: normalizeAddress(params.factoryAddress),
      feeAmount: feeAmount.toString(),
      feeTo,
      pairCount: BigInt(pairAddresses.length),
      lastUpdatedBlockNumber: 0n,
      lastUpdatedTxHash: "0xseed",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.factories.factoryAddress,
      set: {
        feeAmount: feeAmount.toString(),
        feeTo,
        pairCount: BigInt(pairAddresses.length),
        updatedAt: new Date(),
      },
    });

  for (const pairAddress of pairAddresses) {
    const [token0Result, token1Result, reservesResult, totalSupplyResult] = await Promise.all([
      callView(provider, pairAddress, "token0", params.seedBlockNumber),
      callView(provider, pairAddress, "token1", params.seedBlockNumber),
      callView(provider, pairAddress, "get_reserves", params.seedBlockNumber),
      callView(provider, pairAddress, "total_supply", params.seedBlockNumber),
    ]);
    const token0Address = token0Result[0] ? normalizeAddress(token0Result[0]) : ZERO_ADDRESS;
    const token1Address = token1Result[0] ? normalizeAddress(token1Result[0]) : ZERO_ADDRESS;
    const reserve0 = parseU256(reservesResult, 0);
    const reserve1 = parseU256(reservesResult, 2);
    const totalLpSupply = parseU256(totalSupplyResult, 0);

    await params.txDb
      .insert(schema.pairs)
      .values({
        pairAddress,
        factoryAddress: normalizeAddress(params.factoryAddress),
        token0Address,
        token1Address,
        lpTokenAddress: pairAddress,
        reserve0: reserve0.toString(),
        reserve1: reserve1.toString(),
        totalLpSupply: totalLpSupply.toString(),
        createdBlockNumber: 0n,
        createdTxHash: "0xseed",
        lastSyncedBlockNumber: 0n,
        lastSyncedTxHash: "0xseed",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.pairs.pairAddress,
        set: {
          reserve0: reserve0.toString(),
          reserve1: reserve1.toString(),
          totalLpSupply: totalLpSupply.toString(),
          updatedAt: new Date(),
        },
      });
  }
}

async function loadFactoryState(provider: RpcProvider, factoryAddress: string, seedBlockNumber: bigint) {
  try {
    const [feeAmountResult, feeToResult, allPairsResult] = await Promise.all([
      callView(provider, factoryAddress, "get_fee_amount", seedBlockNumber),
      callView(provider, factoryAddress, "get_fee_to", seedBlockNumber),
      callView(provider, factoryAddress, "get_all_pairs", seedBlockNumber),
    ]);

    return {
      feeAmount: feeAmountResult.length >= 2 ? parseU256(feeAmountResult, 0) : DEFAULT_FACTORY_FEE_AMOUNT,
      feeTo: feeToResult[0] ? normalizeAddress(feeToResult[0]) : ZERO_ADDRESS,
      pairAddresses: parseAddressArray(allPairsResult),
    };
  } catch (error) {
    if (isContractUnavailableAtBlock(error)) {
      return null;
    }

    throw error;
  }
}

async function callView(
  provider: RpcProvider,
  contractAddress: string,
  entrypoint: string,
  blockIdentifier: bigint,
): Promise<string[]> {
  const result = await provider.callContract(
    {
      contractAddress,
      entrypoint,
      calldata: [],
    },
    resolveRpcBlockIdentifier(blockIdentifier),
  );

  return result.map((value) => String(value));
}

function resolveRpcBlockIdentifier(blockNumber: bigint): string {
  return blockNumber.toString();
}

function parseAddressArray(values: string[]): string[] {
  if (values.length === 0) {
    return [];
  }

  const length = Number(BigInt(values[0]));
  return values.slice(1, 1 + length).map(normalizeAddress);
}

function parseU256(values: string[], offset: number): bigint {
  const low = BigInt(values[offset] ?? "0x0");
  const high = BigInt(values[offset + 1] ?? "0x0");
  return low + (high << 128n);
}

function normalizeAddress(value: string): string {
  return `0x${value.slice(2).replace(/^0+/, "").toLowerCase() || "0"}`;
}

function isContractUnavailableAtBlock(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("contract not found") ||
    message.includes("uninitialized contract") ||
    message.includes("class hash")
  );
}
