import { HudButton } from "@/ui/design-system/kit/hud-elements";

interface ActionFooterProps {
  armyType: boolean;
  label: string;
  isLoading: boolean;
  isDisabled: boolean;
  /** Why the button is disabled: the one place the form says it, in a few words under the button. */
  blockedReason: string | null;
  onSubmit: () => void;
  /** Embed mode: render just the button, no surrounding card chrome. */
  embedded?: boolean;
}

export const ActionFooter = ({
  armyType,
  label,
  isLoading,
  isDisabled,
  blockedReason,
  onSubmit,
  embedded = false,
}: ActionFooterProps) => {
  const reason = isDisabled ? blockedReason : null;
  // A grid stretches the sheet's one primary to the form's width.
  const button = (
    <div className="grid">
      <HudButton
        kind="primary"
        icon={armyType ? "people" : "defend"}
        onClick={onSubmit}
        disabled={isDisabled || isLoading}
        aria-busy={isLoading}
      >
        {label}
      </HudButton>
    </div>
  );

  const action = (
    <>
      {button}
      {/* Always one line tall, empty when the button can go: the button never moves as its reason comes and goes. */}
      <p className="mt-1 h-5 truncate px-1 text-hud-label text-hud-muted" role="status" title={reason ?? undefined}>
        {reason}
      </p>
    </>
  );

  if (embedded) return action;

  return <div className="p-1.5 rounded-xl border border-hud-line">{action}</div>;
};
