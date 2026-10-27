/**
 * Every game transaction named by the command that sent it, with the options it used, its game and its player.
 *
 * A transaction body is not public on prod's RPC, so a command is recognised by what it wrote: its story when it has
 * one, else its row writes (a Move vacates one tile and occupies a neighbour; Research rewrites RealmKnowledge; a Shrine
 * vacates a site and grants XP). Entity ids repeat from one game to the next, so ownership is followed per game.
 */

/** One decoded Games event, its values as JSON (felts as hex strings, enums as `{ variant: { Name: … } }`). */
export interface DecodedEvent {
  block: number;
  tx: string;
  ei: number;
  kind: "set" | "update-member" | "delete" | "event";
  model: string;
  member?: string;
  key: Record<string, any>;
  value?: any;
}
export type Mode = "blitz" | "frontier" | "eternum";
type Share = "Max" | "75%" | "50%" | "25%" | "typed";
export interface CommandRow {
  tx: string;
  block: number;
  game: string | null;
  mode: Mode | null;
  command: string;
  options: Record<string, any>;
  player: string | null;
}

const UNIT = 10n ** 9n;
const LABOR = 23;
const DONKEY = 25;
const TROOPS = ["Knight", "Crossbowman", "Paladin"];
const TIERS = ["T1", "T2", "T3"];
const RESEARCH_ROWS = [
  "Farm",
  "Workshop",
  "Barracks",
  "Hut",
  "War Hall",
  "Supply Yard",
  "Scouts' Lodge",
  "Hearth",
  "Shrine",
  "Well",
  "Ethereal",
];
const RESEARCH_SIDES: Record<number, string[]> = {
  0: ["Make", "Store"],
  1: ["Make", "Store"],
  2: ["Drill", "Rations"],
  6: ["Camps", "Rifts", "Beasts"],
};
// research.cairo: each row's tier slot and, where it has sides, its choice slot (scale, size).
const TIER_SLOT: [bigint, bigint][] = [
  [0x1n, 8n],
  [0x80n, 8n],
  [0x4000n, 8n],
  [0x200000n, 8n],
  [0x1000000n, 8n],
  [0x8000000n, 8n],
  [0x40000000n, 8n],
  [0x200000000n, 8n],
  [0x100000000000n, 2n],
  [0x200000000000n, 2n],
  [0x400000000000n, 4n],
];
const CHOICE_SLOT: Record<number, [bigint, bigint]> = {
  0: [0x8n, 2n],
  1: [0x400n, 2n],
  2: [0x20000n, 2n],
  6: [0x1000000000n, 4n],
};
const BUILDING_CHANGE: Record<string, string> = {
  Created: "Build",
  Destroyed: "Demolish building",
  Paused: "Pause building",
  Resumed: "Resume building",
};

const big = (value: unknown) => BigInt(value as string);
const small = (value: unknown) => Number(BigInt(value as string));
const variantOf = (value: any): string => Object.keys(value.variant)[0];
const address = (value: unknown) => (value === null || value === undefined ? null : `0x${big(value).toString(16)}`);

/** Who owns each structure and army in one game, followed in chain order. */
class Owners {
  private structures = new Map<string, string>();
  private armies = new Map<string, string>();
  learn(event: DecodedEvent) {
    if (event.model === "Structure" && event.kind === "set")
      this.structures.set(event.key.entity_id, event.value.owner);
    if (event.model === "Structure" && event.member === "owner") this.structures.set(event.key.entity_id, event.value);
    if (event.model === "ExplorerTroops" && event.kind === "set")
      this.armies.set(event.key.explorer_id, event.value.owner);
  }
  isArmy = (id: string) => this.armies.has(id);
  ofStructure = (id: string | undefined) => (id === undefined ? null : (this.structures.get(id) ?? null));
  ofArmy = (id: string | undefined) => (id === undefined ? null : this.ofStructure(this.armies.get(id)));
}

interface Story {
  name: string;
  body: any;
  event: DecodedEvent;
}

