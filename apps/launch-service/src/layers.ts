import { Layer } from "effect";
import type { LaunchServiceConfig } from "./config";
import { identityLayer, type IdentityResolver, VerifiedIdentity } from "./auth";
import { LaunchExecutorLive, launchTargetLayers } from "./executor";
import { databaseLayer, type LaunchServiceStore } from "./store";

export const createLaunchServiceLayer = (
  config: LaunchServiceConfig,
  store: LaunchServiceStore,
  identity?: IdentityResolver,
) => {
  const targets = launchTargetLayers(config);
  return Layer.mergeAll(
    databaseLayer(store),
    identity ? Layer.succeed(VerifiedIdentity, identity) : identityLayer(config.identityUrl),
    LaunchExecutorLive.pipe(Layer.provide(targets)),
  );
};
