// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("App loading boundaries", () => {
  it("keeps game manifest and generated config loaders out of the landing shell", () => {
    const gameClientSource = readSource("src/game-client-app.tsx");
    const starknetProviderSource = readSource("src/hooks/context/starknet-provider.tsx");

    expect(gameClientSource).not.toContain('from "./runtime/world"');
    expect(gameClientSource).not.toContain('from "./ui/features/landing"');
    expect(starknetProviderSource).not.toContain('from "@/runtime/world"');
    expect(starknetProviderSource).not.toContain("dojo-config");
  });
});
