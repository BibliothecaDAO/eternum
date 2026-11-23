import { FRAGMENT_CENTS, FRAGMENTS_A_DAY, MIN_FRAGMENTS } from "@bibliothecadao/types";

import type { IdentityAuth } from "./auth";
import { json } from "./http";
import { quoteLords, type LordsQuoteReader } from "./lords-price";
import { fragmentsBoughtOn, type LordsPayee } from "./fragment-payments";
import { authorizeShop, namedGame, type NamedGame, type ShopAccess } from "./shop-game";

const QUOTE_SECONDS = 600;
const WEI_PER_LORDS = 10n ** 18n;

export interface FragmentPriceWorld {
  db: D1Database;
  access: ShopAccess;
  readLordsQuote: LordsQuoteReader;
  payee: LordsPayee;
  now: () => number;
}

export async function handleFragmentPrice(
  request: Request,
  auth: IdentityAuth,
  world: FragmentPriceWorld,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const url = new URL(request.url);
  const game = namedGame(url.searchParams.get("chain"), url.searchParams.get("game"));
  const seat = await authorizeShop(request, auth, world.access, game);
  if (seat instanceof Response) return seat;
  const fragments = Number(url.searchParams.get("fragments"));
  if (!isFragmentAmount(fragments)) return json({ error: "invalid_fragments" }, 400);
  const remaining = FRAGMENTS_A_DAY - (await fragmentsBoughtOn(world.db, seat.owner, world.now()));
  if (fragments > remaining) return json({ error: "daily_cap", remaining: Math.max(remaining, 0) }, 429);
  const cents = fragments * FRAGMENT_CENTS;
  const lords = await quoteLords(cents, world.readLordsQuote);
  if (lords === null) return json({ fragments, cents, quote: null });
  return json({ fragments, cents, quote: await recordQuote(world, seat.owner, game!, fragments, lords) });
}

const isFragmentAmount = (fragments: number) => Number.isSafeInteger(fragments) && fragments >= MIN_FRAGMENTS;

async function recordQuote(
  world: FragmentPriceWorld,
  owner: string,
  game: NamedGame,
  fragments: number,
  lords: number,
) {
  const now = world.now();
  const quote = {
    id: crypto.randomUUID(),
    lordsWei: (BigInt(lords) * WEI_PER_LORDS).toString(),
    token: world.payee.token,
    treasury: world.payee.treasury,
    expiresAt: now + QUOTE_SECONDS,
  };
  await world.db
    .prepare(
      `INSERT INTO "fragment_quotes" ("id", "owner", "chain_id", "game_id", "fragments", "lords_wei", "token", "treasury",
       "expires_at", "created_at") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      quote.id,
      owner,
      game.chainId,
      game.gameId,
      fragments,
      quote.lordsWei,
      quote.token,
      quote.treasury,
      quote.expiresAt,
      now,
    )
    .run();
  return quote;
}
