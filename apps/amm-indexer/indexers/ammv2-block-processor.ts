import { and, eq } from "drizzle-orm";
import { BURN_ADDRESS, CANDLE_INTERVALS, EVENT_SELECTORS, ZERO_ADDRESS } from "../src/abi";
import * as schema from "../src/schema";

interface BlockEvent {
  address?: string;
  data?: string[];
  eventIndex?: number;
  keys?: string[];
  transaction?: {
    senderAddress?: string;
  };
  transactionHash?: string;
}

interface ApplyAmmV2BlockParams {
  block: {
    events?: BlockEvent[];
    header?: {
      blockNumber?: bigint;
      timestamp?: Date;
    };
  };
  factoryAddress: string;
  txDb: any;
}

interface PairRow {
  pairAddress: string;
  factoryAddress: string;
  reserve0: string;
  reserve1: string;
  token0Address: string;
  token1Address: string;
  totalLpSupply: string;
}

interface ParsedTransfer {
  amount: bigint;
  eventIndex: number;
  from: string;
  to: string;
}

const DEFAULT_FACTORY_FEE_AMOUNT = 997n;

export async function applyAmmV2BlockToDatabase(params: ApplyAmmV2BlockParams) {
  const blockNumber = params.block.header?.blockNumber ?? 0n;
  const blockTimestamp = params.block.header?.timestamp ?? new Date(0);
  const events = params.block.events ?? [];
  const transactionEvents = groupEventsByTransaction(events);

  for (const event of events) {
    const selector = event.keys?.[0];

    if (!selector || !event.address) {
      continue;
    }

    if (isFactoryEvent(params.factoryAddress, event.address, selector)) {
      await applyFactoryEvent(params.txDb, event, {
        blockNumber,
        blockTimestamp,
      });
      continue;
    }

    if (isPairEvent(selector)) {
      await applyPairEvent(params.txDb, event, {
        blockNumber,
        blockTimestamp,
        transactionEvents,
      });
    }
  }
}

function isFactoryEvent(factoryAddress: string, eventAddress: string, selector: string): boolean {
  return normalizeAddress(factoryAddress) === normalizeAddress(eventAddress) && isFactorySelector(selector);
}

function isFactorySelector(selector: string): boolean {
  return (
    selector === EVENT_SELECTORS.pairCreated ||
    selector === EVENT_SELECTORS.feeAmountChanged ||
    selector === EVENT_SELECTORS.feeToChanged
  );
}

function isPairEvent(selector: string): boolean {
  return (
    selector === EVENT_SELECTORS.transfer ||
    selector === EVENT_SELECTORS.sync ||
    selector === EVENT_SELECTORS.swap ||
    selector === EVENT_SELECTORS.mint ||
    selector === EVENT_SELECTORS.burn
  );
}

async function applyFactoryEvent(
  txDb: any,
  event: BlockEvent,
  context: {
    blockNumber: bigint;
    blockTimestamp: Date;
  },
) {
  const selector = event.keys?.[0];

  if (selector === EVENT_SELECTORS.pairCreated) {
    await recordPairCreated(txDb, event, context);
    return;
  }

  if (selector === EVENT_SELECTORS.feeAmountChanged) {
    await recordFactoryFeeAmountChanged(txDb, event, context);
    return;
  }

  if (selector === EVENT_SELECTORS.feeToChanged) {
    await recordFactoryFeeToChanged(txDb, event, context);
  }
}

