import { createSqlApi, sqlApi } from "@/services/api";
import { SqlApi, buildApiUrl, fetchWithErrorHandling, type PlayerLeaderboardRow } from "@bibliothecadao/torii";

const DEFAULT_LIMIT = 20;
const REGISTERED_POINTS_PRECISION = 1_000_000;
const SCORE_TO_BEAT_ENDPOINT_TIMEOUT_MS = 10_000;
const GAME_REWARD_CHEST_POINTS_THRESHOLD = 500;
const LORDS_TOKEN_DECIMALS = 18;
const SCORE_TO_BEAT_GAME_CHEST_REWARD_QUERY = `
  SELECT
    allocated_chests
  FROM "s1_eternum-GameChestReward"
  LIMIT 1;
`;
const SCORE_TO_BEAT_SEASON_PRIZE_QUERY = `
  SELECT
    total_registered_points
  FROM "s1_eternum-SeasonPrize"
  LIMIT 1;
`;
const SCORE_TO_BEAT_PLAYERS_RANK_FINAL_QUERY = `
  SELECT
    trial_id
  FROM "s1_eternum-PlayersRankFinal"
  WHERE trial_id > 0
  ORDER BY trial_id DESC
  LIMIT 1;
`;

export interface PlayerLeaderboardData {
  rank: number;
  address: string;
  displayName: string | null;
  /** Registered + unregistered points combined */
  points: number;
  /** Latest global MMR (integer value) when available */
  mmr?: number;
  /** Latest MMR tier label when available */
  mmrTier?: string;
  /** Raw registered portion if available from the backend */
  registeredPoints?: number;
  /** Unregistered (shareholder) contribution if available */
  unregisteredPoints?: number;
  prizeClaimed: boolean;
  exploredTiles?: number;
  exploredTilePoints?: number;
  riftsTaken?: number;
  riftPoints?: number;
  hyperstructuresConquered?: number;
  hyperstructurePoints?: number;
  relicCratesOpened?: number;
  relicCratePoints?: number;
  campsTaken?: number;
  campPoints?: number;
  hyperstructuresHeld?: number | null;
  hyperstructuresHeldPoints?: number;
}

export type LandingLeaderboardEntry = PlayerLeaderboardData;

export interface ScoreToBeatRun {
  endpoint: string;
  points: number;
  chests: number;
  lords: number;
  rank: number;
}

export const SCORE_TO_BEAT_STATIC_GAMES = ["s0-game-1", "s0-game-2", "s0-game-3", "s0-game-4"] as const;
type ScoreToBeatStaticGame = (typeof SCORE_TO_BEAT_STATIC_GAMES)[number];

export interface ScoreToBeatStaticGameBreakdown {
  game: ScoreToBeatStaticGame;
  points: number;
  chests: number;
}

export interface ScoreToBeatEntrySummary {
  address: string;
  displayName: string | null;
  combinedPoints: number;
  combinedChests: number;
  combinedLords: number;
  /** All endpoint runs for the player, sorted desc by points. */
  allRuns: ScoreToBeatRun[];
  /** Best N runs used for combined score. */
  runs: ScoreToBeatRun[];
  totalRuns: number;
  staticGames: ScoreToBeatStaticGameBreakdown[];
}

export interface ScoreToBeatResult {
  entries: ScoreToBeatEntrySummary[];
  endpoints: string[];
  failedEndpoints: string[];
  generatedAt: number;
}

interface ScoreToBeatOptions {
  perEndpointLimit?: number;
  runsToAggregate?: number;
  maxPlayers?: number;
}

interface ScoreToBeatStaticRow {
  displayName: string;
  address: string;
  points: [number, number, number, number];
  chests: [number, number, number, number];
}

interface ScoreToBeatGameChestRewardRow {
  allocated_chests?: unknown;
}

interface ScoreToBeatSeasonPrizeRow {
  total_registered_points?: unknown;
}

interface ScoreToBeatPlayersRankFinalRow {
  trial_id?: unknown;
}

interface ScoreToBeatRankPrizeRow {
  rank?: unknown;
  total_players_same_rank_count?: unknown;
  total_prize_amount?: unknown;
}

const SCORE_TO_BEAT_STATIC_ENDPOINT_BY_GAME: Record<ScoreToBeatStaticGame, string> = {
  "s0-game-1": "https://api.cartridge.gg/x/s0-game-1/torii/sql",
  "s0-game-2": "https://api.cartridge.gg/x/s0-game-2/torii/sql",
  "s0-game-3": "https://api.cartridge.gg/x/s0-game-3/torii/sql",
  "s0-game-4": "https://api.cartridge.gg/x/s0-game-4/torii/sql",
};

