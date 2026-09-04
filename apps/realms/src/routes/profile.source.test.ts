// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./profile.tsx", import.meta.url), "utf8");

describe("profile sign-out wiring", () => {
  it("ends the identity session before disconnecting the wallet", () => {
    expect(source).toMatch(
      /const signOut = useMutation\(\(\) =>[\s\S]*yield\* IdentityApi;[\s\S]*yield\* identity\.signOut;[\s\S]*yield\* Wallet;[\s\S]*yield\* wallet\.disconnect;/,
    );
  });
});
