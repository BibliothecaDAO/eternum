import { useIdentitySession, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  closePlaytestSlot,
  createEternumGame,
  createPlaytestSlot,
  fetchFactoryRuns,
  fetchPlaytestSlots,
  retryFactoryRun,
} from "../api/factory-worker";
import { FACTORY_GAME_LIST_REFRESH_EVENT } from "../game-list-refresh-event";

const inputStyle = "w-full rounded border border-gold/30 bg-black/40 px-3 py-2 text-gold";
const buttonStyle = "rounded border border-gold/40 px-4 py-2 text-gold disabled:opacity-40 hover:bg-gold/10";

export const FactoryV2Content = () => {
  const { status } = useIdentitySession();
  const signIn = useIdentitySessionStore((state) => state.requestSignIn);
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"blitz" | "eternum">("blitz");
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [notice, setNotice] = useState("");
  const environment = mode === "blitz" ? "madara.blitz" : "madara.eternum";
  const runs = useQuery({
    queryKey: ["factoryRuns", environment],
    queryFn: () => fetchFactoryRuns(environment),
    refetchInterval: 3_000,
  });
  const slots = useQuery({ queryKey: ["playtestSlots"], queryFn: fetchPlaytestSlots, refetchInterval: 3_000 });
  const action = useMutation({
    mutationFn: (execute: () => Promise<unknown>) => execute(),
    onSuccess: async () => {
      setNotice("Request accepted. Progress appears below.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["factoryRuns"] }),
        queryClient.invalidateQueries({ queryKey: ["playtestSlots"] }),
      ]);
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
    action.mutate(() =>
      mode === "blitz" ? createPlaytestSlot(name, date.toISOString()) : createEternumGame(name, date.toISOString()),
    );
  };
  const error = action.error ?? runs.error ?? slots.error;
  return (
    <section className="space-y-5 rounded-2xl border border-gold/20 bg-black/60 p-5 text-gold">
      <h2 className="font-cinzel text-xl">Schedule play</h2>
      <p className="text-sm text-gold/70">
        Blitz slots form balanced Regular Blitz games of up to 24 players. Realms settle automatically before play
        begins.
      </p>
      {status !== "signed-in" ? (
        <button className={buttonStyle} onClick={() => signIn()}>
          Sign in to schedule
        </button>
      ) : (
        <form onSubmit={submit} className="grid max-w-xl gap-4">
          <label>
            Format
            <select
              className={inputStyle}
              value={mode}
              onChange={(event) => setMode(event.target.value as typeof mode)}
            >
              <option value="blitz">Free Blitz slot</option>
              <option value="eternum">Eternum game</option>
            </select>
          </label>
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
            {mode === "blitz" ? "Registration closes (local time)" : "Game starts (local time)"}
            <input
              className={inputStyle}
              required
              type="datetime-local"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </label>
          <button className={buttonStyle} disabled={action.isPending}>
            {action.isPending ? "Submitting…" : mode === "blitz" ? "Create slot" : "Create game"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-red-400">
          {error.message}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {mode === "blitz" &&
        slots.data?.slots
          .filter((slot) => !slot.frozenAt)
          .map((slot) => (
            <div
              key={slot.name}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/20 pt-3"
            >
              <span>
                {slot.name} · {slot.registrations.length} players · closes {new Date(slot.closesAt).toLocaleString()}
              </span>
              {status === "signed-in" && slot.closed && (
                <button
                  className={buttonStyle}
                  disabled={action.isPending}
                  onClick={() => action.mutate(() => closePlaytestSlot(slot.name))}
                >
                  Assign roster
                </button>
              )}
            </div>
          ))}
      <h3 className="font-cinzel text-lg">Progress</h3>
      {runs.isPending && <p>Loading launches…</p>}
      {runs.data?.runs.map((run) => (
        <article key={run.runId} className="space-y-2 rounded border border-gold/20 p-3">
          <p>
            {run.gameName} · {run.kind === "result" ? "Results" : "Creation"} · {run.status}
          </p>
          {run.steps.map((step) => (
            <p key={step.id} className="text-sm text-gold/70">
              {step.title}: {step.latestEvent}
            </p>
          ))}
          {run.artifacts.resultCommitment && (
            <p className="break-all text-xs">Result: {run.artifacts.resultCommitment}</p>
          )}
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
