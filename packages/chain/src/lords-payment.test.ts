import { describe, expect, it } from "vitest";

import avnuSwap from "./fixtures/avnu-swap-receipt.json";
import lordsTransfer from "./fixtures/lords-transfer-receipt.json";
import {
  isRevertedPayment,
  isSettledPayment,
  lordsPaidBy,
  lordsSplitPaidBy,
  splitLordsPayment,
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

describe("a LORDS payment read from mainnet receipts", () => {
  const SENDER =
    "0x20a813da9f67b4b5407c49ffd0f69b861b7b5b38f81457365f43fb882a0c0d8";
  const RECEIVER =
    "0x6daa55364a0593f8d5d6adcc2c8e646afb7231c973f4b681d0439980bd85be6";
  const ROUTER =
    "0x4270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f";
  const RELAYER =
    "0x57130b602e11b30d6e1b82ced26d9ed694702a9eb5ee2d960ffad776091d5b1";
  const BUYER =
    "0x39f0fd8bec01515b543461fb41331cb5e6814c2343439e7f9e9c3dd1159f7c7";
  const BOUGHT = 0x34b8a597f7fcd8a6fn;

  it("counts a wallet's plain transfer, settled on L1", () => {
    expect(isSettledPayment(lordsTransfer)).toBe(true);
    expect(
      lordsPaidBy(lordsTransfer, {
        token: TOKEN,
        treasury: RECEIVER,
        payers: [SENDER],
      }),
    ).toBe(0x80d968f9c3eb0f330n);
    expect(
      lordsPaidBy(lordsTransfer, {
        token: TOKEN,
        treasury: RECEIVER,
        payers: [RECEIVER],
      }),
    ).toBe(0n);
  });

  it("counts none of the LORDS an AVNU swap's router sends, whoever relayed or received the swap", () => {
    expect(isSettledPayment(avnuSwap)).toBe(true);
    for (const payer of [BUYER, RELAYER])
      expect(
        lordsPaidBy(avnuSwap, {
          token: TOKEN,
          treasury: BUYER,
          payers: [payer],
        }),
      ).toBe(0n);
    expect(
      lordsPaidBy(avnuSwap, {
        token: TOKEN,
        treasury: BUYER,
        payers: [ROUTER],
      }),
    ).toBe(BOUGHT);
  });

  it("counts the transfer a buyer adds after that swap, built here onto the real receipt", () => {
    const swappedThenSent = {
      ...avnuSwap,
      events: [...avnuSwap.events, dataTransfer(BUYER, TREASURY, BOUGHT)],
    };
    expect(
      lordsPaidBy(swappedThenSent, {
        token: TOKEN,
        treasury: TREASURY,
        payers: [BUYER],
      }),
    ).toBe(BOUGHT);
  });
});

describe("Starknet 5% veLords / 95% treasury split", () => {
  const VELORDS =
    "0x91b13b83e5c34112aa066a844d4cbe6af99b3d134293829ca1730ea4869a71";

  it("splits any LORDS wei amount with exact 5% veLords and exact sum equal to lordsWei", () => {
    for (const total of [
      0n,
      1n,
      19n,
      20n,
      100n,
      275n * 10n ** 18n,
      2_750n * 10n ** 18n,
      999_999_999_999_999_999n,
    ]) {
      const split = splitLordsPayment(total);
      expect(split.treasuryWei + split.veLordsWei).toBe(total);
      expect(split.veLordsWei).toBe((total * 500n) / 10_000n);
    }
    expect(() => splitLordsPayment(-1n)).toThrow("non-negative");
  });

  it("reads both treasury and veLords transfers from the same receipt independently", () => {
    const split = splitLordsPayment(WEI);
    const full = lordsSplitPaidBy(
      receipt([
        keyedTransfer(PAYER, TREASURY, split.treasuryWei),
        keyedTransfer(PAYER, VELORDS, split.veLordsWei),
      ]),
      { token: TOKEN, treasury: TREASURY, veLords: VELORDS, payers: [PAYER] },
    );
    expect(full).toEqual({
      treasuryWei: split.treasuryWei,
      veLordsWei: split.veLordsWei,
      totalWei: WEI,
    });
    const missingVeLords = lordsSplitPaidBy(
      receipt([keyedTransfer(PAYER, TREASURY, WEI)]),
      { token: TOKEN, treasury: TREASURY, veLords: VELORDS, payers: [PAYER] },
    );
    expect(missingVeLords).toEqual({
      treasuryWei: WEI,
      veLordsWei: 0n,
      totalWei: WEI,
    });
  });
});
