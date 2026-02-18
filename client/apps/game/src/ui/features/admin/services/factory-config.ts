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
  models: any[];
  events: any[];
  libraries: any[];
  all: any[];
}

const serializeContractCalldataEntry = (contract: ManifestContract): any[] => {
  const entry: any[] = [];
  entry.push(contract.selector);
  entry.push(contract.class_hash);
  const initCalldataCount = contract.init_calldata?.length || 0;
  entry.push(initCalldataCount);
  if (initCalldataCount > 0) {
    entry.push(...(contract.init_calldata || []));
  }
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
  defaultNamespaceWriterAll = true,
): FactoryConfigCalldataParts => {
  const base: any[] = [];
  base.push(version);
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

  const models: any[] = [];
  const modelClassHashes = manifest.models.map((model) => model.class_hash);
  models.push(version);
  models.push(modelClassHashes.length);
  for (const modelClassHash of modelClassHashes) models.push(modelClassHash);

  const events: any[] = [];
  const eventClassHashes = manifest.events.map((event) => event.class_hash);
  events.push(version);
  events.push(eventClassHashes.length);
  for (const eventClassHash of eventClassHashes) events.push(eventClassHash);

  const libs = manifest.libraries ?? [];
  const libraryEntries = libs.map((lib) => serializeLibraryCalldataEntry(lib));
  const libraries: any[] = [];
  libraries.push(version);
  libraries.push(libs.length);
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
