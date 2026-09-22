import { readNotificationBody } from "../notification-http";
import {
  encodeStoryHistoryCursor,
  parseStoryHistoryCursor,
  compareStoryHistoryCursors,
  endOfStoryBlock,
  type HeraldStoryHistoryPage,
  type StoryHistoryCursor,
  type HeraldGameDirectory,
} from "@bibliothecadao/eternum/game-sync";

export interface NotificationSourceConfig {
  url: string;
  chainId: string;
  worldAddress: string;
}
export function createNotificationSource(
  config: NotificationSourceConfig,
  request: (url: URL, init: RequestInit) => Promise<Response> = globalThis.fetch,
) {
  const read = async (path: string): Promise<unknown> => {
    const response = await request(new URL(path, `${config.url}/`), {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Notification history HTTP ${response.status}`);
    return JSON.parse(await readNotificationBody(response, 2_000_000));
  };
  return {
    key: `${config.chainId}:${config.worldAddress}`,
    page: async (after: StoryHistoryCursor | null): Promise<HeraldStoryHistoryPage> => {
      const query = after ? `&after=${encodeURIComponent(encodeStoryHistoryCursor(after))}` : "";
      return validateStoryPage(await read(`history/story-events?limit=100${query}`), config, after);
    },
    games: async (): Promise<Map<number, string>> => {
      const directory = (await read("games")) as HeraldGameDirectory;
      if (
        !isSourceChain(directory.chain, config) ||
        directory.world_address === undefined ||
        BigInt(directory.world_address) !== BigInt(config.worldAddress) ||
        !Array.isArray(directory.games) ||
        directory.games.length > 10000
      )
        throw new Error("Invalid notification game directory");
      const games = new Map<number, string>();
      for (const game of directory.games) {
        if (!Number.isSafeInteger(game.game_id) || game.game_id <= 0 || !/^[A-Za-z0-9_-]{1,100}$/.test(game.name))
          throw new Error("Invalid notification game target");
        games.set(game.game_id, game.name);
      }
      return games;
    },
  };
}

/** Herald names its chain by chain id; any other spelling of the id is the same chain. */
function isSourceChain(chain: unknown, config: NotificationSourceConfig): boolean {
  return typeof chain === "string" && /^0x[0-9a-f]{1,64}$/i.test(chain) && BigInt(chain) === BigInt(config.chainId);
}

function validateStoryPage(
  value: unknown,
  config: NotificationSourceConfig,
  after: StoryHistoryCursor | null,
): HeraldStoryHistoryPage {
  if (!value || typeof value !== "object") throw new Error("Invalid notification history");
  const page = value as HeraldStoryHistoryPage;
  if (
    !isSourceChain(page.chain, config) ||
    BigInt(page.world_address) !== BigInt(config.worldAddress) ||
    !Array.isArray(page.items) ||
    page.items.length > 100
  )
    throw new Error("Notification history scope changed");
  const head = endOfStoryBlock(page.complete_through_block),
    next = parseStoryHistoryCursor(page.next_cursor);
  let previous = after;
  for (const event of page.items) {
    const position = parseStoryHistoryCursor({
      block: event.block_number,
      transaction: event.transaction_index,
      event: event.event_index,
    });
    if (
      !previous ||
      compareStoryHistoryCursors(position, previous) <= 0 ||
      compareStoryHistoryCursors(position, head) > 0 ||
      event.model !== "StoryEvent"
    )
      throw new Error("Unordered notification history");
    if (!event.value || typeof event.value !== "object" || Number(event.game_id) !== Number(event.value.game_id))
      throw new Error("Invalid notification event scope");
    previous = position;
  }
  if ((previous && compareStoryHistoryCursors(next, previous) < 0) || compareStoryHistoryCursors(next, head) > 0)
    throw new Error("Invalid next notification cursor");
  return { ...page, next_cursor: next };
}