async function recordPairCreated(
  txDb: any,
  event: BlockEvent,
  context: {
    blockNumber: bigint;
    blockTimestamp: Date;
  },
) {
  const factoryAddress = normalizeAddress(event.address!);
  const token0Address = parseAddressFromKey(event, 1);
  const token1Address = parseAddressFromKey(event, 2);
  const pairAddress = parseAddressFromData(event, 0);
  const pairCount = BigInt(event.data?.[1] ?? "0x0");
  const txHash = event.transactionHash ?? "0x0";

  await txDb
    .insert(schema.factories)
    .values({
      factoryAddress,
      feeAmount: DEFAULT_FACTORY_FEE_AMOUNT.toString(),
      feeTo: ZERO_ADDRESS,
      pairCount,
      lastUpdatedBlockNumber: context.blockNumber,
      lastUpdatedTxHash: txHash,
      updatedAt: context.blockTimestamp,
    })
    .onConflictDoUpdate({
      target: schema.factories.factoryAddress,
      set: {
        pairCount,
        lastUpdatedBlockNumber: context.blockNumber,
        lastUpdatedTxHash: txHash,
        updatedAt: context.blockTimestamp,
      },
    });

  await txDb
    .insert(schema.pairs)
    .values({
      pairAddress,
      factoryAddress,
      token0Address,
      token1Address,
      lpTokenAddress: pairAddress,
      reserve0: "0",
      reserve1: "0",
      totalLpSupply: "0",
      createdBlockNumber: context.blockNumber,
      createdTxHash: txHash,
      lastSyncedBlockNumber: 0n,
      lastSyncedTxHash: "0x0",
      updatedAt: context.blockTimestamp,
    })
    .onConflictDoUpdate({
      target: schema.pairs.pairAddress,
      set: {
        factoryAddress,
        token0Address,
        token1Address,
        lpTokenAddress: pairAddress,
        createdBlockNumber: context.blockNumber,
        createdTxHash: txHash,
        updatedAt: context.blockTimestamp,
      },
    });
}

async function recordFactoryFeeAmountChanged(
  txDb: any,
  event: BlockEvent,
  context: {
    blockNumber: bigint;
    blockTimestamp: Date;
  },
) {
  const factoryAddress = normalizeAddress(event.address!);
  const oldFeeAmount = parseU256(event.data ?? [], 0);
  const newFeeAmount = parseU256(event.data ?? [], 2);
  const txHash = event.transactionHash ?? "0x0";

  await txDb
    .insert(schema.factories)
    .values({
      factoryAddress,
      feeAmount: newFeeAmount.toString(),
      feeTo: ZERO_ADDRESS,
      pairCount: 0n,
      lastUpdatedBlockNumber: context.blockNumber,
      lastUpdatedTxHash: txHash,
      updatedAt: context.blockTimestamp,
    })
    .onConflictDoUpdate({
      target: schema.factories.factoryAddress,
      set: {
        feeAmount: newFeeAmount.toString(),
        lastUpdatedBlockNumber: context.blockNumber,
        lastUpdatedTxHash: txHash,
        updatedAt: context.blockTimestamp,
      },
    });

  await txDb.insert(schema.factoryFeeChanges).values({
    id: `${txHash}:fee_amount`,
    factoryAddress,
    changeType: "fee_amount",
    oldFeeAmount: oldFeeAmount.toString(),
    newFeeAmount: newFeeAmount.toString(),
    blockNumber: context.blockNumber,
    blockTimestamp: context.blockTimestamp,
    txHash,
  });
}

async function recordFactoryFeeToChanged(
  txDb: any,
  event: BlockEvent,
  context: {
    blockNumber: bigint;
    blockTimestamp: Date;
  },
) {
  const factoryAddress = normalizeAddress(event.address!);
  const oldFeeTo = parseAddressFromData(event, 0);
  const newFeeTo = parseAddressFromData(event, 1);
  const txHash = event.transactionHash ?? "0x0";

  await txDb
    .insert(schema.factories)
    .values({
      factoryAddress,
      feeAmount: DEFAULT_FACTORY_FEE_AMOUNT.toString(),
      feeTo: newFeeTo,
      pairCount: 0n,
      lastUpdatedBlockNumber: context.blockNumber,
      lastUpdatedTxHash: txHash,
      updatedAt: context.blockTimestamp,
    })
    .onConflictDoUpdate({
      target: schema.factories.factoryAddress,
      set: {
        feeTo: newFeeTo,
        lastUpdatedBlockNumber: context.blockNumber,
        lastUpdatedTxHash: txHash,
        updatedAt: context.blockTimestamp,
      },
    });

  await txDb.insert(schema.factoryFeeChanges).values({
    id: `${txHash}:fee_to`,
    factoryAddress,
    changeType: "fee_to",
    oldFeeTo,
    newFeeTo,
    blockNumber: context.blockNumber,
    blockTimestamp: context.blockTimestamp,
    txHash,
  });
}

