import type { FactoryLaunchTargetKind, FactoryRun } from "./types";

export const FACTORY_GAME_LIST_REFRESH_EVENT = "factory-v2:game-list-refresh-requested";

export interface FactoryGameListRefreshDetail {
  environment: string;
  kind: FactoryLaunchTargetKind;
  name: string;
}

export function requestGameListRefreshForCompletedRun(
  run: Pick<FactoryRun, "environment" | "kind" | "name" | "status">,
) {
  if (typeof window === "undefined" || run.status !== "complete") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<FactoryGameListRefreshDetail>(FACTORY_GAME_LIST_REFRESH_EVENT, {
      detail: {
        environment: run.environment,
        kind: run.kind,
        name: run.name,
      },
    }),
  );
}
