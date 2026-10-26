import { useEffect, useState } from "react";
import "../data/view.css";
import "./view.css";

/** Where the showcase links the Frontier sheet (eternum-lanes' kit-sheet.mjs writes it). */
export const SHEET_ADDRESS = "/kit-sheet";

type Read = "loading" | "missing" | "read";

/**
 * Dev only: Frontier sheet (Kit room). Every Frontier panel in stills, desktop beside phone with its hover, as
 * kit-sheet.mjs last shot them on the next batch's head. The sheet is a static page of stills served beside the lab, so
 * a rerun updates it without a new lab build.
 */
export const FrontierSheetView = () => {
  const read = useSheet();
  if (read === "loading") return <p className="data-room data-room-note">Reading the Frontier sheet…</p>;
  if (read === "missing")
    return (
      <p className="data-room data-room-note">
        No Frontier sheet on this server. Write one with <code>node kit-sheet.mjs</code> and link its folder at{" "}
        <code>{SHEET_ADDRESS}</code>.
      </p>
    );
  return <iframe className="kit-sheet" title="Frontier sheet" src={`${SHEET_ADDRESS}/index.html`} />;
};

function useSheet(): Read {
  const [read, setRead] = useState<Read>("loading");
  useEffect(() => {
    let current = true;
    fetch(`${SHEET_ADDRESS}/kit.json`)
      .then(async (response) => {
        // The dev server answers an unknown address with the app's page, not a 404.
        const kit = response.ok ? await response.json().catch(() => null) : null;
        if (current) setRead(Array.isArray(kit?.panels) ? "read" : "missing");
      })
      .catch(() => current && setRead("missing"));
    return () => {
      current = false;
    };
  }, []);
  return read;
}
