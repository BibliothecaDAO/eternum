import { hash } from "starknet";
import type { RpcBlockWithReceipts, RpcHead } from "./types";

interface JsonRpcSuccess<Result> {
  jsonrpc: "2.0";
  id: number;
  result: Result;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: number;
  error: { code: number; message: string; data?: unknown };
}

export class MadaraRpc {
  private requestId = 0;

  constructor(private readonly url: string) {}

  public chainId(): Promise<string> {
    return this.request<string>("starknet_chainId", []);
  }

  public blockNumber(): Promise<number> {
    return this.request<number>("starknet_blockNumber", []);
  }

  /** The pre-confirmed block's header: its timestamp is the sequencer clock a transaction executes against. */
  public getPreconfirmedHeader(): Promise<RpcHead> {
    return this.request<RpcHead>("starknet_getBlockWithTxHashes", ["pre_confirmed"]);
  }

  public getBlockWithReceipts(block: number | "pre_confirmed"): Promise<RpcBlockWithReceipts> {
    return this.request<RpcBlockWithReceipts>("starknet_getBlockWithReceipts", [
      typeof block === "number" ? { block_number: block } : block,
    ]);
  }

  /** A read-only contract call at a confirmed block, returning its serialized result. */
  public call(contractAddress: string, entrypoint: string, calldata: string[], block: number): Promise<string[]> {
    return this.request<string[]>("starknet_call", [
      { contract_address: contractAddress, entry_point_selector: hash.getSelectorFromName(entrypoint), calldata },
      { block_number: block },
    ]);
  }

  private async request<Result>(method: string, params: unknown[]): Promise<Result> {
    const id = ++this.requestId;
    const response = await fetch(this.url, {
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) throw new Error(`Madara ${method} returned HTTP ${response.status}`);

    const payload = (await response.json()) as JsonRpcSuccess<Result> | JsonRpcFailure;
    if ("error" in payload) {
      const data = payload.error.data === undefined ? "" : `: ${JSON.stringify(payload.error.data)}`;
      throw new Error(`Madara ${method} failed (${payload.error.code}): ${payload.error.message}${data}`);
    }
    return payload.result;
  }
}
