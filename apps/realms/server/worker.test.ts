import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { buildWorkerBundle, migrationStatements, newStorage, ORIGIN, startWorker, vapidKeys } from "./workerd-harness";

/**
 * The game's page as Pages serves it at any app address (the SPA's `/s/:code / 200`): the client's own index.html, its
 * link preview and address filled in as the build fills them for staging.
 */
const LINK_PREVIEW = `${ORIGIN}/images/covers/link-preview.png`;
const GAME_PAGE = readFileSync(new URL("../../game/index.html", import.meta.url), "utf8")
  .replaceAll("%LINK_PREVIEW%", LINK_PREVIEW)
  .replaceAll("%APP_ADDRESS%", ORIGIN);

let bundle: string;
let worker: Awaited<ReturnType<typeof startWorker>>;

beforeAll(async () => {
  bundle = buildWorkerBundle();
  const launchDirectory = vi.fn(async () => Response.json({ chains: [] }));
  worker = await startWorker({
    bundle,
    storage: newStorage(),
    vapid: await vapidKeys(),
    outbound: async (request) =>
      new URL(request.url).pathname.startsWith("/s/")
        ? new Response(GAME_PAGE, { headers: { "content-type": "text/html; charset=utf-8" } })
        : new Response("unexpected outbound request", { status: 500 }),
    launchDirectory,
  });
  await worker.db.batch(migrationStatements().map((sql) => worker.db.prepare(sql)));
  launchDirectoryMock = launchDirectory;
}, 180_000);

afterAll(() => worker?.dispose());

let launchDirectoryMock: ReturnType<typeof vi.fn>;

it("routes the directory read through the launch service binding", async () => {
  const response = await worker.mf.dispatchFetch(`${ORIGIN}/api/directory`);

  expect(response.status).toBe(200);
  expect(launchDirectoryMock).toHaveBeenCalledOnce();
  expect(launchDirectoryMock.mock.calls[0]?.[0].url).toBe("https://launch/api/factory/directory-games");
});

it("serves health and email sign-in while the chain is unreachable, and the top list says it is unavailable", async () => {
  expect((await worker.mf.dispatchFetch(`${ORIGIN}/api/health`)).status).toBe(200);
  expect(await (await worker.mf.dispatchFetch(`${ORIGIN}/api/auth/providers`)).json()).toEqual({ providers: [] });
  const player = await worker.signInWithEmailCode("no-chain@realms.test");
  expect(player.realmsId).toMatch(/^0x/);
  const top = await worker.mf.dispatchFetch(`${ORIGIN}/api/ratings/top`);
  expect(top.status).toBe(503);
  expect(await top.json()).toEqual({ error: "ratings_unavailable" });
});

it("unfurls a shared day through the deployed bundle: the host's page with the link's tags, then its published card", async () => {
  const sharer = await worker.signInWithEmailCode("day-sharer@realms.test");
  const asSharer = (path: string, method: string, type: string, body: string | Uint8Array) =>
    worker.mf.dispatchFetch(`${ORIGIN}${path}`, {
      method,
      headers: { origin: ORIGIN, cookie: sharer.cookie, "content-type": type },
      body,
    });
  const moment = { kind: "frontier-day", chainId: "0x1", gameId: 1, moment: 12 };
  const made = await asSharer("/api/shares", "POST", "application/json", JSON.stringify(moment));
  const { code } = (await made.json()) as { code: string };
  const tag = (html: string, name: string) =>
    new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)"`).exec(html)?.[1];
  const crawl = async (path: string) => (await worker.mf.dispatchFetch(`${ORIGIN}${path}`)).text();

  // Opened, never posted: the link says who shared which day, and its preview is still the game's own.
  const before = await crawl(`/s/${code}`);
  expect(before).toContain("<title>A player shared Day 12 of Frontier</title>");
  expect(tag(before, "og:title")).toBe("A player shared Day 12 of Frontier");
  expect(tag(before, "og:url")).toBe(`${ORIGIN}/s/${code}`);
  expect(tag(before, "og:image")).toBe(LINK_PREVIEW);
  expect(tag(before, "twitter:image")).toBe(LINK_PREVIEW);
  expect((await worker.mf.dispatchFetch(`${ORIGIN}/api/shares/${code}/card`)).status).toBe(404);

  // The press of a way to post publishes the card, which the link then unfurls as, to any crawler.
  const jpeg = new Uint8Array(4_096).fill(9);
  jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
  const published = await asSharer(`/api/shares/${code}/card`, "PUT", "image/jpeg", jpeg);
  expect(published.status).toBe(204);
  const after = await crawl(`/s/${code}?via=x`);
  expect(tag(after, "og:image")).toBe(`${ORIGIN}/api/shares/${code}/card`);
  expect(tag(after, "twitter:image")).toBe(`${ORIGIN}/api/shares/${code}/card`);
  expect(tag(after, "twitter:card")).toBe("summary_large_image");
  const card = await worker.mf.dispatchFetch(`${ORIGIN}/api/shares/${code}/card`);
  expect(card.headers.get("content-type")).toBe("image/jpeg");
  expect(card.headers.get("cache-control")).toBe("public, max-age=86400");
  expect(new Uint8Array(await card.arrayBuffer())).toEqual(jpeg);

  // A code no link has is the host's page, untouched.
  expect(await crawl("/s/NOPE2345")).toBe(GAME_PAGE);
});
