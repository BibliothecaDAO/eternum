import { IDENTITY_PORTRAITS, nameRuleViolation, type Session } from "@realms-world/identity";
import { useState, type FormEvent } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { Button } from "@/ui/design-system/kit/button";
import { nameRefusal } from "@/ui/modules/identity/identity-failures";

import { SIGN_IN_WORDS } from "../words";
import { FailureLine } from "./failure-line";
import { NameField, PortraitGrid } from "./fields";

/**
 * A new account's one step (spec 02): the name suggested at sign-up (the Discord name or the email's local part),
 * ticked while it passes the identity service's rule, and a portrait already picked; Claim name saves both.
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
        valid={valid}
        onName={(value) => {
          setError(null);
          setName(value);
        }}
      />
      <FailureLine line={error} />
      <PortraitGrid chosen={portrait} onChoose={setPortrait} />
      <Button
        role="primary"
        type="submit"
        word={SIGN_IN_WORDS.claimName}
        icon="Ok"
        disabled={!valid}
        loading={saving ? SIGN_IN_WORDS.saving : undefined}
      />
    </form>
  );
};

const randomPortrait = (): string => IDENTITY_PORTRAITS[Math.floor(Math.random() * IDENTITY_PORTRAITS.length)];
