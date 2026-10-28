import { useEffect, useState } from "react";
import "./view.css";

/** Where the showcase links the pages of what each open PR ships (eternum-lanes' ship-page.py writes them). */
const SHIP_ADDRESS = "/ship";
/** Where the showcase serves the owner's open pick pages, one folder each (eternum-lanes' lab-open.py lists them). */
const PICKS_ADDRESS = "/picks";

/** A PR's page of what it ships, as `/ship/index.json` lists it. */
interface ShipPage {
  pr: number;
  title: string;
  page: string;
}

/** A list the showcase serves beside the lab, out of the repository: still reading, none on this server, or its rows. */
type ServedList<Row> = { state: "loading" } | { state: "missing" } | { state: "read"; rows: Row[] };

/** Reads a JSON list the showcase serves; a server without it has none. */
function useServedList<Row>(address: string): ServedList<Row> {
  const [list, setList] = useState<ServedList<Row>>({ state: "loading" });
  useEffect(() => {
    let current = true;
    fetch(address)
      .then(async (response) => {
        // The dev server answers an unknown address with the app's page, not a 404.
        const rows = response.ok ? await response.json().catch(() => null) : null;
        if (current) setList(Array.isArray(rows) ? { state: "read", rows } : { state: "missing" });
      })
      .catch(() => current && setList({ state: "missing" }));
    return () => {
      current = false;
    };
  }, [address]);
  return list;
}

interface Pick {
  name: string;
  title: string;
  page: string;
}

/**
 * The lab's front page (/lab): what the owner has open now, each one click away: the pick pages still waiting on a
 * choice, then the pages of open PRs. Decided picks and merged PRs are archived outside the lab, so they never show.
 */
export const OpenView = () => {
  const picks = useServedList<Pick>(`${PICKS_ADDRESS}/index.json`);
  const ships = useServedList<ShipPage>(`${SHIP_ADDRESS}/index.json`);
  if (picks.state === "loading" || ships.state === "loading") return <main className="lab-open" aria-busy="true" />;
  const open = [
    ...(picks.state === "read"
      ? picks.rows.map((pick) => ({ key: pick.page, href: pick.page, title: pick.title }))
      : []),
    ...(ships.state === "read"
      ? ships.rows.map((ship) => ({ key: ship.page, href: ship.page, title: `PR #${ship.pr}: ${ship.title}` }))
      : []),
  ];
  return (
    <main className="lab-open">
      <h1>Open now</h1>
      {open.length === 0 ? (
        <p>Nothing open.</p>
      ) : (
        <ul>
          {open.map((item) => (
            <li key={item.key}>
              <a href={`${item.href}index.html`}>{item.title}</a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};
