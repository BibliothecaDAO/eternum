import { describe, expect, it } from "vitest";

import {
  isRevertedPayment,
  isSettledPayment,
  lordsPaidBy,
} from "./lords-payment";

const TOKEN =
  "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";
const TREASURY = "0x7a";
const PAYER = "0xb0b";
const TRANSFER =
  "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9";
const WEI = 2_750n * 10n ** 18n;
const low = (wei: bigint) => `0x${(wei & ((1n << 128n) - 1n)).toString(16)}`;
const high = (wei: bigint) => `0x${(wei >> 128n).toString(16)}`;

const keyedTransfer = (
  from: string,
  to: string,
  wei: bigint,
  token = TOKEN,
) => ({
  from_address: token,
  keys: [TRANSFER, from, to],
  data: [low(wei), high(wei)],
});
const dataTransfer = (from: string, to: string, wei: bigint) => ({
  from_address: TOKEN,
  keys: [TRANSFER],
  data: [from, to, low(wei), high(wei)],
});
const receipt = (events: ReturnType<typeof keyedTransfer>[]) => ({
  execution_status: "SUCCEEDED",
  finality_status: "ACCEPTED_ON_L2",
  events,
});
const paid = (events: ReturnType<typeof keyedTransfer>[]) =>
  lordsPaidBy(receipt(events), {
    token: TOKEN,
    treasury: TREASURY,
    payers: [PAYER],
  });

describe("a LORDS payment", () => {
  it("counts the payer's transfers of the token to the treasury, in either event layout", () => {
    expect(paid([keyedTransfer(PAYER, TREASURY, WEI)])).toBe(WEI);
    expect(paid([dataTransfer(PAYER, TREASURY, WEI)])).toBe(WEI);
    expect(
      paid([
        keyedTransfer(PAYER, TREASURY, WEI),
        keyedTransfer(PAYER, TREASURY, 1n),
      ]),
    ).toBe(WEI + 1n);
  });

  it("counts nothing sent by another wallet, to another address or in another token", () => {
    expect(paid([keyedTransfer("0xe5e", TREASURY, WEI)])).toBe(0n);
    expect(paid([keyedTransfer(PAYER, "0x99", WEI)])).toBe(0n);
    expect(paid([keyedTransfer(PAYER, TREASURY, WEI, "0x5")])).toBe(0n);
    expect(
      paid([
        {
          from_address: TOKEN,
          keys: ["0x1", PAYER, TREASURY],
          data: [low(WEI), high(WEI)],
        },
      ]),
    ).toBe(0n);
  });

  it("is settled once it succeeded and was accepted on L2 or L1, and refused once it reverted", () => {
    expect(isSettledPayment(receipt([]))).toBe(true);
    expect(
      isSettledPayment({ ...receipt([]), finality_status: "ACCEPTED_ON_L1" }),
    ).toBe(true);
    expect(
      isSettledPayment({ ...receipt([]), finality_status: "RECEIVED" }),
    ).toBe(false);
    expect(
      isSettledPayment({ ...receipt([]), execution_status: "REVERTED" }),
    ).toBe(false);
    expect(
      isRevertedPayment({ ...receipt([]), execution_status: "REVERTED" }),
    ).toBe(true);
    expect(isRevertedPayment(receipt([]))).toBe(false);
  });
});
