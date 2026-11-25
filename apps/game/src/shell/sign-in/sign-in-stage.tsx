import "./sign-in-stage.css";

import type { ReactNode } from "react";

import { Icon } from "@/ui/design-system/icon";
import { REALMS_MARK } from "@/ui/design-system/icon-meaning";
import { AppModalLayer } from "@/ui/design-system/kit/app-elements";
import { paintingSources } from "@/ui/design-system/kit/paintings";
import { CLOSE, SIGN_IN_WORDS } from "@/ui/design-system/kit/words";

import { useLayout } from "../frame/layout";

export const SignInStage = ({
  title,
  heading,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  heading?: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  const layout = useLayout();
  return (
    <AppModalLayer onClose={onClose} sheet={false}>
      <section
        role="dialog"
        aria-modal
        aria-label={title}
        data-sign-in-stage
        data-layout={layout}
        className="signin-stage"
      >
        <button type="button" className="signin-stage__close" aria-label={CLOSE} onClick={onClose}>
          <Icon name="close" size={20} />
        </button>
        <div className="signin-stage__art">
          <img
            aria-hidden
            {...paintingSources("frontier-mist")}
            sizes="100vw"
            alt=""
            className="signin-stage__painting"
          />
          <div aria-hidden className="signin-stage__scrim" />
          <div className="signin-stage__brand">
            <img src={REALMS_MARK.lettered} alt="" className="signin-stage__lockup" />
            <p className="signin-stage__line">{SIGN_IN_WORDS.oneAccount}</p>
          </div>
        </div>
        <div className="signin-stage__panel">
          <div className="signin-stage__card">
            <header className="signin-stage__head">
              <h2 className="signin-stage__heading">{heading ?? title}</h2>
              {subtitle && <p className="signin-stage__sub">{subtitle}</p>}
            </header>
            {children}
          </div>
        </div>
      </section>
    </AppModalLayer>
  );
};
