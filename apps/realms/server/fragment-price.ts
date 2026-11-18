import { FRAGMENT_CENTS, MIN_FRAGMENTS } from "@bibliothecadao/types";

import type { IdentityAuth } from "./auth";
import { json } from "./http";
import { quoteLords, type LordsQuoteReader } from "./lords-price";
import { authorizeShop, namedGame, type ShopAccess } from "./shop-game";

export interface FragmentPriceWorld {
  access: ShopAccess;
  readLordsQuote: LordsQuoteReader;
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
  const cents = fragments * FRAGMENT_CENTS;
  return json({ fragments, cents, lords: await quoteLords(cents, world.readLordsQuote) });
}

const isFragmentAmount = (fragments: number) => Number.isSafeInteger(fragments) && fragments >= MIN_FRAGMENTS;