async function applyPairEvent(
  txDb: any,
  event: BlockEvent,
  context: {
    blockNumber: bigint;
    blockTimestamp: Date;
    transactionEvents: Map<string, BlockEvent[]>;
  },
) {
  const selector = event.keys?.[0];
  const pairAddress = normalizeAddress(event.address!);
  const pair = await loadPair(txDb, pairAddress);

  if (!pair) {
    return;
  }

  if (selector === EVENT_SELECTORS.transfer) {
    await recordPairTransfer(txDb, pair, event, context);
    return;
  }

  if (selector === EVENT_SELECTORS.sync) {
    await recordPairSync(txDb, pair, event, context);
    return;
  }

  if (selector === EVENT_SELECTORS.swap) {
    await recordPairSwap(txDb, pair, event, context);
    return;
  }

  if (selector === EVENT_SELECTORS.mint || selector === EVENT_SELECTORS.burn) {
    await recordPairLiquidityEvent(txDb, pair, event, context);
  }
}

async function recordPairTransfer(
  txDb: any,
  pair: PairRow,
  event: BlockEvent,
  context: {
    blockNumber: bigint;
    blockTimestamp: Date;
  },
) {
  const fromAddress = parseAddressFromKey(event, 1);
  const toAddress = parseAddressFromKey(event, 2);
  const amount = parseU256(event.data ?? [], 0);
  const txHash = event.transactionHash ?? "0x0";
  const eventIndex = event.eventIndex ?? 0;

  await txDb.insert(schema.pairLpTransfers).values({
    id: buildHistoryId(pair.pairAddress, txHash, eventIndex),
    pairAddress: pair.pairAddress,
    factoryAddress: pair.factoryAddress,
    token0Address: pair.token0Address,
    token1Address: pair.token1Address,
    fromAddress,
    toAddress,
    amount: amount.toString(),
    blockNumber: context.blockNumber,
    blockTimestamp: context.blockTimestamp,
    txHash,
    eventIndex,
  });

  await applyPairLpBalanceDelta(txDb, pair.pairAddress, fromAddress, -amount, context.blockTimestamp);
  await applyPairLpBalanceDelta(txDb, pair.pairAddress, toAddress, amount, context.blockTimestamp);
  await applyPairTotalSupplyDelta(txDb, pair, fromAddress, toAddress, amount, context.blockTimestamp);
}

async function recordPairSync(
  txDb: any,
  pair: PairRow,
  event: BlockEvent,
  context: {
    blockNumber: bigint;
    blockTimestamp: Date;
  },
) {
  const reserve0 = parseU256(event.data ?? [], 0);
  const reserve1 = parseU256(event.data ?? [], 2);

  await txDb
    .update(schema.pairs)
    .set({
      reserve0: reserve0.toString(),
      reserve1: reserve1.toString(),
      lastSyncedBlockNumber: context.blockNumber,
      lastSyncedTxHash: event.transactionHash ?? "0x0",
      updatedAt: context.blockTimestamp,
    })
    .where(eq(schema.pairs.pairAddress, pair.pairAddress));
}

async function recordPairSwap(
  txDb: any,
  pair: PairRow,
  event: BlockEvent,
  context: {
    blockNumber: bigint;
    blockTimestamp: Date;
  },
) {
  const amount0In = parseU256(event.data ?? [], 0);
  const amount1In = parseU256(event.data ?? [], 2);
  const amount0Out = parseU256(event.data ?? [], 4);
  const amount1Out = parseU256(event.data ?? [], 6);
  const factory = await loadFactory(txDb, pair.factoryAddress);
  const feeAmount = BigInt(factory?.feeAmount ?? DEFAULT_FACTORY_FEE_AMOUNT.toString());
  const txHash = event.transactionHash ?? "0x0";
  const eventIndex = event.eventIndex ?? 0;
  const currentPair = (await loadPair(txDb, pair.pairAddress)) ?? pair;
  const spotPriceAfterSwap = computeSpotPrice(currentPair.reserve0, currentPair.reserve1);

  await txDb.insert(schema.pairSwaps).values({
    id: buildHistoryId(pair.pairAddress, txHash, eventIndex),
    pairAddress: pair.pairAddress,
    factoryAddress: pair.factoryAddress,
    token0Address: pair.token0Address,
    token1Address: pair.token1Address,
    initiatorAddress: resolveInitiatorAddress(event),
    callerAddress: parseAddressFromKey(event, 1),
    recipientAddress: parseAddressFromKey(event, 2),
    amount0In: amount0In.toString(),
    amount1In: amount1In.toString(),
    amount0Out: amount0Out.toString(),
    amount1Out: amount1Out.toString(),
    feeAmount: feeAmount.toString(),
    blockNumber: context.blockNumber,
    blockTimestamp: context.blockTimestamp,
    txHash,
    eventIndex,
  });

  await upsertSwapCandle(txDb, pair.pairAddress, context.blockTimestamp, {
    amount0In,
    amount0Out,
    amount1In,
    amount1Out,
    priceAfterSwap: spotPriceAfterSwap,
  });
}

