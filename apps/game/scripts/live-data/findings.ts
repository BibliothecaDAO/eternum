/**
 * The usage audit's findings, strongest cut first: what each control is and what would replace it are written once
 * here; the evidence line is counted again from every pull, so the lab's Data → UI usage page refreshes with it.
 */
import type { CommandRow, Mode } from "./commands";

export interface LeaderboardEntry {
  address: string;
  deepest_depth: number;
  rewards: { lords: string };
}
interface UsageReport {
  title: string;
  pulled: string;
  source: string;
  caveat: string;
  rerun: string;
  findings: {
    title: string;
    modes: Mode[];
    kind: "command" | "ui-only" | "rules";
    where: string;
    evidence: string;
    replace: string;
    risk: string;
    shot: string | null;
  }[];
  kept: string[];
  outOfScope: string[];
}

const n = (value: number) => value.toLocaleString("en-US");
/** "1 player", "3 players". */
const of = (value: number, noun: string) => `${n(value)} ${noun}${value === 1 ? "" : "s"}`;
const PLAYER_ACTION = (row: CommandRow) => row.player !== null && !row.command.startsWith("(");
const RERUN =
  "cd <folder that keeps the pulls> && python3 -I <repo>/apps/game/scripts/live-data/live-data.py all > analysis.md";

/** The counts a finding's evidence reads. */
export class Counts {
  constructor(
    readonly rows: CommandRow[],
    readonly holdings: { mode: Mode | null; peak: number }[],
    readonly leaderboard: LeaderboardEntry[],
  ) {}
  of = (mode: Mode, command: string, where: (options: Record<string, any>) => boolean = () => true) =>
    this.rows.filter((row) => row.mode === mode && row.command === command && where(row.options));
  count = (mode: Mode, command: string, where?: (options: Record<string, any>) => boolean) =>
    this.of(mode, command, where).length;
  players = (mode: Mode, command: string, where?: (options: Record<string, any>) => boolean) =>
    new Set(
      this.of(mode, command, where)
        .map((row) => row.player)
        .filter(Boolean),
    ).size;
  games = (mode: Mode) => new Set(this.rows.filter((row) => row.mode === mode).map((row) => row.game)).size;
  actions = (mode: Mode) => this.rows.filter((row) => row.mode === mode && PLAYER_ACTION(row));
  accounts = (mode: Mode) => new Set(this.actions(mode).map((row) => row.player)).size;
  /** The share of a mode's player actions made by its `top` busiest accounts, in percent. */
  topShare(mode: Mode, top: number) {
    const per = new Map<string, number>();
    for (const row of this.actions(mode)) per.set(row.player!, (per.get(row.player!) ?? 0) + 1);
    const busiest = [...per.values()].sort((a, b) => b - a).slice(0, top);
    return Math.round((100 * busiest.reduce((sum, value) => sum + value, 0)) / Math.max(1, this.actions(mode).length));
  }
  shares = (label: string) =>
    this.of("blitz", "Send resources")
      .flatMap((row) => row.options.shares)
      .filter((s) => s === label).length;
  sharePlayers = (label: string) => this.players("blitz", "Send resources", (o) => o.shares.includes(label));
  sentRows = () => this.of("blitz", "Send resources").reduce((sum, row) => sum + row.options.shares.length, 0);
  /** Sends from one holding to other destinations within three blocks of each other: one multi-destination Transfer. */
  sendBursts() {
    const sends = this.of("blitz", "Send resources").sort(
      (a, b) => `${a.game}:${a.options.from}`.localeCompare(`${b.game}:${b.options.from}`) || a.block - b.block,
    );
    const bursts: CommandRow[][] = [];
    for (const row of sends) {
      const burst = bursts.at(-1);
      const last = burst?.at(-1);
      const joins =
        last && last.game === row.game && last.options.from === row.options.from && row.block - last.block <= 3;
      if (joins && String(last.options.to) !== String(row.options.to)) burst!.push(row);
      else bursts.push([row]);
    }
    const multi = bursts.filter((burst) => new Set(burst.map((row) => String(row.options.to))).size > 1);
    return { bursts: multi.length, players: new Set(multi.map((burst) => burst[0].player)).size };
  }
  peakHoldings = (mode: Mode) => Math.max(0, ...this.holdings.filter((h) => h.mode === mode).map((h) => h.peak));
  holdingsAtLeast = (mode: Mode, at: number) => this.holdings.filter((h) => h.mode === mode && h.peak >= at).length;
  holdingsTotal = (mode: Mode) => this.holdings.filter((h) => h.mode === mode).length;
}

