import { useIdentitySession, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  createEternumGame,
  fetchFactoryRuns,
  fetchPlaytestSlots,
  fetchSeasonCalendar,
  retryFactoryRun,
  saveSeasonPhase,
  type SeasonPhase,
  type SeasonPhaseName,
} from "../api/factory-worker";
import { FACTORY_GAME_LIST_REFRESH_EVENT } from "../game-list-refresh-event";

const inputStyle = "w-full rounded border border-gold/30 bg-black/40 px-3 py-2 text-gold";
const buttonStyle = "rounded border border-gold/40 px-4 py-2 text-gold disabled:opacity-40 hover:bg-gold/10";
const RUN_ENVIRONMENTS = ["madara.blitz", "madara.eternum", "madara.frontier"] as const;

export const FactoryV2Content = () => {
  const { status } = useIdentitySession();
  const signIn = useIdentitySessionStore((state) => state.requestSignIn);
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
  const slots = useQuery({ queryKey: ["playtestSlots"], queryFn: fetchPlaytestSlots, refetchInterval: 3_000 });
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
  const error = action.error ?? runs.find((query) => query.error)?.error ?? slots.error;
  const allRuns = runs.flatMap((query) => query.data?.runs ?? []);
  // A failed launch waits for a launcher, a Frontier season included, so it leads the page rather than hiding in the list.
  const needsAttention = allRuns.filter((run) => run.status === "attention");
  return (
    <section className="space-y-5 rounded-2xl border border-gold/20 bg-black/60 p-5 text-gold">
      <h2 className="font-cinzel text-xl">Schedule play</h2>
      <p className="text-sm text-gold/70">
        The season calendar decides when Frontier runs and when free Blitz slots open: slots follow the daily timetable
        inside the Blitz window and form games of up to 24 players on their own. Eternum games are scheduled here.
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
      <SeasonCalendar canEdit={status === "signed-in"} />
      {slots.data?.slots
        .filter((slot) => !slot.frozenAt)
        .map((slot) => (
          <p key={slot.name} className="border-t border-gold/20 pt-3">
            {slot.name} · {slot.registrations.length} players · closes {new Date(slot.closesAt).toLocaleString()}
          </p>
        ))}
      {needsAttention.length > 0 && (
        <div role="alert" className="space-y-2 rounded border border-red-400/60 p-3">
          <h3 className="font-cinzel text-lg text-red-300">Needs attention</h3>
          {needsAttention.map((run) => (
            <p key={run.runId}>
              {run.gameName} ({run.environment}) failed:{" "}
              {run.steps.find((step) => step.status === "failed")?.errorMessage}
            </p>
          ))}
        </div>
      )}
      <h3 className="font-cinzel text-lg">Progress</h3>
      {runs.some((query) => query.isPending) && <p>Loading launches…</p>}
      {allRuns.map((run) => (
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

const CALENDAR_PHASES: { phase: SeasonPhaseName; title: string }[] = [
  { phase: "frontier", title: "Frontier season" },
  { phase: "blitz", title: "Blitz window" },
];

/** The season calendar: each phase's planned start and end. A running Frontier season's dates are fixed. */
const SeasonCalendar = ({ canEdit }: { canEdit: boolean }) => {
  const queryClient = useQueryClient();
  const calendar = useQuery({ queryKey: ["seasonCalendar"], queryFn: fetchSeasonCalendar });
  const save = useMutation({
    mutationFn: ({ phase, startsAt, endsAt }: SeasonPhase) => saveSeasonPhase(phase, startsAt, endsAt),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seasonCalendar"] }),
  });
  return (
    <div className="space-y-3 border-t border-gold/20 pt-3">
      <h3 className="font-cinzel text-lg">Season calendar</h3>
      {CALENDAR_PHASES.map(({ phase, title }) => (
        <CalendarPhase
          key={`${phase}:${calendar.dataUpdatedAt}`}
          title={title}
          current={calendar.data?.phases.find((entry) => entry.phase === phase)}
          canEdit={canEdit}
          saving={save.isPending}
          onSave={(startsAt, endsAt) => save.mutate({ phase, startsAt, endsAt })}
        />
      ))}
      {save.error && (
        <p role="alert" className="text-red-400">
          {save.error.message}
        </p>
      )}
    </div>
  );
};

/** An ISO instant as a datetime-local input's value, in the launcher's own time zone. */
const toLocalInput = (iso: string | undefined) =>
  iso ? new Date(Date.parse(iso) - new Date(iso).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";

const CalendarPhase = (props: {
  title: string;
  current: SeasonPhase | undefined;
  canEdit: boolean;
  saving: boolean;
  onSave: (startsAt: string, endsAt: string) => void;
}) => {
  const [start, setStart] = useState(toLocalInput(props.current?.startsAt));
  const [end, setEnd] = useState(toLocalInput(props.current?.endsAt));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    props.onSave(new Date(start).toISOString(), new Date(end).toISOString());
  };
  return (
    <form onSubmit={submit} className="grid max-w-xl gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <p className="sm:col-span-3">{props.title}</p>
      <label className="text-sm">
        Starts (local time)
        <input
          className={inputStyle}
          required
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          disabled={!props.canEdit}
        />
      </label>
      <label className="text-sm">
        Ends (local time)
        <input
          className={inputStyle}
          required
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          disabled={!props.canEdit}
        />
      </label>
      {props.canEdit && (
        <button className={buttonStyle} disabled={props.saving}>
          Save
        </button>
      )}
    </form>
  );
};
