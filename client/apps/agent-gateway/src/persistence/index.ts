import { getAgentGatewayDb } from "./db-client";
import { MemoryPlayerAgentRepository } from "./memory-player-agent-repository";
import { PostgresPlayerAgentRepository } from "./postgres-player-agent-repository";
import type { PlayerAgentRepository } from "./types";
import type { AgentGatewayEnv } from "../types";

let repository: PlayerAgentRepository | null = null;

export function getPlayerAgentRepository(env?: AgentGatewayEnv): PlayerAgentRepository {
  if (env?.AGENT_REPOSITORY) {
    return env.AGENT_REPOSITORY;
  }

  if (repository) {
    return repository;
  }

  const connectionString = env?.DATABASE_URL ?? process.env.DATABASE_URL;
  if (connectionString) {
    repository = new PostgresPlayerAgentRepository(getAgentGatewayDb(connectionString));
    return repository;
  }

  repository = new MemoryPlayerAgentRepository();
  return repository;
}

export * from "./types";