async function recordPairLiquidityEvent(
  txDb: any,
  pair: PairRow,
  event: BlockEvent,
  context: {
    blockNumber: bigint;
    blockTimestamp: Date;
    transactionEvents: Map<string, BlockEvent[]>;
  },
) {
  const txHash = event.transactionHash ?? "0x0";
  const transactionEvents = context.transactionEvents.get(txHash) ?? [];
  const transferEvents = resolveScopedTransferEvents(transactionEvents, pair.pairAddress, event.eventIndex ?? 0);
  const eventType = event.keys?.[0] === EVENT_SELECTORS.mint ? "add" : "remove";
  const amount0 = parseU256(event.data ?? [], 0);
  const amount1 = parseU256(event.data ?? [], 2);
  const lpAmount = eventType === "add" ? resolveMintLpAmount(transferEvents) : resolveBurnLpAmount(transferEvents);

  await txDb.insert(schema.pairLiquidityEvents).values({
    id: buildHistoryId(pair.pairAddress, txHash, event.eventIndex ?? 0),
    pairAddress: pair.pairAddress,
    factoryAddress: pair.factoryAddress,
    token0Address: pair.token0Address,
    token1Address: pair.token1Address,
    providerAddress: resolveLiquidityProviderAddress(event, transferEvents),
    eventType,
    amount0: amount0.toString(),
    amount1: amount1.toString(),
    lpAmount: lpAmount.toString(),
    blockNumber: context.blockNumber,
    blockTimestamp: context.blockTimestamp,
    txHash,
    eventIndex: event.eventIndex ?? 0,
  });
}

function groupEventsByTransaction(events: BlockEvent[]) {
  const transactions = new Map<string, BlockEvent[]>();

  for (const event of events) {
    const txHash = event.transactionHash ?? "0x0";
    const current = transactions.get(txHash);

    if (current) {
      current.push(event);
      continue;
    }

    transactions.set(txHash, [event]);
  }

  return transactions;
}

function resolveScopedTransferEvents(
  events: BlockEvent[],
  pairAddress: string,
  currentEventIndex: number,
): ParsedTransfer[] {
  const previousLiquidityEventIndex = resolvePreviousLiquidityEventIndex(events, pairAddress, currentEventIndex);

  return events
    .filter(
      (event) =>
        normalizeAddress(event.address ?? ZERO_ADDRESS) === pairAddress &&
        event.keys?.[0] === EVENT_SELECTORS.transfer &&
        (event.eventIndex ?? 0) > previousLiquidityEventIndex &&
        (event.eventIndex ?? 0) <= currentEventIndex,
    )
    .map((event) => ({
      amount: parseU256(event.data ?? [], 0),
      eventIndex: event.eventIndex ?? 0,
      from: parseAddressFromKey(event, 1),
      to: parseAddressFromKey(event, 2),
    }))
    .sort((left, right) => left.eventIndex - right.eventIndex);
}

function resolvePreviousLiquidityEventIndex(
  events: BlockEvent[],
  pairAddress: string,
  currentEventIndex: number,
): number {
  const previousEvent = events
    .filter(
      (event) =>
        normalizeAddress(event.address ?? ZERO_ADDRESS) === pairAddress &&
        (event.keys?.[0] === EVENT_SELECTORS.mint || event.keys?.[0] === EVENT_SELECTORS.burn) &&
        (event.eventIndex ?? 0) < currentEventIndex,
    )
    .sort((left, right) => (right.eventIndex ?? 0) - (left.eventIndex ?? 0))[0];

  return previousEvent?.eventIndex ?? -1;
}