const SCORE_TO_BEAT_STATIC_ENDPOINT_TO_GAME = new Map<string, ScoreToBeatStaticGame>(
  SCORE_TO_BEAT_STATIC_GAMES.map((game) => [SCORE_TO_BEAT_STATIC_ENDPOINT_BY_GAME[game], game]),
);

const SCORE_TO_BEAT_STATIC_GAME_INDEX = new Map<ScoreToBeatStaticGame, number>(
  SCORE_TO_BEAT_STATIC_GAMES.map((game, index) => [game, index]),
);

const SCORE_TO_BEAT_STATIC_ROWS: ScoreToBeatStaticRow[] = [
  {
    displayName: "djizus",
    address: "0x04364d8e9f994453f5d0c8dc838293226d8ae0aec78030e5ee5fb91614b00eb5",
    points: [98899, 0, 0, 94420],
    chests: [1, 0, 0, 18],
  },
  {
    displayName: "lgccharrmander",
    address: "0x0643bce119f53a1ec83f57c4c42f694659c2da543d6f8a85b335d3f4bef12548",
    points: [71740, 30128, 0, 3380],
    chests: [1, 5, 0, 1],
  },
  {
    displayName: "lgcambrosia",
    address: "0x0389a701a79f1d62f160dc991d98ad14f122b79e54af68c5eac9086b3e93cbb9",
    points: [59624, 0, 0, 0],
    chests: [1, 0, 0, 0],
  },
  {
    displayName: "bal7hazar",
    address: "0x008b95a26e1392ed9e817607bfae2dd93efb9c66ee7db0b018091a11d9037006",
    points: [55663, 0, 0, 0],
    chests: [1, 0, 0, 0],
  },
  {
    displayName: "calff",
    address: "0x03a496b92d292386ad70dab94ae181a06d289440e3b632a2435721b4280874c4",
    points: [51468, 79356, 37174, 1490],
    chests: [1, 12, 5, 1],
  },
  {
    displayName: "alexx855",
    address: "0x062d69c12007e40bd6689499829bf5ed56a5908ce307bc5bd614fc50f299333b",
    points: [38726, 24015, 0, 1210],
    chests: [1, 4, 0, 1],
  },
  {
    displayName: "lzg",
    address: "0x041845afb6e2b85adbd473941344c8ab017914977280fe8d9b724b27822458e1",
    points: [35306, 37050, 11675, 0],
    chests: [1, 6, 2, 0],
  },
  {
    displayName: "darklyn1",
    address: "0x02e1ee7d1452498128ed3562a05e3cb85ab02a2c8436b2654cc53ca9dda427e6",
    points: [27437, 0, 33723, 77241],
    chests: [1, 0, 5, 15],
  },
  {
    displayName: "lgckung",
    address: "0x00594d857f23ba0bb3b5820b2f24af943be6102d73b92228f8ac60f9ab364f36",
    points: [25368, 44456, 0, 10487],
    chests: [1, 7, 0, 3],
  },
  {
    displayName: "tsuaurym",
    address: "0x062ba685f1d600ac7bda27e556b787548da32c7c0aa3ff5f58dddc07b9116f33",
    points: [24408, 25310, 56909, 20440],
    chests: [1, 4, 8, 4],
  },
  {
    displayName: "krump",
    address: "0x02e4727dfc9f4a6a0c8cee69c6987f487637ccd5e220808fd975bf267cf70431",
    points: [23824, 0, 35144, 43046],
    chests: [1, 0, 5, 9],
  },
  {
    displayName: "s0u7mate",
    address: "0x0347ce135915327d96d020914853a5aed59600e3bfa9b9be00e8d4066e7ba09f",
    points: [21532, 87749, 0, 49539],
    chests: [1, 13, 0, 10],
  },
  {
    displayName: "vorpalsword",
    address: "0x03e1a40b78d90a2477cf881dfec9fa8f782f317452813fdd6cc8b3cddea17c5e",
    points: [11105, 0, 23138, 4590],
    chests: [1, 0, 4, 4],
  },
  {
    displayName: "tsubasa",
    address: "0x02dff02c78f7828fb5ad7619caf4ea830e91ef3b6ce3a97efee681fbfc1af572",
    points: [7726, 20587, 3280, 5350],
    chests: [1, 3, 1, 2],
  },
  {
    displayName: "lgc-apostador",
    address: "0x04df2355a6f60f978e47702175ce56600214539270f90baa3cf83b3c20d3d986",
    points: [3150, 32006, 0, 6490],
    chests: [1, 5, 0, 2],
  },
  {
    displayName: "lgccremildo",
    address: "0x04a100384c231058476dc24210984383b3b89f8faddfb0b9dda325ee9bf8f765",
    points: [3030, 8050, 20130, 25653],
    chests: [1, 2, 3, 5],
  },
  {
    displayName: "lordkb",
    address: "0x015d9023ac1fbc6963c0ad84e3b98c47c6ff90def416e2c21f7b0da1759e4546",
    points: [2748, 0, 0, 580],
    chests: [1, 0, 0, 1],
  },
  {
    displayName: "kacago",
    address: "0x038eb51f5bcd7c7d2a44f68ff16535f3e16a3d5c051f80477e58ae309feb20ff",
    points: [2650, 6209, 0, 5150],
    chests: [1, 1, 0, 1],
  },
  {
    displayName: "credence0x",
    address: "0x040db150844dc372928b3b47e23cb6e240e2c99ddc5381680afd73d777cbd6c8",
    points: [1860, 0, 0, 0],
    chests: [1, 0, 0, 0],
  },
  {
    displayName: "gogi",
    address: "0x05182d69e155054d4852c775f3da3df704fd12fd77ebcc97b0a4ec3d619f60e6",
    points: [1390, 0, 0, 0],
    chests: [1, 0, 0, 0],
  },
  {
    displayName: "jonki",
    address: "0x04cf2d9d5f3dc3d176219355104f092d16c0b564b9cc9f7e6ca0d11c8662ad21",
    points: [1200, 0, 0, 0],
    chests: [1, 0, 0, 0],
  },
  {
    displayName: "squid",
    address: "0x0702150abd7903798fb763b6240beeb7fb6c73d7eceb2bb81ae11cf63ee4cfd8",
    points: [1020, 0, 0, 0],
    chests: [1, 0, 0, 0],
  },
  {
    displayName: "lgctaffa",
    address: "0x044daf0f4a5a19eac44cfbb5f336ade32aaf21baeed8ed94f91bd806f9321c4b",
    points: [560, 74102, 54754, 15046],
    chests: [1, 11, 8, 3],
  },
  {
    displayName: "raschel0x",
    address: "0x018f1a5171cf91eb2c8075af1f9e29a2890aa16037dff87c3920ca6307b1d199",
    points: [210, 0, 0, 0],
    chests: [0, 0, 0, 0],
  },
  {
    displayName: "shadowfax",
    address: "0x01483baba3337df2def5f69a069164627c3e4b4b6cdaa5f825cfa45835421de8",
    points: [180, 0, 0, 0],
    chests: [0, 0, 0, 0],
  },
  {
    displayName: "0xblacksmith",
    address: "0x0720fe2031189bdfbd555260fcd4b742ca7a2d61f67e68a691aeaab209499f7c",
    points: [0, 0, 75571, 0],
    chests: [0, 0, 10, 0],
  },
  {
    displayName: "prefirox",
    address: "0x05bf60edba145b935cb8149dfd5703b3412fccfd0133c5697b1b2b06dbf93c66",
    points: [0, 210, 25868, 0],
    chests: [0, 0, 4, 0],
  },
  {
    displayName: "daydriems",
    address: "0x05732a3405a9593fcc388b277cc3ae388fc03ceb961da7e25badd13aa2fa4d3f",
    points: [0, 14130, 16439, 6490],
    chests: [0, 3, 3, 2],
  },
  {
    displayName: "oxhenry",
    address: "0x01594eb3b8e73a2b8385895afee580c5b5c22023a357a9b130de082fc14ad017",
    points: [0, 0, 13732, 0],
    chests: [0, 0, 2, 0],
  },
  {
    displayName: "femano",
    address: "0x0079248b4b0e79f00e033d76824ed047b8820f7dd2e3df5a2d4c0af0061d3f40",
    points: [0, 540, 7482, 0],
    chests: [0, 1, 1, 0],
  },
  {
    displayName: "xdoctorofc",
    address: "0x07d2c4c0fbd10dd892e1a85bcdaee965eec960ade02d310a2049458342769c9a",
    points: [0, 7270, 3720, 0],
    chests: [0, 2, 1, 0],
  },
  {
    displayName: "lgc-luqbraz",
    address: "0x042fcb1a627923a4409adc4d0d3fd98f891e8fe23dbeb93eeda84a9f476067d9",
    points: [0, 0, 1980, 0],
    chests: [0, 0, 1, 0],
  },
  {
    displayName: "loaf6969",
    address: "0x05372427e24ffd54c70e3c04bed5077a670fa1442caa1ad90e4d3ffab39e08ab",
    points: [0, 0, 300, 0],
    chests: [0, 0, 0, 0],
  },
  {
    displayName: "boat",
    address: "0x06b525b0aaf7694a7e854f44ae0a4467c84c4e0111c15df7a6e2ab691bd77311",
    points: [0, 210, 230, 0],
    chests: [0, 0, 0, 0],
  },
  {
    displayName: "neohalk",
    address: "0x0675a55000f107c2763f46ab28fb72567de5b26fe362a953f0ff423924211bb4",
    points: [0, 31083, 0, 4320],
    chests: [0, 5, 0, 1],
  },
  {
    displayName: "erickld",
    address: "0x000a7cf6ec8701d810193d1384a1a70b812ab53ef7f2bd94fdfe8fb5da8a02ae",
    points: [0, 17638, 0, 0],
    chests: [0, 3, 0, 0],
  },
  {
    displayName: "lgcovrr",
    address: "0x058f5ca3b0975f45ed25d2431b8c881fc312f1f032a280ec10c26d2c3afb5320",
    points: [0, 13651, 0, 0],
    chests: [0, 2, 0, 0],
  },
  {
    displayName: "sosison",
    address: "0x047d21572248ed1f24a18a1401c896e4a3ce1109b41b2028a92bad6e39ecae4d",
    points: [0, 3152, 0, 16738],
    chests: [0, 1, 0, 4],
  },
  {
    displayName: "lgcluiz",
    address: "0x040e7788801347b243bb3873a1017ab4b2a6e850d2eb1103923ec8639e361b6b",
    points: [0, 1520, 0, 0],
    chests: [0, 1, 0, 0],
  },
  {
    displayName: "ashe",
    address: "0x03794259833a4d39fc711477a984e986c1fe843b31da71995728fe447b93b494",
    points: [0, 1490, 0, 0],
    chests: [0, 1, 0, 0],
  },
  {
    displayName: "batminer",
    address: "0x01c97ab8072fbea276dbd157f08fba150b3d5e14df3c203c877f409a86ffe7a3",
    points: [0, 1460, 0, 800],
    chests: [0, 1, 0, 1],
  },
  {
    displayName: "wfedizzier",
    address: "0x02da69c3f10c83dce048e79b747fe3aeb82342bfe10f00fb0fccb34e4b444b8f",
    points: [0, 1200, 0, 1640],
    chests: [0, 1, 0, 1],
  },
  {
    displayName: "lgcmentira",
    address: "0x04e5e01f0a28b1b16e6f94196676c6092e75e9e8a874880ef86d8e790bc34717",
    points: [0, 950, 0, 0],
    chests: [0, 1, 0, 0],
  },
  {
    displayName: "tarrence",
    address: "0x013f1386e3d4267a1502d8ca782d34b63634d969d3c527a511814c2ef67b84c4",
    points: [0, 490, 0, 0],
    chests: [0, 0, 0, 0],
  },
  {
    displayName: "lordbulbhead",
    address: "0x0665d10f25a27e8cd9f7363f5bc21448524b1000031be6fc7dd8787195091b7d",
    points: [0, 0, 0, 19123],
    chests: [0, 0, 0, 4],
  },
  {
    displayName: "0d1nf233",
    address: "0x04ac9805537b881adc2b95589f75e1b808c1b7cc59d0f6da80101dea5208b664",
    points: [0, 0, 0, 9432],
    chests: [0, 0, 0, 2],
  },
];

