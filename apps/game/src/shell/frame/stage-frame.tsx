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
          wide
            ? "mx-auto flex w-full max-w-6xl flex-col gap-5 pt-2"
            : "mx-auto flex max-w-[28rem] flex-col items-center gap-5 pt-4 text-center"
        }
      >
        {children}
        {!phone && verb && (wide ? <div className="flex justify-end">{verb}</div> : verb)}
      </div>
    </PageFrame>
  );
};
