// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("App loading boundaries", () => {
  it("keeps game manifest and generated config loaders out of the landing shell", () => {
    const gameClientSource = readSource("src/game-client-app.tsx");
    const controllerAccountSource = readSource("src/hooks/context/use-controller-account.ts");
    const starknetProviderSource = readSource("src/hooks/context/starknet-provider.tsx");
    const starknetChainConfigSource = readSource("src/hooks/context/starknet-chain-config.ts");

    expect(gameClientSource).not.toContain('from "./runtime/world"');
    expect(gameClientSource).not.toContain('from "./ui/features/landing"');
    expect(controllerAccountSource).not.toContain('from "./session-policy-refresh"');
    expect(starknetProviderSource).not.toContain('from "@/runtime/world"');
    expect(starknetProviderSource).not.toContain("dojo-config");
    expect(starknetChainConfigSource).not.toContain('from "@/runtime/world"');
  });
});
