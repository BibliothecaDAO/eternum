import { getCanonicalRealmMetadata } from "@bibliothecadao/eternum";
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
    <div className="mb-4 rounded border border-gold/25 p-3 text-gold">
      <label htmlFor="dev-realm-number" className="block text-sm">
        Realm number
      </label>
      <input
        id="dev-realm-number"
        type="number"
        min={1}
        max={8000}
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="mt-2 w-full rounded border border-gold/30 bg-black/40 p-2"
      />
      <div aria-live="polite" className="mt-2 text-sm">
        {!valid ? (
          <p>Choose a realm number from 1 to 8000.</p>
        ) : error ? (
          <p>{error.message}</p>
        ) : isPending ? (
          <p>Loading realm...</p>
        ) : data ? (
          <>
            <p className="font-semibold">{data.name}</p>
            <p>{data.resources.join(", ")}</p>
          </>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-gold/60">
        Dev mode: settle additional realms. Each realm number can be used once per game.
      </p>
    </div>
  );
}
