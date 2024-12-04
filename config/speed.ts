import { QUEST_RESOURCES } from "@bibliothecadao/eternum";

export const MAX_QUEST_RESOURCES = Object.fromEntries(
  Object.entries(QUEST_RESOURCES).map(([questType, resources]) => [
    questType,
    resources.map((resource) => ({
      resource: resource.resource,
      amount: resource.amount * 100000,
    })),
  ]),
);
