import { ACCOUNT_DELETION_WORDS, WALLET_WORDS } from "@/ui/design-system/kit/words";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { deleteIdentityAccount } from "@/hooks/context/identity-session";
import { AppButton, AppNotice, AppPanel, AppSetting } from "@/ui/design-system/kit/app-elements";
import { failureSentence } from "@/ui/modules/identity/identity-failures";

import { ShellWindow } from "../frame/shell-window";
import { EmailCodeBoxes, useEmailCode } from "./email-code";
import { DELETE_ACCOUNT_ID } from "./settings-route";

/**
 * Delete account, Settings' last row (Apple 5.1.1(v), Google Play's account deletion policy): it opens the app's sheet,
 * which says what is deleted and what stays before anything is asked, then deletes the account with an emailed code.
 */
export const DeleteAccount = ({ email }: { email: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div id={DELETE_ACCOUNT_ID} className="scroll-mt-4">
      <AppPanel flush>
        <AppSetting icon="trash" name={ACCOUNT_DELETION_WORDS.title} onClick={() => setOpen(true)} />
      </AppPanel>
      {open && (
        <ShellWindow title={ACCOUNT_DELETION_WORDS.title} onClose={() => setOpen(false)}>
          <DeletionSheet email={email} />
        </ShellWindow>
      )}
    </div>
  );
};

/** What deletion does, then the step that confirms it: a code is sent only once the player asks for one. */
const DeletionSheet = ({ email }: { email: string }) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col gap-3 py-2">
      <AppNotice tone="bad" line={ACCOUNT_DELETION_WORDS.intro} />
      <Consequences title={ACCOUNT_DELETION_WORDS.goesTitle} lines={ACCOUNT_DELETION_WORDS.goes} />
      <Consequences title={ACCOUNT_DELETION_WORDS.staysTitle} lines={ACCOUNT_DELETION_WORDS.stays} />
      {confirming ? (
        <DeletionCode email={email} />
      ) : (
        <span>
          <AppButton kind="secondary" tone="bad" icon="mail" onClick={() => setConfirming(true)}>
            {ACCOUNT_DELETION_WORDS.sendCode}
          </AppButton>
        </span>
      )}
    </div>
  );
};

const Consequences = ({ title, lines }: { title: string; lines: readonly string[] }) => (
  <section className="flex flex-col gap-1.5">
    <h3 className="text-app-strong text-app-ink">{title}</h3>
    <ul className="list-disc space-y-1 pl-5 text-app-body text-app-muted">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  </section>
);

/** The emailed code deletes the account the moment its sixth digit lands; the player lands on Play, signed out. */
const DeletionCode = ({ email }: { email: string }) => {
  const navigate = useNavigate();
  const entry = useEmailCode(
    email,
    async (code) => {
      await deleteIdentityAccount(code);
      navigate("/", { replace: true });
    },
    (cause) => failureSentence("delete", cause),
  );
  return (
    <>
      <p className="text-app-body text-app-ink">{ACCOUNT_DELETION_WORDS.confirm}</p>
      <EmailCodeBoxes entry={entry} />
      {entry.error && <p className="text-app-body text-app-bad">{entry.error}</p>}
      <span>
        <AppButton kind="quiet" icon="refresh" onClick={entry.resend}>
          {WALLET_WORDS.newCode}
        </AppButton>
      </span>
    </>
  );
};
