import "./bane-mark.css";

import { Icon } from "@/ui/design-system/icon";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { createContext, useContext, type ReactNode } from "react";

import { type BaneFigure as Figure, useBaneToday } from "./bane-face";

const BaneDay = createContext<ReturnType<typeof useBaneToday>>(null);

export const BaneDayProvider = ({
  realm,
  children,
}: {
  realm: NativeRows["Structure"] | null;
  children: ReactNode;
}) => <BaneDay.Provider value={useBaneToday(realm)}>{children}</BaneDay.Provider>;

const useBaneCut = (figure: Figure) => {
  const today = useContext(BaneDay);
  return today?.figure === figure ? today : null;
};

export const BaneFigure = ({
  figure,
  pill = false,
  altered = true,
  children,
}: {
  figure: Figure;
  pill?: boolean;
  altered?: boolean;
  children: ReactNode;
}) => {
  const cut = useBaneCut(figure);
  if (!cut || !altered) return <>{children}</>;
  return (
    <span
      className="bane-figure"
      data-bane-figure={figure}
      data-pill={pill || undefined}
      data-tip-bane={cut.line}
      data-tip-bane-icon={cut.icon}
    >
      {children}
      <span aria-hidden="true" className="bane-figure__mark">
        {cut.mark}
      </span>
    </span>
  );
};

export const BaneLine = ({ figure }: { figure: Figure }) => {
  const cut = useBaneCut(figure);
  if (!cut) return null;
  return (
    <p className="bane-line" data-bane-line={figure} data-tip={cut.line}>
      <Icon name={cut.icon} size={16} />
      <span className="truncate">{cut.line}</span>
    </p>
  );
};
