import { SIGN_IN_CODE_LENGTH, SIGN_IN_CODE_SECONDS } from "@realms-world/identity";
import { useEffect, useState } from "react";

import { Hourglass, Mail } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Chip } from "@/ui/features/frontier/frontier-chips";
import { formatShortClock } from "@/ui/features/frontier/frontier-format";

/**
 * The code step (design o3, second screen): the address the code went to, six boxes that sign in on the sixth digit,
 * and the code's time left. At zero the clock becomes the way to a new code. Tapping the address goes back to change
 * it.
 */
export const CodeStep = ({
  email,
  sentAt,
  pending,
  error,
  onCode,
  onNewCode,
  onChangeEmail,
}: {
  email: string;
  sentAt: number;
  pending: boolean;
  error: string | null;
  /** Signs in with the code; false when it was refused, and the boxes clear for another try. */
  onCode: (code: string) => Promise<boolean>;
  onNewCode: () => void;
  onChangeEmail: () => void;
}) => {
  const [code, setCode] = useState("");
  const secondsLeft = useCodeSecondsLeft(sentAt);

  const type = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, SIGN_IN_CODE_LENGTH);
    setCode(digits);
    if (digits.length === SIGN_IN_CODE_LENGTH) void onCode(digits).then((signedIn) => signedIn || setCode(""));
  };

  return (
    <div className="flex flex-col items-center gap-6 pt-16">
      <Mail className="size-14" />
      <button type="button" onClick={onChangeEmail} className="frontier-title max-w-full truncate">
        {email}
      </button>
      <CodeBoxes code={code} disabled={pending || secondsLeft === 0} onType={type} />
      {secondsLeft > 0 ? (
        <Chip label="Code time left" icon={<Hourglass />} value={formatShortClock(secondsLeft)} />
      ) : (
        <button type="button" onClick={onNewCode} disabled={pending} className="frontier-chip gap-2 px-4 py-1.5">
          <Mail className="size-6" />
          <span className="font-[Lexend] font-extrabold text-[#eadfc8]">New code</span>
        </button>
      )}
      {error && <p className="text-center text-[15px] text-[#f08a6a]">{error}</p>}
    </div>
  );
};

/**
 * Six boxes over one real one-time-code input, so a pasted or autofilled code, a phone's code suggestion and
 * backspace all behave as they do in any code field.
 */
const CodeBoxes = ({
  code,
  disabled,
  onType,
}: {
  code: string;
  disabled: boolean;
  onType: (value: string) => void;
}) => (
  <label className="relative flex gap-2">
    <span className="sr-only">Sign-in code</span>
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      maxLength={SIGN_IN_CODE_LENGTH}
      value={code}
      disabled={disabled}
      onChange={(event) => onType(event.target.value)}
      className="peer absolute inset-0 z-10 w-full cursor-text opacity-0"
    />
    {Array.from({ length: SIGN_IN_CODE_LENGTH }, (_, index) => (
      <span
        key={index}
        aria-hidden
        className={cn(
          "flex h-16 w-12 items-center justify-center rounded-xl border-2 bg-[#15100a] font-[Lexend] text-[30px] font-extrabold text-[#fff3c4]",
          index === code.length
            ? "border-[#f6ac1d] peer-focus:shadow-[0_0_14px_rgba(246,172,29,0.45)]"
            : "border-[#46351c]",
          disabled && "opacity-50",
        )}
      >
        {code[index] ?? ""}
      </span>
    ))}
  </label>
);

/** Seconds until a code sent at `sentAt` stops signing in, by the identity service's own lifetime. */
const useCodeSecondsLeft = (sentAt: number): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return Math.max(0, SIGN_IN_CODE_SECONDS - Math.floor((now - sentAt) / 1000));
};
