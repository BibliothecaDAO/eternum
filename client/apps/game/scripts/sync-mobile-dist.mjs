import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(scriptDir, "..");
const mobileDist = path.resolve(gameRoot, "..", "eternum-mobile", "dist");
const target = path.resolve(gameRoot, "dist", "mobile");

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(mobileDist, target, { recursive: true });
