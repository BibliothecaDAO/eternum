import {
  sharePathVia,
  type JoinedShare,
  type ShareChannel,
  type ShareMoment,
  type ShareTally,
} from "@realms-world/identity";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";

/**
 * A player's shared links, and what they brought, are their account's alone. Every read of them keys its cache by the
 * signed-in Realms id, asks nothing without one, and drops every other account's entries once the account changes: a
 * second player on the same app never posts, publishes or reads the first one's.
 */
const OWN_SHARES = "own-shares";

const useShareOwner = (): string | null => {
  const owner = useIdentitySession().session?.user.realmsId ?? null;
  const client = useQueryClient();
  useEffect(() => {
    client.removeQueries({ queryKey: [OWN_SHARES], predicate: ({ queryKey }) => queryKey[1] !== owner });
  }, [client, owner]);
  return owner;
};

/**
 * The account's link for one moment, as each channel posts it: made once per moment by identity, so the sheet opened
 * again gets the same one. `posted` records the post; `publish` hands identity the card the link then unfurls as;
 * `failed` says identity refused or could not make it, and `retry` asks again.
 */
export const useShareLink = (moment: ShareMoment) => {
  const owner = useShareOwner();
  const made = useQuery({
    queryKey: [OWN_SHARES, owner, "link", moment.kind, moment.chainId, moment.gameId, moment.moment],
    queryFn: () => identityClient.createShare(moment),
    enabled: owner !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
  const code = owner === null ? undefined : made.data;
  return {
    code,
    url: (via: ShareChannel) => new URL(code ? sharePathVia(code, via) : "/", window.location.origin).href,
    // A post that cannot be recorded is still posted; the tally misses it, the player does not.
    posted: () => void (code && identityClient.sharePosted(code).catch(() => undefined)),
    publish: (card: Blob) => (code ? identityClient.uploadShareCard(code, card) : Promise.resolve()),
    failed: owner !== null && made.isError,
    retry: () => void made.refetch(),
  };
};

/** What the account's shared links brought; null without an account, while it is read, or when identity cannot say. */
export const useShareTally = (): ShareTally | null => {
  const owner = useShareOwner();
  const tally = useQuery({
    queryKey: [OWN_SHARES, owner, "tally"],
    queryFn: () => identityClient.shareTally(),
    enabled: owner !== null,
    retry: false,
  });
  return owner !== null && tally.status === "success" ? tally.data : null;
};

/**
 * The link the signed-in account came by, read once per account: undefined until identity answers (or without an account,
 * or when identity cannot say), null when no link brought it. Another account's answer is never reused.
 */
export const useJoinedShare = (): JoinedShare | undefined => {
  const owner = useShareOwner();
  const joined = useQuery({
    queryKey: [OWN_SHARES, owner, "joined"],
    queryFn: () => identityClient.joinedShare(),
    enabled: owner !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
  return owner !== null && joined.status === "success" ? joined.data : undefined;
};
