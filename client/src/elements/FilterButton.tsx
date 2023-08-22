import clsx from "clsx";
import React, { ComponentPropsWithRef } from "react";
import { ReactComponent as Cross } from "../assets/icons/common/cross-circle.svg";
import { ReactComponent as CaretDownFill } from "../assets/icons/common/caret-down-fill.svg";

type FilterButtonProps = {
  active: boolean;
  children?: React.ReactNode;
} & ComponentPropsWithRef<"button">;

export const FilterButton = ({
  active,
  children,
  onClick,
}: FilterButtonProps) => {
  return (
    <button
      className={clsx(
        active ? "bg-gold/20" : "",
        "items-center border flex rounded border-gold py-0.5 px-1 text-xxs text-gold",
      )}
      onClick={onClick}
    >
      {children}
      {active ? (
        <Cross className="ml-1 fill-current" />
      ) : (
        <CaretDownFill className="ml-1 fill-current" />
      )}
    </button>
  );
};
