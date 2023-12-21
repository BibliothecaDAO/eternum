import clsx from "clsx";
import React from "react";

type RealmLevelProps = {
  level: number;
} & React.ComponentPropsWithRef<"div">;

export const RealmLevel = ({ level, className, ...props }: RealmLevelProps) => (
  <div className={clsx(" p-2 bg-gold/10 rounded-xl text-gold font-bold text-xs", className)} {...props}>
    LVL {level}
  </div>
);
