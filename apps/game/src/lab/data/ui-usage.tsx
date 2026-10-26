import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./view.css";

/** Where the showcase links the usage audit's findings and its HUD screenshots; a server without them has none to show. */
export const AUDIT_ADDRESS = "/usage-audit";

type Kind = "command" | "ui-only" | "rules";
interface Finding {
  title: string;
  modes: string[];
  kind: Kind;
  where: string;
  evidence: string;
  replace: string;
  risk: string;
  shot: string | null;
}
interface Audit {
  title: string;
  pulled: string;
  source: string;
  rerun: string;
  caveat: string;
  findings: Finding[];
  kept: string[];
  outOfScope: string[];
}
type Read = { state: "loading" } | { state: "missing" } | { state: "read"; audit: Audit };

const KIND_LABEL: Record<Kind, string> = {
  command: "Counted on chain",
  "ui-only": "UI-only",
  rules: "Rules question",
};

/**
 * Dev only: UI usage (Data room). The usage audit's ranked list of what players never or almost never use, strongest cut
 * first, each beside its HUD screenshot, for the game switched to (`mode`). The rank is the audit's, kept across games.
 */
export const UiUsageView = () => {
  const [params] = useSearchParams();
  const game = params.get("mode") === "blitz" ? "blitz" : "frontier";
  const read = useAudit();
  if (read.state === "loading") return <p className="data-room data-room-note">Reading the usage audit…</p>;
  if (read.state === "missing")
    return (
      <p className="data-room data-room-note">
        No usage audit on this server. Link its folder (findings.json and the screenshots) at{" "}
        <code>{AUDIT_ADDRESS}</code>.
      </p>
    );
  const { audit } = read;
  const ranked = audit.findings.map((finding, index) => ({ finding, rank: index + 1 }));
  return (
    <div className="data-room">
      <header>
        <h1 className="ui-usage-title">{audit.title}</h1>
        <p className="data-room-note">
          Pulled {audit.pulled}. {audit.source}
        </p>
        <p className="data-room-note">{audit.caveat}</p>
        <p className="data-room-note">
          Rerun: <code>{audit.rerun}</code>
        </p>
      </header>
      <ol className="ui-usage-list">
        {ranked
          .filter(({ finding }) => finding.modes.includes(game))
          .map(({ finding, rank }) => (
            <FindingRow key={finding.title} finding={finding} rank={rank} />
          ))}
      </ol>
      <Notes title="Used: keep" lines={audit.kept} />
      <Notes title="Out of scope" lines={audit.outOfScope} />
    </div>
  );
};

const FindingRow = ({ finding, rank }: { finding: Finding; rank: number }) => (
  <li className="ui-usage-row">
    <div className="ui-usage-text">
      <h2>
        <span className="ui-usage-rank">{rank}</span> {finding.title}
        <span className={`ui-usage-kind ui-usage-kind-${finding.kind}`}>{KIND_LABEL[finding.kind]}</span>
      </h2>
      <dl>
        <dt>Where</dt>
        <dd>{finding.where}</dd>
        <dt>Evidence</dt>
        <dd>{finding.evidence}</dd>
        <dt>Instead</dt>
        <dd>{finding.replace}</dd>
        <dt>Risk</dt>
        <dd>{finding.risk}</dd>
      </dl>
    </div>
    {finding.shot ? (
      <img className="ui-usage-shot" src={`${AUDIT_ADDRESS}/${finding.shot}`} alt={`${finding.title} in the HUD`} />
    ) : (
      <p className="ui-usage-shot data-room-note">No lab fixture draws it.</p>
    )}
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
    fetch(`${AUDIT_ADDRESS}/findings.json`)
      .then(async (response) => {
        // The dev server answers an unknown address with the app's page, not a 404.
        const audit = response.ok ? await response.json().catch(() => null) : null;
        if (current) setRead(audit?.findings ? { state: "read", audit } : { state: "missing" });
      })
      .catch(() => current && setRead({ state: "missing" }));
    return () => {
      current = false;
    };
  }, []);
  return read;
}
