import { byteArray } from "starknet";

interface ManifestContract {
  class_hash: string;
  tag: string;
  selector: string;
  init_calldata?: any[];
}
interface ManifestModel {
  class_hash: string;
}
interface ManifestEvent {
  class_hash: string;
}
interface ManifestData {
  world: { class_hash: string };
  contracts: ManifestContract[];
  models: ManifestModel[];
  events: ManifestEvent[];
  libraries?: Array<{ class_hash: string; tag?: string; version?: string; name?: string }>;
}

export interface FactoryConfigCalldataParts {
  base: any[];
  contracts: any[];
  contractChunks: any[][];
  models: any[];
  modelChunks: any[][];
  events: any[];
  eventChunks: any[][];
  libraries: any[];
  libraryChunks: any[][];
  all: any[];
}

export const CONTRACT_CONFIG_CHUNK_SIZE = 10;
export const MODEL_CONFIG_CHUNK_SIZE = 50;
export const EVENT_CONFIG_CHUNK_SIZE = 50;
export const LIBRARY_CONFIG_CHUNK_SIZE = 50;

const serializeContractCalldataEntry = (contract: ManifestContract): any[] => {
  const entry: any[] = [];
  entry.push(contract.selector);
  entry.push(contract.class_hash);
  const initCalldataCount = contract.init_calldata?.length || 0;
  entry.push(initCalldataCount);
  if (initCalldataCount > 0) {
    entry.push(...(contract.init_calldata || []));
  }
  entry.push(0);
  entry.push(0);
  return entry;
};

const resolveLibraryName = (lib: { tag?: string; version?: string; name?: string }): string => {
  if (lib.name) return lib.name;
  if (!lib.tag) return "";
  try {
    const afterNs = lib.tag.includes("-") ? lib.tag.split("-").slice(1).join("-") : lib.tag;
    const suffix = lib.version ? `_v${lib.version}` : "";
    return afterNs.endsWith(suffix) ? afterNs.slice(0, afterNs.length - suffix.length) : afterNs;
  } catch {
    return lib.tag;
  }
};

const serializeLibraryCalldataEntry = (lib: {
  class_hash: string;
  tag?: string;
  version?: string;
  name?: string;
}): any[] => {
  const libVersion = lib.version || "";
  const libName = resolveLibraryName(lib);
  const nameByteArray = byteArray.byteArrayFromString(libName);
  const versionByteArray = byteArray.byteArrayFromString(libVersion);
  return [lib.class_hash, nameByteArray, versionByteArray];
};

