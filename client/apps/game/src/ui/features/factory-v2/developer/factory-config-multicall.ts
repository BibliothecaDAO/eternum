import type { Call } from "starknet";

import { FACTORY_CONFIG_SECTION_ORDER } from "./factory-config-sections";
import type { FactoryConfigSectionId, FactoryDeveloperConfigSection } from "./types";

export const buildFactoryConfigMulticall = ({
  factoryAddress,
  sections,
  selectedSectionIds,
}: {
  factoryAddress: string;
  sections: FactoryDeveloperConfigSection[];
  selectedSectionIds: FactoryConfigSectionId[];
}): Call[] => {
  const selectedSectionIdSet = new Set(selectedSectionIds);
  const sectionsById = new Map(sections.map((section) => [section.id, section]));

  return FACTORY_CONFIG_SECTION_ORDER.flatMap((sectionId) => {
    if (!selectedSectionIdSet.has(sectionId)) {
      return [];
    }

    const section = sectionsById.get(sectionId);
    if (!section) {
      return [];
    }

    return [
      {
        contractAddress: factoryAddress,
        entrypoint: section.entrypoint,
        calldata: section.calldata,
      },
    ];
  });
};
