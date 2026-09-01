import { Effect, Layer } from "effect";

import { ChannelMembership, createHeraldMembershipResolver, type MembershipResolver } from "../channels/membership";
import { createGameplayAccountService, GameplayAccounts } from "../channels/gameplay-account";
import { createIdentitySessionResolver, VerifiedIdentity, type SessionResolver } from "../http/middleware/auth";

export const createRealtimeDependencies = ({
  gameRpcUrl,
  heraldChain,
  heraldUrl,
  identityUrl,
  playerRegistryAddress,
}: {
  gameRpcUrl: string;
  heraldChain: string;
  heraldUrl: string;
  identityUrl: string;
  playerRegistryAddress: string;
}): { sessions: SessionResolver; membership: MembershipResolver } => {
  const gameplayAccounts = createGameplayAccountService({ rpcUrl: gameRpcUrl, playerRegistryAddress });
  const identity = createIdentitySessionResolver({ identityUrl, resolveMembershipPlayer: gameplayAccounts.resolve });
  const membership = createHeraldMembershipResolver({ heraldUrl, chain: heraldChain });
  const services = Layer.mergeAll(
    Layer.succeed(GameplayAccounts, gameplayAccounts),
    Layer.succeed(VerifiedIdentity, identity),
    Layer.succeed(ChannelMembership, membership),
  );

  return {
    sessions: {
      resolve: (cookie) =>
        VerifiedIdentity.pipe(
          Effect.flatMap((service) => service.resolve(cookie)),
          Effect.provide(services),
        ),
    },
    membership: {
      channelsForPlayer: (playerId) =>
        ChannelMembership.pipe(
          Effect.flatMap((service) => service.channelsForPlayer(playerId)),
          Effect.provide(services),
        ),
      isMember: (playerId, channelId) =>
        ChannelMembership.pipe(
          Effect.flatMap((service) => service.isMember(playerId, channelId)),
          Effect.provide(services),
        ),
    },
  };
};
