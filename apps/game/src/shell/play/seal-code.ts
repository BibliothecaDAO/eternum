import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IdentityRequestError, isSealCodeRefusal, type SealCodeRefusal } from "@realms-world/identity";

import { identityClient } from "@/hooks/context/identity-session";

const sealCodeKey = (owner: string | null) => ["sealCode", owner] as const;

export const useSealCode = (owner: string | null) =>
  useQuery({
    queryKey: sealCodeKey(owner),
    queryFn: () => identityClient.getSealCode(),
    enabled: owner !== null,
  });

export const useRedeemSealCode = (owner: string | null) => {
  const client = useQueryClient();
  const redeem = useMutation({
    mutationFn: (typed: string) => identityClient.redeemSealCode(typed),
    onSuccess: (saved) => client.setQueryData(sealCodeKey(owner), saved),
  });
  return { redeem, refusal: refusalOf(redeem.error) };
};

const refusalOf = (error: unknown): SealCodeRefusal | undefined =>
  error instanceof IdentityRequestError && isSealCodeRefusal(error.code) ? error.code : undefined;