const SCORE_TO_BEAT_STATIC_ROW_BY_ADDRESS = new Map<string, ScoreToBeatStaticRow>(
  SCORE_TO_BEAT_STATIC_ROWS.map((row) => [row.address.toLowerCase(), row]),
);

const buildStaticGameBreakdown = (address: string): ScoreToBeatStaticGameBreakdown[] => {
  const row = SCORE_TO_BEAT_STATIC_ROW_BY_ADDRESS.get(address.toLowerCase());

  return SCORE_TO_BEAT_STATIC_GAMES.map((game) => {
    const gameIndex = SCORE_TO_BEAT_STATIC_GAME_INDEX.get(game) ?? 0;
    return {
      game,
      points: row?.points[gameIndex] ?? 0,
      chests: row?.chests[gameIndex] ?? 0,
    };
  });
};

const getStaticGameChestCountForRun = (address: string, endpoint: string): number | null => {
  const staticGame = SCORE_TO_BEAT_STATIC_ENDPOINT_TO_GAME.get(endpoint);
  if (!staticGame) {
    return null;
  }

  const gameIndex = SCORE_TO_BEAT_STATIC_GAME_INDEX.get(staticGame);
  if (gameIndex == null) {
    return 0;
  }

  const row = SCORE_TO_BEAT_STATIC_ROW_BY_ADDRESS.get(address.toLowerCase());
  return row?.chests[gameIndex] ?? 0;
};

