import { getSelector } from "@apibara/starknet";
import { EVENT_NAME } from "../src/abi";

const U128_MASK = (1n << 128n) - 1n;

function hex(value: bigint): `0x${string}` {
  return `0x${value.toString(16)}` as const;
}

function encodeU256(value: bigint): [`0x${string}`, `0x${string}`] {
  return [hex(value & U128_MASK), hex(value >> 128n)];
}

interface BuildEventParams {
  address: `0x${string}`;
  data: Array<`0x${string}`>;
  eventIndex?: number;
  keys: Array<`0x${string}`>;
  transactionHash?: `0x${string}`;
}

function buildEvent(params: BuildEventParams) {
  return {
    address: params.address,
    data: params.data,
    eventIndex: params.eventIndex ?? 0,
    eventIndexInTransaction: params.eventIndex ?? 0,
    filterIds: [],
    keys: params.keys,
    transactionHash: params.transactionHash ?? "0xabc",
    transactionIndex: 0,
    transactionStatus: "succeeded" as const,
  };
}

export function buildBlock(events: any[], blockNumber = 1n, timestamp = new Date("2025-01-01T00:00:00.000Z")) {
  return {
    events,
    header: {
      blockNumber,
      timestamp,
    },
  };
}

export function buildPoolCreatedEvent(params: {
  address: `0x${string}`;
  lpFeeDenom: bigint;
  lpFeeNum: bigint;
  lpToken: `0x${string}`;
  protocolFeeDenom: bigint;
  protocolFeeNum: bigint;
  token: `0x${string}`;
  eventIndex?: number;
}) {
  return buildEvent({
    address: params.address,
    eventIndex: params.eventIndex,
    keys: [getSelector("PoolCreated") as `0x${string}`, params.token],
    data: [
      params.lpToken,
      ...encodeU256(params.lpFeeNum),
      ...encodeU256(params.lpFeeDenom),
      ...encodeU256(params.protocolFeeNum),
      ...encodeU256(params.protocolFeeDenom),
    ],
  });
}

export function buildLiquidityAddedEvent(params: {
  address: `0x${string}`;
  lordsAmount: bigint;
  lpMinted: bigint;
  provider: `0x${string}`;
  token: `0x${string}`;
  tokenAmount: bigint;
  eventIndex?: number;
}) {
  return buildEvent({
    address: params.address,
    eventIndex: params.eventIndex,
    keys: [getSelector("LiquidityAdded") as `0x${string}`, params.token, params.provider],
    data: [...encodeU256(params.lordsAmount), ...encodeU256(params.tokenAmount), ...encodeU256(params.lpMinted)],
  });
}

export function buildLiquidityRemovedEvent(params: {
  address: `0x${string}`;
  lordsAmount: bigint;
  lpBurned: bigint;
  provider: `0x${string}`;
  token: `0x${string}`;
  tokenAmount: bigint;
  eventIndex?: number;
}) {
  return buildEvent({
    address: params.address,
    eventIndex: params.eventIndex,
    keys: [getSelector("LiquidityRemoved") as `0x${string}`, params.token, params.provider],
    data: [...encodeU256(params.lordsAmount), ...encodeU256(params.tokenAmount), ...encodeU256(params.lpBurned)],
  });
}

export function buildSwapEvent(params: {
  address: `0x${string}`;
  amountIn: bigint;
  amountOut: bigint;
  protocolFee: bigint;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  user: `0x${string}`;
  eventIndex?: number;
}) {
  return buildEvent({
    address: params.address,
    eventIndex: params.eventIndex,
    keys: [getSelector("Swap") as `0x${string}`, params.user],
    data: [
      params.tokenIn,
      params.tokenOut,
      ...encodeU256(params.amountIn),
      ...encodeU256(params.amountOut),
      ...encodeU256(params.protocolFee),
    ],
  });
}

export function buildPoolFeeChangedEvent(params: {
  address: `0x${string}`;
  lpFeeDenom: bigint;
  lpFeeNum: bigint;
  protocolFeeDenom: bigint;
  protocolFeeNum: bigint;
  token: `0x${string}`;
  eventIndex?: number;
}) {
  return buildEvent({
    address: params.address,
    eventIndex: params.eventIndex,
    keys: [getSelector("PoolFeeChanged") as `0x${string}`, params.token],
    data: [
      ...encodeU256(params.lpFeeNum),
      ...encodeU256(params.lpFeeDenom),
      ...encodeU256(params.protocolFeeNum),
      ...encodeU256(params.protocolFeeDenom),
    ],
  });
}
