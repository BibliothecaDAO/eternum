import { ChevronDown as CaretDown, ChevronUp as CaretUp } from "@/ui/design-system/atoms/game-icons";
import clsx from "clsx";

type SortButtonProps = {
  label: string | JSX.Element;
  sortKey: string;
  activeSort: {
    sortKey: string;
    sort: "asc" | "desc" | "none";
  };
  onChange: (_sortKey: string, _sort: "asc" | "desc" | "none") => void;
  className?: string;
  classNameCaret?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

export type SortInterface = {
  sortKey: string;
  sort: "asc" | "desc" | "none";
};

export const SortButton = ({
  label,
  activeSort,
  sortKey,
  onChange,
  className,
  classNameCaret,
  activeClassName = "text-white",
  inactiveClassName = "text-gold",
  ...props
}: SortButtonProps) => {
  const isActive = activeSort.sortKey == sortKey;
  const sort = isActive ? activeSort.sort : "none";

  const nextSort = (sort: "asc" | "desc" | "none") => {
    switch (sort) {
      case "asc":
        return "desc";
      case "desc":
        return "none";
      case "none":
        return "asc";
    }
  };

  return (
    <button
      className={clsx(
        isActive && sort !== "none" ? activeClassName : inactiveClassName,
        "flex items-center cursor-pointer text-xxs",
        className,
      )}
      {...props}
    >
      <div onClick={() => onChange(sortKey, nextSort(sort))}>{label}</div>
      <div className="flex flex-col items-center justify-center ml-1">
        <CaretUp
          onClick={() => onChange(sortKey, sort !== "asc" ? "asc" : "none")}
          className={clsx("h-3 w-3", classNameCaret, sort == "asc" ? "opacity-100" : "opacity-40")}
        />
        <CaretDown
          onClick={() => onChange(sortKey, sort !== "desc" ? "desc" : "none")}
          className={clsx("h-3 w-3", classNameCaret, sort == "desc" ? "opacity-100" : "opacity-40")}
        />
      </div>
    </button>
  );
};