const buildMockLeaderboardEntries = (
  game: ScoreToBeatStaticGame,
  limit: number,
  offset: number = 0,
): PlayerLeaderboardData[] => {
  const gameIndex = SCORE_TO_BEAT_STATIC_GAME_INDEX.get(game);
  if (gameIndex == null) return [];

  const rankedRows = SCORE_TO_BEAT_STATIC_ROWS.map((row) => ({
    row,
    points: row.points[gameIndex],
    chests: row.chests[gameIndex],
  }))
    .filter((entry) => entry.points > 0 || entry.chests > 0)
    .toSorted((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.chests !== b.chests) return b.chests - a.chests;
      return a.row.displayName.localeCompare(b.row.displayName);
    });

  return rankedRows.slice(offset, offset + limit).map((entry, index) => ({
    rank: offset + index + 1,
    address: entry.row.address,
    displayName: entry.row.displayName,
    points: entry.points,
    prizeClaimed: false,
  }));
};

const parseNumeric = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return 0;
    }

    try {
      if (/^0x[0-9a-f]+$/i.test(trimmed)) {
        return Number(BigInt(trimmed));
      }

      const asNumber = Number(trimmed);
      return Number.isFinite(asNumber) ? asNumber : 0;
    } catch {
      return 0;
    }
  }

  return 0;
};

