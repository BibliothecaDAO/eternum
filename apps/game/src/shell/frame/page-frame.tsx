import "@/ui/design-system/kit/app-sheet.css";

import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import type { ReactNode } from "react";
import { Link, type To } from "react-router-dom";

import { AppPageHead } from "@/ui/design-system/kit/app-elements";
import { BACK } from "@/ui/design-system/kit/words";

import { paintingSources, type Painting } from "@/ui/design-system/kit/paintings";
import { useAppNotice } from "./app-notice";
import { EnvEdge } from "./env-mark";
import { useDesktopKeys } from "./desktop-keys";
import { AppFooter } from "./footer";
import { useLayout } from "./layout";
import { Lockup } from "./lockup";
import { DesktopBar, TabBar } from "./tabs";

type PageFrameProps = {
  /** A page opened from another names where Back leads; a tab page has none. */
  back?: To;
  /** The page's title: beside Back on the phone, in the title row on desktop. A tab page shows the lockup instead. */
  title?: string;
  /** What the desktop's title row holds at its end: the page's state (Entry open, a clock), its secondary buttons. */
  aside?: ReactNode;
  /** One notice, directly above the foot row (phone) or in the top bar (desktop): it covers nothing and pushes nothing. */
  notice?: ReactNode;
  /** The foot row: the page's buttons (one primary) or its stepper. */
  foot?: ReactNode;
  /** The places, and the footer the page ends on; a full-screen step (sign-in, entering a match) has neither. */
  tabs?: boolean;
  /** Play, the one page that offers to install the app. */
  offersInstall?: boolean;
  /**
   * The painting behind the desktop page: the age or mode the page is about; a page about the app stands on its
   * landscape.
   */
  painting?: Painting;
  /** The painting lit brighter: a stage, as the first visit is drawn. */
  stage?: boolean;
  children: ReactNode;
};

/**
 * The composer: the only code that places a page's parts. Each part sits in its band, tagged so a test can hold every
 * control to its place: Back top left and nothing else there, nothing to tap in a phone's top right, one foot row,
 * notices directly above it on a phone and in the desktop's top bar (covering nothing, pushing nothing down), the tabs
 * at the phone's foot or in the desktop's top bar, with the desktop's keys (Esc Back, Enter the step). On the desktop
 * the frame is the app sheet's (app-sheet.css): the page stands on its painting, graded, under the bar. Every page's
 * content starts at the top of its body: a painting is the ground behind it, never a space above it. Its root is the
 * shell's surface: everything under it, fixed layers and sheets included, draws the shell's palette and finish
 * (src/tokens.ts), never the HUD's.
 */
export const PageFrame = (props: PageFrameProps) => {
  const layout = useLayout();
  // The page's own notice first (a refusal it caused); else the app's (offline, an update, install on Play).
  const appNotice = useAppNotice({ offersInstall: props.offersInstall ?? false });
  const framed = { ...props, notice: props.notice ?? appNotice };
  return (
    <div data-surface="shell" data-layout={layout} className="bg-kit-ground font-body text-kit-cream">
      <EnvEdge />
      {layout === "phone" ? <PhoneFrame {...framed} /> : <DesktopFrame {...framed} />}
    </div>
  );
};

const PhoneFrame = ({ back, title, notice, foot, tabs = true, children }: PageFrameProps) => (
  <div className="flex h-dvh flex-col">
    <header
      data-band="top"
      className="flex min-h-12 shrink-0 items-center gap-1 px-gutter pt-[env(safe-area-inset-top)]"
    >
      {back === undefined ? <Lockup /> : <PhoneTitle back={back} title={title} />}
    </header>
    {/* The page fills the first screen at least, so the footer starts below it and no fold falls among its links. */}
    <div className="min-h-0 flex-1 overflow-y-auto px-gutter pb-4">
      <main data-band="body" className="min-h-full">
        {children}
      </main>
      {tabs && <AppFooter />}
    </div>
    {notice ? (
      <div data-band="notice" className="shrink-0 px-gutter pb-2">
        {notice}
      </div>
    ) : null}
    {foot ? (
      <div data-band="foot" className="shrink-0 px-gutter pb-3">
        {foot}
      </div>
    ) : null}
    {tabs ? (
      <div data-band="tabs" className="shrink-0">
        <TabBar />
      </div>
    ) : null}
  </div>
);

/** The app's own landscape: the ground of a desktop page that is about no one game. */
const APP_LANDSCAPE: Painting = "brooding-plains";

const DesktopFrame = ({
  back,
  title,
  aside,
  notice,
  foot,
  tabs = true,
  painting = APP_LANDSCAPE,
  stage = false,
  children,
}: PageFrameProps) => {
  useDesktopKeys({ back });
  return (
    <div className="app-frame" data-stage={stage || undefined}>
      <img aria-hidden {...paintingSources(painting)} sizes="100vw" alt="" className="app-frame__painting" />
      <DesktopBar places={tabs} notice={notice} />
      <div className="app-frame__page">
        {back !== undefined || title ? (
          <div data-band="title">
            <AppPageHead back={back} title={title} aside={aside} />
          </div>
        ) : null}
        <main data-band="body" className="min-w-0">
          {children}
        </main>
        {foot ? <div data-band="foot">{foot}</div> : null}
        {tabs && <AppFooter />}
      </div>
    </div>
  );
};

/** The phone's top row: Back, wordless at the top left, and the page's title beside it. */
const PhoneTitle = ({ back, title }: { back: To; title?: string }) => (
  <>
    <Link
      to={back}
      data-role="back"
      aria-label={BACK}
      className="-ml-2 flex size-12 shrink-0 items-center justify-center rounded-control"
    >
      <SemanticIcon name="arrow-left" size={26} />
    </Link>
    {title ? <h1 className="truncate text-app-title text-app-ink">{title}</h1> : null}
  </>
);
