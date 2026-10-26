import { useEffect, useState } from "react";
import "./view.css";

/** Where the showcase links the pages of what each batch PR ships (eternum-lanes' ship-page.py writes them). */
export const SHIP_ADDRESS = "/ship";

interface ShipPage {
  pr: number;
  title: string;
  url: string;
  page: string;
  items: number;
  joining: number;
}
type Read = { state: "loading" } | { state: "missing" } | { state: "read"; pages: ShipPage[] };

/**
 * Dev only: Ships (Data room). Each batch PR's page of what it ships, item by item in stills, newest PR first. The pages
 * are static, written outside the game's repo and served beside the lab; this lists the ones the server has.
 */
export const ShipsView = () => {
  const read = useShipPages();
  if (read.state === "loading") return <p className="data-room data-room-note">Reading the ship pages…</p>;
  if (read.state === "missing" || read.pages.length === 0)
    return (
      <p className="data-room data-room-note">
        No ship pages on this server. Write one with <code>python3 ship-page.py --pr &lt;number&gt;</code> and link its
        folder at <code>{SHIP_ADDRESS}</code>.
      </p>
    );
  return (
    <div className="data-room">
      <h1 className="ui-usage-title">What each PR ships</h1>
      <ul className="ship-list">
        {read.pages.map((page) => (
          <li key={page.pr}>
            <a href={`${page.page}index.html`}>
              PR #{page.pr}: {page.title}
            </a>
            <span className="data-room-note">
              {" "}
              · {page.items} items{page.joining > 0 ? `, ${page.joining} joining` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

function useShipPages(): Read {
  const [read, setRead] = useState<Read>({ state: "loading" });
  useEffect(() => {
    let current = true;
    fetch(`${SHIP_ADDRESS}/index.json`)
      .then(async (response) => {
        // The dev server answers an unknown address with the app's page, not a 404.
        const pages = response.ok ? await response.json().catch(() => null) : null;
        if (current) setRead(Array.isArray(pages) ? { state: "read", pages } : { state: "missing" });
      })
      .catch(() => current && setRead({ state: "missing" }));
    return () => {
      current = false;
    };
  }, []);
  return read;
}
