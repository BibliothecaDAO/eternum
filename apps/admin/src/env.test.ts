import { expect, it } from "vitest";
import { adminConfigOf, type AdminBindings } from "./env";

const bindings = {
  ADMIN_HOSTNAME: "admin.realms.party",
  ACCESS_TEAM_DOMAIN: "realms.cloudflareaccess.com",
  ACCESS_AUD: "aud",
  ACCESS_PRODUCTION_AUD: "production-aud",
  OPERATOR_TOKEN_DEV: "dev",
  OPERATOR_TOKEN_PRODUCTION: "production",
} as AdminBindings;

it("targets each environment's own game origin with its own token", () => {
  const { targets } = adminConfigOf(bindings);
  expect([targets.dev.origin, targets.dev.operatorToken]).toEqual(["https://play.dev-realms.party", "dev"]);
  expect([targets.production.origin, targets.production.operatorToken]).toEqual([
    "https://play.realms.party",
    "production",
  ]);
});

it("refuses to run with any setting blank, naming it", () => {
  for (const name of Object.keys(bindings) as (keyof AdminBindings)[])
    expect(() => adminConfigOf({ ...bindings, [name]: " " }), name).toThrow(`Admin is missing ${name}`);
});
