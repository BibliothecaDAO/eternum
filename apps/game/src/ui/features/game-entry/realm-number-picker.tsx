import { getCanonicalRealmMetadata } from "@bibliothecadao/eternum";
import { HudField, HudLoading, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { useQuery } from "@tanstack/react-query";

export function RealmNumberPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const realmId = Number(value);
  const valid = Number.isInteger(realmId) && realmId >= 1 && realmId <= 8000;
  const { data, isPending, error } = useQuery({
    queryKey: ["canonical-realm-metadata", realmId],
    queryFn: () => getCanonicalRealmMetadata(realmId),
    enabled: valid,
    staleTime: Infinity,
  });

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-hud-line p-3">
      <span className="text-hud-label text-hud-muted">Realm number</span>
      <HudField
        aria-label="Realm number"
        id="dev-realm-number"
        type="number"
        min={1}
        max={8000}
        step={1}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      <div aria-live="polite" className="text-hud-body text-hud-ink">
        {!valid ? (
          <p>Choose a realm number, 1 to 8000.</p>
        ) : error ? (
          <HudNotice tone="bad" line={error.message} />
        ) : isPending ? (
          <HudLoading line="Loading realm…" />
        ) : data ? (
          <>
            <p className="text-hud-strong">{data.name}</p>
            <p className="text-hud-muted">{data.resources.join(", ")}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
