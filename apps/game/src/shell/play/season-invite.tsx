import { aspectName, type AspectId } from "@bibliothecadao/types";
import { useState } from "react";

import { useShareLink } from "@/shell/share/own-shares";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { AppButton, AppNotice } from "@/ui/design-system/kit/app-elements";
import { INVITE_WORDS, SEASON_INVITE_WORDS, TRY_AGAIN } from "@/ui/design-system/kit/words";

export const useSeasonInvite = (aspect: AspectId) => {
  const link = useShareLink({ kind: "aspect", chainId: null, gameId: null, moment: aspect });
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);
  const copy = () =>
    navigator.clipboard.writeText(link.url("system")).then(
      () => setCopied("copied"),
      () => setCopied("failed"),
    );
  return { aspect, link, copied, copy };
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

export const SeasonInviteCard = ({ invite }: { invite: SeasonInvite }) => (
  <section data-season-invite className="app-well w-full gap-3 p-4 text-left">
    <span className="flex items-center gap-3">
      <Icon name="people" size={48} />
      <span className="flex flex-col">
        <span className="text-app-heading text-app-ink">{SEASON_INVITE_WORDS.title}</span>
        <span className="text-app-label text-app-muted">{SEASON_INVITE_WORDS.line(aspectName(invite.aspect))}</span>
      </span>
    </span>
    <SeasonInviteAlerts invite={invite} />
  </section>
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