const research = (c: Counts, row: string, side: string | null = null) =>
  c.count("frontier", "Research", (o) => o.row === row && (side === null || o.side === side));
const deploys = (c: Counts, tier: string) => c.count("blitz", "Deploy army", (o) => o.tier === tier);

type Finding = Omit<UsageReport["findings"][number], "evidence"> & { evidence: (c: Counts) => string };

const FINDINGS: Finding[] = [
  {
    title: "Burn a resource (the flame)",
    modes: ["blitz"],
    kind: "command",
    where: "Transfer (T) → Balances, the flame on a row; a resource chip's flame in a structure's details.",
    evidence: (c) =>
      `${n(c.count("blitz", "Burn resource"))} burns in ${n(c.games("blitz"))} Blitz games (${n(c.actions("blitz").length)} player actions). Frontier's preset disables the command.`,
    replace: "Nothing.",
    risk: "None found: no rule rewards destroying stock. The command could also leave Blitz's preset (contracts, your call).",
    shot: "burn.png",
  },
  {
    title: "Transfer's 25% and 75% quick shares",
    modes: ["blitz"],
    kind: "command",
    where: "Transfer (T) → Transfer tab, the 25% / 50% / 75% / Max buttons on every resource row.",
    evidence: (c) =>
      `Of ${n(c.sentRows())} resource rows sent, at most ${n(c.shares("25%"))} match 25% of the holding's balance (${of(c.sharePlayers("25%"), "player")}) and ${n(c.shares("75%"))} match 75%. Max ${n(c.shares("Max"))} and 50% ${n(c.shares("50%"))}, both inflated by even splits over two destinations and the window's own defaults.`,
    replace: "Max, the field and the slider (50% optional).",
    risk: "Low. Same shape as the All to / Even cut.",
    shot: "quick-shares.png",
  },
  {
    title: "Pause / Resume a building's production",
    modes: ["blitz"],
    kind: "command",
    where: "Realm view → a building → Pause (bottom-right panel); Production → Manual, Pause all on a building kind.",
    evidence: (c) =>
      `${n(c.count("blitz", "Pause building"))} pauses and ${n(c.count("blitz", "Resume building"))} resumes against ${n(c.count("blitz", "Build"))} buildings built.`,
    replace: "Nothing; Automation's Off already stops spending.",
    risk: "Low. No lab fixture draws a built building's panel: code in bottom-right-panel.tsx and select-preview-building.tsx.",
    shot: "production.png",
  },
  {
    title: "Remove a guard",
    modes: ["blitz"],
    kind: "command",
    where: "A structure's Guards → a slot → dismiss (army deployment picker).",
    evidence: (c) =>
      `${n(c.count("blitz", "Remove guard"))} removals against ${n(c.count("blitz", "Add guard"))} guards added. A guard leaves its slot through Transfer troops, guard → army: ${n(c.count("blitz", "Transfer troops", (o) => o.from === "Guard"))} uses.`,
    replace: "Guard → army transfer.",
    risk: "Low.",
    shot: "guards.png",
  },
  {
    title: "Demolish a building",
    modes: ["blitz", "frontier"],
    kind: "command",
    where: "Realm view → a building: Demolish in Blitz; Research → Delete → OK in Frontier.",
    evidence: (c) =>
      `Blitz: ${n(c.count("blitz", "Demolish building"))} demolitions by ${of(c.players("blitz", "Demolish building"), "player")}. Frontier: ${n(c.count("frontier", "Demolish building"))} demolitions by ${of(c.players("frontier", "Demolish building"), "player")}. Initial Frontier observations predate its client action; judge its use only on observations after that action ships.`,
    replace: "Nothing proposed in Frontier: collect observations after the action ships. Nothing in Blitz.",
    risk: "Medium: a misplaced building can no longer be undone.",
    shot: null,
  },
  {
    title: "Manual Production (the Production window's first tab)",
    modes: ["blitz"],
    kind: "command",
    where: "Production bubble or P → Manual Production.",
    evidence: (c) => {
      const all = c.count("blitz", "Produce");
      const automated = c.count("blitz", "Produce", (o) => o.outputs >= 2);
      return `Automation sent at least ${n(automated)} of ${n(all)} production commands (${Math.round((100 * automated) / Math.max(1, all))}%), for ${n(c.players("blitz", "Produce", (o) => o.outputs >= 2))} of the ${n(c.players("blitz", "Produce"))} players who produced. A manual run carries exactly one output, so manual runs were at most ${n(all - automated)}.`;
    },
    replace: "Automation (Smart / Custom / Off on the holding card); the Production bubble could then go.",
    risk: "Medium to high: an exact one-off run (a troop batch) then needs Custom automation.",
    shot: "production.png",
  },
  {
    title: "Rename a holding (the quill)",
    modes: ["blitz", "frontier"],
    kind: "ui-only",
    where: "The holding's card, the quill beside its name.",
    evidence: () =>
      "UI-only, and private: the new name is kept in this browser only. No other player, device, story or plate sees it. The chain's SetEntityName (enabled in Frontier) is never sent.",
    replace: "Nothing, or send SetEntityName so everyone sees the name (the command exists).",
    risk: "None.",
    shot: "rename.png",
  },
  {
    title: "Transfer → Arrivals tab",
    modes: ["blitz"],
    kind: "ui-only",
    where: "Transfer (T) → Arrivals.",
    evidence: (c) =>
      `The client offloads every landed arrival by itself (${n(c.count("blitz", "Offload arrival"))} offloads), so the tab only lists what is on its way. The Transfer bubble's badges and Next up already say when goods arrive.`,
    replace: "The bubble's badges and Next up.",
    risk: "Low to medium: the list of what is on its way goes.",
    shot: "arrivals.png",
  },
  {
    title: "Balances tab: its switch, filters and gestures",
    modes: ["blitz"],
    kind: "ui-only",
    where:
      "Transfer (T) → Balances: Single / All realms, Hide empty, Producing, Military, a star per holding, a ⇄ per row, double-click a cell, drag a cell onto another holding.",
    evidence: () =>
      "UI-only. It repeats the holding card's rings and Transfer's Send from list; the double-click and drag are a seventh and eighth way into the same Transfer.",
    replace: "The Transfer tab and the holding card; at least the hidden double-click and drag.",
    risk: "Low to medium: players holding many structures lose the overview (see Used, keep).",
    shot: "burn.png",
  },
  {
    title: "Three event lenses (Important / Mine / All)",
    modes: ["blitz", "frontier"],
    kind: "ui-only",
    where: "Blitz: the Events strip and Log. Frontier: the Feed (World / Mine / Important).",
    evidence: (c) =>
      `UI-only. Three lenses over a three-row strip. Mine fills with Automation's own stories (in Blitz: ${n(c.count("blitz", "Produce"))} production runs, ${n(c.count("blitz", "Offload arrival"))} offloads, ${n(c.count("blitz", "Send resources"))} sends).`,
    replace: "Two lenses (Important, All). The Feed's redraw belongs to the shell and polish lanes.",
    risk: "Low.",
    shot: "events-filter.png",
  },
  {
    title: "Settings: Renderer, and Haptics on a desktop",
    modes: ["blitz", "frontier"],
    kind: "ui-only",
    where: "The gear → Video & Graphics.",
    evidence: () =>
      "UI-only. Settings has 15 rows. Renderer (WebGPU / WebGL) duplicates the address's rendererMode, a developer escape. Haptics is drawn on a desktop, where nothing vibrates.",
    replace: "The address parameter; Haptics on touch devices only.",
    risk: "Low: a player whose WebGPU driver fails needs the fallback to stay automatic.",
    shot: "settings.png",
  },
  {
    title: "The Season detail's Reach line",
    modes: ["frontier"],
    kind: "command",
    where: "Season → a realm's row → its detail, Reach.",
    evidence: (c) =>
      `${n(c.count("frontier", "Enter depth"))} depth entries, ${n(research(c, "Ethereal"))} Ethereal research among ${n(c.count("frontier", "Research"))} researches by ${n(c.players("frontier", "Research"))} players, deepest reach 0 for ${n(c.leaderboard.filter((e) => e.deepest_depth === 0).length)} of ${n(c.leaderboard.length)} realms.`,
    replace: "Draw Reach only above 0, as the board's badge already does.",
    risk: "None. The Spire itself is late-game: no cut on this evidence.",
    shot: "season.png",
  },
  {
    title: "Research sides almost never picked (rules, not UI)",
    modes: ["frontier"],
    kind: "rules",
    where: "Research → a row → its side.",
    evidence: (c) =>
      `${n(c.count("frontier", "Research"))} researches. Farm: Make ${research(c, "Farm", "Make")}, Store ${research(c, "Farm", "Store")}. Workshop: Make ${research(c, "Workshop", "Make")}, Store ${research(c, "Workshop", "Store")}. Barracks: Drill ${research(c, "Barracks", "Drill")}, Rations ${research(c, "Barracks", "Rations")}. Scouts' Lodge: Camps ${research(c, "Scouts' Lodge", "Camps")}, Rifts ${research(c, "Scouts' Lodge", "Rifts")}, Beasts ${research(c, "Scouts' Lodge", "Beasts")}. War Hall ${research(c, "War Hall")}, Supply Yard ${research(c, "Supply Yard")}, Hearth ${research(c, "Hearth")}, Ethereal ${research(c, "Ethereal")}. Hut ${research(c, "Hut")}, Shrine ${research(c, "Shrine")}, Well ${research(c, "Well")}.`,
    replace: "A question for the rules lane and the research balance study (Data → Balance & data).",
    risk: "Changes the game; owner and rules lane.",
    shot: "research.png",
  },
  {
    title: "Blitz T2 troops (rules, not UI)",
    modes: ["blitz"],
    kind: "rules",
    where: "Military → Deploy, the T2 row of the troop grid; guard slots.",
    evidence: (c) =>
      `Deploys: T1 ${n(deploys(c, "T1"))}, T3 ${n(deploys(c, "T3"))}, T2 ${n(deploys(c, "T2"))} (${of(
        c.players("blitz", "Deploy army", (o) => o.tier === "T2"),
        "player",
      )}). Guards: T2 ${n(c.count("blitz", "Add guard", (o) => o.tier === "T2"))} of ${n(c.count("blitz", "Add guard"))}.`,
    replace: "A question for the rules lane.",
    risk: "Changes the game.",
    shot: "deploy-grid.png",
  },
  {
    title: "Refill stamina with LORDS",
    modes: ["frontier"],
    kind: "command",
    where: "An army's panel → refill (when its stamina is short).",
    evidence: (c) =>
      `${n(c.count("frontier", "Refill stamina (LORDS)"))} refills by ${n(c.players("frontier", "Refill stamina (LORDS)"))} of ${n(c.accounts("frontier"))} players. ${n(c.leaderboard.filter((e) => Number(e.rewards.lords) > 0).length)} players hold any LORDS, ${n(c.count("frontier", "Withdraw LORDS"))} withdrawals. Wells: ${n(c.count("frontier", "Use Well"))} uses by ${n(c.players("frontier", "Use Well"))} players.`,
    replace: "Keep for now: too little LORDS in play to judge.",
    risk: "It is a LORDS sink; cutting it is an economy call.",
    shot: "army.png",
  },
];

