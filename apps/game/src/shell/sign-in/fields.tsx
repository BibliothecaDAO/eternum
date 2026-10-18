import { SIGN_IN_WORDS } from "@/ui/design-system/kit/words";
import { IDENTITY_PORTRAITS, SIGN_IN_CODE_LENGTH } from "@realms-world/identity";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Field } from "@/ui/design-system/kit/field";
import { Portrait } from "@/ui/design-system/kit/portrait";

/**
 * Six boxes over one real one-time-code input, so a pasted or autofilled code, a phone's code suggestion and backspace
 * all behave as in any code field. A refused code turns the boxes ember until the player types again.
 */
export const CodeBoxes = ({
  code,
  refused,
  disabled,
  onType,
}: {
  code: string;
  refused: boolean;
  disabled: boolean;
  onType: (value: string) => void;
}) => (
  <label className="relative flex justify-center gap-2">
    <span className="sr-only">{SIGN_IN_WORDS.code}</span>
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      maxLength={SIGN_IN_CODE_LENGTH}
      value={code}
      disabled={disabled}
      aria-invalid={refused}
      onChange={(event) => onType(event.target.value)}
      className="peer absolute inset-0 z-10 w-full cursor-text opacity-0"
    />
    {Array.from({ length: SIGN_IN_CODE_LENGTH }, (_, index) => (
      <span
        key={index}
        aria-hidden
        className={cn(
          "flex h-16 w-12 items-center justify-center rounded-control border-2 bg-kit-plate font-body text-title font-extrabold text-kit-cream",
          refused ? "border-kit-red" : index === code.length ? "border-kit-peach" : "border-kit-line",
          disabled && "opacity-50",
        )}
      >
        {code[index] ?? ""}
      </span>
    ))}
  </label>
);

/** The name, ticked while it passes the identity service's own rule; the field turns ember when it does not. */
export const NameField = ({
  name,
  valid,
  onName,
}: {
  name: string;
  valid: boolean;
  onName: (name: string) => void;
}) => (
  <Field
    size="lg"
    valid={valid}
    invalid={!valid}
    type="text"
    value={name}
    maxLength={20}
    autoComplete="nickname"
    onChange={(event) => onName(event.target.value)}
    aria-label={SIGN_IN_WORDS.yourName}
    className="font-body text-xl font-bold"
  />
);

/** The twelve portraits, the chosen one on the peach ring. */
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
        className={cn(
          "overflow-hidden rounded-full border-[3px]",
          chosen === id ? "border-kit-peach" : "border-kit-line opacity-80",
        )}
      >
        {/* The ring is the button's, so the focus ring and the tap take the whole circle. */}
        <Portrait portrait={id} className="aspect-square w-full" />
      </button>
    ))}
  </div>
);
