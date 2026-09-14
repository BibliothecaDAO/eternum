import { useId } from "react";

interface StructureSelectProps {
  value: number;
  onChange: (entityId: number) => void;
  options: { entityId: number; name: string }[];
}

/** Native selection keeps long realm lists usable with touch and the mobile keyboard. */
export const StructureSelect = ({ value, onChange, options }: StructureSelectProps) => {
  const id = useId();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-xs text-gold/75">
        Structure
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-h-11 min-w-0 flex-1 rounded-md border border-gold/30 bg-[#101c23] px-2 text-base text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
      >
        {!options.some((option) => option.entityId === value) && <option value={value}>Select a structure</option>}
        {options.map((option) => (
          <option key={option.entityId} value={option.entityId}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
};
