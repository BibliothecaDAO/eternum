import "./stage-frame.css";

import type { ReactNode } from "react";

import { useLayout } from "./layout";
import { PageFrame } from "./page-frame";

export const StageFrame = ({
  notice,
  verb,
  wide = false,
  children,
}: {
  notice?: ReactNode;
  verb?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) => {
  const phone = useLayout() === "phone";
  return (
    <PageFrame painting="frontier-mist" stage notice={notice} foot={phone ? verb : undefined}>
      <div
        className={
          wide ? "stage-frame--wide" : "mx-auto flex max-w-tabs flex-col items-center gap-5 pt-4 text-center"
        }
      >
        {children}
        {!phone && verb && (wide ? <div className="stage-frame__verb">{verb}</div> : verb)}
      </div>
    </PageFrame>
  );
};
