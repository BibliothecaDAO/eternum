import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

type JsonObject = Record<string, unknown>;

/** Deployment documents remain complete on disk; the browser only needs runtime data. */
export function clientDataPlugin(nativeManifestPath?: string): Plugin {
  return {
    name: "client-runtime-data",
    enforce: "pre",
    config() {
      if (!nativeManifestPath) throw new Error("NATIVE_WORLD_MANIFEST must name the native release manifest");
      const manifest = JSON.parse(readFileSync(nativeManifestPath, "utf8"));
      if (!manifest.native?.activeSchema || !manifest.native.schemas?.[manifest.native.activeSchema]) {
        throw new Error("Native release manifest is missing its active schema");
      }
      const season = manifest.native.domains?.season;
      if (!season?.address || BigInt(season.address) !== BigInt(manifest.world?.address)) {
        throw new Error("Native release manifest has no matching season entrypoint");
      }
      return { define: { __NATIVE_WORLD_MANIFEST__: JSON.stringify(runtimeManifest(manifest)) } };
    },
    transform(source, id) {
      const file = id.replaceAll("\\", "/");
      if (/\/config\/generated\/(blitz\.(madara|appchain)|eternum\.appchain)\.json$/.test(file)) {
        return { code: JSON.stringify(runtimeConfig(JSON.parse(source))), map: null };
      }
      if (/\/contracts\/l3\/game\/manifest_(madara|appchain_blitz|appchain_eternum)\.json$/.test(file)) {
        return { code: JSON.stringify(runtimeManifest(JSON.parse(source))), map: null };
      }
      return null;
    },
  };
}

function runtimeConfig(document: JsonObject): JsonObject {
  const configuration = document.configuration;
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    throw new Error("Client configuration document has no configuration object");
  }
  const { setup: _deploymentSetup, ...runtime } = configuration as JsonObject;
  return { ...document, configuration: runtime };
}

function runtimeManifest(document: JsonObject): JsonObject {
  // The provider uses world.abi and contract ABIs. The root aggregate is compiler
  // output for deployment tooling; preserve all contract/model/event metadata.
  const { abis: _aggregateAbis, ...runtime } = document;
  return runtime;
}
