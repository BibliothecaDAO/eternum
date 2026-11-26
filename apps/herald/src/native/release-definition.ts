import { CairoCustomEnum, CairoOption, CairoOptionVariant } from "starknet";
import releaseFile from "../../../../contracts/l3/world-native/schema/release-definition.json";
import releaseArchive from "./release-definitions.json";
import type { DecodedRecord } from "../types";

class NativeReleaseDefinitionUnknown extends Error {
  constructor(release: number) {
    super(`No rule definition for release ${release}`);
    this.name = "NativeReleaseDefinitionUnknown";
  }
}

export type ReleaseDefinitions = ReadonlyMap<number, DecodedRecord>;

export function releaseDefinitionText(release: number, definition: unknown): string {
  return (
    JSON.stringify(
      { release, definition },
      (_key, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ) + "\n"
  );
}

export function readReleaseDefinitions(...files: unknown[]): ReleaseDefinitions {
  const definitions = new Map<number, DecodedRecord>();
  for (const file of files) {
    const { release, definition } = file as { release: number; definition: unknown };
    if (!Number.isSafeInteger(release)) throw new Error("A release definition names no release");
    if (definitions.has(release)) throw new Error(`Two rule definitions for release ${release}`);
    definitions.set(release, revive(definition) as DecodedRecord);
  }
  return definitions;
}

export const RELEASE_DEFINITIONS = readReleaseDefinitions(...releaseArchive, releaseFile);

export function releaseDefinition(definitions: ReleaseDefinitions, release: number): DecodedRecord {
  const definition = definitions.get(release);
  if (!definition) throw new NativeReleaseDefinitionUnknown(release);
  return definition;
}

function revive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(revive);
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value);
  const [only] = entries;
  if (entries.length === 1 && only![0] === "Some") return new CairoOption(CairoOptionVariant.Some, revive(only![1]));
  if (entries.length === 1 && only![0] === "None") return new CairoOption(CairoOptionVariant.None);
  if (entries.length === 1 && only![0] === "variant") return new CairoCustomEnum(revive(only![1]) as never);
  return Object.fromEntries(entries.map(([key, member]) => [key, revive(member)]));
}
