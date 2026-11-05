import { SIGN_IN_WORDS } from "@/ui/design-system/kit/words";
import { nameRuleViolation, type Session } from "@realms-world/identity";
import { useState, type FormEvent } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { AppButton } from "@/ui/design-system/kit/app-elements";
import { nameRefusal } from "@/ui/modules/identity/identity-failures";

import { randomPortrait } from "./default-name";
import { FailureLine } from "./failure-line";
import { NameField, PortraitGrid } from "./fields";

/**
 * A new account's one step (spec 02): the name suggested at sign-up (the Discord name; empty for an email sign-up,
 * with a line asking for one), with what the identity service's rule asks of it while it does not pass, and a portrait
 * already picked; Claim name saves both.
 */
export const ProfileStep = ({ session, onClaimed }: { session: Session; onClaimed: () => void }) => {
  const [name, setName] = useState(session.user.suggestedName ?? "");
  const [portrait, setPortrait] = useState(() => session.user.image ?? randomPortrait());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosenName = name.trim();
  const valid = nameRuleViolation(chosenName) === null;

  const claim = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await identityClient.updateUser({ name: chosenName, image: portrait });
      onClaimed();
    } catch (cause) {
      setError(nameRefusal(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void claim(event)} className="flex flex-col gap-4">
      <NameField
        name={name}
        onName={(value) => {
          setError(null);
          setName(value);
        }}
      />
      <FailureLine line={error} />
      <PortraitGrid chosen={portrait} onChoose={setPortrait} />
      <AppButton
        kind="primary"
        size="lg"
        type="submit"
        icon="check"
        disabled={!valid}
        busy={saving ? SIGN_IN_WORDS.saving : undefined}
      >
        {SIGN_IN_WORDS.claimName}
      </AppButton>
    </form>
  );
};
