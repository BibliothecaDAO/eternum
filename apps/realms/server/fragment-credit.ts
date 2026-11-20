import type { IdentityEnv } from "./env";

export interface FragmentCredit {
  chainId: string;
  gameId: number;
  realmsId: string;
  id: string;
  amount: number;
}

export const creditFragmentsOf =
  (env: Pick<IdentityEnv, "VALUE_RELAY" | "OPERATOR_TOKEN">) =>
  (credit: FragmentCredit): Promise<Response> =>
    env.VALUE_RELAY.fetch("https://value-relay/api/value/operator/fragments", {
      method: "POST",
      redirect: "manual",
      headers: { authorization: `Bearer ${env.OPERATOR_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(credit),
    });
