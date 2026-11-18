import type { ReactNode } from "react";

import { useLayout } from "./layout";
import { PageFrame } from "./page-frame";

export const StageFrame = ({
  notice,
  verb,
  children,
}: {
  notice?: ReactNode;
  verb?: ReactNode;
  children: ReactNode;
}) => {
  const phone = useLayout() === "phone";
  return (
    <PageFrame painting="frontier-mist" stage notice={notice} foot={phone ? verb : undefined}>
      <div className="mx-auto flex max-w-[28rem] flex-col items-center gap-5 pt-4 text-center">
        {children}
        {!phone && verb}
      </div>
    </PageFrame>
  );
};
