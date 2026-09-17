import { existsSync, readFileSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { WorldManifest } from "./types";

export function writeWorldOutputs(manifest: WorldManifest, manifestPath: string, addressPath: string): void {
  atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  atomicWrite(addressPath, `${manifest.world.address}\n`);
}

function atomicWrite(path: string, content: string) {
  if (existsSync(path) && readFileSync(path, "utf8") === content) return;
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, content);
  renameSync(temporaryPath, path);
}
