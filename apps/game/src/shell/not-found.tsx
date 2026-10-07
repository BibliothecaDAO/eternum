import { Link } from "react-router-dom";

import { PageFrame } from "./frame/page-frame";
import { Panel, PanelTitle } from "./kit";

/** A page that does not exist, also drawn inside a page whose subject does not exist (a post, a player). */
export const NothingHere = () => (
  <Panel className="max-w-lg">
    <PanelTitle>Nothing here</PanelTitle>
    <Link to="/" className="mt-3 inline-block text-[15px] text-gold underline">
      Play
    </Link>
  </Panel>
);

export const NotFoundPage = () => (
  <PageFrame>
    <NothingHere />
  </PageFrame>
);
