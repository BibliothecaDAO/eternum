import * as schema from "../schema";
import { BURN_ADDRESS, ZERO_ADDRESS } from "../abi";
import { applyAmmV2BlockToDatabase } from "../../indexers/ammv2-block-processor";
import {
  DEFAULT_STANDALONE_AMMV2_LORDS_ADDRESS,
  STANDALONE_AMM_RESOURCES,
  sortTokenPair,
} from "@bibliothecadao/ammv2-sdk";
import {
  buildBlock,
  buildMintEvent,
  buildPairCreatedEvent,
  buildSwapEvent,
  buildSyncEvent,
  buildTransferEvent,
} from "../../test-support/ammv2-events";

const FEATURED_PAIR_COUNT = 5;
const PREVIEW_PAIR_COUNT = 12;
const PREVIEW_TOKEN_UNIT = 10n ** 18n;
const SWAP_FEE_AMOUNT = 997n;
const SWAP_FEE_DENOMINATOR = 1000n;

interface PreviewPairState {
  pairAddress: `0x${string}`;
  token0Address: `0x${string}`;
  token1Address: `0x${string}`;
  lordsIsToken0: boolean;
  reserve0: bigint;
  reserve1: bigint;
}

export const DEFAULT_STANDALONE_AMMV2_FACTORY_ADDRESS = "0xf00d1" as const;
export const STANDALONE_PREVIEW_PROVIDER_ADDRESS = "0xf00d2" as const;

const STANDALONE_PREVIEW_ROUTER_ADDRESS = "0xf00d3" as const;
const STANDALONE_PREVIEW_SWAP_USER = "0xf00d4" as const;
const STANDALONE_PREVIEW_TRANSFER_USER = "0xf00d5" as const;

function buildPreviewPairAddress(index: number): `0x${string}` {
  return `0x9${(index + 1).toString(16)}` as const;
}

function buildPreviewTxHash(index: number): `0x${string}` {
  return `0xa${(index + 1).toString(16)}` as const;
}

function buildPreviewPairs() {
  return STANDALONE_AMM_RESOURCES.slice(0, PREVIEW_PAIR_COUNT).map((resource, index) => {
    const [token0Address, token1Address] = sortTokenPair(DEFAULT_STANDALONE_AMMV2_LORDS_ADDRESS, resource.address);

    return {
      pairAddress: buildPreviewPairAddress(index),
      token0Address: token0Address as `0x${string}`,
      token1Address: token1Address as `0x${string}`,
      lordsIsToken0: normalizeAddress(token0Address) === normalizeAddress(DEFAULT_STANDALONE_AMMV2_LORDS_ADDRESS),
    };
  });
}

function resolveInitialPreviewLiquidity(index: number) {
  return {
    providerLpAmount: (24_000n + BigInt(index) * 1_300n) * PREVIEW_TOKEN_UNIT,
    lordsReserve: (18_000n + BigInt(index) * 2_400n) * PREVIEW_TOKEN_UNIT,
    tokenReserve: (27_000n + BigInt(index) * 1_900n) * PREVIEW_TOKEN_UNIT,
  };
}

function resolvePreviewLpTransferAmount(index: number): bigint {
  return (1_500n + BigInt(index) * 175n) * PREVIEW_TOKEN_UNIT;
}

function resolvePreviewSwapAmountIn(index: number, step: number, tokenInSide: 0 | 1): bigint {
  const baseAmount = tokenInSide === 0 ? 850n : 620n;
  return (baseAmount + BigInt(index * 55 + step * 70)) * PREVIEW_TOKEN_UNIT;
}

function computeAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
    return 0n;
  }

  const amountInWithFee = amountIn * SWAP_FEE_AMOUNT;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * SWAP_FEE_DENOMINATOR + amountInWithFee;

  if (denominator === 0n) {
    return 0n;
  }

  return numerator / denominator;
}

