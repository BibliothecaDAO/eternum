import fs from "node:fs";

interface ManifestResource {
  address?: string;
  selector?: string;
  tag?: string;
}

interface RelayManifestJson {
  world?: { address?: string };
  contracts?: ManifestResource[];
  events?: ManifestResource[];
}

export interface RelayManifest {
  entrySystemAddress: string;
  resultReadySelector: string;
  resultRowSelector: string;
  worldAddress: string;
}

const NAMESPACE = "s2";

export function loadRelayManifest(path: string): RelayManifest {
  const manifest = JSON.parse(fs.readFileSync(path, "utf8")) as RelayManifestJson;
  return {
    entrySystemAddress: requireAddress(
      manifest.contracts?.find(({ tag }) => tag === `${NAMESPACE}-entry_systems`)?.address,
      `${NAMESPACE}-entry_systems`,
    ),
    resultReadySelector: requireFelt(
      manifest.events?.find(({ tag }) => tag === `${NAMESPACE}-LedgerResultsReady`)?.selector,
      `${NAMESPACE}-LedgerResultsReady`,
    ),
    resultRowSelector: requireFelt(
      manifest.events?.find(({ tag }) => tag === `${NAMESPACE}-LedgerResultRowReady`)?.selector,
      `${NAMESPACE}-LedgerResultRowReady`,
    ),
    worldAddress: requireAddress(manifest.world?.address, "world"),
  };
}

function requireAddress(value: string | undefined, label: string): string {
  const address = requireFelt(value, `${label} address`);
  if (BigInt(address) === 0n) throw new Error(`${label} address is zero`);
  return address;
}

function requireFelt(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is missing from the S2 manifest`);
  return `0x${BigInt(value).toString(16)}`;
}
