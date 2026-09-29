import { Link } from "react-router-dom";

import { Panel, PanelTitle } from "./kit";

export const NotFoundPage = ({ title = "Nothing here", children }: { title?: string; children?: React.ReactNode }) => (
  <Panel className="max-w-lg">
    <PanelTitle>{title}</PanelTitle>
    <p className="text-sm text-gold/70">{children ?? "That page does not exist."}</p>
    <Link to="/" className="mt-3 inline-block font-mono text-[11px] uppercase tracking-wider text-gold underline">
      Back home
    </Link>
  </Panel>
);