const parseBigInt = (value: unknown): bigint | null => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    return BigInt(Math.trunc(value));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return null;
    }

    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }

  return null;
};

const parseInteger = (value: unknown): number | null => {
  const parsed = parseNumeric(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.trunc(parsed);
};

const bigintToDecimal = (value: bigint, decimals: number): number => {
  const safeDecimals = Math.max(0, Math.trunc(decimals));
  const divisor = 10n ** BigInt(safeDecimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  return Number(whole) + Number(fraction) / Number(divisor);
};

const normaliseAddress = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
};

const decodePlayerName = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }

  if (!trimmed.startsWith("0x")) {
    return trimmed;
  }

  try {
    const hex = trimmed.slice(2);
    if (hex.length % 2 !== 0) {
      return trimmed;
    }

    let output = "";
    for (let index = 0; index < hex.length; index += 2) {
      const chunk = hex.slice(index, index + 2);
      const charCode = parseInt(chunk, 16);

      if (Number.isInteger(charCode) && charCode > 0 && charCode < 127) {
        output += String.fromCharCode(charCode);
      }
    }

    return output.length ? output : trimmed;
  } catch (error) {
    console.warn("Failed to decode player name", error);
    return trimmed;
  }
};

const transformLandingLeaderboardRow = (row: PlayerLeaderboardRow, rank: number): PlayerLeaderboardData | null => {
  const address = normaliseAddress(row.playerAddress ?? null);
  if (!address) {
    return null;
  }

  const displayName = decodePlayerName(row.playerName ?? null);

  const totalRaw = parseNumeric(row.registeredPoints);
  const registeredRaw = Math.min(parseNumeric(row.registeredPointsRegistered), totalRaw);
  const registeredPoints = registeredRaw / REGISTERED_POINTS_PRECISION;
  const totalPoints = totalRaw / REGISTERED_POINTS_PRECISION;
  const unregisteredPoints = row.unregisteredPoints ?? Math.max(totalPoints - registeredPoints, 0);
  const prizeClaimedRaw = Boolean(row.prizeClaimed);

  const activity = row.activityBreakdown;
  const exploredTiles = activity.exploration.count;
  const exploredTilePoints = activity.exploration.points;
  const relicCratesOpened = activity.openRelicChest.count;
  const relicCratePoints = activity.openRelicChest.points;
  const structureBattlesCount = activity.otherStructureBanditsDefeat.count;
  const structureBattlesPoints = activity.otherStructureBanditsDefeat.points;
  const hyperstructureBattlesCount = activity.hyperStructureBanditsDefeat.count;
  const hyperstructureBattlesPoints = activity.hyperStructureBanditsDefeat.points;
  const hyperstructureSharePoints = activity.hyperstructureShare.points;
  const hyperstructureShareCount = activity.hyperstructureShare.count;

  const riftsTaken = structureBattlesCount;
  const riftPoints = structureBattlesPoints;
  const campsTaken = structureBattlesCount;
  const campPoints = structureBattlesPoints;
  const hyperstructuresConquered = hyperstructureBattlesCount;
  const hyperstructurePoints = hyperstructureBattlesPoints;
  const hyperstructuresHeld = hyperstructureShareCount > 0 ? hyperstructureShareCount : null;
  const hyperstructuresHeldPoints = hyperstructureSharePoints;

  return {
    rank,
    address,
    displayName: displayName && displayName.length ? displayName : null,
    points: totalPoints,
    registeredPoints,
    unregisteredPoints,
    prizeClaimed: prizeClaimedRaw,
    exploredTiles,
    exploredTilePoints,
    riftsTaken,
    riftPoints,
    hyperstructuresConquered,
    hyperstructurePoints,
    relicCratesOpened,
    relicCratePoints,
    campsTaken,
    campPoints,
    hyperstructuresHeld,
    hyperstructuresHeldPoints,
  } satisfies PlayerLeaderboardData;
};

