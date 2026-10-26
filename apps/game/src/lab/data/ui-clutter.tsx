import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./view.css";

/** Where the showcase links the clutter audit: its clutter.json and, beside it, each surface's before and mock stills. */
export const CLUTTER_ADDRESS = "/clutter-audit";

type Action = "delete" | "hover" | "merge";
interface Counts {
  texts: number;
  numbers: number;
  buttons: number;
  icons: number;
}
interface Surface {
  rank: number;
  id: string;
  mode: "frontier" | "blitz";
  name: string;
  where: string;
  job: string;
  before: Counts;
  after: Counts;
  cuts: { what: string; action: Action; why: string }[];
  stills: { size: string; before: string; after: string }[];
}
interface Audit {
  title: string;
  captured: string;
  method: string;
  patterns: string[];
  noted: string[];
  alsoFound: string[];
  surfaces: Surface[];
}
type Read = { state: "loading" } | { state: "missing" } | { state: "read"; audit: Audit };

const ACTION_LABEL: Record<Action, string> = { delete: "Delete", hover: "To hover or a held tap", merge: "Merge" };
/** The counts a surface is held to, as the audit names them. */
const COUNTED: [keyof Counts, string][] = [
  ["texts", "text runs"],
  ["numbers", "figures"],
  ["buttons", "buttons"],
  ["icons", "icons"],
];

/**
 * Dev only: UI clutter (Data room). What a player sees on each surface of the game switched to (`mode`), strongest cut
 * first: the surface's one job, what it shows counted before and after, each cut and where it goes (deleted, or to a
 * hover or a held tap), and a still of the surface beside a mock of it with the cuts applied. Stills only.
 */
export const UiClutterView = () => {
  const [params] = useSearchParams();
  const game = params.get("mode") === "blitz" ? "blitz" : "frontier";
  const read = useAudit();
  if (read.state === "loading") return <p className="data-room data-room-note">Reading the clutter audit…</p>;
  if (read.state === "missing")
    return (
      <p className="data-room data-room-note">
        No clutter audit on this server. Link the audit's page folder (its clutter.json and mocks) at{" "}
        <code>{CLUTTER_ADDRESS}</code> (the showcase links it).
      </p>
    );
  const { audit } = read;
  return (
    <div className="data-room">
      <header>
        <h1 className="ui-usage-title">{audit.title}</h1>
        <p className="data-room-note">{audit.captured}</p>
        <p className="data-room-note">{audit.method}</p>
      </header>
      <Notes title="What repeats across surfaces" lines={audit.patterns} />
      <ol className="ui-usage-list">
        {audit.surfaces
          .filter((surface) => surface.mode === game)
          .map((surface) => (
            <SurfaceRow key={surface.id} surface={surface} />
          ))}
      </ol>
      <Notes title="Also found" lines={audit.alsoFound} />
      <Notes title="Noted, not redone" lines={audit.noted} />
    </div>
  );
};

const SurfaceRow = ({ surface }: { surface: Surface }) => (
  <li className="ui-clutter-row">
    <h2>
      <span className="ui-usage-rank">{surface.rank}</span> {surface.name}
      <span className="data-room-note">{surface.where}</span>
    </h2>
    <p>
      <b>Job:</b> {surface.job}
    </p>
    <p className="data-room-note">
      {COUNTED.map(([key, noun]) => `${surface.before[key]} → ${surface.after[key]} ${noun}`).join(" · ")}
    </p>
    <ol className="ui-clutter-cuts">
      {surface.cuts.map((cut) => (
        <li key={cut.what}>
          <span className={`ui-usage-kind ui-clutter-${cut.action}`}>{ACTION_LABEL[cut.action]}</span> {cut.what}.{" "}
          <span className="data-room-note">{cut.why}</span>
        </li>
      ))}
    </ol>
    {surface.stills.map((still) => (
      <div key={still.size} className="ui-clutter-pair">
        <figure>
          <img src={`${CLUTTER_ADDRESS}/${still.before}`} alt={`${surface.name} on a ${still.size}, as it stands`} />
          <figcaption>Now · {still.size}</figcaption>
        </figure>
        <figure>
          <img src={`${CLUTTER_ADDRESS}/${still.after}`} alt={`${surface.name} on a ${still.size}, with the cuts`} />
          <figcaption>With the cuts · {still.size}</figcaption>
        </figure>
      </div>
    ))}
  </li>
);

const Notes = ({ title, lines }: { title: string; lines: string[] }) => (
  <section>
    <h2 className="ui-usage-title">{title}</h2>
    <ul className="ui-usage-notes">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  </section>
);

function useAudit(): Read {
  const [read, setRead] = useState<Read>({ state: "loading" });
  useEffect(() => {
    let current = true;
    fetch(`${CLUTTER_ADDRESS}/clutter.json`)
      .then(async (response) => {
        // The dev server answers an unknown address with the app's page, not a 404.
        const audit = response.ok ? await response.json().catch(() => null) : null;
        if (current) setRead(audit?.surfaces ? { state: "read", audit } : { state: "missing" });
      })
      .catch(() => current && setRead({ state: "missing" }));
    return () => {
      current = false;
    };
  }, []);
  return read;
}
