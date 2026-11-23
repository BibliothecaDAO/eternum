import { useQuery } from "@tanstack/react-query";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";

export const orderIntentKey = (owner: string | null) => ["orderIntent", owner] as const;

export const useOrderIntent = () => {
  const owner = useIdentitySession().session?.user.realmsId ?? null;
  const intent = useQuery({
    queryKey: orderIntentKey(owner),
    queryFn: () => identityClient.getOrderIntent(),
    enabled: owner !== null,
  });
  return { owner, intent };
};
