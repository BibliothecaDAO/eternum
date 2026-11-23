import "@/ui/features/game-entry/doorway/doorway-screen.css";

import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";
import { paintingSources } from "@/ui/design-system/kit/paintings";

export const FirstFrame = () => (
  <div data-surface="shell" className="doorway-stage">
    <img aria-hidden {...paintingSources("frontier-mist")} sizes="100vw" alt="" className="doorway-stage__painting" />
    <div aria-hidden className="doorway-stage__scrim" />
    <main className="doorway-stage__center">
      <img src={AGE_LOCKUP.frontier} alt="Realms" className="doorway-stage__lockup" />
    </main>
    <footer className="doorway-stage__foot">
      <div className="doorway-bar" aria-hidden="true">
        <div className="doorway-bar__fill doorway-bar__fill--indeterminate" />
      </div>
    </footer>
  </div>
);