const buildLeaderboardEntries = (rows: PlayerLeaderboardRow[], safeOffset: number): PlayerLeaderboardData[] => {
  const entries: PlayerLeaderboardData[] = [];

  rows.forEach((rawRow, index) => {
    const entry = transformLandingLeaderboardRow(rawRow, safeOffset + index + 1);
    if (entry) {
      entries.push(entry);
    }
  });

  return entries.toSorted((a, b) => b.points - a.points).map((entry, index) => ({ ...entry, rank: index + 1 }));
};

const fetchLeaderboardWithClient = async (
  client: SqlApi,
  limit: number = DEFAULT_LIMIT,
  offset: number = 0,
): Promise<PlayerLeaderboardData[]> => {
  const safeLimit = Math.max(0, limit);
  const safeOffset = Math.max(0, offset);

  if (safeLimit === 0) {
    return [];
  }

  const rows = await client.fetchPlayerLeaderboard(safeLimit, safeOffset);
  return buildLeaderboardEntries(rows, safeOffset);
};

export const fetchLandingLeaderboard = async (
  limit: number = DEFAULT_LIMIT,
  offset: number = 0,
  toriiBaseUrl?: string,
): Promise<PlayerLeaderboardData[]> => {
  const client = toriiBaseUrl ? createSqlApi(toriiBaseUrl) : sqlApi;
  return fetchLeaderboardWithClient(client, limit, offset);
};

export const fetchLandingLeaderboardEntryByAddress = async (
  playerAddress: string,
  toriiBaseUrl?: string,
): Promise<PlayerLeaderboardData | null> => {
  const normalizedAddress = normaliseAddress(playerAddress);
  if (!normalizedAddress) {
    return null;
  }

  const client = toriiBaseUrl ? createSqlApi(toriiBaseUrl) : sqlApi;
  const rawRow = await client.fetchPlayerLeaderboardByAddress(normalizedAddress);

  if (!rawRow) {
    return null;
  }

  const rank = typeof rawRow.rank === "number" && rawRow.rank > 0 ? Math.floor(rawRow.rank) : 1;

  return transformLandingLeaderboardRow(rawRow, rank);
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const normaliseToriiEndpoint = (value: string): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.search = "";
    const base = trimTrailingSlash(url.toString());
    return base.endsWith("/sql") ? base : `${base}/sql`;
  } catch {
    return null;
  }
};

const sanitiseToriiEndpoints = (endpoints: string[]): string[] => {
  const seen = new Set<string>();
  const sanitized: string[] = [];

  endpoints.forEach((candidate) => {
    const normalized = normaliseToriiEndpoint(candidate);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      sanitized.push(normalized);
    }
  });

  return sanitized;
};

const buildTrialIdMatchCondition = (columnName: string, trialId: bigint): string => {
  const trialIdDecimal = trialId.toString();
  const trialIdHexNoPrefix = trialId.toString(16).toLowerCase();

  return `(
    CAST(${columnName} AS TEXT) = '${trialIdDecimal}'
    OR ltrim(lower(CAST(${columnName} AS TEXT)), '0x') = '${trialIdHexNoPrefix}'
  )`;
};

const buildScoreToBeatRankPrizeQuery = (trialId: bigint): string => `
  SELECT
    rank,
    total_players_same_rank_count,
    total_prize_amount
  FROM "s1_eternum-RankPrize"
  WHERE ${buildTrialIdMatchCondition("trial_id", trialId)}
`;

type EndpointSnapshot = {
  endpoint: string;
  entries: PlayerLeaderboardData[];
};

type EndpointChestRewardSnapshot = {
  allocatedChests: number;
  totalRegisteredPoints: number;
};

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

const fetchLeaderboardForEndpoint = async (
  endpoint: string,
  limit: number,
  offset: number = 0,
): Promise<EndpointSnapshot> => {
  const staticGame = SCORE_TO_BEAT_STATIC_ENDPOINT_TO_GAME.get(endpoint);
  if (staticGame) {
    return {
      endpoint,
      entries: buildMockLeaderboardEntries(staticGame, limit, offset),
    };
  }

  return {
    endpoint,
    entries: await withTimeout(
      fetchLeaderboardWithClient(createSqlApi(endpoint), limit, offset),
      SCORE_TO_BEAT_ENDPOINT_TIMEOUT_MS,
      `Score to beat request timed out for ${endpoint}`,
    ),
  };
};