function buildPreviewSwap(
  pairState: PreviewPairState,
  index: number,
  step: number,
  eventIndex: number,
  transactionHash: `0x${string}`,
) {
  const tokenInSide = (index + step) % 2 === 0 ? 0 : 1;
  const amountIn = resolvePreviewSwapAmountIn(index, step, tokenInSide);

  if (tokenInSide === 0) {
    const amount1Out = computeAmountOut(amountIn, pairState.reserve0, pairState.reserve1);
    const nextState = {
      ...pairState,
      reserve0: pairState.reserve0 + amountIn,
      reserve1: pairState.reserve1 - amount1Out,
    };

    return {
      events: [
        buildSyncEvent({
          address: pairState.pairAddress,
          reserve0: nextState.reserve0,
          reserve1: nextState.reserve1,
          eventIndex,
          transactionHash,
        }),
        buildSwapEvent({
          address: pairState.pairAddress,
          sender: STANDALONE_PREVIEW_ROUTER_ADDRESS,
          to: STANDALONE_PREVIEW_SWAP_USER,
          amount0In: amountIn,
          amount1In: 0n,
          amount0Out: 0n,
          amount1Out,
          transactionSender: STANDALONE_PREVIEW_SWAP_USER,
          eventIndex: eventIndex + 1,
          transactionHash,
        }),
      ],
      nextState,
    };
  }

  const amount0Out = computeAmountOut(amountIn, pairState.reserve1, pairState.reserve0);
  const nextState = {
    ...pairState,
    reserve0: pairState.reserve0 - amount0Out,
    reserve1: pairState.reserve1 + amountIn,
  };

  return {
    events: [
      buildSyncEvent({
        address: pairState.pairAddress,
        reserve0: nextState.reserve0,
        reserve1: nextState.reserve1,
        eventIndex,
        transactionHash,
      }),
      buildSwapEvent({
        address: pairState.pairAddress,
        sender: STANDALONE_PREVIEW_ROUTER_ADDRESS,
        to: STANDALONE_PREVIEW_SWAP_USER,
        amount0In: 0n,
        amount1In: amountIn,
        amount0Out,
        amount1Out: 0n,
        transactionSender: STANDALONE_PREVIEW_SWAP_USER,
        eventIndex: eventIndex + 1,
        transactionHash,
      }),
    ],
    nextState,
  };
}

async function clearStandalonePreviewTables(db: any) {
  await db.delete(schema.pairPriceCandles);
  await db.delete(schema.pairLpBalances);
  await db.delete(schema.pairLpTransfers);
  await db.delete(schema.pairLiquidityEvents);
  await db.delete(schema.pairSwaps);
  await db.delete(schema.factoryFeeChanges);
  await db.delete(schema.pairs);
  await db.delete(schema.factories);
}

async function seedInitialStandalonePairs(db: any, now: Date) {
  const pairStates = new Map<string, PreviewPairState>();
  let nextBlockNumber = 1n;
  let nextTxHashIndex = 1;

  for (const [index, pairDefinition] of buildPreviewPairs().entries()) {
    const liquidity = resolveInitialPreviewLiquidity(index);
    const transactionHash = buildPreviewTxHash(nextTxHashIndex);
    const reserve0 = pairDefinition.lordsIsToken0 ? liquidity.lordsReserve : liquidity.tokenReserve;
    const reserve1 = pairDefinition.lordsIsToken0 ? liquidity.tokenReserve : liquidity.lordsReserve;

    await applyAmmV2BlockToDatabase({
      txDb: db,
      factoryAddress: DEFAULT_STANDALONE_AMMV2_FACTORY_ADDRESS,
      block: buildBlock(
        [
          buildPairCreatedEvent({
            address: DEFAULT_STANDALONE_AMMV2_FACTORY_ADDRESS,
            token0: pairDefinition.token0Address,
            token1: pairDefinition.token1Address,
            pair: pairDefinition.pairAddress,
            totalPairs: BigInt(index + 1),
            eventIndex: 0,
            transactionHash,
          }),
          buildTransferEvent({
            address: pairDefinition.pairAddress,
            from: ZERO_ADDRESS,
            to: BURN_ADDRESS,
            amount: 1_000n,
            eventIndex: 1,
            transactionHash,
          }),
          buildTransferEvent({
            address: pairDefinition.pairAddress,
            from: ZERO_ADDRESS,
            to: STANDALONE_PREVIEW_PROVIDER_ADDRESS,
            amount: liquidity.providerLpAmount,
            eventIndex: 2,
            transactionHash,
          }),
          buildSyncEvent({
            address: pairDefinition.pairAddress,
            reserve0,
            reserve1,
            eventIndex: 3,
            transactionHash,
          }),
          buildMintEvent({
            address: pairDefinition.pairAddress,
            sender: STANDALONE_PREVIEW_ROUTER_ADDRESS,
            amount0: reserve0,
            amount1: reserve1,
            transactionSender: STANDALONE_PREVIEW_PROVIDER_ADDRESS,
            eventIndex: 4,
            transactionHash,
          }),
        ],
        nextBlockNumber,
        new Date(now.getTime() - (72 - index * 4) * 60 * 60 * 1000),
      ),
    });

    pairStates.set(pairDefinition.pairAddress, {
      ...pairDefinition,
      reserve0,
      reserve1,
    });

    nextBlockNumber += 1n;
    nextTxHashIndex += 1;
  }

  return { nextBlockNumber, nextTxHashIndex, pairStates };
}

