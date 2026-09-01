import "dotenv/config";

import { Effect } from "effect";
import { buildLaunchRequest } from "../../../config/deployer/clean/cli/launch-request";
import { resolveLaunchRequestArgs } from "../../../config/deployer/clean/cli/launch-config-file";
import type { LaunchRotationRequest } from "../../../config/deployer/clean/types";
import { readLaunchServiceConfig } from "./config";
import type { CreateRotationRequest } from "./schemas";
import { PostgresLaunchStore } from "./store";

const toRotationJobRequest = (request: LaunchRotationRequest): CreateRotationRequest => ({
  environment: "madara.blitz",
  rotationName: request.rotationName,
  firstGameStartTime: String(request.firstGameStartTime),
  gameIntervalMinutes: request.gameIntervalMinutes,
  maxGames: request.maxGames,
  evaluationIntervalMinutes: request.evaluationIntervalMinutes,
  advanceWindowGames: request.advanceWindowGames,
  weeklyCadence: request.weeklyCadence as CreateRotationRequest["weeklyCadence"],
  biomeClimateOverridesByGameNumber:
    request.biomeClimateOverridesByGameNumber as CreateRotationRequest["biomeClimateOverridesByGameNumber"],
  version: "6",
  devModeOn: true,
  twoPlayerMode: request.twoPlayerMode,
  singleRealmMode: request.singleRealmMode,
  durationSeconds: request.durationSeconds,
  mapConfigOverrides: request.mapConfigOverrides,
  biomeClimateOverrides: request.biomeClimateOverrides,
  blitzRegistrationOverrides: request.blitzRegistrationOverrides as CreateRotationRequest["blitzRegistrationOverrides"],
  autoRetryIntervalMinutes: request.autoRetryIntervalMinutes,
});

const loadRotationRequest = (configPath: string, rpcUrl: string): CreateRotationRequest => {
  const args = resolveLaunchRequestArgs({ "config-path": configPath, "rpc-url": rpcUrl });
  const request = buildLaunchRequest(args);
  if (request.launchKind !== "rotation" || request.environmentId !== "madara.blitz") {
    throw new Error(`${configPath} must describe a madara.blitz rotation`);
  }
  return toRotationJobRequest(request);
};

const program = Effect.gen(function* () {
  const config = yield* readLaunchServiceConfig();
  const store = new PostgresLaunchStore(config.databaseUrl);
  yield* Effect.acquireUseRelease(
    Effect.promise(async () => {
      await store.initialize();
      return store;
    }),
    (database) =>
      Effect.forEach(config.rotationConfigs, (configPath) =>
        Effect.tryPromise({
          try: async () => {
            const run = await database.enqueue("rotation", loadRotationRequest(configPath, config.rpcUrl));
            console.info(JSON.stringify({ event: "rotation_enqueued", configPath, runId: run.id, name: run.name }));
          },
          catch: (cause) => new Error(`Failed to enqueue ${configPath}: ${String(cause)}`),
        }),
      ),
    (database) => Effect.promise(() => database.close()),
  );
});

Effect.runPromise(program).catch((error) => {
  console.error("rotation_tick_failed", error);
  process.exitCode = 1;
});
