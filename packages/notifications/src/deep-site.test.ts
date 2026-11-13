import { expect, it } from "vitest";

import { buildDeepSiteNotification } from "./deep-site";

const HOUR = 3_600_000;
const at = Date.UTC(2026, 10, 13, 10);

const site = (input: { day?: number; siteId?: number; now?: number } = {}) =>
  buildDeepSiteNotification({
    chainId: "0xa",
    gameId: 6,
    site: { id: input.siteId ?? 300, name: "Foundation" },
    day: input.day ?? 4,
    at,
    until: at + 6 * HOUR,
    guard: 1_000,
    army: 1_500,
    owner: "0x1",
    game: { mode: "frontier" as const },
    now: input.now ?? at,
  });

it("tells a player a Deep site is within their army's reach, until its day ends, one shown per site", () => {
  expect(site()).toMatchObject({
    kind: "deep-sites",
    title: "The Foundation can be taken",
    body: "Frontier: its guard is down to 1,000 troops. Your army has 1,500.",
    tag: "deep-sites:/g/0xa/6:300",
    createdAt: at,
    expiresAt: at + 6 * HOUR,
  });
  // One per site and day: the same site the same day is the same alert; another site or day is another.
  expect(site().id).toBe(site().id);
  expect(site({ day: 5 }).id).not.toBe(site().id);
  expect(site({ siteId: 301 }).tag).not.toBe(site().tag);
  // Its day over, the guards are gone: nothing to tell.
  expect(site({ now: at + 6 * HOUR })).toBeNull();
});
