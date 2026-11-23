import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IdentityRequestError, isSealCodeRefusal, type SealCodeRefusal } from "@realms-world/identity";

import { identityClient } from "@/hooks/context/identity-session";

export const sealCodeKey = (owner: string | null) => ["sealCode", owner] as const;

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