const fetchChestRewardSnapshotForEndpoint = async (endpoint: string): Promise<EndpointChestRewardSnapshot | null> => {
  if (SCORE_TO_BEAT_STATIC_ENDPOINT_TO_GAME.has(endpoint)) {
    return null;
  }

  try {
    const [chestRows, seasonRows] = await withTimeout(
      Promise.all([
        fetchWithErrorHandling<ScoreToBeatGameChestRewardRow>(
          buildApiUrl(endpoint, SCORE_TO_BEAT_GAME_CHEST_REWARD_QUERY),
          `Failed to fetch chest reward state for ${endpoint}`,
        ),
        fetchWithErrorHandling<ScoreToBeatSeasonPrizeRow>(
          buildApiUrl(endpoint, SCORE_TO_BEAT_SEASON_PRIZE_QUERY),
          `Failed to fetch season prize state for ${endpoint}`,
        ),
      ]),
      SCORE_TO_BEAT_ENDPOINT_TIMEOUT_MS,
      `Score to beat chest reward request timed out for ${endpoint}`,
    );

    return {
      allocatedChests: Math.max(0, Math.trunc(parseNumeric(chestRows[0]?.allocated_chests))),
      totalRegisteredPoints: Math.max(
        0,
        parseNumeric(seasonRows[0]?.total_registered_points) / REGISTERED_POINTS_PRECISION,
      ),
    };
  } catch (error) {
    console.warn("Failed to fetch Torii chest rewards", endpoint, error);
    return null;
  }
};

const fetchLordsRewardsByRankForEndpoint = async (endpoint: string): Promise<Map<number, number>> => {
  if (SCORE_TO_BEAT_STATIC_ENDPOINT_TO_GAME.has(endpoint)) {
    return new Map();
  }

  try {
    const finalRows = await withTimeout(
      fetchWithErrorHandling<ScoreToBeatPlayersRankFinalRow>(
        buildApiUrl(endpoint, SCORE_TO_BEAT_PLAYERS_RANK_FINAL_QUERY),
        `Failed to fetch finalized trial for ${endpoint}`,
      ),
      SCORE_TO_BEAT_ENDPOINT_TIMEOUT_MS,
      `Score to beat finalized trial request timed out for ${endpoint}`,
    );

    const finalTrialId = parseBigInt(finalRows[0]?.trial_id);
    if (finalTrialId == null || finalTrialId <= 0n) {
      return new Map();
    }

    const rankPrizeRows = await withTimeout(
      fetchWithErrorHandling<ScoreToBeatRankPrizeRow>(
        buildApiUrl(endpoint, buildScoreToBeatRankPrizeQuery(finalTrialId)),
        `Failed to fetch rank prize state for ${endpoint}`,
      ),
      SCORE_TO_BEAT_ENDPOINT_TIMEOUT_MS,
      `Score to beat rank prize request timed out for ${endpoint}`,
    );

    const lordsByRank = new Map<number, number>();
    rankPrizeRows.forEach((row) => {
      const rank = parseInteger(row.rank);
      const totalPlayersAtRank = parseBigInt(row.total_players_same_rank_count);
      const totalPrizeAmountRaw = parseBigInt(row.total_prize_amount);

      if (
        rank == null ||
        rank <= 0 ||
        totalPlayersAtRank == null ||
        totalPlayersAtRank <= 0n ||
        totalPrizeAmountRaw == null ||
        totalPrizeAmountRaw <= 0n
      ) {
        return;
      }

      const lordsShareRaw = totalPrizeAmountRaw / totalPlayersAtRank;
      const lordsShare = bigintToDecimal(lordsShareRaw, LORDS_TOKEN_DECIMALS);
      if (!Number.isFinite(lordsShare) || lordsShare <= 0) {
        return;
      }

      lordsByRank.set(rank, lordsShare);
    });

    return lordsByRank;
  } catch (error) {
    console.warn("Failed to fetch Torii Lords rewards", endpoint, error);
    return new Map();
  }
};

const estimateEarnedChests = (
  registeredPoints: number,
  endpointChestRewardSnapshot: EndpointChestRewardSnapshot | null,
): number => {
  const safeRegisteredPoints = Number.isFinite(registeredPoints) ? Math.max(0, registeredPoints) : 0;
  const guaranteedChestBonus = safeRegisteredPoints >= GAME_REWARD_CHEST_POINTS_THRESHOLD ? 1 : 0;

  if (!endpointChestRewardSnapshot) {
    return guaranteedChestBonus;
  }

  const { allocatedChests, totalRegisteredPoints } = endpointChestRewardSnapshot;
  if (allocatedChests <= 0 || totalRegisteredPoints <= 0) {
    return guaranteedChestBonus;
  }

  const proportionalChestShare = Math.floor((allocatedChests * safeRegisteredPoints) / totalRegisteredPoints);
  return Math.max(0, guaranteedChestBonus + Math.max(0, proportionalChestShare));
};

