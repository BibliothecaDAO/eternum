import { configManager, ResourceManager } from "@bibliothecadao/eternum";
import { CapacityConfig, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

export class AutomationUnavailable extends Data.TaggedError("AutomationUnavailable")<{
  message: string;
  cause?: unknown;
}> {}

export const readAutomationGameId = () =>
  Effect.runSync(
    Effect.result(
      Effect.try({
        try: () => {
          const season = configManager.getSeasonConfig();
          return `${season.startSettlingAt}-${season.startMainAt}-${season.endAt}`;
        },
        catch: (cause) =>
          new AutomationUnavailable({ message: "Game configuration is not ready for automation.", cause }),
      }),
    ),
  );

export const requireAutomationGameId = (): string => {
  const game = readAutomationGameId();
  if (Result.isFailure(game)) throw game.failure;
  return game.success;
};

export const readAutomationBalance = (resources: ResourceManager, tick: number, resourceId: ResourcesIds): number => {
  const balance = resources.balanceWithProduction(tick, resourceId)?.balance;
  if (balance === undefined)
    throw new AutomationUnavailable({ message: `${ResourcesIds[resourceId]} balance is not synchronized.` });
  return Number(balance) / RESOURCE_PRECISION;
};

export const readTransferResources = (resources: ResourceManager, tick: number, resourceIds: ResourcesIds[]) =>
  Effect.runSync(
    Effect.result(
      Effect.try({
        try: () => {
          const balances = new Map<ResourcesIds, number>();
          const weights = new Map<ResourcesIds, number>();
          for (const id of resourceIds) {
            balances.set(id, Math.max(0, Math.floor(readAutomationBalance(resources, tick, id))));
            const weight = configManager.getResourceWeightKg(id);
            if (weight === undefined)
              throw new AutomationUnavailable({ message: `${ResourcesIds[id]} weight is not synchronized.` });
            weights.set(id, weight);
          }
          return {
            balances,
            weights,
            donkeys: Math.max(0, Math.floor(readAutomationBalance(resources, tick, ResourcesIds.Donkey))),
            capacity: configManager.getCapacityConfigKg(CapacityConfig.Donkey),
          };
        },
        catch: (cause) =>
          cause instanceof AutomationUnavailable
            ? cause
            : new AutomationUnavailable({ message: "Resource configuration is not ready for transfers.", cause }),
      }),
    ),
  );
