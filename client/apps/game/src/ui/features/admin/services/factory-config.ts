import { byteArray } from "starknet";

interface ManifestContract { class_hash: string; tag: string; selector: string; init_calldata?: any[] }
interface ManifestModel { class_hash: string }
interface ManifestEvent { class_hash: string }
interface ManifestData {
  world: { class_hash: string };
  contracts: ManifestContract[];
  models: ManifestModel[];
  events: ManifestEvent[];
  libraries?: Array<{ class_hash: string; tag?: string; version?: string; name?: string }>;
}

export const generateFactoryCalldata = (
  manifest: ManifestData,
  version: string,
  namespace: string,
  maxActions = 20,
  defaultNamespaceWriterAll = true,
): any[] => {
  const calldata: any[] = [];
  calldata.push(version);
  calldata.push(maxActions);
  calldata.push(manifest.world.class_hash);
  const namespaceByteArray = byteArray.byteArrayFromString(namespace);
  calldata.push(namespaceByteArray);
  calldata.push(defaultNamespaceWriterAll ? 1 : 0);
  calldata.push(manifest.contracts.length);
  for (const contract of manifest.contracts) {
    calldata.push(contract.selector);
    calldata.push(contract.class_hash);
    const initCalldataCount = contract.init_calldata?.length || 0;
    calldata.push(initCalldataCount);
    if (initCalldataCount > 0) calldata.push(...(contract.init_calldata || []));
    calldata.push(0);
    calldata.push(0);
  }
  calldata.push(manifest.models.length);
  for (const model of manifest.models) calldata.push(model.class_hash);
  calldata.push(manifest.events.length);
  for (const event of manifest.events) calldata.push(event.class_hash);
  const libs = manifest.libraries ?? [];
  calldata.push(libs.length);
  for (const lib of libs) {
    const classHash = lib.class_hash;
    let libName = lib.name || "";
    const libVersion = lib.version || "";
    if (!libName && lib.tag) {
      try {
        const afterNs = lib.tag.includes("-") ? lib.tag.split("-").slice(1).join("-") : lib.tag;
        const suffix = libVersion ? `_v${libVersion}` : "";
        libName = afterNs.endsWith(suffix) ? afterNs.slice(0, afterNs.length - suffix.length) : afterNs;
      } catch {
        libName = lib.tag!;
      }
    }
    const nameByteArray = byteArray.byteArrayFromString(libName || "");
    const versionByteArray = byteArray.byteArrayFromString(libVersion || "");
    calldata.push(classHash);
    calldata.push(nameByteArray);
    calldata.push(versionByteArray);
  }
  return calldata;
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
  for (const model of manifest.models) output += `        TryInto::<felt252, ClassHash>::try_into(${model.class_hash}).unwrap(),\n`;
  output += `    ],\n`;
  output += `    events: array![\n`;
  for (const event of manifest.events) output += `        TryInto::<felt252, ClassHash>::try_into(${event.class_hash}).unwrap(),\n`;
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

