#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as balance from "../contracts/l3/world-native/schema/balance.gen.ts";

export const DECODERS = ["apps/herald/src", "apps/value-relay/src"];
const SOURCE = /\.[cm]?[jt]sx?$/;

export function balanceReads(root, directories = DECODERS, names = Object.keys(balance)) {
  const read = new RegExp(`\\b(?:${names.join("|")})\\b|schema/balance\\.gen`, "g");
  return directories.flatMap((directory) =>
    readdirSync(join(root, directory), { recursive: true, encoding: "utf8" })
      .filter((file) => SOURCE.test(file))
      .flatMap((file) =>
        [...readFileSync(join(root, directory, file), "utf8").matchAll(read)].map((match) => ({
          path: join(directory, file),
          read: match[0],
        })),
      ),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const reads = balanceReads(process.cwd());
  console.log(JSON.stringify({ decoders: DECODERS, reads }, null, 2));
  if (reads.length > 0) process.exit(1);
}
