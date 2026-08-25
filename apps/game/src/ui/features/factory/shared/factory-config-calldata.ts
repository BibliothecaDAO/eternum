import { byteArray, type RawArgsArray } from "starknet";

import type { FactoryConfigManifest, FactoryManifestContract, FactoryManifestLibrary } from "./factory-metadata";

export interface FactoryConfigCalldataParts {
  base: RawArgsArray;
  contracts: RawArgsArray;
  models: RawArgsArray;
  events: RawArgsArray;
  libraries: RawArgsArray;
  all: RawArgsArray;
}

const serializeContractCalldataEntry = (contract: FactoryManifestContract): RawArgsArray => {
  const entry: RawArgsArray = [];
  entry.push(contract.selector);
  entry.push(contract.class_hash);

  const initCalldata = contract.init_calldata ?? [];
  entry.push(initCalldata.length);

  if (initCalldata.length > 0) {
    entry.push(...initCalldata);
  }

  return entry;
};

const resolveLibraryName = (library: FactoryManifestLibrary): string => {
  if (library.name) {
    return library.name;
  }

  if (!library.tag) {
    return "";
  }

  try {
    const tagWithoutNamespace = library.tag.includes("-") ? library.tag.split("-").slice(1).join("-") : library.tag;
    const versionSuffix = library.version ? `_v${library.version}` : "";

    return tagWithoutNamespace.endsWith(versionSuffix)
      ? tagWithoutNamespace.slice(0, tagWithoutNamespace.length - versionSuffix.length)
      : tagWithoutNamespace;
  } catch {
    return library.tag;
  }
};

const serializeLibraryCalldataEntry = (library: FactoryManifestLibrary): RawArgsArray => {
  const libraryName = resolveLibraryName(library);
  const libraryVersion = library.version ?? "";

  return [
    library.class_hash,
    byteArray.byteArrayFromString(libraryName),
    byteArray.byteArrayFromString(libraryVersion),
  ];
};

export const buildFactoryConfigCalldataParts = (
  manifest: FactoryConfigManifest,
  version: string,
  namespace: string,
  defaultNamespaceWriterAll = true,
): FactoryConfigCalldataParts => {
  const base: RawArgsArray = [
    version,
    manifest.world.class_hash,
    byteArray.byteArrayFromString(namespace),
    defaultNamespaceWriterAll ? 1 : 0,
  ];

  const contractEntries = manifest.contracts.map((contract) => serializeContractCalldataEntry(contract));
  const contracts: RawArgsArray = [version, manifest.contracts.length];
  for (const entry of contractEntries) {
    contracts.push(...entry);
  }

  const models: RawArgsArray = [version, manifest.models.length];
  for (const model of manifest.models) {
    models.push(model.class_hash);
  }

  const events: RawArgsArray = [version, manifest.events.length];
  for (const event of manifest.events) {
    events.push(event.class_hash);
  }

  const librariesInManifest = manifest.libraries ?? [];
  const libraryEntries = librariesInManifest.map((library) => serializeLibraryCalldataEntry(library));
  const libraries: RawArgsArray = [version, librariesInManifest.length];
  for (const entry of libraryEntries) {
    libraries.push(...entry);
  }

  return {
    base,
    contracts,
    models,
    events,
    libraries,
    all: [...base, ...contracts, ...models, ...events, ...libraries],
  };
};
