import { buildFactoryConfigCalldataParts } from "@/ui/features/factory/shared/factory-config-calldata";
import type { FactoryConfigManifest } from "@/ui/features/factory/shared/factory-metadata";

import type { FactoryConfigSectionId, FactoryDeveloperConfigSection } from "./types";

const FACTORY_CONFIG_SECTION_METADATA: Record<
  FactoryConfigSectionId,
  {
    label: string;
    entrypoint: string;
    description: string;
    resolveItemCount: (manifest: FactoryConfigManifest) => number | undefined;
  }
> = {
  base: {
    label: "Base",
    entrypoint: "set_factory_config",
    description: "World and namespace",
    resolveItemCount: () => undefined,
  },
  contracts: {
    label: "Contracts",
    entrypoint: "set_factory_config_contracts",
    description: "Tagged systems",
    resolveItemCount: (manifest) => manifest.contracts.length,
  },
  models: {
    label: "Models",
    entrypoint: "set_factory_config_models",
    description: "Schema classes",
    resolveItemCount: (manifest) => manifest.models.length,
  },
  events: {
    label: "Events",
    entrypoint: "set_factory_config_events",
    description: "Event classes",
    resolveItemCount: (manifest) => manifest.events.length,
  },
  libraries: {
    label: "Libraries",
    entrypoint: "set_factory_config_libraries",
    description: "Linked code",
    resolveItemCount: (manifest) => manifest.libraries?.length ?? 0,
  },
};

export const FACTORY_CONFIG_SECTION_ORDER: FactoryConfigSectionId[] = [
  "base",
  "contracts",
  "models",
  "events",
  "libraries",
];

export const listAllFactoryConfigSectionIds = (): FactoryConfigSectionId[] => [...FACTORY_CONFIG_SECTION_ORDER];

export const buildFactoryConfigSections = ({
  manifest,
  version,
  namespace,
  defaultNamespaceWriterAll,
}: {
  manifest: FactoryConfigManifest;
  version: string;
  namespace: string;
  defaultNamespaceWriterAll: boolean;
}): FactoryDeveloperConfigSection[] => {
  const calldataParts = buildFactoryConfigCalldataParts(manifest, version, namespace, defaultNamespaceWriterAll);

  return FACTORY_CONFIG_SECTION_ORDER.map((sectionId) => {
    const metadata = FACTORY_CONFIG_SECTION_METADATA[sectionId];

    return {
      id: sectionId,
      label: metadata.label,
      entrypoint: metadata.entrypoint,
      description: metadata.description,
      itemCount: metadata.resolveItemCount(manifest),
      calldata: calldataParts[sectionId],
    };
  });
};
