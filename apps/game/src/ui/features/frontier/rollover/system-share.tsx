import { useSystemShare } from "@/shell/share/system-share";
import { HudButton, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { SHARE_WORDS } from "@/ui/design-system/kit/words";

/** A Frontier day's Share, in the HUD's kit: the card through the device's share sheet (useSystemShare). */
export const SystemShare = (props: Parameters<typeof useSystemShare>[0]) => {
  const sheet = useSystemShare(props);
  return (
    <>
      <HudButton kind="primary" icon="share" busy={sheet.making} onClick={sheet.share}>
        {SHARE_WORDS.share}
      </HudButton>
      {sheet.failed && <HudNotice tone="bad" line={SHARE_WORDS.shareFailed} />}
    </>
  );
};
