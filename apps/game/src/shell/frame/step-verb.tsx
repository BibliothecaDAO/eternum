import type { ReactNode } from "react";

import { Kbd } from "./kbd";

/**
 * The screen's one step on the desktop: its verb, with the Enter mark at its right while it can be taken (desktop-keys
 * presses it when nothing else holds the focus).
 */
export const StepVerb = ({ children }: { children: ReactNode }) => (
  <div data-role="step" className="group relative flex flex-col">
    {children}
    <Kbd
      keyName="Enter"
      className="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 group-has-[button:enabled]:inline"
    />
  </div>
);
