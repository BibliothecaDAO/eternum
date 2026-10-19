import { type ReactNode, useState } from "react";
import { useParams } from "react-router-dom";

import { AppAgeColumn, AppPanel, AppRow, AppTabs } from "@/ui/design-system/kit/app-elements";
import { NEWS_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { formatContentDay } from "@bibliothecadao/types";

import { useLayout } from "@/shell/frame/layout";
import { PageAddress } from "@/shell/frame/page-address";
import { PageFrame } from "@/shell/frame/page-frame";
import { ScrollPanel } from "@/shell/news/news";
import { WHATS_NEW_PATH } from "@/shell/news/posts";
import { PatchChanges, PatchHead, type PatchNote } from "@/shell/news/patch-notes";
import { ageOf } from "@/shell/play/ages";
import { PLAY_MODES, type PlayMode } from "@/shell/play/play-board";

import { DRAFT_PATCH_NOTES } from "./patch-notes-fixture";

/** The page's frame: What's new's place, its title, its footer; a phone shows the title in its body. */
const WhatsNewFrame = ({ children }: { children: ReactNode }) => {
  const phone = useLayout() === "phone";
  return (
    <PageFrame title={WORDS.whatsNew} footer>
      <div className="flex flex-col gap-6">
        {phone && <h1 className="text-app-title text-app-ink">{WORDS.whatsNew}</h1>}
        {children}
      </div>
    </PageFrame>
  );
};

const firstChangedMode = (note: PatchNote): PlayMode =>
  PLAY_MODES.find((mode) => note.modes[mode].length > 0) ?? PLAY_MODES[0];

const modeTabs = PLAY_MODES.map((mode) => ({ key: mode, label: ageOf(mode).name }));

/** The patches before the one on show, each a row that shows it. */
const EarlierPatches = ({ shown, onShow }: { shown: number; onShow: (index: number) => void }) => (
  <>
    {DRAFT_PATCH_NOTES.map((note, index) => (
      <AppRow
        key={note.date}
        own={index === shown}
        title={note.title}
        detail={formatContentDay(note.date)}
        onClick={() => onShow(index)}
      />
    ))}
  </>
);

/**
 * A · today's two columns, the latest changes replaced by the patch: its head, a switch per mode (the first mode it
 * changes chosen), that mode's changes, then the earlier patches. The Scroll stays beside it.
 */
const NotesBesideScroll = () => {
  const phone = useLayout() === "phone";
  const [shown, setShown] = useState(0);
  const note = DRAFT_PATCH_NOTES[shown];
  const [mode, setMode] = useState<PlayMode>(firstChangedMode(note));
  const show = (index: number) => {
    setShown(index);
    setMode(firstChangedMode(DRAFT_PATCH_NOTES[index]));
  };
  return (
    <WhatsNewFrame>
      <div className={phone ? "flex flex-col gap-6" : "grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-6"}>
        <AppPanel icon="book" title={NEWS_WORDS.patchNotes} flush>
          <div className="flex flex-col gap-4 px-5 py-3">
            <PatchHead note={note} />
            <AppTabs tabs={modeTabs} value={mode} onChange={setMode} label={NEWS_WORDS.patchNotes} />
          </div>
          <PatchChanges changes={note.modes[mode]} />
          <h4 className="px-5 pb-1 pt-5 text-app-label text-app-muted">{NEWS_WORDS.earlier}</h4>
          <EarlierPatches shown={shown} onShow={show} />
        </AppPanel>
        <ScrollPanel />
      </div>
    </WhatsNewFrame>
  );
};

/**
 * B · Play's ages: the patch's head across the page, then each mode as its painted column with its changes in its well,
 * side by side as Play's are (a phone stacks them); the Scroll and the earlier patches under them.
 */
const ThreeAges = () => {
  const phone = useLayout() === "phone";
  const [shown, setShown] = useState(0);
  const note = DRAFT_PATCH_NOTES[shown];
  return (
    <WhatsNewFrame>
      <AppPanel icon="book" title={NEWS_WORDS.patchNotes}>
        <PatchHead note={note} />
      </AppPanel>
      <div className={phone ? "flex flex-col gap-6" : "grid grid-cols-3 gap-6"}>
        {PLAY_MODES.map((mode) => {
          const age = ageOf(mode);
          return (
            <AppAgeColumn key={mode} age={mode} painting={age.painting} name={age.name}>
              <div className="app-well">
                <PatchChanges changes={note.modes[mode]} />
              </div>
            </AppAgeColumn>
          );
        })}
      </div>
      <div className={phone ? "flex flex-col gap-6" : "grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-6"}>
        <ScrollPanel />
        <AppPanel icon="calendar" title={NEWS_WORDS.earlier} flush>
          <EarlierPatches shown={shown} onShow={setShown} />
        </AppPanel>
      </div>
    </WhatsNewFrame>
  );
};

/**
 * C · two views behind one switch, Patch notes or the Scroll, each the page's whole width: the patches listed down the
 * side, the one shown with a painted panel per mode.
 */
const TwoTabs = () => {
  const phone = useLayout() === "phone";
  const [view, setView] = useState<"notes" | "scroll">("notes");
  const [shown, setShown] = useState(0);
  const note = DRAFT_PATCH_NOTES[shown];
  const views = [
    { key: "notes" as const, label: NEWS_WORDS.patchNotes },
    { key: "scroll" as const, label: NEWS_WORDS.scroll },
  ];
  const patch = (
    <div className="flex min-w-0 flex-col gap-6">
      <PatchHead note={note} />
      {PLAY_MODES.map((mode) => {
        const age = ageOf(mode);
        return (
          <AppPanel key={mode} title={age.name} painting={age.painting} flush>
            <PatchChanges changes={note.modes[mode]} />
          </AppPanel>
        );
      })}
    </div>
  );
  const earlier = (
    <AppPanel icon="calendar" title={NEWS_WORDS.earlier} flush>
      <EarlierPatches shown={shown} onShow={setShown} />
    </AppPanel>
  );
  return (
    <WhatsNewFrame>
      <AppTabs tabs={views} value={view} onChange={setView} label={WORDS.whatsNew} />
      {view === "scroll" ? (
        <ScrollPanel />
      ) : phone ? (
        <>
          {patch}
          {earlier}
        </>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-6">
          {earlier}
          {patch}
        </div>
      )}
    </WhatsNewFrame>
  );
};

/**
 * What's new remade around patch notes and the Scroll, three ways for the owner to pick from. Each is the whole page in
 * the real frame, built from the app sheet's elements and the real patch-note parts, over draft notes.
 */
export const WHATS_NEW_OPTIONS = {
  a: { name: "A · Notes beside the Scroll", Page: NotesBesideScroll },
  b: { name: "B · Three ages", Page: ThreeAges },
  c: { name: "C · Two tabs", Page: TwoTabs },
} as const;

const isOption = (option: string | undefined): option is keyof typeof WHATS_NEW_OPTIONS =>
  option !== undefined && Object.hasOwn(WHATS_NEW_OPTIONS, option);

/** One option at /lab/app/<screen>/whats-new/<option>, told it is What's new so its place is lit. */
export const WhatsNewOptionPage = () => {
  const { option } = useParams();
  const { Page } = WHATS_NEW_OPTIONS[isOption(option) ? option : "a"];
  return (
    <PageAddress.Provider value={WHATS_NEW_PATH}>
      <Page />
    </PageAddress.Provider>
  );
};
