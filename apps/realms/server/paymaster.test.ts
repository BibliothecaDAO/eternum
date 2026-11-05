import { WALLET_GAS_TOKEN } from "@realms-world/identity/wallet";
import { afterEach, expect, it, vi } from "vitest";

import { avnuPaymaster, PaymasterRefusedError } from "./paymaster";

const WALLET = "0x4385558e8d2d34d5e80f66228810e228ab34f649480631ed8aa25f1b7ade15e";
const CALLS = [{ contractAddress: WALLET_GAS_TOKEN, entrypoint: "transfer", calldata: ["0x5", "0x64", "0x0"] }];
const TYPED_DATA = { primaryType: "OutsideExecution", domain: {}, message: {}, types: {} };

/** One JSON-RPC request the paymaster sent to AVNU: its method, params and headers. */
interface Sent {
  url: string;
  method: string;
  params: { parameters: { fee_mode: unknown } };
  apiKey: string | null;
}

/** AVNU's endpoint, answering every request with `answer` (a JSON-RPC result or error), recording what it was sent. */
const avnuAnswering = (answer: { result?: unknown; error?: unknown } | Error) => {
  const sent: Sent[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string, init: RequestInit & { body: string }) => {
      const body = JSON.parse(init.body) as { id: number; method: string; params: Sent["params"] };
      sent.push({
        url: input,
        method: body.method,
        params: body.params,
        apiKey: new Headers(init.headers).get("x-paymaster-api-key"),
      });
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve(Response.json({ jsonrpc: "2.0", id: body.id, ...answer }));
    }),
  );
  return sent;
};

const builtInvoke = (feeMode: unknown) => ({
  result: {
    type: "invoke",
    typed_data: TYPED_DATA,
    parameters: { version: "0x1", fee_mode: feeMode, time_bounds: null },
    fee: {
      gas_token_price_in_strk: "0x195a2c4403b22b0",
      estimated_fee_in_strk: "0xc7d713b49da0000",
      estimated_fee_in_gas_token: "0x6d5e1a3a2b8c0000",
      suggested_max_fee_in_strk: "0x1bc16d674ec80000",
      suggested_max_fee_in_gas_token: "0xf3f20b8dfa69d000",
    },
  },
});

afterEach(() => vi.unstubAllGlobals());

it("builds a wallet's send gasless in LORDS with no key, and answers the fee it pays itself", async () => {
  const sent = avnuAnswering(builtInvoke({ mode: "default", gas_token: WALLET_GAS_TOKEN }));
  const built = await avnuPaymaster("our-key").build(WALLET, CALLS, null, "wallet");
  expect(built).toEqual({
    typedData: TYPED_DATA,
    fee: { estimated: "0x6d5e1a3a2b8c0000", max: "0xf3f20b8dfa69d000" },
  });
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({
    url: "https://starknet.paymaster.avnu.fi",
    method: "paymaster_buildTransaction",
    params: { parameters: { fee_mode: { mode: "default", gas_token: WALLET_GAS_TOKEN } } },
    apiKey: null,
  });
});

it("builds and submits a recovery step sponsored with our key, with no fee of the wallet's", async () => {
  const sent = avnuAnswering(builtInvoke({ mode: "sponsored" }));
  const paymaster = avnuPaymaster("our-key");
  expect(paymaster.canSponsor).toBe(true);
  expect(await paymaster.build(WALLET, CALLS, null, "sponsor")).toEqual({ typedData: TYPED_DATA, fee: null });
  const submitted = avnuAnswering({ result: { transaction_hash: "0xabc", tracking_id: "0x1" } });
  expect(await paymaster.execute(WALLET, TYPED_DATA as never, ["0x1"], null, "sponsor")).toBe("0xabc");
  expect(sent[0]).toMatchObject({ params: { parameters: { fee_mode: { mode: "sponsored" } } }, apiKey: "our-key" });
  expect(submitted[0]).toMatchObject({
    method: "paymaster_executeTransaction",
    params: { parameters: { fee_mode: { mode: "sponsored" } } },
    apiKey: "our-key",
  });
});

it("submits a wallet's send gasless, its fee in LORDS, without our key", async () => {
  const sent = avnuAnswering({ result: { transaction_hash: "0xdef", tracking_id: "0x2" } });
  expect(await avnuPaymaster(undefined).execute(WALLET, TYPED_DATA as never, ["0x1"], null, "wallet")).toBe("0xdef");
  expect(sent[0]).toMatchObject({
    method: "paymaster_executeTransaction",
    params: { parameters: { fee_mode: { mode: "default", gas_token: WALLET_GAS_TOKEN } } },
    apiKey: null,
  });
});

it("cannot sponsor without our key, and asks AVNU nothing for a sponsored step", async () => {
  const sent = avnuAnswering(builtInvoke({ mode: "sponsored" }));
  const paymaster = avnuPaymaster(undefined);
  expect(paymaster.canSponsor).toBe(false);
  await expect(paymaster.build(WALLET, CALLS, null, "sponsor")).rejects.toThrow("paymaster_sponsor_key_missing");
  expect(sent).toEqual([]);
});

it("reads AVNU's JSON-RPC refusal of a build or a send as refused, and a lost answer as not refused", async () => {
  // The simulation of a wallet with too little LORDS for its fee, as AVNU answered it on mainnet.
  avnuAnswering({ error: { code: 156, message: "An error occurred (TRANSACTION_EXECUTION_ERROR)" } });
  const paymaster = avnuPaymaster(undefined);
  await expect(paymaster.build(WALLET, CALLS, null, "wallet")).rejects.toBeInstanceOf(PaymasterRefusedError);
  await expect(paymaster.execute(WALLET, TYPED_DATA as never, ["0x1"], null, "wallet")).rejects.toBeInstanceOf(
    PaymasterRefusedError,
  );
  avnuAnswering(new TypeError("fetch failed"));
  const lost = paymaster.execute(WALLET, TYPED_DATA as never, ["0x1"], null, "wallet");
  await expect(lost).rejects.toThrow("fetch failed");
  await expect(lost).rejects.not.toBeInstanceOf(PaymasterRefusedError);
});
