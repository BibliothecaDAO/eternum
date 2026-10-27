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
    realm_not_owned: "Your linked Starknet wallet does not hold this Realm.",
    realm_wallet_missing: "Link the Starknet wallet holding your Realm in Settings before founding.",
    realm_already_settled: "This Realm has already been settled in this game.",
    realm_registration_refused:
      "Realm registration was refused. Choose another Realm or leave the number blank to found a free home.",
    conflicting_entry_entitlement: "You already registered a different Realm for this game. Use that Realm number.",
    settlement_closed: "This game's settlement is closed.",
  };
  throw new Error(messages[reply?.error ?? ""] ?? "Your Realm could not be registered. Please try again.");
}
