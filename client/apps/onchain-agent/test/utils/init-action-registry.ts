import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeActions, type TokenConfig } from "../../src/adapter/action-registry";
import { mockSigner } from "./mock-client";

const manifestPath = resolve(__dirname, "../../../../../contracts/game/manifest_slot.json");
export const testManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

export function initializeTestActionRegistry(tokenConfig?: TokenConfig) {
  initializeActions(testManifest, mockSigner, { gameName: "eternum", tokenConfig });
}