/** The page's data, every number counted from this pull. */
export function usageReport(c: Counts, pulled: string, throughBlock: number): UsageReport {
  // What a deploy left and sent, not the control that set it: Max, +500, the field and the slider can each give any of
  // these amounts (Max stops at what the army holds, +500 at what is on hand).
  const deployedAll = (mode: Mode) => c.count(mode, "Deploy army", (o) => o.left === 0);
  const deployedHundreds = (mode: Mode) =>
    c.count(mode, "Deploy army", (o) => o.left !== 0 && o.left !== null && o.amount % 500 === 0);
  const bursts = c.sendBursts();
  const named = c.rows.filter((row) => !row.command.startsWith("(unclassified"));
  return {
    title: "What players never use",
    pulled,
    source: `Prod chain, read-only: every event of the Games contract through block ${n(throughBlock)}, decoded with Herald's own decoder; ${n(named.length)} of ${n(c.rows.length)} transactions named by the command that wrote them. Frontier: ${n(c.accounts("frontier"))} players, ${n(c.actions("frontier").length)} player actions. Blitz: ${n(c.games("blitz"))} games, ${n(c.accounts("blitz"))} accounts, ${n(c.actions("blitz").length)} player actions, ${c.topShare("blitz", 2)}% of them from two accounts.`,
    caveat:
      "A transaction body is not public on prod, so each command is recognised by what it wrote. Blitz numbers come from few players: 'never' there means 'never by the few who played'. UI-only controls leave no trace on chain; for them the evidence is the code and the HUD.",
    rerun: RERUN,
    findings: FINDINGS.map((finding) => ({ ...finding, evidence: finding.evidence(c) })),
    kept: [
      `Explore ${n(c.count("frontier", "Explore"))} / ${n(c.count("blitz", "Explore"))}, Move ${n(c.count("frontier", "Move"))} / ${n(c.count("blitz", "Move"))}, Attack ${n(c.count("frontier", "Attack"))} / ${n(c.count("blitz", "Attack"))} (Frontier / Blitz).`,
      `Deploy amounts, of ${n(c.count("frontier", "Deploy army"))} / ${n(c.count("blitz", "Deploy army"))} deploys: ${n(deployedAll("frontier"))} / ${n(deployedAll("blitz"))} sent every troop of their kind, ${n(deployedHundreds("frontier"))} / ${n(deployedHundreds("blitz"))} a multiple of 500 with troops left. Which control set them (Max, +500, the field, the slider) is not recorded.`,
      `Army level-ups: ${n(c.count("frontier", "Army level up"))} by ${n(c.players("frontier", "Army level up"))} players.`,
      `Sends from one holding to different holdings within three blocks of each other: ${of(bursts.bursts, "burst")} by ${of(bursts.players, "player")}, as one multi-destination Transfer would send them; that one Transfer sent each burst is not recorded.`,
      `Holdings kind tabs and search: Blitz peaks at ${n(c.peakHoldings("blitz"))} holdings; ${n(c.holdingsAtLeast("blitz", 12))} of ${n(c.holdingsTotal("blitz"))} player-games passed 12.`,
      `Automation: ${n(c.players("blitz", "Produce", (o) => o.outputs >= 2))} of ${n(c.players("blitz", "Produce"))} producing players.`,
      `Relic crates ${n(c.count("blitz", "Open relic crate"))}, relics used ${n(c.count("blitz", "Use relic"))}, disband ${n(c.count("blitz", "Disband army"))}, Shrine ${n(c.count("frontier", "Use Shrine"))}, Well ${n(c.count("frontier", "Use Well"))}, Realm labor claims ${n(c.count("frontier", "Claim Realm labor"))}.`,
    ],
    outOfScope: [
      "Eternum only (never drawn in Blitz or Frontier): Trade, Tribes, Faith, Hyperstructure construction, Bitcoin mining.",
      `Craft relic: its button shows only on a Research balance, which no realm has held; ${n(c.count("blitz", "Craft relic"))} crafts.`,
      `Withdraw LORDS: ${n(c.count("frontier", "Withdraw LORDS"))} so far, but it is the payout path.`,
    ],
  };
}
