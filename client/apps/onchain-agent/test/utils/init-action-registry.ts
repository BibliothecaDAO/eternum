import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeActions } from "../../src/adapter/action-registry";
import { mockSigner } from "./mock-client";

const manifestPath = resolve(__dirname, "../manifest.json");
export const testManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

export function initializeTestActionRegistry() {
  initializeActions(testManifest, mockSigner, { gameName: "eternum" });
}
