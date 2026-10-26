import { HudTabs } from "@/ui/design-system/kit/hud-elements";
import { marked } from "marked";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ResearchBalanceLab } from "./research-balance/research-balance-lab";
import "./view.css";

/** Where the showcase links perf's newest analysis (showcase.sh); a server without one has no pull to show. */
export const PULL_ADDRESS = "/live-data/analysis.md";
const RERUN =
  "cd evidence/perf/frontier-live-data-1 && python3 -I <repo>/apps/game/scripts/live-data/live-data.py all > <new-dir>/analysis.md";

/** The pull's sections for a game: Blitz's under "# Blitz", Frontier's the rest; the value ledger, both games' money, in each. */
export function sectionsFor(markdown: string, game: "blitz" | "frontier") {
  const sections = markdown.split(/^(?=# )/m).filter((section) => section.startsWith("# "));
  const blitz = (section: string) => section.startsWith("# Blitz");
  const ledger = (section: string) => section.startsWith("# Value ledger");
  return sections
    .filter((section) => ledger(section) || (game === "blitz" ? blitz(section) : !blitz(section)))
    .join("\n");
}

/** When the pull was taken, from its first heading ("…, pulled 2026-10-25T17:24:19…"). */
export const pulledAt = (markdown: string) => /pulled (\S+)/.exec(markdown)?.[1]?.slice(0, 16).replace("T", " ");

type Pull = { state: "loading" } | { state: "missing" } | { state: "read"; markdown: string };

/**
 * Dev only: Balance & data (Data room). The live playtest is perf's newest pull (live-data.py's analysis) for the game
 * switched to; Frontier's research balance study is the proposals for next season. `view` picks one, `mode` the game.
 */
export const DataRoomView = () => {
  const [params, setParams] = useSearchParams();
  const game = params.get("mode") === "blitz" ? "blitz" : "frontier";
  const view = game === "frontier" && params.get("view") === "balance" ? "balance" : "live";
  const choose = (next: string) =>
    setParams((current) => {
      current.set("view", next);
      return current;
    });
  return (
    <div className="data-room">
      {game === "frontier" && (
        <HudTabs
          tabs={[
            { key: "live", label: "Live playtest" },
            { key: "balance", label: "Research balance · next season" },
          ]}
          value={view}
          onChange={choose}
        />
      )}
      {view === "balance" ? <ResearchBalanceLab /> : <LivePull game={game} />}
    </div>
  );
};

const LivePull = ({ game }: { game: "blitz" | "frontier" }) => {
  const [pull, setPull] = useState<Pull>({ state: "loading" });
  useEffect(() => {
    let current = true;
    fetch(PULL_ADDRESS)
      .then(async (response) => {
        const markdown = response.ok ? await response.text() : "";
        // The dev server answers an unknown address with the app's page, not a 404.
        if (current) setPull(markdown.startsWith("# ") ? { state: "read", markdown } : { state: "missing" });
      })
      .catch(() => current && setPull({ state: "missing" }));
    return () => {
      current = false;
    };
  }, []);
  if (pull.state === "loading") return <p className="data-room-note">Reading the newest pull…</p>;
  if (pull.state === "missing")
    return (
      <p className="data-room-note">
        No pull on this server. Pull one with <code>{RERUN}</code> and link it at <code>{PULL_ADDRESS}</code> (the
        showcase links the newest one).
      </p>
    );
  return (
    <article className="data-room-pull">
      <p className="data-room-note">
        Perf's pull of {pulledAt(pull.markdown) ?? "an unknown time"} UTC, read-only. Rerun: <code>{RERUN}</code>
      </p>
      <div dangerouslySetInnerHTML={{ __html: marked.parse(sectionsFor(pull.markdown, game), { async: false }) }} />
    </article>
  );
};
