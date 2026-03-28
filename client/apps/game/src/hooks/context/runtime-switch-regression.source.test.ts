// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("runtime chain switch regression", () => {
  it("rebuilds the starknet provider from the active world selection", () => {
    const source = readSource("src/hooks/context/starknet-provider.tsx");

    expect(source).toContain("resolveActiveWorldChain");
    expect(source).toContain("subscribeToWorldSelectionChange");
    expect(source).toContain("key={providerKey}");
  });

  it("builds session signing policies from the active runtime chain", () => {
    const source = readSource("src/hooks/context/policies.ts");

    expect(source).toContain("buildSigningMessages(resolveActivePolicyChain())");
    expect(source).not.toContain('import { messages } from "./signing-policy"');
  });

  it("chooses mainnet settlement behavior from the selected game chain", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain('const isMainnet = chain === "mainnet";');
  });
});
