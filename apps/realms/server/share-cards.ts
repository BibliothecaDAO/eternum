import { SHARE_CARD, SHARE_PATH, SHARED_MOMENT_WORDS, shareCardPath, sharePath } from "@realms-world/identity";

import type { IdentityAuth } from "./auth";
import { readCampaignCode } from "./campaigns";
import { json } from "./http";
import { createShareStore } from "./share-store";
import { signedInRealmsId } from "./shares";

/** Where shared cards are kept: R2, one object per link (wrangler.jsonc's SHARE_CARDS). */
export type ShareCards = Pick<R2Bucket, "put" | "get" | "head">;

const cardKey = (code: string) => `cards/${code}.jpg`;
/** Every JPEG starts with its start-of-image marker and a segment marker. */
const JPEG_START = [0xff, 0xd8, 0xff];
/** A card is the same image until its sharer makes it again: a day the reader's cache keeps, an unfurl's crawl reads. */
const CARD_CACHE = "public, max-age=86400";

/**
 * PUT /api/shares/<code>/card: the sharer's browser hands over the card it drew for its link, as the JPEG their post's
 * image is, so the link unfurls as the card. Only the link's sharer may, with at most SHARE_CARD.bytes of a JPEG; a
 * second card for the same link replaces the first.
 */
export async function handleShareCardUpload(
  request: Request,
  auth: IdentityAuth,
  db: D1Database,
  cards: ShareCards,
  code: string,
) {
  const sharer = await signedInRealmsId(request, auth);
  if (typeof sharer !== "string") return sharer;
  const link = readCampaignCode(code);
  const shared = link ? await createShareStore(db).sharedLink(link) : null;
  if (!link || shared?.sharer !== sharer) return json({ error: "share_unknown" }, 404);
  const image = await readCard(request);
  if (!image) return json({ error: "invalid_card" }, 400);
  await cards.put(cardKey(link), image, { httpMetadata: { contentType: SHARE_CARD.type, cacheControl: CARD_CACHE } });
  return new Response(null, { status: 204 });
}

/** GET /api/shares/<code>/card: the link's card, for its unfurl; 404 until its sharer's browser made one. */
export async function handleShareCard(cards: ShareCards, code: string) {
  const link = readCampaignCode(code);
  const card = link ? await cards.get(cardKey(link)) : null;
  if (!card) return json({ error: "card_unknown" }, 404);
  return new Response(card.body, { headers: { "content-type": SHARE_CARD.type, "cache-control": CARD_CACHE } });
}

/**
 * GET /s/<code>: the game's page as the host serves it, with what the link says written into its unfurl: who shared
 * which moment, the game's pitch, the link itself, and the card once its sharer's browser made one (else the game's
 * own preview stands). A crawler reads no script, so this is the only place an unfurl can learn whose link it is. A
 * code no link has, or a page the host did not serve, passes through as the host answered it.
 */
export async function handleSharedPage(
  request: Request,
  { db, cards, origin }: { db: D1Database; cards: ShareCards; origin: string },
  fetchPage: (request: Request) => Promise<Response>,
) {
  const page = await fetchPage(request);
  const link = readCampaignCode(new URL(request.url).pathname.slice(SHARE_PATH.length + 1));
  const shared = link ? await createShareStore(db).sharedLink(link) : null;
  if (!link || !shared || !page.ok || !page.headers.get("content-type")?.includes("text/html")) return page;
  const card = await cards.head(cardKey(link));
  const html = withShareUnfurl(await page.text(), {
    title: SHARED_MOMENT_WORDS.title(shared.name, shared.moment),
    description: SHARED_MOMENT_WORDS.pitch,
    url: `${origin}${sharePath(link)}`,
    image: card ? `${origin}${shareCardPath(link)}` : null,
  });
  const headers = new Headers(page.headers);
  headers.delete("content-length");
  return new Response(html, { status: page.status, headers });
}

/**
 * The page with its unfurl's tags saying the link's own: the title (the page's and the tags'), the description, the
 * address and, when there is one, the image. Only the content of tags the page already has changes.
 */
const withShareUnfurl = (
  html: string,
  unfurl: { title: string; description: string; url: string; image: string | null },
) => {
  const tags: [string, string][] = [
    ["og:title", unfurl.title],
    ["description", unfurl.description],
    ["og:description", unfurl.description],
    ["og:url", unfurl.url],
    ...(unfurl.image
      ? ([
          ["og:image", unfurl.image],
          ["twitter:image", unfurl.image],
        ] as [string, string][])
      : []),
  ];
  const tagged = tags.reduce(
    (page, [name, value]) =>
      page.replace(
        new RegExp(`(<meta (?:property|name)="${name}" content=")[^"]*(")`),
        (_, open: string, close: string) => `${open}${escapeAttribute(value)}${close}`,
      ),
    html,
  );
  return tagged.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttribute(unfurl.title)}</title>`);
};

const escapeAttribute = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** The request's body when it is a JPEG of at most SHARE_CARD.bytes; null for anything else. */
const readCard = async (request: Request): Promise<ArrayBuffer | null> => {
  if (request.headers.get("content-type") !== SHARE_CARD.type) return null;
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > SHARE_CARD.bytes) return null;
  const image = await request.arrayBuffer().catch(() => null);
  if (!image || image.byteLength === 0 || image.byteLength > SHARE_CARD.bytes) return null;
  const start = new Uint8Array(image, 0, Math.min(JPEG_START.length, image.byteLength));
  return JPEG_START.every((byte, index) => start[index] === byte) ? image : null;
};
