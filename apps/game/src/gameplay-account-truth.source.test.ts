// @vitest-environment node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_SOURCE_ROOT = resolve(process.cwd(), "src");
const IDENTITY_WALLET_BOUNDARIES = [
  "hooks/context/gameplay-account-sync.tsx",
  "ui/modules/identity/identity-login.tsx",
];

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!/\.(ts|tsx)$/.test(entry) || /\.(test|source\.test)\.(ts|tsx)$/.test(entry)) return [];
    return [path];
  });

describe("gameplay account truth", () => {
  it("uses the identity wallet connector only at the login and provisioning boundaries", () => {
    const connectorReaders = sourceFiles(CLIENT_SOURCE_ROOT)
      .filter((path) => /\buseAccount\s*\(/.test(readFileSync(path, "utf8")))
      .map((path) => relative(CLIENT_SOURCE_ROOT, path))
      .sort();

    expect(connectorReaders).toEqual(IDENTITY_WALLET_BOUNDARIES);
  });
});
