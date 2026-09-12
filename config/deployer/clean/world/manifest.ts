import { existsSync, readFileSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { externalEntrypoints, resourceSelector } from "./artifacts";
import type { LocalWorld, WorldManifest, WorldPlan } from "./types";

export function buildWorldManifest(local: LocalWorld, plan: WorldPlan): WorldManifest {
  const manifest: WorldManifest = {
    world: {
      address: local.address,
      class_hash: local.world.classHash,
      seed: local.profile.world.seed,
      name: local.profile.world.name,
      entrypoints: externalEntrypoints(local.world.sierra.abi),
      abi: local.world.sierra.abi,
    },
    contracts: [],
    libraries: [],
    models: [],
    events: [],
    external_contracts: [],
    abis: [],
  };
  const abis = new Map<string, WorldManifest["abis"][number]>();
  const comparisons = new Map(plan.resources.map((resource) => [resource.tag, resource]));
  for (const artifact of [local.world, ...local.resources]) {
    for (const entry of artifact.sierra.abi) if (entry.type !== "impl") abis.set(entry.name, entry);
  }
  for (const resource of local.resources) {
    const common = { class_hash: resource.classHash, tag: resource.tag, selector: resource.selector };
    switch (resource.kind) {
      case "contract": {
        const address = comparisons.get(resource.tag)?.address;
        if (!address) throw new Error(`Missing contract address for ${resource.tag}`);
        manifest.contracts.push({
          ...common,
          address,
          init_calldata: resource.initCalldata,
          systems: resource.systems,
        });
        break;
      }
      // Manifest library selectors identify the unversioned name; World DNS uses the versioned selector.
      case "library":
        manifest.libraries.push({
          ...common,
          selector: resourceSelector(resource.namespace, resource.name),
          systems: resource.systems,
          version: resource.version!,
        });
        break;
      case "model":
        manifest.models.push({ ...common, members: resource.members });
        break;
      case "event":
        manifest.events.push({ ...common, members: resource.members });
        break;
    }
  }
  manifest.abis = [...abis.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return manifest;
}

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
