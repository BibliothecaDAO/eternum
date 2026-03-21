import type { FactoryDeveloperContractTarget, FactoryDeveloperContractTargetId } from "./types";

export const FACTORY_DEVELOPER_CONTRACT_TARGETS: FactoryDeveloperContractTarget[] = [
  {
    id: "prize-address",
    label: "Prize address",
    manifestTag: "s1_eternum-prize_distribution_systems",
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
