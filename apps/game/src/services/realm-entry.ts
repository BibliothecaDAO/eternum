import { fetchApi } from "@/runtime/app-api";
import type { GameRef } from "@bibliothecadao/eternum/game-client";
import type { HeldRealm } from "@realms-world/identity";

/**
 * Registers the source a Frontier home claims from, before the player founds it: the held Realm they name, else the
 * campaign ticket (Devcon's) their account holds, which the relay reads from identity; with neither, nothing.
 */
export async function registerHomeSource(game: GameRef, realmId: number | null): Promise<void> {
  const response = await fetchApi(`/api/value/realm-entry?chainId=${game.chainId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(realmId === null ? { gameId: game.gameId } : { gameId: game.gameId, realmId }),
  });
  if (response.ok) return;
  const reply = (await response.json().catch(() => null)) as { error?: string } | null;
  const messages: Record<string, string> = {
    realm_not_owned: "Linked wallet does not hold this Realm.",
    realm_wallet_missing: "Link your Realm's wallet in Settings.",
    realm_already_settled: "Realm already settled in this game.",
    realm_registration_refused: "Choose another Realm or leave blank.",
    conflicting_entry_entitlement: "Use the Realm number already registered.",
    settlement_closed: "This game's settlement is closed.",
    realm_check_unavailable: "Realm check unavailable. Try again.",
  };
  throw new Error(messages[reply?.error ?? ""] ?? "Realm registration failed. Try again.");
}

/**
 * The Realms the player's linked wallet holds, each with the index's map of it, from the Realm holdings index; empty
 * without a linked wallet.
 */
export async function readHeldRealms(): Promise<HeldRealm[]> {
  const response = await fetchApi("/api/value/held-realms", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error("held_realms_unavailable");
  return ((await response.json()) as { realms: HeldRealm[] }).realms;
}

/** A Realm number from 1 to 8,000, as typed. */
export const isRealmNumber = (value: string) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 8000;
