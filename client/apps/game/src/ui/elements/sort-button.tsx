import { ReactComponent as CaretDown } from "@/assets/icons/common/caret-down.svg";
import { ReactComponent as CaretUp } from "@/assets/icons/common/caret-up.svg";
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
        isActive && sort !== "none" ? "text-white" : "text-gold",
        "flex items-center cursor-pointer text-xxs",
        className,
      )}
      {...props}
    >
      <div onClick={() => onChange(sortKey, nextSort(sort))}>{label}</div>
      <div className="flex flex-col items-center justify-center ml-1">
        <CaretUp
          onClick={() => onChange(sortKey, sort !== "asc" ? "asc" : "none")}
          className={clsx(classNameCaret, sort == "asc" ? "stroke-white" : "stroke-gold/50")}
        />
        <CaretDown
          onClick={() => onChange(sortKey, sort !== "desc" ? "desc" : "none")}
          className={clsx(classNameCaret, sort == "desc" ? "stroke-white" : "stroke-gold/50")}
        />
      </div>
    </button>
  );
};
