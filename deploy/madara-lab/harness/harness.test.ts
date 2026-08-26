import { describe, expect, it } from "bun:test";
import { mapWithConcurrency } from "./account-factory";
import {
  chooseOutwardDirection,
  millisecondsUntilNextArmyTick,
  neighbor,
  oppositeDirection,
  parseStructureIds,
  prioritizeExplorer,
  resolveActionKind,
} from "./driver";
import { percentile, summarizeMix } from "./report";
import { parseHarnessArgs } from "./run";
import { ToriiObserver } from "./torii-observer";

describe("Madara harness workload", () => {
  it("produces the exact 50/30/20 mix over the acceptance run", () => {
    const actions = Array.from({ length: 40 }, (_, tick) => ({ kind: resolveActionKind(tick) }));
    expect(summarizeMix(actions)).toEqual({ move: 20, explore: 12, produce: 8 });
  });

  it("parses the Torii settlement encodings seen across versions", () => {
    expect(parseStructureIds("[2,5,8]")).toEqual(["2", "5", "8"]);
    expect(parseStructureIds("0x2, 0x5, 8")).toEqual(["2", "5", "8"]);
  });

  it("keeps the first route step pointed away from map center", () => {
    expect(chooseOutwardDirection({ x: 110, y: 100 }, { x: 100, y: 100 })).toBe(0);
    expect(neighbor({ x: 110, y: 100 }, 0)).toEqual({ x: 111, y: 100 });
    expect(oppositeDirection(0)).toBe(3);
    expect(oppositeDirection(5)).toBe(2);
  });

  it("waits through the next complete army tick", () => {
    expect(millisecondsUntilNextArmyTick(Date.UTC(2026, 7, 25, 12, 0, 0))).toBe(61_000);
    expect(millisecondsUntilNextArmyTick(Date.UTC(2026, 7, 25, 12, 0, 59))).toBe(2_000);
  });

  it("keeps an explorer at the frontier throughout the acceptance workload", () => {
    const explorers = [0, 1, 2].map((id) => ({ atFrontier: true, id, lastUsedAt: -1 }));

    for (let tick = 0; tick < 40; tick += 1) {
      const kind = resolveActionKind(tick);
      if (kind === "produce") continue;

      const candidates = kind === "explore" ? explorers.filter(({ atFrontier }) => atFrontier) : explorers;
      const selected = prioritizeExplorer(candidates, kind);
      expect(selected, `tick ${tick.toString()} ${kind}`).toBeDefined();
      selected!.lastUsedAt = tick;
      if (kind === "move") selected!.atFrontier = !selected!.atFrontier;
    }
  });
});

describe("Madara harness reporting", () => {
  it("uses nearest-rank percentiles", () => {
    expect(percentile([5, 1, 4, 2, 3], 50)).toBe(3);
    expect(percentile([5, 1, 4, 2, 3], 95)).toBe(5);
    expect(percentile([], 95)).toBeNull();
  });
});

describe("Madara harness Torii observer", () => {
  it("batches concurrent transaction and explorer observations", async () => {
    let requests = 0;
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        requests += 1;
        const query = new URL(request.url).searchParams.get("query") ?? "";
        if (query.includes("FROM transactions")) {
          return Response.json([
            { transaction_hash: "0x1", source: "transactions" },
            { transaction_hash: "0x1", source: "events" },
            { transaction_hash: "0x2", source: "transactions" },
            { transaction_hash: "0x2", source: "events" },
          ]);
        }
        return Response.json([
          explorerRow("11", "event-11"),
          explorerRow("12", "event-12"),
        ]);
      },
    });

    try {
      const observer = new ToriiObserver(`http://127.0.0.1:${server.port}`, 5);
      const observations = await Promise.all([
        observer.waitForTransaction("0x1", 1_000),
        observer.waitForTransaction("0x2", 1_000),
        observer.waitForExplorer(7, "11", "previous-11", 1_000),
        observer.waitForExplorer(7, "12", "previous-12", 1_000),
      ]);

      expect(observations[0]).toMatchObject({
        eventIndexedAt: expect.any(Number),
        transactionIndexedAt: expect.any(Number),
      });
      expect(observations[1]).toMatchObject({
        eventIndexedAt: expect.any(Number),
        transactionIndexedAt: expect.any(Number),
      });
      expect(observations[2]).toMatchObject({ explorerId: "11", eventId: "event-11" });
      expect(observations[3]).toMatchObject({ explorerId: "12", eventId: "event-12" });
      expect(requests).toBe(2);
    } finally {
      server.stop(true);
    }
  });
});

describe("Madara harness CLI and concurrency", () => {
  it("parses an explicit smoke-run configuration", () => {
    expect(
      parseHarnessArgs([
        "--bots",
        "4",
        "--minutes",
        "0.5",
        "--interval-seconds",
        "5",
        "--game-id",
        "9",
      ]),
    ).toMatchObject({ bots: 4, minutes: 0.5, intervalSeconds: 5, gameId: 9, gameName: "game-9" });
  });

  it("preserves input order while bounding concurrent work", async () => {
    let active = 0;
    let maximumActive = 0;
    const result = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Bun.sleep(2);
      active -= 1;
      return value * 2;
    });
    expect(result).toEqual([2, 4, 6, 8]);
    expect(maximumActive).toBe(2);
  });
});

function explorerRow(explorerId: string, eventId: string) {
  return {
    event_id: eventId,
    explorer_id: explorerId,
    owner: explorerId,
    stamina: "120",
    stamina_tick: "1",
    x: 1,
    y: 2,
  };
}
