import type { Counter, Incident, MonitorState, Probe, Target } from "./model";

const DAY = 86400;
const dateOf = (time: number) => new Date(time * 1000).toISOString().slice(0, 10);

/** One observation per minute; unknown intervals never contribute successful uptime or continuous status. */
export function nextMonitorState(
  previous: MonitorState | null,
  checkedAt: number,
  probes: Probe[],
  targets: Target[],
): MonitorState | null {
  const minute = Math.floor(checkedAt / 60);
  const priorMinute = previous ? Math.floor(previous.document.checked_at / 60) : null;
  if (priorMinute !== null && minute <= priorMinute) return null;
  const dates = Array.from({ length: 90 }, (_, i) => dateOf(checkedAt - (89 - i) * DAY));
  const gap = priorMinute === null || minute > priorMinute + 1;
  const counters = retainedCounters(previous, dates);
  const components = probes.map((probe) => {
    const prior = previous?.document.components.find((row) => row.id === probe.id);
    const samples = (previous?.counters[probe.id] ?? [])
      .filter((day) => dates.includes(day.date))
      .map((day) => ({ ...day }));
    recordMinute(samples, checkedAt, probe.status === "up", prior ? priorMinute : null);
    counters[probe.id] = samples;
    return {
      ...probe,
      since: prior && prior.status === probe.status && !gap ? prior.since : checkedAt,
      days: dates.map((date) => {
        const day = samples.find((sample) => sample.date === date);
        return { date, uptime: !day || day.unknown || day.observed === 0 ? null : day.up / day.observed };
      }),
    };
  });
  return {
    document: {
      version: 1,
      checked_at: checkedAt,
      components,
      incidents: updateIncidents(previous?.document.incidents ?? [], probes, checkedAt),
    },
    targets,
    counters,
  };
}

function retainedCounters(previous: MonitorState | null, dates: string[]): MonitorState["counters"] {
  const result: MonitorState["counters"] = {};
  for (const [id, days] of Object.entries(previous?.counters ?? {})) {
    const retained = days.filter((day) => dates.includes(day.date));
    if (retained.length) result[id] = retained;
  }
  return result;
}

function recordMinute(samples: Counter[], now: number, up: boolean, priorMinute: number | null) {
  const date = dateOf(now);
  let today = samples.find((day) => day.date === date);
  if (!today) {
    today = { date, observed: 0, up: 0, unknown: false };
    samples.push(today);
  }
  if (priorMinute === null) today.unknown = Math.floor(now / 60) % 1440 !== 0;
  else {
    const current = Math.floor(now / 60);
    // At most90 days survive. Mark a gap by day, never allocate a record for each absent minute.
    for (
      let day = Math.max(Math.floor((priorMinute + 1) / 1440), Math.floor(current / 1440) - 89);
      day <= Math.floor((current - 1) / 1440);
      day++
    ) {
      const missingStart = Math.max(priorMinute + 1, day * 1440);
      const missingEnd = Math.min(current - 1, (day + 1) * 1440 - 1);
      if (missingStart > missingEnd) continue;
      const missingDate = dateOf(day * DAY);
      let sample = samples.find((row) => row.date === missingDate);
      if (!sample) {
        sample = { date: missingDate, observed: 0, up: 0, unknown: true };
        samples.push(sample);
      }
      sample.unknown = true;
    }
  }
  today.observed++;
  if (up) today.up++;
}

function updateIncidents(previous: Incident[], probes: Probe[], now: number) {
  const incidents = previous.map((incident) => ({ ...incident, updates: [...incident.updates] }));
  for (const probe of probes) {
    let incident = incidents.find((row) => row.status !== "resolved" && row.components.includes(probe.id));
    if (probe.status === "up") {
      if (incident) {
        incident.status = "resolved";
        incident.resolved_at = now;
        incident.updates.push({ at: now, text: "The public probe recovered." });
      }
    } else if (!incident) {
      incident = {
        id: `${probe.id}:${now}`,
        title: `${probe.name}: ${probe.status === "down" ? "unavailable" : "degraded"}`,
        status: "monitoring",
        started_at: now,
        resolved_at: null,
        components: [probe.id],
        updates: [{ at: now, text: `The public probe observed ${probe.status}.` }],
      };
      incidents.unshift(incident);
    } else {
      const text = `The public probe observed ${probe.status}.`;
      if (incident.updates.at(-1)?.text !== text) incident.updates.push({ at: now, text });
    }
  }
  for (const incident of incidents) {
    if (incident.status !== "resolved" && !incident.components.some((id) => probes.some((probe) => probe.id === id))) {
      incident.status = "resolved";
      incident.resolved_at = now;
      incident.updates.push({ at: now, text: "This world is no longer listed for monitoring." });
    }
    if (incident.updates.length > 10) incident.updates = [incident.updates[0]!, ...incident.updates.slice(-9)];
  }
  const recent = incidents
    .filter((row) => row.status === "resolved")
    .sort((a, b) => (b.resolved_at ?? b.started_at) - (a.resolved_at ?? a.started_at))
    .slice(0, 100);
  return [...incidents.filter((row) => row.status !== "resolved"), ...recent].sort(
    (a, b) => b.started_at - a.started_at,
  );
}