/** One transaction's events, read the ways its command is recognised. */
class Transaction {
  readonly stories: Story[];
  readonly writes: DecodedEvent[];
  constructor(readonly events: DecodedEvent[]) {
    this.stories = events
      .filter((event) => event.kind === "event")
      .map((event) => {
        if (event.model !== "StoryEvent") return { name: event.model, body: event.value, event };
        const name = variantOf(event.value.story);
        return { name, body: event.value.story.variant[name], event };
      });
    this.writes = events.filter((event) => event.kind !== "event");
  }
  has = (name: string) => this.stories.some((story) => story.name === name);
  story = (name: string) => this.stories.find((story) => story.name === name)!.body;
  storiesOf = (name: string) => this.stories.filter((story) => story.name === name).map((story) => story.body);
  wrote = (kind: DecodedEvent["kind"], model: string) => this.writes.some((w) => w.kind === kind && w.model === model);
  write = (model: string) => this.writes.find((w) => w.model === model);
  get storyOwner(): string | null {
    const owned = this.stories.find((story) => story.event.model === "StoryEvent" && story.event.key.owner?.Some);
    return owned ? owned.event.key.owner.Some : null;
  }
  /** A resource's balance at a holding after this transaction, in whole units (0 when its row was deleted). */
  balanceAfter(entity: string, resource: number): bigint | undefined {
    const row = this.writes.find(
      (w) => w.model === "ResourceBalance" && w.key.entity_id === entity && small(w.key.resource_type) === resource,
    );
    if (!row) return undefined;
    return row.kind === "delete" ? 0n : big(row.value.balance);
  }
}

/** Names every transaction, in chain order. */
export function nameCommands(events: DecodedEvent[], modes: Record<string, Mode>): CommandRow[] {
  const owners = new Map<string, Owners>();
  const knowledge = new Map<string, Map<string, bigint>>();
  const rows: CommandRow[] = [];
  for (const events_ of groupByTransaction(events)) {
    const game = gameOf(events_);
    const gameOwners = owners.get(game ?? "") ?? new Owners();
    owners.set(game ?? "", gameOwners);
    const gameKnowledge = knowledge.get(game ?? "") ?? new Map<string, bigint>();
    knowledge.set(game ?? "", gameKnowledge);
    events_.forEach((event) => gameOwners.learn(event));
    const mode = game === null ? null : (modes[game] ?? null);
    const [command, options, player] = nameOne(new Transaction(events_), mode, gameOwners, gameKnowledge);
    for (const event of events_)
      if (event.model === "RealmKnowledge" && event.kind === "set")
        gameKnowledge.set(event.key.structure_id, big(event.value.learned));
    rows.push({ tx: events_[0].tx, block: events_[0].block, game, mode, command, options, player: address(player) });
  }
  return rows;
}

/** Events grouped by transaction, in chain order, with a re-read duplicate dropped. */
function groupByTransaction(events: DecodedEvent[]): DecodedEvent[][] {
  const groups = new Map<string, Map<number, DecodedEvent>>();
  for (const event of events) {
    const group = groups.get(event.tx) ?? new Map<number, DecodedEvent>();
    groups.set(event.tx, group);
    group.set(event.ei, event);
  }
  return [...groups.values()].map((group) => [...group.values()].sort((a, b) => a.ei - b.ei));
}

function gameOf(events: DecodedEvent[]): string | null {
  const keyed = events.find((event) => event.key && "game_id" in event.key);
  return keyed ? String(small(keyed.key.game_id)) : null;
}

type Named = [command: string, options: Record<string, any>, player: string | null];

function nameOne(t: Transaction, mode: Mode | null, owners: Owners, knowledge: Map<string, bigint>): Named {
  return (
    nameSystem(t) ??
    nameFight(t, mode, owners) ??
    nameArmy(t, owners) ??
    nameRealm(t) ??
    nameEconomy(t) ??
    nameStoryless(t, owners, knowledge) ?? ["(unclassified)", {}, null]
  );
}

