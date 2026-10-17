import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import type { ReactNode } from "react";
import { Link, type To } from "react-router-dom";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { BACK } from "@/ui/design-system/kit/words";

import { paintingSources, type Painting } from "../paintings";
import { useAppNotice } from "./app-notice";
import { EnvEdge } from "./env-mark";
import { useDesktopKeys } from "./desktop-keys";
import { AppFooter } from "./footer";
import { Kbd } from "./kbd";
import { useLayout } from "./layout";
import { Lockup } from "./lockup";
import { PLACES, TabBar, TopBar } from "./tabs";

type PageFrameProps = {
  /** A page opened from another names where Back leads; a tab page has none. */
  back?: To;
  /** The page's title: beside Back on the phone, in the title row on desktop. A tab page shows the lockup instead. */
  title?: string;
  /** One notice, directly above the foot row (phone) or in the top bar (desktop): it covers nothing and pushes nothing. */
  notice?: ReactNode;
  /** The foot row: the page's buttons (one primary) or its stepper. */
  foot?: ReactNode;
  /** The three places; a full-screen step (sign-in, entering a match) has none. */
  tabs?: boolean;
  /** Play, the one page that offers to install the app. */
  offersInstall?: boolean;
  /** A painting across the desktop window behind the page, faded into the ground in its lower third. */
  painting?: Painting;
  /** The painting fills the desktop's first screen: a stage, as the first visit is drawn. */
  stage?: boolean;
  /** A page that scrolls ends on the footer: What's new, a post, the legal pages. */
  footer?: boolean;
  children: ReactNode;
};

/**
 * The composer: the only code that places a page's parts. Each part sits in its band, tagged so a test can hold every
 * control to its place: Back top left and nothing else there, nothing to tap in a phone's top right, one foot row,
 * notices directly above it on a phone and in the desktop's top bar (covering nothing, pushing nothing down), the tabs
 * at the phone's foot or in the desktop's top bar, with the desktop's keys (1–3 the places, Esc Back). Every page's
 * content starts at the top of its body: a painting is the ground behind it, never a space above it.
 */
export const PageFrame = (props: PageFrameProps) => {
  const layout = useLayout();
  // The page's own notice first (a refusal it caused); else the app's (offline, an update, install on Play).
  const appNotice = useAppNotice({ offersInstall: props.offersInstall ?? false });
  const framed = { ...props, notice: props.notice ?? appNotice };
  return (
    <div data-layout={layout} className="bg-kit-ground font-body text-kit-cream">
      <EnvEdge />
      {layout === "phone" ? <PhoneFrame {...framed} /> : <DesktopFrame {...framed} />}
    </div>
  );
};

const PhoneFrame = ({ back, title, notice, foot, tabs = true, footer = false, children }: PageFrameProps) => (
  <div className="flex h-dvh flex-col">
    <header
      data-band="top"
      className="flex min-h-12 shrink-0 items-center gap-1 px-gutter pt-[env(safe-area-inset-top)]"
    >
      {back === undefined ? <Lockup /> : <PhoneTitle back={back} title={title} />}
    </header>
    <main data-band="body" className="min-h-0 flex-1 overflow-y-auto px-gutter pb-4">
      {children}
      {footer && <AppFooter />}
    </main>
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

const DesktopFrame = ({
  back,
  title,
  notice,
  foot,
  tabs = true,
  painting,
  stage = false,
  footer = false,
  children,
}: PageFrameProps) => {
  useDesktopKeys({ places: tabs ? PLACES : [], back });
  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <TopBar places={tabs} notice={notice} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        {painting && <Backdrop painting={painting} stage={stage} />}
        {back !== undefined || title ? (
          <div data-band="title" className="flex items-center gap-3 px-gutter-desk pt-7 wide:px-gutter-wide">
            <DesktopTitle back={back} title={title} />
          </div>
        ) : null}
        <main data-band="body" className="w-full flex-1 px-gutter-desk py-6 wide:px-gutter-wide">
          {children}
        </main>
        {foot ? (
          <div data-band="foot" className="w-full px-gutter-desk pb-8 wide:px-gutter-wide">
            {foot}
          </div>
        ) : null}
        {footer && (
          <div className="w-full px-gutter-desk wide:px-gutter-wide">
            <AppFooter />
          </div>
        )}
      </div>
    </div>
  );
};

/** The desktop's title row: Back with its key, then the page's title in the display face. */
const DesktopTitle = ({ back, title }: { back: To | undefined; title?: string }) => (
  <>
    {back !== undefined && (
      <Link
        to={back}
        data-role="back"
        aria-label={BACK}
        className="-ml-2 flex h-12 shrink-0 items-center gap-1.5 rounded-control px-2 hover:bg-kit-gold/[.06]"
      >
        <SemanticIcon name="arrow-left" size={26} />
        <Kbd keyName="Esc" />
      </Link>
    )}
    {title ? (
      <h1 className="font-display text-[34px] leading-tight text-shadow-title wide:text-title-lg">{title}</h1>
    ) : null}
  </>
);

/**
 * The painting under a dark grade: a vignette that keeps its heart lit, faded into the ground at its foot. The grade
 * is what lets a 1536 px lore painting stand across a 1920 px window.
 */
const Backdrop = ({ painting, stage }: { painting: Painting; stage: boolean }) => (
  <div
    aria-hidden
    className={cn("grain pointer-events-none absolute inset-x-0 top-0 -z-10", stage ? "h-screen" : "h-[42rem]")}
  >
    <img {...paintingSources(painting)} sizes="100vw" alt="" className="size-full object-cover object-[50%_40%]" />
    <span className="absolute inset-0 bg-[radial-gradient(120%_90%_at_55%_38%,transparent_40%,theme(colors.kit.ground/85%)_100%),linear-gradient(0deg,theme(colors.kit.ground)_0%,transparent_55%)]" />
  </div>
);

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
    {title ? <h1 className="truncate font-display text-[24px] leading-tight">{title}</h1> : null}
  </>
);
