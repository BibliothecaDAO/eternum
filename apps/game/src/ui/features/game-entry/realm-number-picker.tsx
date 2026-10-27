import {
  REALM_NUMBER,
  OPTIONAL_REALM_NUMBER,
  FREE_REALM_ENTRY,
  INVALID_REALM_NUMBER,
} from "@/ui/design-system/kit/words";
import { orders } from "@bibliothecadao/types";
import { getCanonicalRealmMetadata } from "@bibliothecadao/eternum";
import { HudField, HudLoading, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { useQuery } from "@tanstack/react-query";

export function RealmNumberPicker({
  value,
  onChange,
  disabled,
  purpose,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  purpose: "held" | "development";
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
      <span className="text-hud-label text-hud-muted">{purpose === "held" ? OPTIONAL_REALM_NUMBER : REALM_NUMBER}</span>
      <HudField
        aria-label={REALM_NUMBER}
        id="realm-number"
        type="number"
        min={1}
        max={8000}
        step={1}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      <div aria-live="polite" className="text-hud-body text-hud-ink">
        {purpose === "held" && value === "" ? (
          <p>{FREE_REALM_ENTRY}</p>
        ) : !valid ? (
          <p>{INVALID_REALM_NUMBER}</p>
        ) : error ? (
          <HudNotice tone="bad" line={error.message} />
        ) : isPending ? (
          <HudLoading line="Loading realm…" />
        ) : data ? (
          <>
            <p className="text-hud-strong">{data.name}</p>
            <p className="text-hud-muted">
              {orders.find((order) => order.orderId === data.order)?.fullOrderName} · {data.resources.join(", ")}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
