import type { AspectId } from "@bibliothecadao/types";
import { useState } from "react";

import { useOwnInvite } from "@/shell/share/own-shares";
import type { IconMeaning } from "@/ui/design-system/icon";
import { AppButton, AppNotice } from "@/ui/design-system/kit/app-elements";
import { INVITE_WORDS, SEASON_INVITE_WORDS, TRY_AGAIN } from "@/ui/design-system/kit/words";

export const useSeasonInvite = () => {
  const link = useOwnInvite();
  const aspect = link.aspect;
  const [copied, setCopied] = useState<{ aspect: AspectId | null; state: "copied" | "failed" } | null>(null);
  const copy = () =>
    navigator.clipboard.writeText(link.url("system")).then(
      () => setCopied({ aspect, state: "copied" }),
      () => setCopied({ aspect, state: "failed" }),
    );
  return { aspect, link, copied: copied?.aspect === aspect ? copied.state : null, copy };
};

type SeasonInvite = ReturnType<typeof useSeasonInvite>;

export const SeasonInviteAlerts = ({ invite }: { invite: SeasonInvite }) => (
  <>
    {invite.link.failed && (
      <AppNotice
        tone="bad"
        line={INVITE_WORDS.failed}
        actions={
          <AppButton kind="secondary" onClick={invite.link.retry}>
            {TRY_AGAIN}
          </AppButton>
        }
      />
    )}
    {invite.copied === "failed" && <AppNotice tone="bad" line={INVITE_WORDS.copyFailed} />}
  </>
);

export const CopySeasonInvite = ({
  invite,
  size = "lg",
  icon = "copy",
  label = SEASON_INVITE_WORDS.copy,
  className,
}: {
  invite: SeasonInvite;
  size?: "md" | "lg";
  icon?: IconMeaning;
  label?: string;
  className?: string;
}) => (
  <AppButton
    kind="secondary"
    size={size}
    icon={icon}
    className={className}
    busy={invite.link.code === undefined && !invite.link.failed ? INVITE_WORDS.making : undefined}
    disabled={invite.link.code === undefined}
    onClick={() => void invite.copy()}
  >
    {invite.copied === "copied" ? INVITE_WORDS.copied : label}
  </AppButton>
);
