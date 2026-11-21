import { useQuery } from "@tanstack/react-query";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { readHeldRealms } from "@/services/realm-entry";

/**
 * What the signed-in account holds outside a game, read once for every screen that shows it (a game's Realm step, the
 * player's card). Each read belongs to the account, and the Realms to its linked wallet too, so another account or a
 * changed wallet in the same tab asks again and never sees the last one's.
 */

/** The Realms the account's linked wallet holds (the relay's held-Realms read); not asked without a linked wallet. */
export const useHeldRealms = () => {
  const { session } = useIdentitySession();
  const wallet = session?.user.address ?? null;
  const held = useQuery({
    queryKey: ["held-realms", session?.user.realmsId ?? null, wallet] as const,
    queryFn: readHeldRealms,
    enabled: wallet !== null,
    retry: false,
    staleTime: 60_000,
  });
  return { session, wallet, held };
};