export const fetchScoreToBeatAcrossEndpoints = async (
  toriiEndpoints: string[],
  { perEndpointLimit = 50, runsToAggregate = 2, maxPlayers }: ScoreToBeatOptions = {},
): Promise<ScoreToBeatResult> => {
  const safePerEndpointLimit = perEndpointLimit > 0 ? perEndpointLimit : DEFAULT_LIMIT;
  const safeRunsToAggregate = runsToAggregate > 0 ? runsToAggregate : 2;
  const safeMaxPlayers =
    typeof maxPlayers === "number" && Number.isFinite(maxPlayers) && maxPlayers > 0 ? Math.floor(maxPlayers) : null;

  const sanitizedEndpoints = sanitiseToriiEndpoints(toriiEndpoints);

  if (sanitizedEndpoints.length === 0) {
    return {
      entries: [],
      endpoints: [],
      failedEndpoints: [],
      generatedAt: Date.now(),
    };
  }

  const settledSnapshots = await Promise.allSettled(
    sanitizedEndpoints.map((endpoint) => fetchLeaderboardForEndpoint(endpoint, safePerEndpointLimit)),
  );

  const successfulSnapshots: EndpointSnapshot[] = [];
  const failedEndpoints: string[] = [];

  settledSnapshots.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successfulSnapshots.push(result.value);
    } else {
      failedEndpoints.push(sanitizedEndpoints[index]);
      console.error("Failed to fetch Torii leaderboard", sanitizedEndpoints[index], result.reason);
    }
  });

  const endpointChestRewardsByEndpoint = new Map<string, EndpointChestRewardSnapshot | null>();
  const endpointLordsRewardsByEndpoint = new Map<string, Map<number, number>>();
  await Promise.all(
    successfulSnapshots.map(async ({ endpoint }) => {
      const [endpointChestRewards, endpointLordsRewards] = await Promise.all([
        fetchChestRewardSnapshotForEndpoint(endpoint),
        fetchLordsRewardsByRankForEndpoint(endpoint),
      ]);
      endpointChestRewardsByEndpoint.set(endpoint, endpointChestRewards);
      endpointLordsRewardsByEndpoint.set(endpoint, endpointLordsRewards);
    }),
  );

  const perPlayer = new Map<string, { address: string; displayName: string | null; runs: ScoreToBeatRun[] }>();

  successfulSnapshots.forEach(({ endpoint, entries }) => {
    entries.forEach((entry) => {
      const key = entry.address.toLowerCase();
      const snapshot = perPlayer.get(key) ?? {
        address: entry.address,
        displayName: entry.displayName ?? null,
        runs: [],
      };

      if (!snapshot.displayName && entry.displayName) {
        snapshot.displayName = entry.displayName;
      }

      const staticRunChests = getStaticGameChestCountForRun(entry.address, endpoint);
      const runChests =
        staticRunChests ??
        estimateEarnedChests(entry.registeredPoints ?? 0, endpointChestRewardsByEndpoint.get(endpoint) ?? null);
      const runLords = endpointLordsRewardsByEndpoint.get(endpoint)?.get(entry.rank) ?? 0;

      snapshot.runs.push({ endpoint, points: entry.points, chests: runChests, lords: runLords, rank: entry.rank });
      perPlayer.set(key, snapshot);
    });
  });

  const aggregatedEntries = Array.from(perPlayer.values())
    .map((player) => {
      const allRuns = player.runs.toSorted((a, b) => b.points - a.points);
      const bestRuns = allRuns.slice(0, safeRunsToAggregate);
      const combinedPoints = bestRuns.reduce((sum, run) => sum + run.points, 0);
      const combinedChests = bestRuns.reduce((sum, run) => sum + run.chests, 0);
      const combinedLords = bestRuns.reduce((sum, run) => sum + run.lords, 0);

      return {
        address: player.address,
        displayName: player.displayName,
        combinedPoints,
        combinedChests,
        combinedLords,
        allRuns,
        runs: bestRuns,
        totalRuns: player.runs.length,
        staticGames: buildStaticGameBreakdown(player.address),
      } satisfies ScoreToBeatEntrySummary;
    })
    .filter((entry) => entry.runs.length > 0)
    .toSorted((a, b) => {
      if (a.combinedPoints !== b.combinedPoints) {
        return b.combinedPoints - a.combinedPoints;
      }

      if (a.combinedChests !== b.combinedChests) {
        return b.combinedChests - a.combinedChests;
      }

      return b.combinedLords - a.combinedLords;
    });

  return {
    entries: safeMaxPlayers === null ? aggregatedEntries : aggregatedEntries.slice(0, safeMaxPlayers),
    endpoints: sanitizedEndpoints,
    failedEndpoints,
    generatedAt: Date.now(),
  } satisfies ScoreToBeatResult;
};
