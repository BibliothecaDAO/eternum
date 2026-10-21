import { useRef, useState } from "react";

import { Icon } from "@/ui/design-system/icon";
import { AppLink, AppPanel, AppTabs } from "@/ui/design-system/kit/app-elements";
import { NEWS_WORDS, WORDS } from "@/ui/design-system/kit/words";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { patchNotes } from "../generated/patch-notes";
import type { PatchNote } from "./patch-note";
import { changedSections, PatchHead, PatchSection, patchSection, ReleaseRows } from "./patch-notes";

/** The game's full rules, on the docs site: the notes say what changed, the docs say everything. */
const FULL_RULES = "https://docs.realms.world";

/**
 * What's new (spec 13), a place of its own in the bar: the game's patch notes, the page's whole width. A release's head
 * with the link to the full rules, a tab per section it changed (All modes, then Frontier, Blitz, Eternum) over that
 * section on its painting, then every release, newest first; a release picked there is shown from its head, scrolled to
 * and focused (qa-app-1 P3-1). It ends on the footer.
 */
export const WhatsNewPage = () => {
  const phone = useLayout() === "phone";
  const [shown, setShown] = useState(0);
  const note = patchNotes[shown];
  const release = useRef<HTMLDivElement | null>(null);
  // A release picked from the list is read from its head: the page takes the reader there, its focus with it.
  const show = (index: number) => {
    setShown(index);
    queueMicrotask(() => {
      release.current?.scrollIntoView({ block: "start" });
      release.current?.focus({ preventScroll: true });
    });
  };
  return (
    <PageFrame title={WORDS.whatsNew}>
      <div className="flex flex-col gap-6">
        {phone && <h1 className="text-app-title text-app-ink">{WORDS.whatsNew}</h1>}
        <div ref={release} tabIndex={-1} className="flex scroll-mt-6 flex-col gap-6 outline-none">
          <Release key={note.date} note={note} />
        </div>
        <AppPanel icon="calendar" title={NEWS_WORDS.releases} flush>
          <ReleaseRows notes={patchNotes} shown={shown} onShow={show} />
        </AppPanel>
      </div>
    </PageFrame>
  );
};

/** One release: its head, a tab per section it changed (the first chosen), and the chosen section. */
const Release = ({ note }: { note: PatchNote }) => {
  const sections = changedSections(note);
  const [section, setSection] = useState(sections[0]);
  return (
    <>
      <AppPanel icon="book" title={NEWS_WORDS.patchNotes} cue={<FullRulesLink />}>
        <PatchHead note={note} />
      </AppPanel>
      <AppTabs
        tabs={sections.map((mode) => ({ key: mode, label: patchSection(mode).name }))}
        value={section}
        onChange={setSection}
        label={NEWS_WORDS.patchNotes}
      >
        <PatchSection note={note} mode={section} />
      </AppTabs>
    </>
  );
};

const FullRulesLink = () => (
  <AppLink to={FULL_RULES} className="flex items-center gap-2 text-app-strong text-app-ink hover:underline">
    {NEWS_WORDS.fullRules}
    <Icon name="external-link" size={18} />
  </AppLink>
);
