import { describe, expect, it } from "vitest";
import { type DecodedEvent, nameCommands, researchStep, shareOf } from "./commands";
import { Counts, usageReport } from "./findings";

const PLAYER = "0x5a";
const OTHER = "0x6b";
const UNIT = 10n ** 9n;
const hex = (value: bigint | number) => `0x${BigInt(value).toString(16)}`;
let block = 0;

/** One transaction's events, each a decoded row or story as usage.ts hands them to nameCommands. */
const tx = (game: number, ...events: Omit<DecodedEvent, "block" | "tx" | "ei">[]): DecodedEvent[] => {
  block += 1;
  return events.map((event, ei) => ({
    ...event,
    key: { game_id: hex(game), ...event.key },
    block,
    tx: `0xt${block}`,
    ei,
  }));
};
const structure = (id: string, owner: string) => ({
  kind: "set" as const,
  model: "Structure",
  key: { entity_id: id },
  value: { owner },
});
const army = (id: string, home: string) => ({
  kind: "set" as const,
  model: "ExplorerTroops",
  key: { explorer_id: id },
  value: { owner: home },
});
const tile = (kind: "set" | "delete", col: number, row: number, entity?: string) => ({
  kind,
  model: "TileOccupancy",
  key: { col: hex(col), row: hex(row), alt: false },
  value: entity ? { entity_id: entity } : undefined,
});
const story = (name: string, body: unknown, owner = PLAYER) => ({
  kind: "event" as const,
  model: "StoryEvent",
  key: { owner: { Some: owner } },
  value: { story: { variant: { [name]: body } } },
});
const balance = (entity: string, resource: number, units: bigint) => ({
  kind: "set" as const,
  model: "ResourceBalance",
  key: { entity_id: entity, resource_type: hex(resource) },
  value: { balance: hex(units * UNIT) },
});
const named = (
  events: DecodedEvent[],
  modes: Record<string, "blitz" | "frontier"> = { "1": "frontier", "2": "blitz", "3": "blitz" },
) => nameCommands(events, modes);

describe("naming a transaction by what it wrote", () => {
  it("names a storyless step to a neighbouring tile a Move by the army's owner", () => {
    const rows = named([
      ...tx(1, structure("0x1", PLAYER), army("0xa", "0x1")),
      ...tx(1, tile("delete", 10, 10), tile("set", 11, 10, "0xa")),
    ]);
    expect(rows.at(-1)).toMatchObject({ command: "Move", mode: "frontier", player: PLAYER });
  });

  it("reads the research row and side from the knowledge bitfield", () => {
    const learn = (learned: bigint) => ({
      kind: "set" as const,
      model: "RealmKnowledge",
      key: { structure_id: "0x1" },
      value: { learned: hex(learned) },
    });
    // Farm tier 1 on the Store side: the tier bit, then side 1 in the first choice slot.
    const rows = named([...tx(1, structure("0x1", PLAYER), learn(0n)), ...tx(1, learn(0x1n + 0x8n))]);
    expect(rows.at(-1)).toMatchObject({
      command: "Research",
      player: PLAYER,
      options: { row: "Farm", tier: 1, side: "Store" },
    });
    expect(researchStep(0n, 0x400000000000n)).toEqual({ row: "Ethereal", tier: 1, side: null });
  });

  it("follows owners per game, since entity ids repeat from one game to the next", () => {
    const rows = named([
      ...tx(2, structure("0x1", PLAYER), army("0xa", "0x1")),
      ...tx(3, structure("0x1", OTHER), army("0xa", "0x1")),
      ...tx(2, tile("delete", 5, 5), tile("set", 5, 6, "0xa")),
    ]);
    expect(rows.at(-1)).toMatchObject({ command: "Move", game: "2", player: PLAYER });
  });

  it("names a fight that also pays Hyperstructure points an Attack", () => {
    const battle = {
      kind: "event" as const,
      model: "BattleEvent",
      key: { attacker_id: "0xa", defender_id: "0x9", attacker_owner: "0x1" },
      value: { winner_id: "0x1", attacker: { player: PLAYER } },
    };
    const rows = named([
      ...tx(2, structure("0x1", PLAYER), army("0xa", "0x1")),
      ...tx(2, battle, { kind: "event", model: "HyperstructurePoints", key: {} }),
    ]);
    expect(rows.at(-1)).toMatchObject({ command: "Attack", options: { target: "structure", won: true } });
  });

  it("tells Automation's production (several outputs) from a manual run (one)", () => {
    const output = (resource: number) => ({
      received_resource_type: hex(resource),
      cost: [{ resource_type: hex(35) }],
    });
    const rows = named([
      ...tx(2, story("ProductionStory", output(2)), story("ProductionStory", output(3))),
      ...tx(2, story("ProductionStory", output(2))),
    ]);
    expect(rows.map((row) => row.options.outputs)).toEqual([2, 1]);
  });

  it("reads a sent amount as the quick share of the holding's balance it equals", () => {
    const send = {
      from_entity_id: "0x1",
      to_entity_id: "0x2",
      resources: [{ resource_type: hex(35), amount: hex(500n * UNIT) }],
    };
    const rows = named(tx(2, story("ResourceTransferStory", send), balance("0x1", 35, 500n)));
    expect(rows[0]).toMatchObject({ command: "Send resources", options: { shares: ["50%"] } });
    expect(shareOf(300n * UNIT, 700n * UNIT)).toBe("typed");
    expect(shareOf(1000n * UNIT, 0n)).toBe("Max");
  });
});

