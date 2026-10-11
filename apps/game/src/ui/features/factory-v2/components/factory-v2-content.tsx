import { useIdentitySession } from "@/hooks/context/identity-session";
import { useRequestSignIn } from "@/shell/sign-in/sign-in-route";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { createEternumGame, fetchFactoryRuns, retryFactoryRun } from "../api/factory-worker";
import { FACTORY_GAME_LIST_REFRESH_EVENT } from "../game-list-refresh-event";

const inputStyle = "w-full rounded border border-gold/30 bg-black/40 px-3 py-2 text-gold";
const buttonStyle = "rounded border border-gold/40 px-4 py-2 text-gold disabled:opacity-40 hover:bg-gold/10";
// Official games are the operator's: Blitz slots, their games and results, and the season calendar are not on this page.
const RUN_ENVIRONMENTS = ["madara.eternum", "madara.frontier"] as const;

/**
 * A launcher's own games: an Eternum game scheduled here, and the launches a launcher may continue. A game made here
 * has no slot, no pot and no rating.
 */
export const FactoryV2Content = () => {
  const { status } = useIdentitySession();
  const signIn = useRequestSignIn();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [notice, setNotice] = useState("");
  const runs = useQueries({
    queries: RUN_ENVIRONMENTS.map((environment) => ({
      queryKey: ["factoryRuns", environment],
      queryFn: () => fetchFactoryRuns(environment),
      refetchInterval: 3_000,
    })),
  });
  const action = useMutation({
    mutationFn: (execute: () => Promise<unknown>) => execute(),
    onSuccess: async () => {
      setNotice("Request accepted. Progress appears below.");
      await queryClient.invalidateQueries({ queryKey: ["factoryRuns"] });
      window.dispatchEvent(new Event(FACTORY_GAME_LIST_REFRESH_EVENT));
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const date = new Date(time);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      setNotice("Choose a future time.");
      return;
    }
    setNotice("");
    action.mutate(() => createEternumGame(name, date.toISOString()));
  };
  const error = action.error ?? runs.find((query) => query.error)?.error;
  const allRuns = runs.flatMap((query) => query.data?.runs ?? []);
  // A failed launch waits for a launcher, a Frontier season included, so it leads the page rather than hiding in the list.
  const needsAttention = allRuns.filter((run) => run.status === "attention");
  return (
    <section className="space-y-5 rounded-2xl border border-gold/20 bg-black/60 p-5 text-gold">
      <h2 className="text-xl">Schedule play</h2>
      <p className="text-sm text-gold/70">
        Eternum games are scheduled here; a game made here has no slot, no pot and no rating. Ranked Blitz slots and the
        season calendar are the operator's.
      </p>
      {status !== "signed-in" ? (
        <button className={buttonStyle} onClick={() => signIn()}>
          Sign in to schedule
        </button>
      ) : (
        <form onSubmit={submit} className="grid max-w-xl gap-4">
          <label>
            Name
            <input
              className={inputStyle}
              required
              pattern="[a-z0-9][a-z0-9-]{0,23}"
              maxLength={24}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Game starts (local time)
            <input
              className={inputStyle}
              required
              type="datetime-local"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </label>
          <button className={buttonStyle} disabled={action.isPending}>
            {action.isPending ? "Submitting…" : "Create Eternum game"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-red-400">
          {error.message}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {needsAttention.length > 0 && (
        <div role="alert" className="space-y-2 rounded border border-red-400/60 p-3">
          <h3 className="text-lg text-red-300">Needs attention</h3>
          {needsAttention.map((run) => (
            <p key={run.runId}>
              {run.gameName} ({run.environment}) failed:{" "}
              {run.steps.find((step) => step.status === "failed")?.errorMessage}
            </p>
          ))}
        </div>
      )}
      <h3 className="text-lg">Progress</h3>
      {runs.some((query) => query.isPending) && <p>Loading launches…</p>}
      {allRuns.map((run) => (
        <article key={run.runId} className="space-y-2 rounded border border-gold/20 p-3">
          <p>
            {run.gameName} · {run.status}
          </p>
          {run.steps.map((step) => (
            <p key={step.id} className="text-sm text-gold/70">
              {step.title}: {step.latestEvent}
            </p>
          ))}
          {run.recovery.canContinue && status === "signed-in" && (
            <button
              className={buttonStyle}
              disabled={action.isPending}
              onClick={() => action.mutate(() => retryFactoryRun(run))}
            >
              Retry
            </button>
          )}
        </article>
      ))}
    </section>
  );
};
