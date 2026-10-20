import { HudSelect } from "@/ui/design-system/kit/hud-elements";

interface StructureSelectProps {
  value: number;
  onChange: (entityId: number) => void;
  options: { entityId: number; name: string }[];
}

/** Which structure a workspace edits, as the sheet's select: its list opens over every surface. */
export const StructureSelect = ({ value, onChange, options }: StructureSelectProps) => (
  <div className="flex min-w-0 items-center gap-2">
    <span className="shrink-0 text-hud-label text-hud-muted">Structure</span>
    <HudSelect
      label="Structure"
      value={value}
      options={[
        ...(options.some((option) => option.entityId === value) ? [] : [{ value, label: "Select a structure" }]),
        ...options.map((option) => ({ value: option.entityId, label: option.name })),
      ]}
      onChange={onChange}
    />
  </div>
);
