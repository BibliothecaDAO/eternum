import { handleGameStackApiRequest, type FinalizedSeasonIntent, type GameStackApiStore } from "./api";
import type { BlitzAuthChallenge } from "./auth";
import type { GameStack } from "./types";

export interface GameStackApiHandlerDependencies {
  store: GameStackApiStore;
  now(): Date;
  generateFeltId(): string;
  generateGameStackId(): string;
  verifySignature(challenge: BlitzAuthChallenge, signature: string[]): Promise<boolean>;
  readFinalizedSeasonIntent(deploymentId: string): Promise<FinalizedSeasonIntent>;
  assertProductionReleaseAuthorized(): Promise<void>;
  dispatchProvisioning(gameStack: GameStack, idempotencyKey: string): Promise<void>;
}

export function createGameStackApiHandler(
  dependencies: GameStackApiHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    handleGameStackApiRequest(request, {
      ...dependencies,
      startProvisioning: (gameStack) => dependencies.dispatchProvisioning(gameStack, gameStack.gameStackId),
    });
}
