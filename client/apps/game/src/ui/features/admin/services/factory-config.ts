import type { FactoryConfigManifest } from "@/ui/features/factory/shared/factory-metadata";
import {
  buildFactoryConfigCalldataParts,
  type FactoryConfigCalldataParts,
} from "@/ui/features/factory/shared/factory-config-calldata";

export type { FactoryConfigCalldataParts };

export const generateFactoryCalldata = (
  manifest: FactoryConfigManifest,
  version: string,
  namespace: string,
  defaultNamespaceWriterAll = true,
): FactoryConfigCalldataParts =>
  buildFactoryConfigCalldataParts(manifest, version, namespace, defaultNamespaceWriterAll);

export const generateCairoOutput = (
  manifest: FactoryConfigManifest,
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
