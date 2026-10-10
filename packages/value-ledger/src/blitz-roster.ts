import { nativeRuleConstants } from "../../../contracts/l3/world-native/schema/client.gen";
import type { SlotRegistration } from "./blitz-slots";

export interface RegistrationIdentity {
  accountAtRegistration(wallet: string, registeredAt: number): Promise<string | null>;
}

/** Resolve every payer before deciding: an identity outage yields neither seats nor refunds. */
export async function resolveBlitzRoster(registrations: readonly SlotRegistration[], identity: RegistrationIdentity) {
  const accounts = await Promise.all(
    registrations.map(({ wallet, registeredAt }) => identity.accountAtRegistration(wallet, registeredAt)),
  );
  const seated = new Set<string>();
  const players: { wallet: string; account: string }[] = [];
  const refunds: string[] = [];
  for (const [index, registration] of registrations.entries()) {
    const account = accounts[index];
    if (!account || seated.has(BigInt(account).toString())) {
      refunds.push(registration.wallet);
      continue;
    }
    seated.add(BigInt(account).toString());
    players.push({ wallet: registration.wallet, account });
  }
  return { players, refunds };
}

export interface SlotCohort {
  chainId: string;
  slotId: number;
  complete: boolean;
  games: { gameId: number; groupIndex: number }[];
}
export interface LaunchCohorts {
  rosterCohorts(): Promise<SlotCohort[]>;
}

/** Preserve the caller's roster order; earlier groups receive the extra player. */
export function splitPlaytestRoster<T>(roster: readonly T[]): T[][] {
  const gameCount = Math.ceil(roster.length / nativeRuleConstants.MAX_BLITZ_ROSTER_PLAYERS);
  if (gameCount === 0) return [];
  const size = Math.floor(roster.length / gameCount);
  const largerGames = roster.length % gameCount;
  let offset = 0;
  return Array.from({ length: gameCount }, (_, index) => {
    const next = offset + size + Number(index < largerGames);
    const group = roster.slice(offset, next);
    offset = next;
    return group;
  });
}
