import React, { useEffect } from "react";

type BaseStatusProps = {
  state: "bad" | "neutral" | "good";
  children?: React.ReactNode;
};

const STYLES = {
  base: "flex items-center justify-center ml-auto text-xs rounded-full cursor-default h-7",
  bad: " text-anger-light",
  neutral: "text-gold",
  good: "text-order-vitriol",
};
export const BaseStatus = ({ state, children }: BaseStatusProps) => {
  useEffect(() => { }, []);

  return <div className={`${STYLES.base} ${STYLES[state]}`}>{children}</div>;
};
