// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

/**
 * The play route never guesses with a timer and never leaves the app to recover an account: the identity session
 * says whether a gameplay account is coming, and the sign-in surface renders on the route itself.
 */
describe("play route boot discipline", () => {
  it("has no reconnect grace timer and no hard navigation", () => {
    const boot = readSource("src/game-entry/play-route-boot.ts");
    const route = readSource("src/game-route.tsx");
    for (const source of [boot, route]) {
      expect(source).not.toMatch(/RECONNECT_GRACE|location\.assign|location\.reload/);
    }
    expect(boot).toContain("useIdentitySession()");
  });

  it("the reconnect screen signs in inline", () => {
    const screen = readSource("src/ui/layouts/play-route-reconnect-screen.tsx");
    expect(screen).toContain("<IdentityLogin");
    expect(screen).not.toContain("onReconnect");
  });
});
