import { useIdentitySession } from "@/hooks/context/identity-session";
import {
  fetchPlaytestSlots,
  registerPlaytestSlot,
  type PlaytestSlot,
} from "@/ui/features/factory-v2/api/factory-worker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

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

/** The return path's mark that a Join waits on the sign-in it led through. */
const JOIN_PARAM = "join";

/**
 * Joining a slot as the signed-in player. Signed out, Join leads through sign-in and comes back to the same page
 * marked with the slot, which then joins by itself: no second tap.
 */
export const useJoinSlot = () => {
  const { status, session } = useIdentitySession();
  const requestSignIn = useRequestSignIn();
  const { pathname } = useLocation();
  const client = useQueryClient();
  const register = useMutation({
    mutationFn: registerPlaytestSlot,
    onSuccess: () => client.invalidateQueries({ queryKey: SLOTS_KEY }),
  });
  return {
    realmsId: session?.user.realmsId,
    register,
    /** The slot whose Join is under way, so only its button says Joining…. */
    joining: register.isPending ? register.variables : undefined,
    join: (slot: PlaytestSlot) =>
      status === "signed-in"
        ? register.mutate(slot.name)
        : requestSignIn(`${pathname}?${JOIN_PARAM}=${encodeURIComponent(slot.name)}`),
  };
};

/** Back from sign-in with a Join waiting: join that slot once, then drop the mark from the address. */
export const useJoinOnReturn = (join: ReturnType<typeof useJoinSlot>, slots: readonly PlaytestSlot[] | undefined) => {
  const { status } = useIdentitySession();
  const [search, setSearch] = useSearchParams();
  const waiting = search.get(JOIN_PARAM);
  useEffect(() => {
    if (status !== "signed-in" || !waiting || !slots) return;
    const slot = slots.find((candidate) => candidate.name === waiting);
    if (slot && !registrationFor(slot, join.realmsId)) join.join(slot);
    setSearch(
      (current) => {
        current.delete(JOIN_PARAM);
        return current;
      },
      { replace: true },
    );
  }, [join, setSearch, slots, status, waiting]);
};
