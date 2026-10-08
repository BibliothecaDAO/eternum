import { useState } from "react";
import { Link } from "react-router-dom";

import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { ViewSwitch } from "@/ui/design-system/kit/view-switch";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { SettingRow, SettingRows } from "../profile/setting-row";
import { LEARN_WORDS } from "../words";
import { MODE_GUIDES, PLAYER_GUIDES } from "./guides";
import { News } from "./news";

type LearnView = "guides" | "news";

/**
 * Learn (spec 13): a guide per mode and the players' guides, and News; a switch above the one list on a phone, both
 * side by side on desktop; Terms · Privacy at the foot.
 */
export const LearnPage = () => {
  const layout = useLayout();
  const [view, setView] = useState<LearnView>("guides");
  return (
    <PageFrame foot={<LegalLinks />}>
      {layout === "phone" ? (
        <div className="flex flex-col gap-3">
          <ViewSwitch
            label={LEARN_WORDS.guides}
            views={[
              { id: "guides", word: LEARN_WORDS.guides },
              { id: "news", word: LEARN_WORDS.news },
            ]}
            lit={view}
            onChange={setView}
          />
          {view === "guides" ? <Guides /> : <NewsRows />}
        </div>
      ) : (
        <div className="grid grid-cols-2 items-start gap-6">
          <Guides />
          <NewsRows />
        </div>
      )}
    </PageFrame>
  );
};

const Guides = () => {
  const [players, setPlayers] = useState(false);
  return (
    <>
      <SettingRows>
        {MODE_GUIDES.map((guide) => (
          <SettingRow
            key={guide.url}
            icon={guide.icon}
            name={guide.title}
            onOpen={() => window.open(guide.url, "_blank", "noopener,noreferrer")}
          />
        ))}
        <SettingRow icon="Pp" name={LEARN_WORDS.byPlayers} onOpen={() => setPlayers(true)} />
      </SettingRows>
      {players && (
        <Sheet label={LEARN_WORDS.byPlayers} onClose={() => setPlayers(false)}>
          <SettingRows>
            {PLAYER_GUIDES.map((guide) => (
              <SettingRow
                key={guide.url}
                icon="Pc"
                name={guide.title}
                value={guide.source}
                onOpen={() => window.open(guide.url, "_blank", "noopener,noreferrer")}
              />
            ))}
          </SettingRows>
        </Sheet>
      )}
    </>
  );
};

const NewsRows = () => (
  <SettingRows>
    <News />
  </SettingRows>
);

/** The legal pages, at Learn's foot. */
const LegalLinks = () => (
  <nav className="flex items-center justify-center gap-3 text-[15px] text-kit-muted">
    <Link to="/terms" className="flex min-h-12 items-center px-2">
      <KitIcon code="Dk" size={18} className="mr-1.5" />
      {LEARN_WORDS.terms}
    </Link>
    <span aria-hidden>·</span>
    <Link to="/privacy" className="flex min-h-12 items-center px-2">
      {LEARN_WORDS.privacy}
    </Link>
  </nav>
);