function resolveMintLpAmount(transferEvents: ParsedTransfer[]): bigint {
  const mintedTransfers = transferEvents.filter((event) => isZeroLikeAddress(event.from));
  const providerTransfer = mintedTransfers
    .filter((event) => !isZeroLikeAddress(event.to) && normalizeAddress(event.to) !== BURN_ADDRESS)
    .at(-1);

  return providerTransfer?.amount ?? mintedTransfers.at(-1)?.amount ?? 0n;
}

function resolveBurnLpAmount(transferEvents: ParsedTransfer[]): bigint {
  return transferEvents.find((event) => isZeroLikeAddress(event.to))?.amount ?? 0n;
}

function resolveLiquidityProviderAddress(event: BlockEvent, transferEvents: ParsedTransfer[]): string {
  const transactionSender = resolveInitiatorAddress(event);

  if (!isZeroLikeAddress(transactionSender)) {
    return transactionSender;
  }

  const providerTransfer = transferEvents
    .filter((candidate) => !isZeroLikeAddress(candidate.to) && normalizeAddress(candidate.to) !== BURN_ADDRESS)
    .at(-1);

  return providerTransfer?.to ?? ZERO_ADDRESS;
}

async function upsertSwapCandle(
  txDb: any,
  pairAddress: string,
  blockTimestamp: Date,
  swap: {
    amount0In: bigint;
    amount0Out: bigint;
    amount1In: bigint;
    amount1Out: bigint;
    priceAfterSwap: number;
  },
) {
  for (const [interval, intervalMs] of Object.entries(CANDLE_INTERVALS)) {
    const openTime = getCandleOpenTime(blockTimestamp, intervalMs);
    const id = `${pairAddress}:${interval}:${openTime.toISOString()}`;
    const closeTime = new Date(openTime.getTime() + intervalMs);
    const existingRows = await txDb
      .select()
      .from(schema.pairPriceCandles)
      .where(eq(schema.pairPriceCandles.id, id))
      .limit(1);
    const existing = existingRows[0];
    const volume0 = (swap.amount0In + swap.amount0Out).toString();
    const volume1 = (swap.amount1In + swap.amount1Out).toString();
    const price = swap.priceAfterSwap.toFixed(18);

    if (!existing) {
      await txDb.insert(schema.pairPriceCandles).values({
        id,
        pairAddress,
        interval,
        openTime,
        closeTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume0,
        volume1,
        tradeCount: 1,
      });
      continue;
    }

    const nextHigh = Math.max(Number(existing.high), swap.priceAfterSwap).toFixed(18);
    const nextLow = Math.min(Number(existing.low), swap.priceAfterSwap).toFixed(18);

    await txDb
      .update(schema.pairPriceCandles)
      .set({
        high: nextHigh,
        low: nextLow,
        close: price,
        volume0: (BigInt(existing.volume0) + BigInt(volume0)).toString(),
        volume1: (BigInt(existing.volume1) + BigInt(volume1)).toString(),
        tradeCount: existing.tradeCount + 1,
      })
      .where(eq(schema.pairPriceCandles.id, id));
  }
}

function getCandleOpenTime(timestamp: Date, intervalMs: number): Date {
  const milliseconds = timestamp.getTime();
  return new Date(milliseconds - (milliseconds % intervalMs));
}

async function loadPair(txDb: any, pairAddress: string): Promise<PairRow | null> {
  const rows = await txDb.select().from(schema.pairs).where(eq(schema.pairs.pairAddress, pairAddress)).limit(1);
  return rows[0] ?? null;
}

async function loadFactory(txDb: any, factoryAddress: string) {
  const rows = await txDb
    .select()
    .from(schema.factories)
    .where(eq(schema.factories.factoryAddress, factoryAddress))
    .limit(1);
  return rows[0] ?? null;
}

