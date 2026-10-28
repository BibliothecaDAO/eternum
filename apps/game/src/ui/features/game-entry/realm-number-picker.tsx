import {
  REALM_NUMBER,
  OPTIONAL_REALM_NUMBER,
  FREE_REALM_ENTRY,
  INVALID_REALM_NUMBER,
  REALM,
  YOUR_REALMS,
} from "@/ui/design-system/kit/words";
import { orders } from "@bibliothecadao/types";
import { getCanonicalRealmMetadata } from "@bibliothecadao/eternum";
import { HudChip, HudField, HudLoading, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { readHeldRealms } from "@/services/realm-entry";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@realms-world/identity";

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
      {purpose === "held" && <HeldRealms value={value} onChange={onChange} disabled={disabled} />}
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

/**
 * The Realms the player's wallet holds, one press to fill the number. Shown only when the holdings index answers with
 * some; typing the number always works, and the relay checks the holder either way. The list belongs to the signed-in
 * account and its linked wallet, so another account or a changed wallet in the same tab asks again.
 */
function HeldRealms({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { session } = useIdentitySession();
  const { data } = useQuery({
    queryKey: heldRealmsKey(session),
    queryFn: readHeldRealms,
    enabled: session !== null,
    retry: false,
    staleTime: 60_000,
  });
  if (!data?.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-hud-label text-hud-muted">{YOUR_REALMS}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={YOUR_REALMS}>
        {data.map((realmId) => (
          <HudChip
            key={realmId}
            tone={value === String(realmId) ? "good" : undefined}
            label={REALM}
            onPress={() => onChange(String(realmId))}
            disabled={disabled}
          >
            {realmId}
          </HudChip>
        ))}
      </div>
    </div>
  );
}

const heldRealmsKey = (session: Session | null) =>
  ["held-realms", session?.user.realmsId ?? null, session?.user.address ?? null] as const;
