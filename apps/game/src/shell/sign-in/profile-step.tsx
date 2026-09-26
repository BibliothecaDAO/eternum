import { IDENTITY_PORTRAITS, nameRuleViolation, type Session } from "@realms-world/identity";
import { useState, type FormEvent } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { Check } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { portraitUrl } from "../identity-chip";
import { nameRefusal } from "../name-claim";

/** The name and portrait a new player chose, as the account now holds them. */
export interface ChosenProfile {
  name: string;
  portrait: string;
}

/**
 * The profile step (design o3, third screen): the name suggested at sign-up (their Discord name or their email's local
 * part), ticked only while it passes the identity service's own name rule, and the ink portraits with one already
 * picked at random. One Continue saves both.
 */
export const ProfileStep = ({
  session,
  onChosen,
}: {
  session: Session;
  onChosen: (profile: ChosenProfile) => void;
}) => {
  const [name, setName] = useState(session.user.suggestedName ?? "");
  const [portrait, setPortrait] = useState(() => session.user.image ?? randomPortrait());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosenName = name.trim();
  const violation = nameRuleViolation(chosenName);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await identityClient.updateUser({ name: chosenName, image: portrait });
      onChosen({ name: chosenName, portrait });
    } catch (cause) {
      setError(nameRefusal(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5 pt-10">
      <label
        className={cn(
          "flex h-[60px] items-center gap-2 rounded-[18px] border-2 bg-[#15100a] px-4",
          violation ? "border-[#b4533a]" : "border-[#f6ac1d]",
        )}
      >
        <span className="sr-only">Your name</span>
        <input
          type="text"
          value={name}
          maxLength={20}
          autoComplete="nickname"
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          aria-invalid={violation !== null}
          className="min-w-0 flex-1 bg-transparent font-[Lexend] text-[22px] font-extrabold text-[#fff3c4] outline-none placeholder:text-[#6e6148]"
        />
        {violation === null && (
          <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-[#9fd06a]">
            <Check className="size-5" />
          </span>
        )}
      </label>
      {violation && chosenName.length > 0 && <p className="-mt-3 text-[14px] text-[#f08a6a]">Names use {violation}.</p>}
      <div role="radiogroup" aria-label="Portrait" className="grid grid-cols-3 gap-3">
        {IDENTITY_PORTRAITS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={portrait === id}
            aria-label={`Portrait ${id}`}
            onClick={() => setPortrait(id)}
            className={cn(
              "overflow-hidden rounded-2xl border-2",
              portrait === id
                ? "border-[#f6ac1d] shadow-[0_0_16px_rgba(246,172,29,0.55)]"
                : "border-[#46351c] opacity-80",
            )}
          >
            <img src={portraitUrl(id)} alt="" className="aspect-square w-full object-cover" />
          </button>
        ))}
      </div>
      <button type="submit" disabled={pending || violation !== null} className="frontier-primary">
        Continue
      </button>
      {error && <p className="text-center text-[15px] text-[#f08a6a]">{error}</p>}
    </form>
  );
};

const randomPortrait = (): string => IDENTITY_PORTRAITS[Math.floor(Math.random() * IDENTITY_PORTRAITS.length)];