export const generateFactoryCalldata = (
  manifest: ManifestData,
  version: string,
  namespace: string,
  maxActions = 20,
  defaultNamespaceWriterAll = true,
): FactoryConfigCalldataParts => {
  const base: any[] = [];
  base.push(version);
  base.push(maxActions);
  base.push(manifest.world.class_hash);
  const namespaceByteArray = byteArray.byteArrayFromString(namespace);
  base.push(namespaceByteArray);
  base.push(defaultNamespaceWriterAll ? 1 : 0);

  const contracts: any[] = [];
  const contractEntries = manifest.contracts.map((contract) => serializeContractCalldataEntry(contract));
  contracts.push(version);
  contracts.push(manifest.contracts.length);
  for (const entry of contractEntries) {
    contracts.push(...entry);
  }

  const contractChunks: any[][] = [];
  for (let start = 0; start < manifest.contracts.length; start += CONTRACT_CONFIG_CHUNK_SIZE) {
    const chunkContracts = manifest.contracts.slice(start, start + CONTRACT_CONFIG_CHUNK_SIZE);
    const chunkEntries = chunkContracts.map((contract) => serializeContractCalldataEntry(contract));
    const chunkCalldata = [version, start, chunkContracts.length];
    for (const chunkEntry of chunkEntries) {
      chunkCalldata.push(...chunkEntry);
    }
    contractChunks.push(chunkCalldata);
  }
  if (contractChunks.length === 0) {
    contractChunks.push([version, 0, 0]);
  }

  const models: any[] = [];
  const modelClassHashes = manifest.models.map((model) => model.class_hash);
  models.push(version);
  models.push(modelClassHashes.length);
  for (const modelClassHash of modelClassHashes) models.push(modelClassHash);

  const modelChunks: any[][] = [];
  for (let start = 0; start < modelClassHashes.length; start += MODEL_CONFIG_CHUNK_SIZE) {
    const chunk = modelClassHashes.slice(start, start + MODEL_CONFIG_CHUNK_SIZE);
    modelChunks.push([version, start, chunk.length, ...chunk]);
  }
  if (modelChunks.length === 0) {
    modelChunks.push([version, 0, 0]);
  }

  const events: any[] = [];
  const eventClassHashes = manifest.events.map((event) => event.class_hash);
  events.push(version);
  events.push(eventClassHashes.length);
  for (const eventClassHash of eventClassHashes) events.push(eventClassHash);

  const eventChunks: any[][] = [];
  for (let start = 0; start < eventClassHashes.length; start += EVENT_CONFIG_CHUNK_SIZE) {
    const chunk = eventClassHashes.slice(start, start + EVENT_CONFIG_CHUNK_SIZE);
    eventChunks.push([version, start, chunk.length, ...chunk]);
  }
  if (eventChunks.length === 0) {
    eventChunks.push([version, 0, 0]);
  }

  const libs = manifest.libraries ?? [];
  const libraryEntries = libs.map((lib) => serializeLibraryCalldataEntry(lib));
  const libraries: any[] = [];
  libraries.push(version);
  libraries.push(libs.length);
  for (const entry of libraryEntries) {
    libraries.push(...entry);
  }

  const libraryChunks: any[][] = [];
  for (let start = 0; start < libs.length; start += LIBRARY_CONFIG_CHUNK_SIZE) {
    const chunkLibs = libs.slice(start, start + LIBRARY_CONFIG_CHUNK_SIZE);
    const chunkEntries = chunkLibs.map((lib) => serializeLibraryCalldataEntry(lib));
    const chunkCalldata = [version, start, chunkLibs.length];
    for (const chunkEntry of chunkEntries) {
      chunkCalldata.push(...chunkEntry);
    }
    libraryChunks.push(chunkCalldata);
  }
  if (libraryChunks.length === 0) {
    libraryChunks.push([version, 0, 0]);
  }

  return {
    base,
    contracts,
    contractChunks,
    models,
    modelChunks,
    events,
    eventChunks,
    libraries,
    libraryChunks,
    all: [...base, ...contracts, ...models, ...events, ...libraries],
  };
};

export const generateCairoOutput = (
  manifest: ManifestData,
  version: string,
  maxActions: number,
  defaultNamespaceWriterAll: boolean,
  namespace: string,
): string => {
  let output = `let factory_config = FactoryConfig {\n`;
  output += `    version: '${version}',\n`;
  output += `    max_actions: ${maxActions},\n`;
  output += `    world_class_hash: TryInto::<felt252, ClassHash>::try_into(${manifest.world.class_hash}).unwrap(),\n`;
  output += `    default_namespace: "${namespace}",\n`;
  output += `    default_namespace_writer_all: ${defaultNamespaceWriterAll},\n`;
  output += `    contracts: array![\n`;
  for (const contract of manifest.contracts) {
    const initArgsCount = contract.init_calldata?.length || 0;
    output += `        (selector_from_tag!("${contract.tag}"), TryInto::<felt252, ClassHash>::try_into(${contract.class_hash}).unwrap(), array![`;
    if (initArgsCount > 0) output += contract.init_calldata?.join(", ");
    output += `]),\n`;
  }
  output += `    ],\n`;
  output += `    models: array![\n`;
  for (const model of manifest.models)
    output += `        TryInto::<felt252, ClassHash>::try_into(${model.class_hash}).unwrap(),\n`;
  output += `    ],\n`;
  output += `    events: array![\n`;
  for (const event of manifest.events)
    output += `        TryInto::<felt252, ClassHash>::try_into(${event.class_hash}).unwrap(),\n`;
  output += `    ],\n`;
  output += `    libraries: array![\n`;
  const libs = manifest.libraries ?? [];
  for (const lib of libs) {
    const ver = lib.version || "";
    let name = lib.name || "";
    if (!name && lib.tag) {
      const afterNs = lib.tag.includes("-") ? lib.tag.split("-").slice(1).join("-") : lib.tag;
      const suffix = ver ? `_v${ver}` : "";
      name = afterNs.endsWith(suffix) ? afterNs.slice(0, afterNs.length - suffix.length) : afterNs;
    }
    output += `        (TryInto::<felt252, ClassHash>::try_into(${lib.class_hash}).unwrap(), "${name}", "${ver}"),\n`;
  }
  output += `    ],\n`;
  output += `};\n`;
  return output;
};
