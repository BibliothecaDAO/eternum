import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { Icon } from "@/ui/design-system/icon";
import { AppButton, AppField } from "@/ui/design-system/kit/app-elements";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { SEAL_CODE_WORDS } from "@/ui/design-system/kit/words";

import { sealCodeKey, useRedeemSealCode } from "./seal-code";

export const SealCodeCard = ({ owner, compact = false }: { owner: string | null; compact?: boolean }) => {
  const held = useQuery({
    queryKey: sealCodeKey(owner),
    queryFn: () => identityClient.getSealCode(),
    enabled: owner !== null,
  });
  if (held.isError) return <ServiceFailure service="season" error={held.error} retry={() => void held.refetch()} />;
  if (!held.data) return null;
  if (compact) return <CompactSealDisclosure owner={owner} held={held.data.held} />;
  return (
    <section data-seal-code={held.data.held ? "held" : "open"} className="app-well w-full gap-3 p-4 text-left">
      <SealHeading held={held.data.held} />
      {!held.data.held && <RedeemForm owner={owner} />}
    </section>
  );
};

const CompactSealDisclosure = ({ owner, held }: { owner: string | null; held: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  if (held)
    return (
      <div data-seal-code="held" className="seal-disclosure seal-disclosure--held">
        <Icon name="final-seal" size={24} />
        <div className="seal-disclosure__held-text">
          <span className="text-app-strong text-app-ink">{SEAL_CODE_WORDS.held}</span>
          <span className="text-app-label text-app-muted">{SEAL_CODE_WORDS.heldLine}</span>
        </div>
      </div>
    );
  return (
    <div data-seal-code="open" className="seal-disclosure">
      <button
        type="button"
        className="seal-disclosure__toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="seal-disclosure__lead">
          <Icon name="final-seal" size={22} />
          <span className="text-app-label text-app-ink">{SEAL_CODE_WORDS.haveCode}</span>
        </span>
        <span className="seal-disclosure__action">{SEAL_CODE_WORDS.redeem}</span>
      </button>
      {expanded && (
        <div className="seal-disclosure__body">
          <p className="text-app-label text-app-muted">{SEAL_CODE_WORDS.line}</p>
          <RedeemForm owner={owner} />
        </div>
      )}
    </div>
  );
};

const SealHeading = ({ held }: { held: boolean }) => (
  <span className="flex items-center gap-3">
    <Icon name="final-seal" size={48} />
    <span className="flex flex-col">
      <span className="text-app-heading text-app-ink">{held ? SEAL_CODE_WORDS.held : SEAL_CODE_WORDS.title}</span>
      <span className="text-app-label text-app-muted">{held ? SEAL_CODE_WORDS.heldLine : SEAL_CODE_WORDS.line}</span>
    </span>
  </span>
);

const RedeemForm = ({ owner }: { owner: string | null }) => {
  const [code, setCode] = useState("");
  const { redeem, refusal } = useRedeemSealCode(owner);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    redeem.mutate(code);
  };
  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <span className="flex items-end gap-2">
        <span className="min-w-0 flex-1">
          <AppField
            label={SEAL_CODE_WORDS.label}
            placeholder={SEAL_CODE_WORDS.placeholder}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={code}
            error={refusal && SEAL_CODE_WORDS.refused[refusal]}
            onChange={(event) => {
              setCode(event.target.value);
              redeem.reset();
            }}
          />
        </span>
        <AppButton
          kind="secondary"
          type="submit"
          disabled={code.trim() === ""}
          busy={redeem.isPending ? SEAL_CODE_WORDS.redeeming : undefined}
        >
          {SEAL_CODE_WORDS.redeem}
        </AppButton>
      </span>
      {redeem.isError && !refusal && (
        <ServiceFailure service="season" error={redeem.error} retry={() => redeem.mutate(code)} />
      )}
    </form>
  );
};
