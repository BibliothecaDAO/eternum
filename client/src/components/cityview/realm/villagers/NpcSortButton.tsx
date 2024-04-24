import clsx from "clsx";

type NpcSortButtonProps = {
  className?: string;
  label: string;
  isActive: boolean;
  onChange: () => void;
};

export const NpcSortButton = ({ label, onChange, className, isActive }: NpcSortButtonProps) => {
  return (
    <button
      className={clsx(isActive ? "text-white" : "text-gold", "flex items-center cursor-pointer text-xxs", className)}
    >
      <div onClick={onChange}>{label}</div>
    </button>
  );
};
