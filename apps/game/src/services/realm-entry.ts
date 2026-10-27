import { fetchApi } from "@/runtime/app-api";
import type { GameRef } from "@bibliothecadao/eternum/game-client";

export async function registerHeldRealm(game: GameRef, realmId: number): Promise<void> {
  const response = await fetchApi(`/api/value/realm-entry?chainId=${game.chainId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId: game.gameId, realmId }),
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
  };
  throw new Error(messages[reply?.error ?? ""] ?? "Realm registration failed. Try again.");
}