function nameSystem(t: Transaction): Named | null {
  if (t.has("GameplayRejected"))
    return ["(rejected)", { reason: t.story("GameplayRejected").reason }, t.stories[0].event.key.actor];
  const setup = ["GameRegistry", "Preset", "RealmTraits", "BlitzRoster", "GameRelease", "LordsBudget"].some((m) =>
    t.wrote("set", m),
  );
  const playerSet = t.writes.some((w) => w.model === "ArmySlot");
  if (
    t.has("BlitzFinalized") ||
    (t.has("HyperstructurePoints") && !t.has("BattleEvent")) ||
    (t.has("BatchProgress") && !t.has("RealmCreatedStory")) ||
    (setup && !playerSet)
  )
    return ["(system)", {}, null];
  if (t.has("RealmCreatedStory")) return [t.has("BatchProgress") ? "(system)" : "Realm founded", {}, t.storyOwner];
  return null;
}

function nameFight(t: Transaction, mode: Mode | null, owners: Owners): Named | null {
  if (t.has("BattleEvent")) {
    const body = t.story("BattleEvent");
    const key = t.stories.find((story) => story.name === "BattleEvent")!.event.key;
    const defenderIsArmy = owners.isArmy(key.defender_id);
    const target = !owners.isArmy(key.attacker_id)
      ? "guard attacks army"
      : t.has("SitePayout") || (mode === "frontier" && !defenderIsArmy)
        ? "site"
        : defenderIsArmy
          ? "army"
          : "structure";
    const player = big(body.attacker.player) === 0n ? null : body.attacker.player;
    return [
      "Attack",
      { target, won: body.winner_id === key.attacker_owner, captured: t.has("StructureCapturedStory") },
      player,
    ];
  }
  if (t.has("StructureCapturedStory")) return ["Capture (walk-in)", {}, t.storyOwner];
  return null;
}

function nameArmy(t: Transaction, owners: Owners): Named | null {
  const owner = t.storyOwner;
  if (t.has("SkillPointSpent")) {
    const b = t.story("SkillPointSpent");
    return [
      "Army level up",
      { attribute: variantOf(b.attribute), tier: small(b.tier), kind: b.kind?.Some ? variantOf(b.kind.Some) : null },
      owner,
    ];
  }
  if (
    t.has("ExplorationReward") ||
    t.has("SpireDiscovered") ||
    (t.stories.every((s) => s.name === "PointsAwarded") && t.has("PointsAwarded") && t.wrote("set", "TileOpt"))
  ) {
    const explorer = t.write("ExplorerTroops")?.key.explorer_id;
    return ["Explore", { spire: t.has("SpireDiscovered") }, owner ?? owners.ofArmy(explorer)];
  }
  if (t.has("ExplorerCreateStory")) {
    const b = t.story("ExplorerCreateStory");
    const resource = 26 + 3 * TROOPS.indexOf(variantOf(b.category)) + TIERS.indexOf(variantOf(b.tier));
    const left = t.balanceAfter(b.structure_id, resource);
    return [
      "Deploy army",
      {
        troop: variantOf(b.category),
        tier: variantOf(b.tier),
        amount: Number(big(b.amount) / UNIT),
        left: left === undefined ? null : Number(left / UNIT),
      },
      owner,
    ];
  }
  if (t.has("ExplorerAddStory")) return ["Reinforce army", {}, owner];
  if (t.has("ExplorerDeleteStory")) return ["Disband army", {}, owner];
  if (t.has("GuardAddStory")) {
    const b = t.story("GuardAddStory");
    return ["Add guard", { troop: variantOf(b.category), tier: variantOf(b.tier), slot: small(b.slot) }, owner];
  }
  if (t.has("GuardDeleteStory")) return ["Remove guard", {}, owner];
  if (t.has("TroopsTransferred")) {
    const b = t.story("TroopsTransferred");
    const source = variantOf(b.source);
    const emptied = t.writes.some(
      (w) => w.model === "ExplorerTroops" && w.kind === "delete" && w.key.explorer_id === b.source.variant.Explorer,
    );
    return [
      "Transfer troops",
      { from: source, to: variantOf(b.target), whole: source === "Explorer" ? emptied : null },
      owner,
    ];
  }
  if (t.has("RelicChestOpened")) return ["Open relic crate", {}, owner];
  if (t.has("RewardChestOpened")) return ["Open reward chest", {}, owner];
  if (t.has("RelicActivated")) return ["Use relic", { relic: small(t.story("RelicActivated").relic_id) }, owner];
  if (t.has("RelicCrafted")) return ["Craft relic", {}, owner];
  return null;
}