async function applyStandalonePreviewLpTransfers(
  db: any,
  now: Date,
  blockNumber: bigint,
  pairStates: Map<string, PreviewPairState>,
  nextTxHashIndex: number,
) {
  const transferEvents = Array.from(pairStates.values())
    .slice(0, FEATURED_PAIR_COUNT)
    .map((pairState, index) =>
      buildTransferEvent({
        address: pairState.pairAddress,
        from: STANDALONE_PREVIEW_PROVIDER_ADDRESS,
        to: STANDALONE_PREVIEW_TRANSFER_USER,
        amount: resolvePreviewLpTransferAmount(index),
        eventIndex: index,
        transactionHash: buildPreviewTxHash(nextTxHashIndex + index),
      }),
    );

  await applyAmmV2BlockToDatabase({
    txDb: db,
    factoryAddress: DEFAULT_STANDALONE_AMMV2_FACTORY_ADDRESS,
    block: buildBlock(transferEvents, blockNumber, new Date(now.getTime() - 18 * 60 * 60 * 1000)),
  });

  return {
    nextBlockNumber: blockNumber + 1n,
    nextTxHashIndex: nextTxHashIndex + FEATURED_PAIR_COUNT,
  };
}

async function applyFeaturedStandaloneSwaps(
  db: any,
  now: Date,
  blockNumber: bigint,
  pairStates: Map<string, PreviewPairState>,
  nextTxHashIndex: number,
) {
  let nextBlockNumber = blockNumber;
  let nextTransactionHashIndex = nextTxHashIndex;
  const featuredPairs = Array.from(pairStates.values()).slice(0, FEATURED_PAIR_COUNT);

  for (let step = 0; step < 6; step += 1) {
    const events: any[] = [];
    let eventIndex = 0;

    for (const [index, pairState] of featuredPairs.entries()) {
      const transactionHash = buildPreviewTxHash(nextTransactionHashIndex);
      const swap = buildPreviewSwap(pairState, index, step, eventIndex, transactionHash);
      pairStates.set(pairState.pairAddress, swap.nextState);
      featuredPairs[index] = swap.nextState;
      events.push(...swap.events);
      eventIndex += swap.events.length;
      nextTransactionHashIndex += 1;
    }

    await applyAmmV2BlockToDatabase({
      txDb: db,
      factoryAddress: DEFAULT_STANDALONE_AMMV2_FACTORY_ADDRESS,
      block: buildBlock(events, nextBlockNumber, new Date(now.getTime() - (6 - step) * 60 * 60 * 1000)),
    });

    nextBlockNumber += 1n;
  }

  return {
    nextBlockNumber,
    nextTxHashIndex: nextTransactionHashIndex,
  };
}

async function applyTailStandaloneSwaps(
  db: any,
  now: Date,
  blockNumber: bigint,
  pairStates: Map<string, PreviewPairState>,
  nextTxHashIndex: number,
) {
  let nextBlockNumber = blockNumber;
  let nextTransactionHashIndex = nextTxHashIndex;
  const tailPairs = Array.from(pairStates.values()).slice(FEATURED_PAIR_COUNT);

  for (let offset = 0; offset < tailPairs.length; offset += 3) {
    const pairBatch = tailPairs.slice(offset, offset + 3);
    const events: any[] = [];
    let eventIndex = 0;

    for (const [batchIndex, pairState] of pairBatch.entries()) {
      const pairIndex = FEATURED_PAIR_COUNT + offset + batchIndex;
      const transactionHash = buildPreviewTxHash(nextTransactionHashIndex);
      const swap = buildPreviewSwap(pairState, pairIndex, offset / 3, eventIndex, transactionHash);
      pairStates.set(pairState.pairAddress, swap.nextState);
      tailPairs[offset + batchIndex] = swap.nextState;
      events.push(...swap.events);
      eventIndex += swap.events.length;
      nextTransactionHashIndex += 1;
    }

    await applyAmmV2BlockToDatabase({
      txDb: db,
      factoryAddress: DEFAULT_STANDALONE_AMMV2_FACTORY_ADDRESS,
      block: buildBlock(events, nextBlockNumber, new Date(now.getTime() - (offset + 1) * 15 * 60 * 1000)),
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

  const seededPairs = await seedInitialStandalonePairs(params.db, now);
  const seededTransfers = await applyStandalonePreviewLpTransfers(
    params.db,
    now,
    seededPairs.nextBlockNumber,
    seededPairs.pairStates,
    seededPairs.nextTxHashIndex,
  );
  const seededFeaturedSwaps = await applyFeaturedStandaloneSwaps(
    params.db,
    now,
    seededTransfers.nextBlockNumber,
    seededPairs.pairStates,
    seededTransfers.nextTxHashIndex,
  );

  await applyTailStandaloneSwaps(
    params.db,
    now,
    seededFeaturedSwaps.nextBlockNumber,
    seededPairs.pairStates,
    seededFeaturedSwaps.nextTxHashIndex,
  );
}

function normalizeAddress(value: string): string {
  if (!value.startsWith("0x")) {
    return value.trim().toLowerCase();
  }

  return `0x${value.slice(2).replace(/^0+/, "").toLowerCase() || "0"}`;
}
