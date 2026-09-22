import { useIdentitySession, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPlaytestSlots,
  registerPlaytestSlot,
  type PlaytestSlot,
} from "@/ui/features/factory-v2/api/factory-worker";

function registrationFor(slot: PlaytestSlot, owner: string | undefined) {
  if (!owner) return undefined;
  return slot.registrations.find((registration) => BigInt(registration.owner) === BigInt(owner));
}

export const BlitzSlots = () => {
  const { status, session } = useIdentitySession();
  const signIn = useIdentitySessionStore((state) => state.requestSignIn);
  const client = useQueryClient();
  const slots = useQuery({ queryKey: ["playtestSlots"], queryFn: fetchPlaytestSlots, refetchInterval: 3_000 });
  const register = useMutation({
    mutationFn: registerPlaytestSlot,
    onSuccess: () => client.invalidateQueries({ queryKey: ["playtestSlots"] }),
  });
  const error = register.error ?? slots.error;
  const visible = slots.data?.slots.filter((slot) => !slot.frozenAt || registrationFor(slot, session?.user.id));
  if (!visible?.length && !error) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-gold/30 bg-black/40 p-4 text-gold">
      <h2 className="font-cinzel text-lg">Free Blitz slots</h2>
      {error && (
        <p role="alert" className="text-red-400">
          {error.message}
        </p>
      )}
      {visible?.map((slot) => {
        const registration = registrationFor(slot, session?.user.id);
        const closed = slot.closed;
        return (
          <article
            key={slot.name}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/20 pt-3"
          >
            <div>
              <h3>{slot.name}</h3>
              <p className="text-sm text-gold/70">
                {slot.registrations.length} registered · closes {new Date(slot.closesAt).toLocaleString()}
              </p>
              {registration?.gameNumber != null && (
                <p role="status">
                  Assigned to {slot.name}-{registration.gameNumber}. Your realms are settled automatically; the game
                  appears in the list below when it opens.
                </p>
              )}
              {registration && registration.gameNumber === null && (
                <p role="status">
                  Registered.{" "}
                  {closed ? "Your game is being assigned." : "Your game will be assigned when registration closes."}
                </p>
              )}
            </div>
            {!registration && !closed && (
              <button
                disabled={register.isPending}
                className="rounded border border-gold/40 px-4 py-2 disabled:opacity-40 hover:bg-gold/10"
                onClick={() => (status === "signed-in" ? register.mutate(slot.name) : signIn())}
              >
                {status === "signed-in"
                  ? register.isPending
                    ? "Registering…"
                    : "Register free"
                  : "Sign in to register"}
              </button>
            )}
            {!registration && closed && <span>Registration closed</span>}
          </article>
        );
      })}
    </section>
  );
};