describe("the page's evidence, counted from the named rows", () => {
  it("counts Automation's share of production and the manual runs left", () => {
    const output = { received_resource_type: hex(2), cost: [{ resource_type: hex(35) }] };
    const rows = named([
      ...tx(2, story("ProductionStory", output), story("ProductionStory", output)),
      ...tx(2, story("ProductionStory", output), story("ProductionStory", output)),
      ...tx(2, story("ProductionStory", output, OTHER)),
    ]);
    const report = usageReport(new Counts(rows, [], []), "2026-10-26 09:09 UTC", 100);
    const manual = report.findings.find((finding) => finding.title.startsWith("Manual Production"))!;
    expect(manual.evidence).toBe(
      "Automation sent at least 2 of 3 production commands (67%), for 1 of the 2 players who produced. A manual run carries exactly one output, so manual runs were at most 1.",
    );
  });
});

it("counts demolitions in both formats without treating the old Frontier sample as a choice", () => {
  const demolish = (owner = PLAYER) =>
    story(
      "BuildingPlacementStory",
      {
        change: { variant: { Destroyed: {} } },
        category: hex(1),
      },
      owner,
    );
  const rows = named([...tx(1, demolish()), ...tx(1, demolish()), ...tx(1, demolish(OTHER)), ...tx(2, demolish())]);
  const finding = usageReport(new Counts(rows, [], []), "", 100).findings.find((finding) =>
    finding.title.startsWith("Demolish"),
  )!;
  expect(finding.evidence).toBe(
    "Blitz: 1 demolitions by 1 player. Frontier: 3 demolitions by 2 players. Initial Frontier observations predate its client action; judge its use only on observations after that action ships.",
  );
  expect(finding.where).toBe("Realm view → a building: Demolish in Blitz; Research → Delete → OK in Frontier.");
});

describe("what the page claims about how amounts were chosen", () => {
  it("counts a deploy capped by the army's capacity as an amount with troops left, never as a Max press", () => {
    const deploy = (amount: number, left: number) =>
      story("ExplorerCreateStory", {
        structure_id: "0x1",
        category: { variant: { Knight: {} } },
        tier: { variant: { T1: {} } },
        amount: hex(BigInt(amount) * UNIT),
      });
    const rows = named([
      // Max pressed with 6,000 held where 3,000 fit: 3,000 sent, 3,000 left.
      ...tx(2, deploy(3000, 3000), balance("0x1", 26, 3000n)),
      ...tx(2, deploy(1200, 0), {
        kind: "delete",
        model: "ResourceBalance",
        key: { entity_id: "0x1", resource_type: hex(26) },
      }),
    ]);
    const report = usageReport(new Counts(rows, [], []), "2026-10-26 09:09 UTC", 100);
    expect(report.kept[1]).toBe(
      "Deploy amounts, of 0 / 2 deploys: 0 / 1 sent every troop of their kind, 0 / 1 a multiple of 500 with troops left. Which control set them (Max, +500, the field, the slider) is not recorded.",
    );
  });

  it("calls a send burst what was measured, not one Transfer", () => {
    const send = (to: string) =>
      story("ResourceTransferStory", { from_entity_id: "0x1", to_entity_id: to, resources: [] });
    const rows = named([...tx(2, send("0x2")), ...tx(2, send("0x3"))]);
    expect(usageReport(new Counts(rows, [], []), "", 100).kept[3]).toBe(
      "Sends from one holding to different holdings within three blocks of each other: 1 burst by 1 player, as one multi-destination Transfer would send them; that one Transfer sent each burst is not recorded.",
    );
  });
});
