import { expect, it } from "vitest";
import { adminConfigOf, type AdminBindings } from "./env";

const dev = {
  ADMIN_ENVIRONMENT: "dev",
  ACCESS_TEAM_DOMAIN: "realms.cloudflareaccess.com",
  ACCESS_AUD: "aud",
  OPERATOR_TOKEN: "dev-token",
} as AdminBindings;
const production = { ...dev, ADMIN_ENVIRONMENT: "production", ADMIN_WRITERS: "Owner@realms.world" } as AdminBindings;

it("operates its own environment's origin and links to the other environment's admin", () => {
  expect(adminConfigOf(dev)).toMatchObject({
    environment: "dev",
    origin: "https://play.dev-realms.party",
    access: { audience: "aud" },
    writers: null,
    other: { environment: "production", url: "https://admin.realms.party" },
  });
  expect(adminConfigOf(production)).toMatchObject({
    origin: "https://play.realms.party",
    writers: ["owner@realms.world"],
    other: { environment: "dev", url: "https://admin.dev-realms.party" },
  });
});

it("refuses to run with any setting blank, naming it", () => {
  for (const name of Object.keys(production) as (keyof AdminBindings)[])
    expect(() => adminConfigOf({ ...production, [name]: " " }), name).toThrow(`Admin is missing ${name}`);
});

it("refuses a writers list on dev, where every operator may act", () => {
  expect(() => adminConfigOf({ ...dev, ADMIN_WRITERS: "owner@realms.world" })).toThrow(
    "Dev admin takes no ADMIN_WRITERS",
  );
});
