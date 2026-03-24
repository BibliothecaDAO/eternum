import {
  DEFAULT_STANDALONE_AMM_ADDRESS,
  DEFAULT_STANDALONE_AMM_LORDS_ADDRESS,
  STANDALONE_AMM_RESOURCES,
  getInputPrice,
} from "@bibliothecadao/amm-sdk";
import * as schema from "../schema";
import { applyAmmBlockToDatabase } from "../../indexers/amm-block-processor";
import {
  buildBlock,
  buildLiquidityAddedEvent,
  buildPoolCreatedEvent,
  buildSwapEvent,
} from "../../test-support/amm-events";

const LP_FEE_NUM = 3n;
const LP_FEE_DENOM = 1000n;
const PROTOCOL_FEE_NUM = 1n;
const PROTOCOL_FEE_DENOM = 100n;
const FEATURED_POOL_COUNT = 5;

interface PreviewPoolState {
  lordsReserve: bigint;
  tokenAddress: `0x${string}`;
  tokenReserve: bigint;
}

export const STANDALONE_PREVIEW_PROVIDER_ADDRESS =
  "0x0feed0000000000000000000000000000000000000000000000000000000001" as const;
const STANDALONE_PREVIEW_SWAP_USER = "0x0feed0000000000000000000000000000000000000000000000000000000002" as const;

function createPreviewHex(prefix: string, index: number): `0x${string}` {
  return `0x${prefix}${index.toString(16).padStart(62 - prefix.length, "0")}` as const;
}

function buildPreviewLpTokenAddress(index: number): `0x${string}` {
  return createPreviewHex("9", index + 1);
}

function buildPreviewTxHash(index: number): `0x${string}` {
  return createPreviewHex("a", index + 1);
}

function resolveInitialLiquidity(index: number) {
  const lordsAmount = 80_000n + BigInt(index) * 4_000n;
  const tokenAmount = 40_000n + BigInt(index) * 3_000n;
  const lpMinted = 60_000n + BigInt(index) * 2_000n;

  return {
    lordsAmount,
    tokenAmount,
    lpMinted,
  };
}

function buildDirectPreviewSwap(
  poolState: PreviewPoolState,
  index: number,
  step: number,
): {
  event: ReturnType<typeof buildSwapEvent>;
  nextState: PreviewPoolState;
} {
  const lordsInput = (index + step) % 2 === 0;

  if (lordsInput) {
    const amountIn = 900n + BigInt(index * 75 + step * 110);
    const grossAmountOut = getInputPrice(
      LP_FEE_NUM,
      LP_FEE_DENOM,
      amountIn,
      poolState.lordsReserve,
      poolState.tokenReserve,
    );
    const protocolFee = (grossAmountOut * PROTOCOL_FEE_NUM) / PROTOCOL_FEE_DENOM;
    const amountOut = grossAmountOut - protocolFee;

    return {
      event: buildSwapEvent({
        address: DEFAULT_STANDALONE_AMM_ADDRESS,
        amountIn,
        amountOut,
        protocolFee,
        tokenIn: DEFAULT_STANDALONE_AMM_LORDS_ADDRESS as `0x${string}`,
        tokenOut: poolState.tokenAddress,
        user: STANDALONE_PREVIEW_SWAP_USER,
      }),
      nextState: {
        ...poolState,
        lordsReserve: poolState.lordsReserve + amountIn,
        tokenReserve: poolState.tokenReserve - amountOut - protocolFee,
      },
    };
  }

  const amountIn = 450n + BigInt(index * 45 + step * 60);
  const grossAmountOut = getInputPrice(
    LP_FEE_NUM,
    LP_FEE_DENOM,
    amountIn,
    poolState.tokenReserve,
    poolState.lordsReserve,
  );
  const protocolFee = (grossAmountOut * PROTOCOL_FEE_NUM) / PROTOCOL_FEE_DENOM;
  const amountOut = grossAmountOut - protocolFee;

  return {
    event: buildSwapEvent({
      address: DEFAULT_STANDALONE_AMM_ADDRESS,
      amountIn,
      amountOut,
      protocolFee,
      tokenIn: poolState.tokenAddress,
      tokenOut: DEFAULT_STANDALONE_AMM_LORDS_ADDRESS as `0x${string}`,
      user: STANDALONE_PREVIEW_SWAP_USER,
    }),
    nextState: {
      ...poolState,
      lordsReserve: poolState.lordsReserve - amountOut - protocolFee,
      tokenReserve: poolState.tokenReserve + amountIn,
    },
  };
}

async function clearStandalonePreviewTables(db: any) {
  await db.delete(schema.poolSnapshots);
  await db.delete(schema.priceCandles);
  await db.delete(schema.poolFeeChanges);
  await db.delete(schema.liquidityEvents);
  await db.delete(schema.swaps);
  await db.delete(schema.pools);
}