function nameRealm(t: Transaction): Named | null {
  const owner = t.storyOwner;
  if (t.has("BuildingPlacementStory")) {
    const b = t.story("BuildingPlacementStory");
    return [BUILDING_CHANGE[variantOf(b.change)], { building: small(b.category) }, owner];
  }
  if (t.has("StructureLevelUpStory"))
    return ["Level up realm", { level: small(t.story("StructureLevelUpStory").new_level) }, owner];
  if (t.has("ProductionStory")) {
    const outputs = t.storiesOf("ProductionStory");
    const labor = outputs.every((o) => o.cost.length === 1 && small(o.cost[0].resource_type) === LABOR);
    // The Production window sends one output; Automation sends every output it plans in one command.
    return ["Produce", { outputs: outputs.length, inputs: labor ? "labor" : "resources" }, owner];
  }
  return null;
}

function nameEconomy(t: Transaction): Named | null {
  const owner = t.storyOwner;
  if (t.has("ResourceTransferStory")) {
    const sends = t.storiesOf("ResourceTransferStory");
    const shares: Share[] = [];
    for (const send of sends)
      for (const resource of send.resources) {
        const id = small(resource.resource_type);
        const after = t.balanceAfter(send.from_entity_id, id);
        // Donkeys also pay the carry, so their share of the balance says nothing about the button pressed.
        if (after !== undefined && id !== DONKEY) shares.push(shareOf(big(resource.amount), after));
      }
    return [
      "Send resources",
      { from: sends[0].from_entity_id, to: [...new Set(sends.map((s) => s.to_entity_id))].sort(), shares },
      owner,
    ];
  }
  if (t.has("ResourceReceiveArrivalStory")) return ["Offload arrival", {}, owner];
  if (t.has("ResourceBurnStory")) return ["Burn resource", {}, owner];
  if (t.has("LordsWithdrawn")) return ["Withdraw LORDS", {}, owner];
  if (t.has("RaidEvent")) return ["Raid", {}, null];
  for (const name of [
    "TradeCreated",
    "TradeAccepted",
    "TradeCancelled",
    "BankSwap",
    "BankLiquidity",
    "FaithPledged",
    "FaithRemoved",
  ])
    if (t.has(name)) return ["Trade, bank or faith", { story: name }, owner];
  return null;
}

/** A share of the holding's balance within half a unit of a quick-share button, else typed. */
export function shareOf(sent: bigint, after: bigint): Share {
  const before = sent + after;
  const parts: [Share, bigint, bigint][] = [
    ["Max", 1n, 1n],
    ["75%", 3n, 4n],
    ["50%", 1n, 2n],
    ["25%", 1n, 4n],
  ];
  for (const [label, num, den] of parts) {
    const diff = sent * den - before * num;
    if ((diff < 0n ? -diff : diff) * 2n <= UNIT * den) return label;
  }
  return "typed";
}

