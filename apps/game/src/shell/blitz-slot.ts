import { useIdentitySession } from "@/hooks/context/identity-session";
import {
  fetchPlaytestSlots,
  registerPlaytestSlot,
  type PlaytestSlot,
} from "@/ui/features/factory-v2/api/factory-worker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useRequestSignIn } from "./sign-in/sign-in-route";

/** A Blitz game's roster: registrations past it fill the slot's next game. */
export const BLITZ_SEATS = 24;

const SLOTS_KEY = ["playtestSlots"];

export const usePlaytestSlots = () =>
  useQuery({ queryKey: SLOTS_KEY, queryFn: fetchPlaytestSlots, refetchInterval: 3_000 });

/** A slot's players are Realms accounts, so the signed-in account finds itself by its Realms id. */
export function registrationFor(slot: PlaytestSlot, realmsId: string | undefined) {
  if (!realmsId) return undefined;
  return slot.registrations.find(
    (registration) => registration.realmsId !== null && BigInt(registration.realmsId) === BigInt(realmsId),
  );
}

/** The seats taken in the game the slot is filling now: a full roster starts the next game's. */
export const seatsFilling = (slot: PlaytestSlot): number => {
  const registered = slot.registrations.length;
  return registered === 0 ? 0 : ((registered - 1) % BLITZ_SEATS) + 1;
};

/** Joining a slot as the signed-in player, or asking them to sign in first. */
export const useJoinSlot = () => {
  const { status, session } = useIdentitySession();
  const requestSignIn = useRequestSignIn();
  const client = useQueryClient();
  const register = useMutation({
    mutationFn: registerPlaytestSlot,
    onSuccess: () => client.invalidateQueries({ queryKey: SLOTS_KEY }),
  });
  return {
    realmsId: session?.user.realmsId,
    register,
    join: (slot: PlaytestSlot) => (status === "signed-in" ? register.mutate(slot.name) : requestSignIn()),
  };
};
