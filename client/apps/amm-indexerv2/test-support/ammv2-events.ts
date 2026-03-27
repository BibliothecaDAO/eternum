import { getSelector } from "@apibara/starknet";

const U128_MASK = (1n << 128n) - 1n;

function hex(value: bigint): `0x${string}` {
  return `0x${value.toString(16)}` as const;
}

function encodeU256(value: bigint): [`0x${string}`, `0x${string}`] {
  return [hex(value & U128_MASK), hex(value >> 128n)];
}

function buildEvent(params: {
  address: `0x${string}`;
  keys: Array<`0x${string}`>;
  data: Array<`0x${string}`>;
  eventIndex?: number;
  transactionHash?: `0x${string}`;
  transactionSender?: `0x${string}`;
}) {
  return {
    address: params.address,
    data: params.data,
    eventIndex: params.eventIndex ?? 0,
    eventIndexInTransaction: params.eventIndex ?? 0,
    filterIds: [],
    keys: params.keys,
    transaction: {
      senderAddress: params.transactionSender ?? "0x0",
    },
    transactionHash: params.transactionHash ?? "0xabc",
    transactionIndex: 0,
    transactionStatus: "succeeded" as const,
  };
}

export function buildBlock(events: any[], blockNumber = 1n, timestamp = new Date("2026-03-26T00:00:00.000Z")) {
  return {
    events,
    header: {
      blockNumber,
      timestamp,
    },
  };
}

export function buildPairCreatedEvent(params: {
  address: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  pair: `0x${string}`;
  totalPairs: bigint;
  eventIndex?: number;
  transactionHash?: `0x${string}`;
}) {
  return buildEvent({
    address: params.address,
    keys: [getSelector("PairCreated") as `0x${string}`, params.token0, params.token1],
    data: [params.pair, hex(params.totalPairs)],
    eventIndex: params.eventIndex,
    transactionHash: params.transactionHash,
  });
}

export function buildFeeAmountChangedEvent(params: {
  address: `0x${string}`;
  oldFeeAmount: bigint;
  newFeeAmount: bigint;
  eventIndex?: number;
  transactionHash?: `0x${string}`;
}) {
  return buildEvent({
    address: params.address,
    keys: [getSelector("FeeAmountChanged") as `0x${string}`],
    data: [...encodeU256(params.oldFeeAmount), ...encodeU256(params.newFeeAmount)],
    eventIndex: params.eventIndex,
    transactionHash: params.transactionHash,
  });
}

function buildFeeToChangedEvent(params: {
  address: `0x${string}`;
  oldFeeTo: `0x${string}`;
  newFeeTo: `0x${string}`;
  eventIndex?: number;
  transactionHash?: `0x${string}`;
}) {
  return buildEvent({
    address: params.address,
    keys: [getSelector("FeeToChanged") as `0x${string}`],
    data: [params.oldFeeTo, params.newFeeTo],
    eventIndex: params.eventIndex,
    transactionHash: params.transactionHash,
  });
}

export function buildTransferEvent(params: {
  address: `0x${string}`;
  from: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
  eventIndex?: number;
  transactionHash?: `0x${string}`;
}) {
  return buildEvent({
    address: params.address,
    keys: [getSelector("Transfer") as `0x${string}`, params.from, params.to],
    data: [...encodeU256(params.amount)],
    eventIndex: params.eventIndex,
    transactionHash: params.transactionHash,
  });
}

export function buildSyncEvent(params: {
  address: `0x${string}`;
  reserve0: bigint;
  reserve1: bigint;
  eventIndex?: number;
  transactionHash?: `0x${string}`;
}) {
  return buildEvent({
    address: params.address,
    keys: [getSelector("Sync") as `0x${string}`],
    data: [...encodeU256(params.reserve0), ...encodeU256(params.reserve1)],
    eventIndex: params.eventIndex,
    transactionHash: params.transactionHash,
  });
}

export function buildMintEvent(params: {
  address: `0x${string}`;
  sender: `0x${string}`;
  amount0: bigint;
  amount1: bigint;
  transactionSender: `0x${string}`;
  eventIndex?: number;
  transactionHash?: `0x${string}`;
}) {
  return buildEvent({
    address: params.address,
    keys: [getSelector("Mint") as `0x${string}`, params.sender],
    data: [...encodeU256(params.amount0), ...encodeU256(params.amount1)],
    eventIndex: params.eventIndex,
    transactionHash: params.transactionHash,
    transactionSender: params.transactionSender,
  });
}

export function buildBurnEvent(params: {
  address: `0x${string}`;
  sender: `0x${string}`;
  to: `0x${string}`;
  amount0: bigint;
  amount1: bigint;
  transactionSender: `0x${string}`;
  eventIndex?: number;
  transactionHash?: `0x${string}`;
}) {
  return buildEvent({
    address: params.address,
    keys: [getSelector("Burn") as `0x${string}`, params.sender, params.to],
    data: [...encodeU256(params.amount0), ...encodeU256(params.amount1)],
    eventIndex: params.eventIndex,
    transactionHash: params.transactionHash,
    transactionSender: params.transactionSender,
  });
}

export function buildSwapEvent(params: {
  address: `0x${string}`;
  sender: `0x${string}`;
  to: `0x${string}`;
  amount0In: bigint;
  amount1In: bigint;
  amount0Out: bigint;
  amount1Out: bigint;
  transactionSender: `0x${string}`;
  eventIndex?: number;
  transactionHash?: `0x${string}`;
}) {
  return buildEvent({
    address: params.address,
    keys: [getSelector("Swap") as `0x${string}`, params.sender, params.to],
    data: [
      ...encodeU256(params.amount0In),
      ...encodeU256(params.amount1In),
      ...encodeU256(params.amount0Out),
      ...encodeU256(params.amount1Out),
    ],
    eventIndex: params.eventIndex,
    transactionHash: params.transactionHash,
    transactionSender: params.transactionSender,
  });
}
