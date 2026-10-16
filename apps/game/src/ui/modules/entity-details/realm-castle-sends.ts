import { sendOnce } from "@/hooks/store/use-actions-in-flight";
import type { SystemCalls, UpgradeRealmProps } from "@bibliothecadao/types";

type CastleCalls = Pick<SystemCalls, "provision_realm" | "upgrade_realm">;
type Signer = UpgradeRealmProps["signer"];

/**
 * A realm's level-up steps, the one way anything sends them: the player's buttons and the automatic provisioning alike.
 * Every step holds the realm's castle lock until the game applies it, so one step per realm is in flight at a time.
 * Each resolves with the transaction once applied, or with null, sending nothing, while another step for the realm is
 * in flight; it rejects with the reason the step did not apply.
 */
export const sendRealmProvision = (calls: CastleCalls, signer: Signer, realmId: number, withFirstLevel: boolean) =>
  sendOnce("castle", realmId, true, () =>
    calls.provision_realm({ signer, realm_entity_id: realmId, upgrade: withFirstLevel }),
  );

export const sendRealmLevelUp = (calls: CastleCalls, signer: Signer, realmId: number) =>
  sendOnce("castle", realmId, true, () => calls.upgrade_realm({ signer, realm_entity_id: realmId }));

/**
 * The automatic provisioning's send. Its runner checks the castle lock just before; a step the player started in
 * between is not this provision applied, so it is refused, never reported done.
 */
export const sendAutomaticProvision = async (calls: CastleCalls, signer: Signer, realmId: number): Promise<string> => {
  const applied = await sendRealmProvision(calls, signer, realmId, false);
  if (applied === null) throw new Error("Another level-up step for this realm is in flight.");
  return applied;
};
