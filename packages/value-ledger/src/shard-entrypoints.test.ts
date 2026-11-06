import { describe, expect, it } from "vitest";
import { ShardOperator } from "./shard";
import { GAME_ENTRYPOINTS } from "./shard-entrypoints";

describe("shard entrypoints", () => {
  it("lists the Frontier close's sweep beside its prize writes", () => {
    const admin = GAME_ENTRYPOINTS.filter((entry) => !entry.stamp).map((entry) => entry.name);
    expect(admin).toEqual(expect.arrayContaining(["publish_frontier_pool", "award_frontier_prize", "sweep_lords"]));
  });

  it("refuses at compile time an administrative write the proxy does not admit", () => {
    // The typecheck (CI's packages/value-ledger typecheck) fails if this ever compiles: the proxy refuses any Games
    // entrypoint missing from GAME_ENTRYPOINTS with "RPC method is not public", as it refused sweep_lords on 11-06.
    const unlisted = (operator: ShardOperator) =>
      // @ts-expect-error not on GAME_ENTRYPOINTS
      operator.admin("not_on_the_proxy_list", {});
    const play = (operator: ShardOperator, nonce: bigint) =>
      // @ts-expect-error play is stamped by the proxy, never sent as an administrative call
      operator.sendAdmin("play", {}, nonce);
    expect([unlisted, play].every((call) => typeof call === "function")).toBe(true);
  });
});
