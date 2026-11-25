import { expect, it } from "vitest";
import { buildRingOpenNotification, buildSiteVulnerableNotification } from "./site-vulnerable";
import { notificationMatchesGame, parseNotificationPayload } from "./delivery";
import { includesKind } from "./notification-kinds";

it("opens the site's coordinate and gives it one identity per owner, site kind and day", () => {
  const input = {
    chainId: "0xa",
    gameId: 1,
    kind: 2,
    siteName: "Ethereal mine",
    col: -50,
    row: 350,
    day: 2,
    owner: "0x1",
    now: 1000,
    until: 10000,
  };
  const alert = buildSiteVulnerableNotification(input)!;
  expect(alert.target).toBe("/g/0xa/1/map?col=-50&row=350");
  expect(alert.title).toBe("Ethereal mine can be taken");
  expect(buildSiteVulnerableNotification({ ...input, col: 10, row: 10 })!.id).toBe(alert.id);
  expect(buildSiteVulnerableNotification({ ...input, kind: 1 })!.id).not.toBe(alert.id);
  expect(buildSiteVulnerableNotification({ ...input, now: 2000 })!.id).toBe(alert.id);
  expect(buildSiteVulnerableNotification({ ...input, day: 3 })!.id).not.toBe(alert.id);
  expect(buildSiteVulnerableNotification({ ...input, now: 10000 })).toBeNull();
  expect(includesKind("important", "site-vulnerable")).toBe(true);
  expect(includesKind("off", "site-vulnerable")).toBe(false);
  expect(
    notificationMatchesGame("https://game.test/g/0xa/1/map?col=-50&row=350", alert.target, "https://game.test"),
  ).toBe(true);
  expect(notificationMatchesGame("https://game.test/g/0xa/1/map", alert.target, "https://game.test")).toBe(false);
  for (const target of [
    alert.target + "&redirect=/chat",
    "/g/0xa/1/map?col=NaN&row=0",
    "/g/0xa/1/map?col=0",
    "/g/0xa/1/hex?col=0&row=0",
  ])
    expect(() => parseNotificationPayload({ ...alert, target }, input.now)).toThrow();
});

it("says which ring opened and how many sites it adds, and opens that ring once per owner and day", () => {
  const input = {
    chainId: "0xa",
    gameId: 1,
    ring: 1,
    sites: 6,
    col: 8,
    row: -8,
    day: 2,
    owner: "0x1",
    now: 1000,
    until: 10000,
  };
  const alert = buildRingOpenNotification(input)!;
  expect(alert.title).toBe("Ring 2 is open");
  expect(alert.body).toBe("6 new sites are open today.");
  expect(alert.target).toBe("/g/0xa/1/map?col=8&row=-8");
  expect(alert.kind).toBe("site-vulnerable");
  expect(buildRingOpenNotification({ ...input, now: 2000 })!.id).toBe(alert.id);
  expect(buildRingOpenNotification({ ...input, ring: 2 })!.id).not.toBe(alert.id);
  expect(buildRingOpenNotification({ ...input, now: 10000 })).toBeNull();
});
