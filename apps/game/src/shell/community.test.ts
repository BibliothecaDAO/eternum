import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { communityPlace, X_HANDLE } from "./community";
import { twitterTemplates } from "@/ui/shared/lib/x-share-messages";

const SOURCE = join(__dirname, "..");

/** Every client source file, tests aside. */
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });

/** A link to one of the realm's accounts: an X profile (not a post's intent), a Discord invite, a Telegram group. */
const ACCOUNT_LINK = /https:\/\/(?:x\.com|twitter\.com)\/(?!intent\/)[A-Za-z]|discord\.gg\/|t\.me\//;

describe("the realm's accounts", () => {
  it("are written in community.ts alone, so every surface links the same ones", () => {
    const elsewhere = sourceFiles(SOURCE)
      .filter((file) => !file.endsWith(join("shell", "community.ts")))
      .filter((file) => ACCOUNT_LINK.test(readFileSync(file, "utf8")))
      .map((file) => relative(SOURCE, file));
    expect(elsewhere).toEqual([]);
  });

  it("tag the X account the footer links in every share message", () => {
    expect(X_HANDLE).toBe("@LootRealms");
    expect(communityPlace("X").href).toBe("https://x.com/LootRealms");
    for (const template of Object.values(twitterTemplates)) expect(template).toContain(X_HANDLE);
  });
});
