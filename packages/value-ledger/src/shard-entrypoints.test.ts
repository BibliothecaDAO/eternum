import { describe, expect, it } from "vitest";
import { ShardOperator } from "./shard";
import { GAME_ENTRYPOINTS } from "./shard-entrypoints";

describe("shard entrypoints", () => {
  it("forwards no Season 0 money write and no authority route", () => {
    const forwarded = GAME_ENTRYPOINTS.map((entry) => entry.name) as string[];
    for (const refused of ["deliver_deposit", "sweep_lords", "authority_call", "initialize_realm_traits"])
      expect(forwarded).not.toContain(refused);
  });

  it("stamps play alone", () => {
    expect(GAME_ENTRYPOINTS.filter((entry) => entry.stamp).map((entry) => entry.name)).toEqual(["play"]);
  });

  it("names each entrypoint once, so two branches adding the same write cannot both keep it", () => {
    const names = GAME_ENTRYPOINTS.map((entry) => entry.name);
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  it("refuses at compile time an administrative write the proxy does not admit", () => {
    // The typecheck (CI's packages/value-ledger typecheck) fails if this ever compiles: the proxy refuses any Games
    // entrypoint missing from GAME_ENTRYPOINTS with "RPC method is not public", as it refused sweep_lords on 11-06.
    const unlisted = (operator: ShardOperator) =>
      // @ts-expect-error not on GAME_ENTRYPOINTS
      operator.admin("not_on_the_proxy_list", {});
    const play = (operator: ShardOperator) =>
      // @ts-expect-error play is stamped by the proxy, never sent as an administrative call
      operator.admin("play", {});
    expect([unlisted, play].every((call) => typeof call === "function")).toBe(true);
  });
});
