import type { Call } from "starknet";
import { describe, expect, it } from "vitest";
import { EternumProvider } from "./index";

/**
 * s2 single-world calldata seam: every deployed s2 game-system entrypoint
 * takes `game_id` first, so the provider prepends it to calls targeting the
 * world's contracts — and ONLY those. Token approvals / VRF calls in the same
 * multicall, and legacy worlds (gameId 0), must pass through untouched.
 */

const GAME_CONTRACT = "0x00a1";
const OTHER_GAME_CONTRACT = "0x00b2";
const FEE_TOKEN = "0x0ffe";

const manifest = {
  world: { address: "0x77", abi: [{ type: "interface", name: "IWorld", items: [] }] },
  contracts: [{ address: GAME_CONTRACT }, { address: OTHER_GAME_CONTRACT }],
} as any;

const makeScopedProvider = (gameId: number) =>
  new EternumProvider(manifest, "http://127.0.0.1:1", undefined, undefined, { namespace: "s2_blitz", gameId });

const withGameId = (provider: EternumProvider, details: Call | Call[]) => (provider as any).withGameIdCalldata(details);

describe("EternumProvider s2 game-id calldata seam", () => {
  it("prepends the game id to game-system calls and leaves token calls alone", () => {
    const provider = makeScopedProvider(7);
    const calls: Call[] = [
      { contractAddress: FEE_TOKEN, entrypoint: "approve", calldata: ["0x1", "10", "0"] },
      { contractAddress: GAME_CONTRACT, entrypoint: "explorer_move", calldata: ["42", "3", "0"] },
      { contractAddress: OTHER_GAME_CONTRACT, entrypoint: "level_up", calldata: ["42"] },
    ];

    const scoped = withGameId(provider, calls) as Call[];

    expect(scoped[0].calldata).toEqual(["0x1", "10", "0"]);
    expect(scoped[1].calldata).toEqual(["7", "42", "3", "0"]);
    expect(scoped[2].calldata).toEqual(["7", "42"]);
    // Address matching is normalization-based, not string equality.
    expect(withGameId(provider, { contractAddress: "0xa1", entrypoint: "settle", calldata: [] })).toMatchObject({
      calldata: ["7"],
    });
  });

  it("does not rewrite anything on legacy worlds (gameId 0)", () => {
    const provider = makeScopedProvider(0);
    const call: Call = { contractAddress: GAME_CONTRACT, entrypoint: "explorer_move", calldata: ["42"] };
    expect(withGameId(provider, call)).toBe(call);
  });

  it("exposes the scope namespace with an s1 default", () => {
    expect(makeScopedProvider(7).namespace).toBe("s2_blitz");
    expect(new EternumProvider(manifest, "http://127.0.0.1:1").namespace).toBe("s1_eternum");
  });
});
