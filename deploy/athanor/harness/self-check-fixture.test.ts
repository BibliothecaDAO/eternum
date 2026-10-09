import { expect, test } from "bun:test";
import { shortString, type Account } from "starknet";
import { encodeNativeCommand } from "@bibliothecadao/provider";
import { getNeighborHexes, StructureType } from "@bibliothecadao/types";
import { nativeTilePackingConstants } from "../../../contracts/l3/world-native/schema/client.gen";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";
import type { NativeCommand } from "../../../contracts/l3/world-native/schema/commands.gen";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { nativePresetForId } from "../../../config/source/native";
import { SELF_CHECK_PRESET_ID } from "../../../config/source/common/native-preset-modes";
import { buildRoutePlan, gameFacts } from "./self-check-fixture";
import { commandForRoute, routeReasons } from "./self-check-routes";
import { assertDomainRefusal } from "./self-check-action";
import { runSelfCheck, type RouteCase } from "./self-check";

const client = (actor: string) =>
  ({ gameId: 7, setup: { store: { inGame: () => [] } }, actor }) as unknown as RouteCase["client"];

test("the default fixture covers every generated dispatch route, with real launcher accounts only for launcher calls", () => {
  const bot = { address: "0x10" } as Account;
  const launcher = { address: "0x20" } as Account;
  const plan = buildRoutePlan(bot, client(bot.address), launcher, client(launcher.address));
  expect(plan).toHaveLength(Object.keys(nativeCommandBits).length);
  expect(new Set<string>(plan.map(({ route }) => route))).toEqual(new Set(Object.keys(nativeCommandBits)));
  for (const step of plan) {
    expect(step.client.gameId).toBe(7);
    expect(step.account.address).toBe(
      ["CreateBanks", "SettleBlitzRoster"].includes(step.route) ? launcher.address : bot.address,
    );
  }
  expect(plan.filter(({ expectedRejection }) => expectedRejection === undefined)).toHaveLength(14);
});

test("all domain probes encode as the actual compiled command enum, with no guessed ABI or omitted variant", () => {
  for (const route of Object.keys(nativeCommandBits) as NativeCommand["kind"][]) {
    const command = commandForRoute(route);
    const calldata = encodeNativeCommand(bindings.commandAbi, command);
    expect(BigInt(calldata[0]!)).toBe(BigInt(Object.keys(nativeCommandBits).indexOf(route)));
  }
});

test("the fixture opens all routes without changing the production Eternum rules or balance", () => {
  const fixture = nativePresetForId(SELF_CHECK_PRESET_ID);
  const production = nativePresetForId(3);
  for (const bit of Object.values(nativeCommandBits)) expect(fixture.commandMask & BigInt(bit)).toBe(BigInt(bit));
  expect(fixture.modeRules).toBe(production.modeRules);
  expect(fixture.entryRule).toBe(production.entryRule);
  expect(fixture.ledger).toEqual(production.ledger);
  expect(production.commandMask).not.toBe(fixture.commandMask);
});

test("an admission revert, wrong refusal reason or internal failure cannot count as a domain route pass", () => {
  const outcome = {
    state: "rejected" as const,
    block: 2,
    reason: "missing explorer",
    statusClass: "GAMEPLAY_REJECTED",
  };
  expect(() => assertDomainRefusal(outcome, "missing explorer")).not.toThrow();
  expect(() => assertDomainRefusal({ ...outcome, statusClass: undefined }, "missing explorer")).toThrow();
  expect(() => assertDomainRefusal({ ...outcome, reason: "command disabled" }, "missing explorer")).toThrow();
  expect(() =>
    assertDomainRefusal(
      { ...outcome, statusClass: shortString.encodeShortString("INVALID_GAMEPLAY_RESULT") },
      "missing explorer",
    ),
  ).toThrow();
  expect(() => assertDomainRefusal({ state: "applied", block: 2 }, "missing explorer")).toThrow();
  expect(routeReasons.SettleBlitzRoster).toBe("not a Blitz game");
});

test("rollback evidence detects changes, creates and deletes while preserving full-width entity IDs", () => {
  let facts = [{ game_id: 7, explorer_id: 9007199254740993n, owner: 1n }];
  const store = {
    inGame: (name: string) => (name === "ExplorerTroops" ? facts : []),
  } as unknown as RouteCase["client"]["setup"]["store"];
  const before = gameFacts(store, 7);
  expect(before).toContain("9007199254740993");
  facts = [{ ...facts[0]!, owner: 2n }];
  expect(gameFacts(store, 7)).not.toBe(before);
  facts = [];
  expect(gameFacts(store, 7)).not.toBe(before);
});

test("exploration accepts a stamped discovery without assuming the army moved, then moves through revealed facts", async () => {
  const bot = { address: "0x10" } as Account;
  const origin = { alt: false, col: 100, row: 100 };
  const neighbors = getNeighborHexes(origin.col, origin.row);
  const target = { ...neighbors[0]!, alt: false };
  const known = { ...neighbors[1]!, alt: false };
  const terrain = BigInt(nativeTilePackingConstants.BIOME_SCALE);
  const facts: Record<string, unknown[]> = {
    Structure: [{ owner: 16n, entity_id: 111n, base: { category: StructureType.Realm } }],
    ExplorerTroops: [{ owner: 111n, explorer_id: 9007199254740993n, troops: { count: 10n } }],
    TileOccupancy: [{ ...origin, entity_id: 9007199254740993n }],
    TileOpt: [
      { ...origin, data: terrain },
      { ...known, data: terrain },
    ],
  };
  const store = { inGame: (model: string) => facts[model] ?? [] } as unknown as RouteCase["client"]["setup"]["store"];
  const ownClient = { ...client(bot.address), setup: { store } } as RouteCase["client"];
  const plan = buildRoutePlan(bot, ownClient, { address: "0x20" } as Account, client("0x20"));
  const explore = plan.find((step) => step.route === "Explore")!;
  expect(await explore.command()).toMatchObject({ kind: "Explore", value: { direction: target.direction } });
  facts.TileOpt!.push({ ...target, data: terrain });
  facts.TileOccupancy!.push({ ...target, entity_id: 112n, is_structure: true });
  expect(() => explore.verify(store)).not.toThrow();
  const move = plan.find((step) => step.route === "Move")!;
  expect(await move.command()).toMatchObject({
    kind: "Move",
    value: { explorer_id: 9007199254740993n, directions: [known.direction] },
  });
  facts.TileOccupancy![0] = { ...known, entity_id: 9007199254740993n };
  expect(() => move.verify(store)).not.toThrow();
  facts.TileOccupancy![0] = { alt: false, col: 300, row: 300, entity_id: 9007199254740993n };
  expect(() => move.verify(store)).toThrow();
});

test("a setup timeout cancels the fixture so later setup cannot keep mutating", async () => {
  let stopped: AbortSignal | undefined;
  const result = await runSelfCheck(
    {
      createThrowawayGame: (signal) => {
        stopped = signal;
        return new Promise(() => {});
      },
    },
    5,
  );
  expect(result.passed).toBe(false);
  expect(stopped?.aborted).toBe(true);
  expect(result.firstFailedRoute).toBe("create_throwaway_game");
});
