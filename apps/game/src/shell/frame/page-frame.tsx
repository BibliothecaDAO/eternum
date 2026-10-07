import type { ReactNode } from "react";
import { Link, type To } from "react-router-dom";

import { ArrowLeft } from "@/ui/design-system/atoms/game-icons";

import { WORDS } from "../words";
import { EnvEdge } from "./env-mark";
import { type Layout, useLayout } from "./layout";
import { Lockup } from "./lockup";
import { TabBar, TopNav } from "./tabs";

type PageFrameProps = {
  /** A page opened from another names where Back leads; a tab page has none. */
  back?: To;
  /** The page's title: beside Back on the phone, in the title row on desktop. A tab page shows the lockup instead. */
  title?: string;
  /** One notice, directly above the foot row (phone) or bottom centre over the page (desktop). */
  notice?: ReactNode;
  /** The foot row: the page's buttons (one primary) or its stepper. */
  foot?: ReactNode;
  /** The four tabs; a full-screen step (sign-in, entering a match) has none. */
  tabs?: boolean;
  children: ReactNode;
};

/**
 * The composer: the only code that places a page's parts. Each part sits in its band, tagged so a test can hold every
 * control to its place: Back top left and nothing else there, nothing to tap in a phone's top right, one foot row,
 * notices directly above it, the tabs at the phone's foot or in the desktop top bar.
 */
export const PageFrame = (props: PageFrameProps) => {
  const layout = useLayout();
  return (
    <div data-layout={layout} className="bg-kit-ground font-body text-kit-cream">
      <EnvEdge />
      {layout === "phone" ? <PhoneFrame {...props} /> : <DesktopFrame {...props} />}
    </div>
  );
};

const PhoneFrame = ({ back, title, notice, foot, tabs = true, children }: PageFrameProps) => (
  <div className="flex h-dvh flex-col">
    <header data-band="top" className="flex min-h-12 shrink-0 items-center gap-1 px-4 pt-[env(safe-area-inset-top)]">
      {back === undefined ? <Lockup size="phone" /> : <BackTitle back={back} title={title} layout="phone" />}
    </header>
    <main data-band="body" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
      {children}
    </main>
    {notice ? (
      <div data-band="notice" className="shrink-0 px-4 pb-2">
        {notice}
      </div>
    ) : null}
    {foot ? (
      <div data-band="foot" className="shrink-0 px-4 pb-3">
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

const DesktopFrame = ({ back, title, notice, foot, children }: PageFrameProps) => (
  <div className="flex min-h-screen flex-col">
    <div data-band="top">
      <TopNav />
    </div>
    {back !== undefined ? (
      <div data-band="title" className="mx-auto flex w-full max-w-6xl items-center gap-2 px-10 pt-6">
        <BackTitle back={back} title={title} layout="desktop" />
      </div>
    ) : null}
    <main data-band="body" className="mx-auto w-full max-w-6xl flex-1 px-10 py-6">
      {children}
    </main>
    {foot ? (
      <div data-band="foot" className="mx-auto w-full max-w-6xl px-10 pb-8">
        {foot}
      </div>
    ) : null}
    {notice ? (
      <div data-band="notice" className="fixed bottom-6 left-1/2 z-40 w-[min(32rem,calc(100%-5rem))] -translate-x-1/2">
        {notice}
      </div>
    ) : null}
  </div>
);

/** Back, wordless at the top left, and the page's title beside it. */
const BackTitle = ({ back, title, layout }: { back: To; title?: string; layout: Layout }) => (
  <>
    <Link
      to={back}
      data-role="back"
      aria-label={WORDS.back}
      className="-ml-2 flex size-12 shrink-0 items-center justify-center rounded-xl"
    >
      <ArrowLeft size={26} />
    </Link>
    {title ? (
      <h1 className={layout === "phone" ? "truncate font-ui text-[22px] font-bold" : "font-ui text-[28px] font-bold"}>
        {title}
      </h1>
    ) : null}
  </>
);
