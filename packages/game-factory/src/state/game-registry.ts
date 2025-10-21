import type { GameDeploymentArtifact } from "../types";

export class GameRegistry {
  private readonly deployments = new Map<string, GameDeploymentArtifact>();

  register(artifact: GameDeploymentArtifact) {
    this.deployments.set(artifact.planId, artifact);
  }

  get(planId: string): GameDeploymentArtifact | undefined {
    return this.deployments.get(planId);
  }

  list(): GameDeploymentArtifact[] {
    return Array.from(this.deployments.values());
  }
}

export const createGameRegistry = () => new GameRegistry();