async function seedInitialStandalonePools(db: any, now: Date) {
  const poolStates = new Map<string, PreviewPoolState>();
  let blockNumber = 1n;
  let txHashIndex = 1;

  for (const [index, resource] of STANDALONE_AMM_RESOURCES.entries()) {
    const { lordsAmount, tokenAmount, lpMinted } = resolveInitialLiquidity(index);

    await applyAmmBlockToDatabase({
      txDb: db,
      lordsAddress: DEFAULT_STANDALONE_AMM_LORDS_ADDRESS,
      block: buildBlock(
        [
          buildPoolCreatedEvent({
            address: DEFAULT_STANDALONE_AMM_ADDRESS,
            token: resource.address as `0x${string}`,
            lpToken: buildPreviewLpTokenAddress(index),
            lpFeeNum: LP_FEE_NUM,
            lpFeeDenom: LP_FEE_DENOM,
            protocolFeeNum: PROTOCOL_FEE_NUM,
            protocolFeeDenom: PROTOCOL_FEE_DENOM,
          }),
          buildLiquidityAddedEvent({
            address: DEFAULT_STANDALONE_AMM_ADDRESS,
            token: resource.address as `0x${string}`,
            provider: STANDALONE_PREVIEW_PROVIDER_ADDRESS,
            lordsAmount,
            tokenAmount,
            lpMinted,
            eventIndex: 1,
          }),
        ],
        blockNumber,
        new Date(now.getTime() - (72 - index) * 60 * 60 * 1000),
      ),
    });

    poolStates.set(resource.address, {
      tokenAddress: resource.address as `0x${string}`,
      lordsReserve: lordsAmount,
      tokenReserve: tokenAmount,
    });

    blockNumber += 1n;
    txHashIndex += 1;
  }

  return { blockNumber, poolStates, txHashIndex };
}

async function applyFeaturedStandaloneSwaps(
  db: any,
  now: Date,
  blockNumber: bigint,
  poolStates: Map<string, PreviewPoolState>,
) {
  let nextBlockNumber = blockNumber;

  for (let step = 0; step < 6; step += 1) {
    const events = STANDALONE_AMM_RESOURCES.slice(0, FEATURED_POOL_COUNT).map((resource, eventIndex) => {
      const currentPoolState = poolStates.get(resource.address);

      if (!currentPoolState) {
        throw new Error(`Missing preview pool state for ${resource.address}`);
      }

      const { event, nextState } = buildDirectPreviewSwap(currentPoolState, eventIndex, step);
      poolStates.set(resource.address, nextState);

      return {
        ...event,
        eventIndex,
        transactionHash: buildPreviewTxHash(Number(nextBlockNumber) + eventIndex),
      };
    });

    await applyAmmBlockToDatabase({
      txDb: db,
      lordsAddress: DEFAULT_STANDALONE_AMM_LORDS_ADDRESS,
      block: buildBlock(events, nextBlockNumber, new Date(now.getTime() - (6 - step) * 60 * 60 * 1000)),
    });

    nextBlockNumber += 1n;
  }

  return nextBlockNumber;
}

async function applyTailStandaloneSwaps(
  db: any,
  now: Date,
  blockNumber: bigint,
  poolStates: Map<string, PreviewPoolState>,
) {
  let nextBlockNumber = blockNumber;
  const tailResources = STANDALONE_AMM_RESOURCES.slice(FEATURED_POOL_COUNT);

  for (let offset = 0; offset < tailResources.length; offset += 5) {
    const resourceBatch = tailResources.slice(offset, offset + 5);
    const events = resourceBatch.map((resource, eventIndex) => {
      const currentPoolState = poolStates.get(resource.address);

      if (!currentPoolState) {
        throw new Error(`Missing preview pool state for ${resource.address}`);
      }

      const { event, nextState } = buildDirectPreviewSwap(
        currentPoolState,
        FEATURED_POOL_COUNT + offset + eventIndex,
        offset / 5,
      );
      poolStates.set(resource.address, nextState);

      return {
        ...event,
        eventIndex,
        transactionHash: buildPreviewTxHash(Number(nextBlockNumber) + eventIndex),
      };
    });

    await applyAmmBlockToDatabase({
      txDb: db,
      lordsAddress: DEFAULT_STANDALONE_AMM_LORDS_ADDRESS,
      block: buildBlock(events, nextBlockNumber, new Date(now.getTime() - (offset + 1) * 10 * 60 * 1000)),
    });

    nextBlockNumber += 1n;
  }
}

interface SeedStandalonePreviewDatabaseParams {
  db: any;
  now?: Date;
}

export async function seedStandalonePreviewDatabase(params: SeedStandalonePreviewDatabaseParams) {
  const now = params.now ?? new Date();

  await clearStandalonePreviewTables(params.db);
  const { blockNumber, poolStates } = await seedInitialStandalonePools(params.db, now);
  const nextBlockNumber = await applyFeaturedStandaloneSwaps(params.db, now, blockNumber, poolStates);
  await applyTailStandaloneSwaps(params.db, now, nextBlockNumber, poolStates);
}

export { DEFAULT_STANDALONE_AMM_ADDRESS, DEFAULT_STANDALONE_AMM_LORDS_ADDRESS };
