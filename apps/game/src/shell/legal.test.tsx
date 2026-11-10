import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";

import { AccountDeletionPage, PrivacyPage, TermsPage } from "./legal";

/** The document's own text, without the frame around it (the footer links realms.world, the DAO's site). */
const textOf = (page: React.ReactElement) => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<MemoryRouter>{page}</MemoryRouter>);
  return container.querySelector("article")!.textContent!.replace(/\s+/g, " ");
};

it("names the live game and its guides, and no retired site", () => {
  for (const text of [textOf(<TermsPage />), textOf(<PrivacyPage />)]) {
    expect(text).toContain("the game at play.realms.party");
    expect(text).toContain("guides at docs.realms.party");
    expect(text).not.toMatch(/realms\.world|Realms World/);
  }
});

it("states the payout wallet change hold and where unclaimed LORDS go, as the co-signer and the ledger do", () => {
  const terms = textOf(<TermsPage />);
  expect(terms).toContain("Each payout is made only once its checks pass, so any payout may wait or be refused.");
  expect(terms).toContain("The first payout wallet seen for your account has no wallet change wait.");
  expect(terms).toContain(
    "its first Frontier payout waits 24 hours, counted from when that payout is first requested, not from when the wallet is linked.",
  );
  expect(terms).not.toMatch(/paid at once/i);
  expect(terms).toContain(
    "If no wallet is linked by a Frontier season's claim deadline, its unpaid $LORDS return to the treasury.",
  );
});

it("claims no error reports or analytics, which the live app does not send", () => {
  const privacy = textOf(<PrivacyPage />);
  expect(privacy).not.toMatch(/Sentry|analytics|error data|pages visited/i);
  expect(privacy).toContain("Your IP address and your browser's user agent, stored with each sign-in session");
});

it("says news emails may come and how to stop them, as the news email's stop link does", () => {
  expect(textOf(<PrivacyPage />)).toContain(
    "We may occasionally email you news about seasons you can play. Every such email has a link to stop them, and you can also ask us to stop them through the contacts below.",
  );
});

it("explains account deletion in public, links to Settings' row, and says what stays", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <MemoryRouter>
      <AccountDeletionPage />
    </MemoryRouter>,
  );
  const page = container.querySelector("article")!;
  expect(page.querySelector('a[href="/profile/settings#delete-account"]')?.textContent).toBe("Open Settings");
  const text = page.textContent!.replace(/\s+/g, " ");
  expect(text).toContain("Enter the code we email you.");
  expect(text).toContain("Your notification settings and push alerts on every device");
  expect(text).toContain("email recovery ends");
  expect(text).toContain("Ratings stay on chain under the wallets that played.");
  expect(textOf(<PrivacyPage />)).toContain("You can delete your Realms account yourself, in Settings.");
});
