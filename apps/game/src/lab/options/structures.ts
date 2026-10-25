/**
 * The three structures proposed for one lab (reports/lab-redesign-1.md). Each room lists its pages and, for each page,
 * the routes it replaces, so the mockup shows what merges and the report counts it.
 */
export type Mode = "blitz" | "frontier" | "eternum";
/** What a page draws: the mockup draws a stand-in of that kind. */
export type Stage = "sheet" | "hud" | "app" | "scene" | "art" | "data" | "bench" | "film" | "decide";

export interface Page {
  title: string;
  /** The routes and branches this page replaces. */
  from: string[];
  stage: Stage;
  modes: Mode[];
  /** An open question for the owner: the page is a proposal until it is answered. */
  question?: string;
}
export interface Room {
  title: string;
  /** The room's one job, in a sentence. */
  job: string;
  pages: Page[];
}
export interface Structure {
  key: "a" | "b" | "c";
  name: string;
  idea: string;
  rooms: Room[];
  /** How a lane adds a page, in this structure. */
  adding: string;
}

const ALL: Mode[] = ["blitz", "frontier", "eternum"];
const PLAYED: Mode[] = ["blitz", "frontier"];
const FRONTIER: Mode[] = ["frontier"];

const KIT: Page[] = [
  { title: "HUD sheet", from: ["/lab/kit", "/lab/kit/tokens"], stage: "sheet", modes: ALL },
  { title: "App sheet", from: ["/lab/kit/app", "/lab/kit/shell", "/lab/kit/app-art"], stage: "sheet", modes: ALL },
  {
    title: "Icons",
    from: ["/lab/kit/icons", "/lab/kit/resource-icons", "/lab/kit/reward-chests"],
    stage: "sheet",
    modes: ALL,
  },
  { title: "Words", from: ["/lab/kit/words"], stage: "sheet", modes: ALL },
  { title: "Motion", from: ["/lab/motion"], stage: "sheet", modes: ALL },
];
const IN_GAME: Page = {
  title: "In game",
  from: [
    "/lab/kit/hud/:state (86 Frontier states)",
    "/lab/kit/unified/:view (8 desktop views)",
    "/lab/kit/panels",
    "/lab/kit/guidance",
    "/lab/kit/build-order",
    "/lab/kit/blitz-build",
    "/lab/kit/progression",
    "/lab/kit/windows/:surface",
    "/lab/kit/area-d",
    "/lab/kit/deploy",
    "/lab/kit/chat",
    "/lab/kit/construction",
  ],
  stage: "hud",
  modes: PLAYED,
};
const APP: Page = { title: "App pages", from: ["/lab/app/:screen"], stage: "app", modes: ALL };
const PHONE: Page = {
  title: "Phone options",
  from: ["branch lab/frontier-mobile (/lab/kit/frontier-mobile)"],
  stage: "hud",
  modes: FRONTIER,
  question: "Which phone direction, A, B or C, and which touch scheme?",
};
const DESKTOP: Page = {
  title: "Desktop options",
  from: ["branch lab/frontier-feedback (/lab/kit/feedback)"],
  stage: "hud",
  modes: FRONTIER,
  question: "The desktop playtest's round 3: which option for each item?",
};
const SCENES: Page[] = [
  { title: "Spire", from: ["/lab/game?scenario=spire"], stage: "scene", modes: FRONTIER },
  { title: "Realm upgrade", from: ["/lab/game?scenario=realm"], stage: "scene", modes: FRONTIER },
  { title: "Day end", from: ["/lab/day-end"], stage: "scene", modes: FRONTIER },
  { title: "Game end", from: ["/lab/endgame"], stage: "scene", modes: PLAYED },
  { title: "Chest opening", from: ["/lab/relic-chest"], stage: "scene", modes: PLAYED },
  { title: "Map labels & sites", from: ["/lab/map-labels"], stage: "scene", modes: PLAYED },
];
const PAINTED: Page = {
  title: "Painted buildings",
  from: ["branch art/frontier-painted-wiring-2 (/lab/game?scenario=painted-buildings)"],
  stage: "scene",
  modes: FRONTIER,
  question: "Ship the painted set in the game, castles kept?",
};
const ART: Page[] = [
  { title: "Terrain", from: ["/lab", "/lab/terrain-props"], stage: "art", modes: PLAYED },
  { title: "Models", from: ["/lab/models (and its six families)"], stage: "art", modes: ALL },
  { title: "Characters", from: ["/lab/characters"], stage: "art", modes: ALL },
  { title: "Chests", from: ["/lab/rewards"], stage: "art", modes: PLAYED },
  { title: "Effects", from: ["/lab/world-fx"], stage: "art", modes: PLAYED },
];
const BENCH: Page = {
  title: "Bench",
  from: ["/lab/character-benchmark", "/lab/world", "/lab/chunks", "/lab/terrain-benchmark"],
  stage: "bench",
  modes: PLAYED,
};
const BALANCE: Page = {
  title: "Balance & data",
  from: [
    "branch lab/frontier-research-balance (/lab/kit/research-balance)",
    "reports/frontier-live-data-1, -2, frontier-blitz-live-data-3",
    "evidence/perf/frontier-live-data-1/live-data.py",
  ],
  stage: "data",
  modes: PLAYED,
  question: "Research balance: S1, T1, B1, or which others?",
};
const STUDIO: Page[] = [
  { title: "Set", from: ["/lab/studio"], stage: "film", modes: PLAYED },
  { title: "Footage", from: ["/reels", "/hype3"], stage: "film", modes: ["blitz"] },
  { title: "Marketing", from: ["/announce", "/story", "/emails", "/brand"], stage: "film", modes: ALL },
];
const KIT_JOB = "The parts every screen is built from, in each game's age.";
const HUD_JOB = "The screens a player sees, on a desktop and a phone side by side.";
const DATA_JOB = "What the playtest says, and what to change for next season.";
const STUDIO_JOB = "Shoot the reels, and keep the footage and the pages made from it.";

