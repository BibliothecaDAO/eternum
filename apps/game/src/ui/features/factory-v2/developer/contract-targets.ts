import { DEFAULT_FACTORY_NAMESPACE } from "@/ui/features/factory/shared/factory-metadata";

import type { FactoryDeveloperContractTarget, FactoryDeveloperContractTargetId } from "./types";

export const FACTORY_DEVELOPER_CONTRACT_TARGETS: FactoryDeveloperContractTarget[] = [
  {
    id: "prize-address",
    label: "Prize address",
    manifestTag: `${DEFAULT_FACTORY_NAMESPACE}-prize_distribution_systems`,
    allowsCustomInput: false,
  },
  {
    id: "custom",
    label: "Custom contract",
    allowsCustomInput: true,
  },
];

export const DEFAULT_FACTORY_DEVELOPER_CONTRACT_TARGET_ID: FactoryDeveloperContractTargetId = "prize-address";

export const findFactoryDeveloperContractTarget = (targetId: FactoryDeveloperContractTargetId) =>
  FACTORY_DEVELOPER_CONTRACT_TARGETS.find((target) => target.id === targetId) ?? FACTORY_DEVELOPER_CONTRACT_TARGETS[0];

export const resolveFactoryDeveloperContractSuggestionLabel = (manifestTag: string) =>
  FACTORY_DEVELOPER_CONTRACT_TARGETS.find((target) => target.manifestTag === manifestTag)?.label ?? manifestTag;
