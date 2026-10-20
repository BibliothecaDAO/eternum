import { SIGN_IN_WORDS } from "@/ui/design-system/kit/words";
import { IDENTITY_PORTRAITS, nameRuleViolation } from "@realms-world/identity";

import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { AppField, AppPortrait } from "@/ui/design-system/kit/app-elements";

/** The name, and under it what the identity service's own rule asks of it while it does not pass. */
export const NameField = ({ name, onName }: { name: string; onName: (name: string) => void }) => (
  <AppField
    label={SIGN_IN_WORDS.yourName}
    type="text"
    value={name}
    maxLength={20}
    autoComplete="nickname"
    onChange={(event) => onName(event.target.value)}
    error={nameRuleViolation(name.trim()) ?? undefined}
  />
);

/** The twelve portraits, the chosen one on the accent ring. */
export const PortraitGrid = ({ chosen, onChoose }: { chosen: string; onChoose: (portrait: string) => void }) => (
  <div role="radiogroup" aria-label={SIGN_IN_WORDS.portrait} className="grid grid-cols-4 gap-2.5">
    {IDENTITY_PORTRAITS.map((id) => (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={chosen === id}
        aria-label={`${SIGN_IN_WORDS.portrait} ${id}`}
        onClick={() => onChoose(id)}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
      >
        <AppPortrait src={playerPortraitUrl(null, id)} name={id} size="fill" own={chosen === id} />
      </button>
    ))}
  </div>
);