export const STRUCTURES: Structure[] = [
  {
    key: "a",
    name: "A · Six rooms",
    idea: "One room per kind of work. A proposal sits in its room, marked until it is answered.",
    rooms: [
      { title: "Kit", job: KIT_JOB, pages: KIT },
      { title: "HUD", job: HUD_JOB, pages: [IN_GAME, APP, PHONE, DESKTOP] },
      {
        title: "Game",
        job: "A moment of the game, played on a fixture with its own map and HUD.",
        pages: [...SCENES, PAINTED],
      },
      {
        title: "Art",
        job: "Every model, terrain and effect at game scale, and what it costs to draw.",
        pages: [...ART, BENCH],
      },
      { title: "Data", job: DATA_JOB, pages: [BALANCE] },
      { title: "Studio", job: STUDIO_JOB, pages: STUDIO },
    ],
    adding: "A lane adds one entry to its room's list. A proposal carries its question and shows a mark in the room.",
  },
  {
    key: "b",
    name: "B · Decide first",
    idea: "The first room lists every question waiting for you. Five rooms hold the reference pages.",
    rooms: [
      {
        title: "Decide",
        job: "Every question waiting for the owner, one card each, gone once answered.",
        pages: [PHONE, DESKTOP, BALANCE, PAINTED].map((page) => ({ ...page, stage: "decide" as const })),
      },
      { title: "Kit", job: KIT_JOB, pages: KIT },
      { title: "HUD", job: HUD_JOB, pages: [IN_GAME, APP] },
      {
        title: "World",
        job: "The game's moments on fixtures, and every model, terrain and effect at game scale.",
        pages: [...SCENES, ...ART, BENCH],
      },
      { title: "Data", job: DATA_JOB, pages: [{ ...BALANCE, question: undefined }] },
      { title: "Studio", job: STUDIO_JOB, pages: STUDIO },
    ],
    adding:
      "A lane adds one entry to its room. A proposal also names its question, lane and report: it appears in Decide, and leaves the lab in the change that ships the answer.",
  },
  {
    key: "c",
    name: "C · Three floors",
    idea: "Fewest entries: Interface, World and Data. Each floor goes one level deeper.",
    rooms: [
      {
        title: "Interface",
        job: "Every screen and the parts they are built from.",
        pages: [...KIT, IN_GAME, APP, PHONE, DESKTOP],
      },
      {
        title: "World",
        job: "Everything drawn in 3D: the game's moments, the art, the film set.",
        pages: [...SCENES, PAINTED, ...ART, BENCH, ...STUDIO],
      },
      { title: "Data", job: DATA_JOB, pages: [BALANCE] },
    ],
    adding: "A lane adds one entry to its floor. A floor's page list grows; its tabs group by kind.",
  },
];