function nameStoryless(t: Transaction, owners: Owners, knowledge: Map<string, bigint>): Named | null {
  const research = t.writes.find((w) => w.model === "RealmKnowledge" && w.kind === "set");
  if (research) {
    const structure = research.key.structure_id;
    return [
      "Research",
      researchStep(knowledge.get(structure) ?? 0n, big(research.value.learned)),
      owners.ofStructure(structure),
    ];
  }
  const grant = t.write("LaborGrant");
  if (grant) return ["Claim Realm labor", {}, grant.value.account];
  const slot = t.write("ArmySlot");
  if (t.wrote("set", "LordsBudget") && slot)
    return ["Refill stamina (LORDS)", {}, owners.ofStructure(slot.key.structure_id)];
  if (t.wrote("set", "Hyperstructure")) return ["Found hyperstructure", {}, null];
  const vacated = t.writes.filter((w) => w.model === "TileOccupancy" && w.kind === "delete");
  const occupied = t.writes.filter((w) => w.model === "TileOccupancy" && w.kind === "set");
  if (vacated.length && !occupied.length) {
    const progress = t.write("ArmyProgress");
    if (progress) return ["Use Shrine", {}, owners.ofArmy(progress.key.explorer_id)];
    if (slot) return ["Use Well", {}, owners.ofStructure(slot.key.structure_id)];
  }
  if (vacated.length && occupied.length) {
    const [from, to] = [vacated[0].key, occupied[0].key];
    const steps = hexDistance([small(from.col), small(from.row)], [small(to.col), small(to.row)]);
    const command = steps === 0 && from.alt !== to.alt ? "Toggle layer" : steps > 30 ? "Enter depth" : "Move";
    return [command, {}, owners.ofArmy(occupied[0].value.entity_id)];
  }
  return null;
}

/** The row, tier and side one research command learned, from the bitfield before and after. */
export function researchStep(
  before: bigint,
  after: bigint,
): { row: string | null; tier: number | null; side: string | null } {
  const tier = (learned: bigint, row: number) => Number((learned / TIER_SLOT[row][0]) % TIER_SLOT[row][1]);
  for (let row = 0; row < TIER_SLOT.length; row++) {
    const reached = tier(after, row);
    if (reached !== tier(before, row) + 1) continue;
    const choice = CHOICE_SLOT[row];
    const side = choice
      ? RESEARCH_SIDES[row][Number((after / (choice[0] * choice[1] ** BigInt(reached - 1))) % choice[1])]
      : null;
    return { row: RESEARCH_ROWS[row], tier: reached, side };
  }
  return { row: null, tier: null, side: null };
}

/** Distance between two offset hexes as the map stores them; enough to tell a step from a jump to another depth. */
function hexDistance(a: [number, number], b: [number, number]) {
  const cube = ([col, row]: [number, number]) => {
    const x = col - (row - (row & 1)) / 2;
    return [x, row, -x - row];
  };
  const [p, q] = [cube(a), cube(b)];
  return Math.max(...p.map((value, i) => Math.abs(value - q[i])));
}

/** Each player's most structures held at once, per game. */
export function peakHoldings(
  events: DecodedEvent[],
  modes: Record<string, Mode>,
): { game: string; mode: Mode | null; player: string; peak: number }[] {
  const owner = new Map<string, string>();
  const peaks = new Map<string, number>();
  const held = (game: string, player: string) =>
    [...owner.entries()].filter(([key, holder]) => key.startsWith(`${game}:`) && holder === player).length;
  for (const event of events) {
    if (event.model !== "Structure") continue;
    const game = String(small(event.key.game_id));
    const key = `${game}:${event.key.entity_id}`;
    const before = owner.get(key);
    if (event.kind === "set") owner.set(key, event.value.owner);
    else if (event.member === "owner") owner.set(key, event.value);
    else if (event.kind === "delete") owner.delete(key);
    else continue;
    for (const player of [owner.get(key), before]) {
      if (!player || big(player) === 0n) continue;
      const peakKey = `${game}:${address(player)}`;
      peaks.set(peakKey, Math.max(peaks.get(peakKey) ?? 0, held(game, player)));
    }
  }
  return [...peaks.entries()].map(([key, peak]) => {
    const [game, player] = key.split(":");
    return { game, mode: modes[game] ?? null, player, peak };
  });
}