async function applyPairLpBalanceDelta(
  txDb: any,
  pairAddress: string,
  ownerAddress: string,
  delta: bigint,
  updatedAt: Date,
) {
  if (delta === 0n || isZeroLikeAddress(ownerAddress)) {
    return;
  }

  const balanceRow = await loadPairLpBalance(txDb, pairAddress, ownerAddress);
  const currentBalance = BigInt(balanceRow?.balance ?? "0");
  const nextBalance = currentBalance + delta;

  if (nextBalance < 0n) {
    throw new Error(
      `LP balance for ${ownerAddress} on ${pairAddress} became negative; exact LP positions require full transfer history`,
    );
  }

  if (balanceRow) {
    await txDb
      .update(schema.pairLpBalances)
      .set({
        balance: nextBalance.toString(),
        updatedAt,
      })
      .where(
        and(eq(schema.pairLpBalances.pairAddress, pairAddress), eq(schema.pairLpBalances.ownerAddress, ownerAddress)),
      );
    return;
  }

  await txDb.insert(schema.pairLpBalances).values({
    id: buildPairLpBalanceId(pairAddress, ownerAddress),
    pairAddress,
    ownerAddress,
    balance: nextBalance.toString(),
    updatedAt,
  });
}

async function applyPairTotalSupplyDelta(
  txDb: any,
  pair: PairRow,
  fromAddress: string,
  toAddress: string,
  amount: bigint,
  updatedAt: Date,
) {
  const supplyDelta = calculateSupplyDeltaFromTransfer(fromAddress, toAddress, amount);

  if (supplyDelta === 0n) {
    return;
  }

  const currentPair = (await loadPair(txDb, pair.pairAddress)) ?? pair;
  const nextTotalSupply = BigInt(currentPair.totalLpSupply) + supplyDelta;

  if (nextTotalSupply < 0n) {
    throw new Error(`LP total supply for ${pair.pairAddress} became negative while indexing transfer history`);
  }

  await txDb
    .update(schema.pairs)
    .set({
      totalLpSupply: nextTotalSupply.toString(),
      updatedAt,
    })
    .where(eq(schema.pairs.pairAddress, pair.pairAddress));
}

async function loadPairLpBalance(txDb: any, pairAddress: string, ownerAddress: string) {
  const rows = await txDb
    .select()
    .from(schema.pairLpBalances)
    .where(
      and(eq(schema.pairLpBalances.pairAddress, pairAddress), eq(schema.pairLpBalances.ownerAddress, ownerAddress)),
    )
    .limit(1);
  return rows[0] ?? null;
}

function parseAddressFromKey(event: BlockEvent, keyIndex: number): string {
  return normalizeAddress(event.keys?.[keyIndex] ?? ZERO_ADDRESS);
}

function parseAddressFromData(event: BlockEvent, dataIndex: number): string {
  return normalizeAddress(event.data?.[dataIndex] ?? ZERO_ADDRESS);
}

function parseU256(data: string[], offset: number): bigint {
  const low = BigInt(data[offset] ?? "0x0");
  const high = BigInt(data[offset + 1] ?? "0x0");
  return low + (high << 128n);
}

function calculateSupplyDeltaFromTransfer(fromAddress: string, toAddress: string, amount: bigint): bigint {
  if (isZeroLikeAddress(fromAddress) && !isZeroLikeAddress(toAddress)) {
    return amount;
  }

  if (!isZeroLikeAddress(fromAddress) && isZeroLikeAddress(toAddress)) {
    return -amount;
  }

  return 0n;
}

function buildHistoryId(pairAddress: string, txHash: string, eventIndex: number): string {
  return `${pairAddress}:${txHash}:${eventIndex}`;
}

function buildPairLpBalanceId(pairAddress: string, ownerAddress: string): string {
  return `${pairAddress}:${ownerAddress}`;
}

function resolveInitiatorAddress(event: BlockEvent): string {
  return normalizeAddress(event.transaction?.senderAddress ?? ZERO_ADDRESS);
}

function normalizeAddress(value: string): string {
  if (!value.startsWith("0x")) {
    return ZERO_ADDRESS;
  }

  return `0x${value.slice(2).replace(/^0+/, "").toLowerCase() || "0"}`;
}

function isZeroLikeAddress(value: string): boolean {
  return normalizeAddress(value) === ZERO_ADDRESS;
}

function computeSpotPrice(reserve0: string, reserve1: string): number {
  const base = BigInt(reserve0);
  const quote = BigInt(reserve1);

  if (base === 0n || quote === 0n) {
    return 0;
  }

  return Number(quote) / Number(base);
}
